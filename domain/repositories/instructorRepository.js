const db = require('../../infrastructure/database/db');

class InstructorRepository {

    async findAll() {
        // ✅ SOLUCIÓN: Obtener los instructores desde la tabla 'users' filtrando por rol.
        const { rows } = await db.query(`SELECT id, name, email, role FROM users WHERE role = 'instructor' ORDER BY name`);
        return rows;
    }

    async findById(id) {
        // ✅ SOLUCIÓN: Obtener un instructor específico por su ID de usuario.
        const { rows } = await db.query(`SELECT id, name, email, role FROM users WHERE id = $1 AND role = 'instructor'`, [id]);
        return rows[0];
    }
}

module.exports = InstructorRepository;