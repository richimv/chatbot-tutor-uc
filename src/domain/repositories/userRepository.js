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
            0, // daily_arena_usage removed
            row.last_usage_reset,
            row.last_name_change_at,
            row.monthly_flashcards_usage,
            row.daily_import_usage,
            row.last_free_renewal,
            row.daily_rag_usage,
            row.avatar_url
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

    /**
     * Renueva las vidas semanales de un usuario elegible de forma atómica.
     * La regla de negocio se orquesta desde UsageService; el repositorio
     * mantiene aquí el acceso SQL a la tabla users.
     *
     * @param {string} userId - UUID del usuario
     * @returns {Promise<boolean>} true si se actualizó la fila
     */
    async renewWeeklyLivesIfNeeded(userId) {
        const result = await db.query(`
            UPDATE public.users
            SET usage_count = 0,
                max_free_limit = 10,
                last_free_renewal = CURRENT_TIMESTAMP
            WHERE id = $1
              AND subscription_tier = 'free'
              AND (
                   last_free_renewal IS NULL
                   OR (last_free_renewal AT TIME ZONE 'America/Lima')::date
                      <= ((NOW() AT TIME ZONE 'America/Lima') - INTERVAL '7 days')::date
              )
        `, [userId]);

        return result.rowCount > 0;
    }

    /**
     * Reserva vidas gratuitas con una única operación condicional para impedir
     * que solicitudes concurrentes sobrepasen el límite.
     */
    async consumeFreeUsage(userId, amount = 1) {
        const result = await db.query(`
            UPDATE public.users
            SET usage_count = COALESCE(usage_count, 0) + $2
            WHERE id = $1
              AND COALESCE(usage_count, 0) + $2 <= COALESCE(max_free_limit, 10)
            RETURNING usage_count, COALESCE(max_free_limit, 10) AS max_free_limit
        `, [userId, amount]);

        if (result.rows.length > 0) {
            return {
                allowed: true,
                usage: result.rows[0].usage_count,
                limit: result.rows[0].max_free_limit
            };
        }

        const current = await db.query(`
            SELECT COALESCE(usage_count, 0) AS usage_count,
                   COALESCE(max_free_limit, 10) AS max_free_limit
            FROM public.users
            WHERE id = $1
        `, [userId]);

        if (current.rows.length === 0) throw new Error('Usuario no encontrado');
        return {
            allowed: false,
            usage: current.rows[0].usage_count,
            limit: current.rows[0].max_free_limit
        };
    }

    async findByRole(role) {
        const res = await db.query(`SELECT * FROM users WHERE role = $1 ORDER BY name`, [role]);
        return res.rows.map(row => this._mapRowToUser(row));
    }

    async create(userData) {
        const { email, name, role = 'student', id: externalId = null, avatar_url = null } = userData;
        
        const placeholderPassword = crypto.randomBytes(32).toString('hex');
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(placeholderPassword, salt);

        const id = externalId || crypto.randomUUID();

        // console.log(`💾 Persistiendo usuario en DB local: ${email} (${id})`);

        try {
            // Intentar usar el Procedimiento Almacenado (Optimizado y Atómico)
            const queryText = 'SELECT * FROM sp_register_user($1, $2, $3, $4, $5, $6)';
            const values = [id, name, email.toLowerCase(), passwordHash, role, avatar_url];
            const res = await db.query(queryText, values);
            
            if (res.rows.length > 0) return this._mapRowToUser(res.rows[0]);
        } catch (dbError) {
            // 🛡️ FALLBACK SENIOR: Si la función no existe (42883) o hay conflicto de email, lo hacemos manual.
            if (dbError.code === '42883' || dbError.message.includes('function sp_register_user')) {
                console.warn('⚠️ sp_register_user no encontrada. Usando SQL manual con resolución de conflictos...');
                
                // Estrategia: Intentar insertar por ID, pero si el EMAIL ya existe, actualizar el registro existente.
                const manualQuery = `
                    INSERT INTO public.users (id, name, email, password_hash, role, avatar_url, subscription_status, subscription_tier, usage_count, max_free_limit, last_usage_reset, last_free_renewal, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'free', 0, 10, CURRENT_DATE, NOW(), NOW())
                    ON CONFLICT (email) 
                    DO UPDATE SET 
                        id = EXCLUDED.id,
                        role = CASE 
                            WHEN EXCLUDED.role = 'admin' THEN 'admin'
                            ELSE public.users.role
                        END,
                        avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
                        updated_at = NOW()
                    RETURNING *;
                `;
                const manualRes = await db.query(manualQuery, [id, name, email.toLowerCase(), passwordHash, role, avatar_url]);
                return this._mapRowToUser(manualRes.rows[0]);
            }
            
            // Si el error es específicamente de duplicado de email (23505) y no usamos el fallback arriba
             if (dbError.code === '23505') {
                  const updateQuery = `
                    UPDATE public.users 
                    SET id = $1, avatar_url = COALESCE($3, avatar_url), updated_at = NOW() 
                    WHERE lower(email) = $2
                    RETURNING *;
                  `;
                  const updateRes = await db.query(updateQuery, [id, email.toLowerCase(), avatar_url]);
                  return this._mapRowToUser(updateRes.rows[0]);
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

        const ragUsage = userData.dailyRagUsage !== undefined ? userData.dailyRagUsage : userData.daily_rag_usage;
        if (ragUsage !== undefined) { fields.push(`daily_rag_usage = $${idx++}`); values.push(ragUsage); }



        const lastReset = userData.lastUsageReset !== undefined ? userData.lastUsageReset : userData.last_usage_reset;
        if (lastReset !== undefined) { fields.push(`last_usage_reset = $${idx++}`); values.push(lastReset); }

        const monthlyFlashcardsUsage = userData.monthlyFlashcardsUsage !== undefined ? userData.monthlyFlashcardsUsage : userData.monthly_flashcards_usage;
        if (monthlyFlashcardsUsage !== undefined) { fields.push(`monthly_flashcards_usage = $${idx++}`); values.push(monthlyFlashcardsUsage); }

        const dailyImportUsage = userData.dailyImportUsage !== undefined ? userData.dailyImportUsage : userData.daily_import_usage;
        if (dailyImportUsage !== undefined) { fields.push(`daily_import_usage = $${idx++}`); values.push(dailyImportUsage); }

        const lastNameChange = userData.lastNameChangeAt !== undefined ? userData.lastNameChangeAt : userData.last_name_change_at;
        if (lastNameChange !== undefined) { fields.push(`last_name_change_at = $${idx++}`); values.push(lastNameChange); }

        const lastFreeRenewal = userData.lastFreeRenewal !== undefined ? userData.lastFreeRenewal : userData.last_free_renewal;
        if (lastFreeRenewal !== undefined) { fields.push(`last_free_renewal = $${idx++}`); values.push(lastFreeRenewal); }

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



module.exports = UserRepository;
