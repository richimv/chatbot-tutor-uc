const User = require('../models/user');
const bcrypt = require('bcryptjs');
const db = require('../../infrastructure/database/db');
const crypto = require('crypto');

class UserRepository {
    // Helper privado para mapear fila de DB a Modelo
    _mapRowToUser(row) {
        if (!row) return null;
        return new User(
            row.id,
            row.email,
            row.password_hash,
            row.role,
            row.name,
            row.subscription_status,
            row.payment_id,
            row.usage_count,
            row.max_free_limit,
            row.subscription_tier,
            row.subscription_expires_at,
            row.daily_simulator_usage,
            row.daily_ai_usage,
            row.daily_arena_usage,
            row.last_usage_reset
        );
    }

    async findByEmail(email) {
        const res = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
        return this._mapRowToUser(res.rows[0]);
    }

    async findById(id) {
        const res = await db.query('SELECT * FROM users WHERE id = $1', [id]);
        return this._mapRowToUser(res.rows[0]);
    }

    async findByRole(role) {
        const res = await db.query(`SELECT * FROM users WHERE role = $1 ORDER BY name`, [role]);
        return res.rows.map(row => this._mapRowToUser(row));
    }

    async create(userData) {
        const { email, name, role = 'student', id: externalId = null } = userData;
        
        const placeholderPassword = crypto.randomBytes(32).toString('hex');
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(placeholderPassword, salt);

        const id = externalId || crypto.randomUUID();

        console.log(`💾 Persistiendo usuario en DB local: ${email} (${id})`);

        try {
            // Intentar usar el Procedimiento Almacenado (Optimizado y Atómico)
            const queryText = 'SELECT * FROM sp_register_user($1, $2, $3, $4, $5)';
            const values = [id, name, email.toLowerCase(), passwordHash, role];
            const res = await db.query(queryText, values);
            
            if (res.rows.length > 0) return this._mapRowToUser(res.rows[0]);
        } catch (dbError) {
            // 🛡️ FALLBACK SENIOR: Si la función no existe (42883) o hay conflicto de email, lo hacemos manual.
            if (dbError.code === '42883' || dbError.message.includes('function sp_register_user')) {
                console.warn('⚠️ sp_register_user no encontrada. Usando SQL manual con resolución de conflictos...');
                
                // Estrategia: Intentar insertar por ID, pero si el EMAIL ya existe, actualizar el registro existente.
                const manualQuery = `
                    INSERT INTO public.users (id, name, email, password_hash, role, subscription_status, subscription_tier, usage_count, max_free_limit, last_usage_reset, updated_at)
                    VALUES ($1, $2, $3, $4, $5, 'pending', 'free', 0, 50, CURRENT_DATE, NOW())
                    ON CONFLICT (email) 
                    DO UPDATE SET 
                        id = EXCLUDED.id, -- Sincronizar ID de Supabase si el correo ya existía
                        name = EXCLUDED.name,
                        updated_at = NOW()
                    RETURNING *;
                `;
                const manualRes = await db.query(manualQuery, [id, name, email.toLowerCase(), passwordHash, role]);
                return this._mapRowToUser(manualRes.rows[0]);
            }
            
            // Si el error es específicamente de duplicado de email (23505) y no usamos el fallback arriba
            if (dbError.code === '23505') {
                 console.log('🔄 Conflicto de email detectado. Vinculando ID de Google a cuenta existente...');
                 const updateQuery = 'UPDATE public.users SET id = $1, name = $2, updated_at = NOW() WHERE lower(email) = $3 RETURNING *';
                 const res = await db.query(updateQuery, [id, name, email.toLowerCase()]);
                 return this._mapRowToUser(res.rows[0]);
            }

            console.error('❌ Error crítico en persistencia de usuario:', dbError.message);
            throw dbError;
        }
    }

