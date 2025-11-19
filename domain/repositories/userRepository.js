const User = require('../models/user');
const bcrypt = require('bcryptjs');
const db = require('../../infrastructure/database/db'); // ✅ 1. Importar el pool de conexiones
const crypto = require('crypto');

class UserRepository {
    async findByEmail(email) {
        const res = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
        if (res.rows.length === 0) return null;
        // Mapear el resultado de la BD a nuestro objeto de dominio
        const row = res.rows[0]; // ✅ SOLUCIÓN: Usar el 'id' numérico de la BD, no el 'user_id' de texto.
        return new User(row.id, row.email, row.password_hash, row.role, row.name);
    }

    async findById(id) {
        const res = await db.query('SELECT * FROM users WHERE id = $1', [id]);
        if (res.rows.length === 0) return null;
        const row = res.rows[0]; // ✅ SOLUCIÓN: Usar el 'id' numérico de la BD.
        return new User(row.id, row.email, row.password_hash, row.role, row.name);
    }

    // ✅ NUEVO: Método para encontrar todos los usuarios de un rol específico.
    async findByRole(role) {
        const res = await db.query(`SELECT * FROM users WHERE role = $1 ORDER BY name`, [role]);
        // ✅ MEJORA: Devolver un array de instancias del modelo User para mantener la consistencia.
        return res.rows.map(row => new User(row.id, row.email, row.password_hash, row.role, row.name));
    }

    async create(email, password, name, role = 'student') {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        const id = crypto.randomUUID();
        // ✅ SOLUCIÓN: No insertar 'user_id', la BD genera el 'id' numérico.
        const queryText = 'INSERT INTO users(id, name, email, password_hash, role) VALUES($1, $2, $3, $4, $5) RETURNING *';
        const values = [id, name, email.toLowerCase(), passwordHash, role];

        const res = await db.query(queryText, values);
        const row = res.rows[0];
        return new User(row.id, row.email, row.password_hash, row.role, row.name);
    }

    // ✅ NUEVO: Método para actualizar solo la contraseña.
    async updatePassword(userId, newPasswordHash) {
        const res = await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newPasswordHash, userId]);
        if (res.rowCount === 0) {
            throw new Error('No se pudo actualizar la contraseña, usuario no encontrado.');
        }
        return { success: true };
    }

    // ✅ NUEVO: Método para actualizar datos de un usuario.
    async update(id, userData) {
        const { name, email, role } = userData;
        // ✅ MEJORA: El rol ahora es parte del SET, no del WHERE, permitiendo cambiarlo.
        const res = await db.query(
            'UPDATE users SET name = $1, email = $2, role = $3 WHERE id = $4 RETURNING *',
            [name, email, role, id]
        );
        if (res.rows.length === 0) {
            throw new Error(`Usuario con ID ${id} y rol ${role} no encontrado.`);
        }
        return res.rows[0];
    }

    // ✅ NUEVO: Método para eliminar un usuario.
    async delete(id) {
        const { rowCount } = await db.query('DELETE FROM users WHERE id = $1', [id]);
        if (rowCount === 0) {
            throw new Error(`Usuario con ID ${id} no encontrado para eliminar.`);
        }
        return { success: true };
    }
}

 // --- Sembrar la base de datos con un usuario admin si no existe ---
const seedAdminUser = async () => {
    try {
        const adminEmail = 'admin@uc.edu';
        // Verificar directamente en la base de datos
        const res = await db.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
        
        const adminPassword = 'admin123';
        const adminSalt = await bcrypt.genSalt(10);
        const adminPasswordHash = await bcrypt.hash(adminPassword, adminSalt);

        if (res.rows.length === 0) {
            console.log('🌱 Sembrando usuario administrador en PostgreSQL...');
            const id = crypto.randomUUID();
            const name = 'Admin UC';
            const role = 'admin';
            await db.query(
                'INSERT INTO users(id, name, email, password_hash, role) VALUES($1, $2, $3, $4, $5)',
                [id, name, adminEmail, adminPasswordHash, role]
            );
            console.log('✅ Usuario administrador CREADO en la base de datos PostgreSQL.');
        } else {
            // ✅ SOLUCIÓN: Si el usuario ya existe, no hacer nada para no sobrescribir la contraseña.
            console.log('✅ Usuario administrador ya existe.');
        }

        // ✅ SOLUCIÓN: Se ha eliminado la creación automática del usuario de prueba 'morales@uc.edu'
        // para limpiar los logs de inicio, como se solicitó.

    } catch (error) {
        // Puede fallar si la tabla aún no existe durante la primera inicialización, es seguro ignorarlo en ese caso.
        console.warn('⚠️ Advertencia al sembrar usuario admin (puede ser normal en el primer arranque):', error.message);
    }
};

seedAdminUser(); // Ejecutar la función de sembrado al iniciar la aplicación

module.exports = UserRepository;