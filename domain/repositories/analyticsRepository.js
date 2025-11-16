const db = require('../../infrastructure/database/db');

class AnalyticsRepository {
    async getSearchHistory() {
        const { rows } = await db.query('SELECT query, results_count, is_educational_query, created_at FROM search_history');
        // Mapear para que coincida con el formato que espera el servicio de ML
        return rows.map(row => ({
            query: row.query,
            resultsCount: row.results_count,
            isEducationalQuery: row.is_educational_query,
            timestamp: row.created_at
        }));
    }

    async getFeedback() {
        const { rows } = await db.query('SELECT query, response, is_helpful, created_at FROM feedback');
        return rows; // Asumiendo que el formato es compatible
    }
}

module.exports = AnalyticsRepository;