    async updatePassword(userId, newPasswordHash) {
        const res = await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newPasswordHash, userId]);
        if (res.rowCount === 0) throw new Error('Usuario no encontrado.');
        return { success: true };
    }

    // ✅ ACTUALIZACIÓN ROBUSTA: Soporta camelCase y snake_case
    async update(id, userData) {
        const fields = [];
        const values = [];
        let idx = 1;

        // Mapeo inteligente de campos
        if (userData.name !== undefined) { fields.push(`name = $${idx++}`); values.push(userData.name); }
        if (userData.email !== undefined) { fields.push(`email = $${idx++}`); values.push(userData.email); }
        if (userData.role !== undefined) { fields.push(`role = $${idx++}`); values.push(userData.role); }

        // Manejo de suscripción
        if (userData.subscriptionStatus !== undefined) { fields.push(`subscription_status = $${idx++}`); values.push(userData.subscriptionStatus); }
        else if (userData.subscription_status !== undefined) { fields.push(`subscription_status = $${idx++}`); values.push(userData.subscription_status); }

        // Manejo de Payment ID
        if (userData.paymentId !== undefined) { fields.push(`payment_id = $${idx++}`); values.push(userData.paymentId); }
        else if (userData.payment_id !== undefined) { fields.push(`payment_id = $${idx++}`); values.push(userData.payment_id); }

        // Manejo de Tier
        if (userData.subscriptionTier !== undefined) { fields.push(`subscription_tier = $${idx++}`); values.push(userData.subscriptionTier); }
        else if (userData.subscription_tier !== undefined) { fields.push(`subscription_tier = $${idx++}`); values.push(userData.subscription_tier); }

        // Manejo de Expiración
        if (userData.subscriptionExpiresAt !== undefined) { fields.push(`subscription_expires_at = $${idx++}`); values.push(userData.subscriptionExpiresAt); }
        else if (userData.subscription_expires_at !== undefined) { fields.push(`subscription_expires_at = $${idx++}`); values.push(userData.subscription_expires_at); }

        // ✅ CRÍTICO: Actualizar contadores (Soporta userData.usageCount o usage_count)
        const usage = userData.usageCount !== undefined ? userData.usageCount : userData.usage_count;
        if (usage !== undefined) { fields.push(`usage_count = $${idx++}`); values.push(usage); }

        const simUsage = userData.dailySimulatorUsage !== undefined ? userData.dailySimulatorUsage : userData.daily_simulator_usage;
        if (simUsage !== undefined) { fields.push(`daily_simulator_usage = $${idx++}`); values.push(simUsage); }

        const aiUsage = userData.dailyAiUsage !== undefined ? userData.dailyAiUsage : userData.daily_ai_usage;
        if (aiUsage !== undefined) { fields.push(`daily_ai_usage = $${idx++}`); values.push(aiUsage); }

        const arenaUsage = userData.dailyArenaUsage !== undefined ? userData.dailyArenaUsage : userData.daily_arena_usage;
        if (arenaUsage !== undefined) { fields.push(`daily_arena_usage = $${idx++}`); values.push(arenaUsage); }

        const lastReset = userData.lastUsageReset !== undefined ? userData.lastUsageReset : userData.last_usage_reset;
        if (lastReset !== undefined) { fields.push(`last_usage_reset = $${idx++}`); values.push(lastReset); }

        if (fields.length === 0) return this.findById(id);

        values.push(id);
        const query = `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;

        const res = await db.query(query, values);
        if (res.rows.length === 0) throw new Error(`Usuario ${id} no encontrado.`);

        return this._mapRowToUser(res.rows[0]);
    }

    async delete(id) {
        const { rowCount } = await db.query('DELETE FROM users WHERE id = $1', [id]);
        if (rowCount === 0) throw new Error(`Usuario no encontrado.`);
        return { success: true };
    }
}

// Semilla admin (simplificada)
const seedAdminUser = async () => {
    try {
        const adminEmail = 'admin@uc.edu';
        const res = await db.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
        if (res.rows.length === 0) {
            console.log('🌱 Creando Admin...');
            const id = crypto.randomUUID();
            const hash = await bcrypt.hash('admin123', 10);
            await db.query('INSERT INTO users(id, name, email, password_hash, role) VALUES($1, $2, $3, $4, $5)', [id, 'Admin UC', adminEmail, hash, 'admin']);
        }
    } catch (error) { console.warn('⚠️ Seed Admin:', error.message); }
};
seedAdminUser();

module.exports = UserRepository;