const db = require('../../infrastructure/database/db');

class AnalyticsService {
    /**
     * Registra una consulta de búsqueda en la base de datos.
     * @param {string} query La consulta del usuario.
     * @param {Array} results Los resultados directos encontrados.
     * @param {boolean} isEducationalQuery Si la consulta es de tipo pregunta.
     * @param {number} [userId=null] El ID numérico del usuario de la tabla 'users'.
     */
    async recordSearchWithIntent(query, results, isEducationalQuery, userId = null) {
        console.log(`📊 Registrando búsqueda en BD: "${query}"`);
        try {
            const queryText = `
                INSERT INTO search_history(query, results_count, is_educational_query, user_id)
                VALUES($1, $2, $3, $4)
            `;
            const values = [query, results.length, isEducationalQuery, userId];
            await db.query(queryText, values);
        } catch (error) {
            console.error('❌ Error al registrar la búsqueda en la base de datos:', error);
            // No detenemos la aplicación, solo registramos el error.
        }
    }

    /**
     * Registra el feedback del usuario sobre una respuesta del chatbot.
     * @param {string} query La pregunta original del usuario.
     * @param {string} response La respuesta que dio el chatbot.
     * @param {boolean} isHelpful Si el usuario marcó la respuesta como útil.
     * @param {number} [userId=null] El ID numérico del usuario de la tabla 'users'.
     */
    async recordFeedback(query, response, isHelpful, userId = null) {
        console.log(`📊 Registrando feedback en BD para la consulta: "${query}"`);
        try {
            const queryText = `
                INSERT INTO feedback(query, response, is_helpful, user_id)
                VALUES($1, $2, $3, $4)
            `;
            const values = [query, response, isHelpful, userId];
            await db.query(queryText, values);
        } catch (error) {
            console.error('❌ Error al registrar el feedback en la base de datos:', error);
        }
    }

    /**
     * Obtiene todos los datos de analítica para el servicio de ML.
     * Esta función reemplaza la lectura directa del archivo JSON por parte de Python.
     * @returns {Promise<object>}
     */
    async getAnalyticsForML() {
        try {
            const searchHistoryRes = await db.query('SELECT query, results_count, created_at FROM search_history ORDER BY created_at DESC LIMIT 1000');
            const feedbackRes = await db.query('SELECT query, response, is_helpful, created_at FROM feedback ORDER BY created_at DESC LIMIT 1000');

            return {
                searchHistory: searchHistoryRes.rows,
                feedback: feedbackRes.rows
            };
        } catch (error) {
            console.error('❌ Error al obtener datos de analítica para ML:', error);
            return { searchHistory: [], feedback: [] };
        }
    }
}

module.exports = AnalyticsService;
