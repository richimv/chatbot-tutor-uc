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
            row.usage_count,    // DB envía snake_case
            row.max_free_limit  // DB envía snake_case
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

    async create(email, password, name, role = 'student', externalId = null) {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        // ✅ MEJORA: Permitir ID externo (Supabase) para mantener sincronización
        const id = externalId || crypto.randomUUID();

        const queryText = 'SELECT * FROM sp_register_user($1, $2, $3, $4, $5)';
        const values = [id, name, email.toLowerCase(), passwordHash, role];

        const res = await db.query(queryText, values);
        return this._mapRowToUser(res.rows[0]);
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

        // ✅ CRÍTICO: Actualizar contadores (Soporta userData.usageCount o usage_count)
        const usage = userData.usageCount !== undefined ? userData.usageCount : userData.usage_count;
        if (usage !== undefined) { fields.push(`usage_count = $${idx++}`); values.push(usage); }

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