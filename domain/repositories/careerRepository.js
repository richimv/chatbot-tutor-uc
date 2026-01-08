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
        const { name, area, image_url } = careerData;
        // ✅ SOLUCIÓN TEMPORAL: Generar un 'career_id' de texto para satisfacer la restricción NOT NULL.
        // La solución ideal es eliminar la columna 'career_id' de la tabla 'careers' en la base de datos.
        const tempCareerId = `CAREER_${Date.now()}`;

        // ✅ FIX: Incluir image_url en la inserción
        const { rows } = await db.query(
            'INSERT INTO careers (career_id, name, area, image_url) VALUES ($1, $2, $3, $4) RETURNING *',
            [tempCareerId, name, area, image_url]
        );
        return rows[0];
    }

    async update(id, careerData) {
        const { name, area, image_url } = careerData;

        // ✅ FIX: Incluir image_url en la actualización si viene definido
        // Al igual que en Courses, si image_url está presente, lo actualizamos.
        let query = 'UPDATE careers SET name = $1, area = $2';
        const params = [name, area];

        if (image_url !== undefined) {
            query += ', image_url = $3';
            params.push(image_url);
            query += ' WHERE id = $4 RETURNING *';
            params.push(id);
        } else {
            query += ' WHERE id = $3 RETURNING *';
            params.push(id);
        }

        const { rows } = await db.query(query, params);

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