const db = require('../../infrastructure/database/db');
const { normalizeText } = require('../utils/textUtils');

/**
 * Repositorio para manejar las operaciones de datos de las carreras desde Supabase.
 */
class CareerRepository {

    async findAll() {
        const { rows } = await db.query('SELECT * FROM careers ORDER BY name');
        return rows;
    }

    async findById(id) {
        const { rows } = await db.query('SELECT * FROM careers WHERE id = $1', [id]);
        return rows[0];
    }

    /**
     * Busca una carrera por su nombre (usado por el LLM).
     * @param {string} query El nombre de la carrera a buscar.
     * @returns {Promise<object|null>} El objeto de la carrera encontrada o null.
     */
    async search(query) {
        const normalizedQuery = normalizeText(query);
        const { rows } = await db.query(
            "SELECT * FROM careers WHERE unaccent(name) ILIKE unaccent($1) LIMIT 1",
            [`%${normalizedQuery}%`]
        );
        return rows[0] || null;
    }

    async create(careerData) {
        const { name, curriculumUrl, description, area } = careerData;
        // ✅ SOLUCIÓN TEMPORAL: Generar un 'career_id' de texto para satisfacer la restricción NOT NULL.
        // La solución ideal es eliminar la columna 'career_id' de la tabla 'careers' en la base de datos.
        const tempCareerId = `CAREER_${Date.now()}`;
        const { rows } = await db.query(
            'INSERT INTO careers (career_id, name, curriculum_url, description, area) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [tempCareerId, name, curriculumUrl, description, area]
        );
        return rows[0];
    }

    async update(id, careerData) {
        const { name, curriculumUrl, description, area } = careerData;
        const { rows } = await db.query(
            // ✅ SOLUCIÓN: Eliminar 'updated_at' y buscar por el 'id' numérico.
            'UPDATE careers SET name = $1, curriculum_url = $2, description = $3, area = $4 WHERE id = $5 RETURNING *',
            [name, curriculumUrl || null, description, area, id]
        );
        if (rows.length === 0) {
            throw new Error(`Carrera con ID ${id} no encontrada.`);
        }
        return rows[0];
    }

    async delete(id) {
        const { rowCount } = await db.query('DELETE FROM careers WHERE id = $1', [id]);
        if (rowCount === 0) {
            throw new Error(`Carrera con ID ${id} no encontrada para eliminar.`);
        }
        return { success: true };
    }
}

module.exports = CareerRepository;