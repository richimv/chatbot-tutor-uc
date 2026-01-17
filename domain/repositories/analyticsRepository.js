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

    /**
     * Obtiene el historial de búsquedas agrupado por día para los top 5 términos.
     * @param {number} days Número de días hacia atrás.
     */
    async getSearchHistoryTimeSeries(days) {
        // 1. Identificar los Top 5 términos en el periodo
        const topTermsQuery = `
            SELECT query
            FROM search_history
            WHERE created_at >= NOW() - INTERVAL '${days} days'
            GROUP BY query
            ORDER BY COUNT(*) DESC
            LIMIT 5
        `;

        // 2. Obtener la serie temporal solo para esos términos
        const timeSeriesQuery = `
            WITH TopTerms AS (${topTermsQuery})
            SELECT DATE(created_at) as date, query, COUNT(*) as count
            FROM search_history
            WHERE created_at >= NOW() - INTERVAL '${days} days'
            AND query IN (SELECT query FROM TopTerms)
            GROUP BY DATE(created_at), query
            ORDER BY date ASC;
        `;

        const { rows } = await db.query(timeSeriesQuery);
        return rows;
    }

    /**
     * ✅ NUEVO: Obtiene la serie temporal para una lista específica de queries.
     * @param {string[]} queries Lista de términos a consultar.
     * @param {number} days Días hacia atrás.
     */
    async getTimeSeriesForQueries(queries, days) {
        if (!queries || queries.length === 0) return [];

        // Construir la cláusula IN dinámicamente ($2, $3, ...)
        // $1 es days. Los queries empiezan en $2.
        const placeholders = queries.map((_, i) => `$${i + 2}`).join(', ');

        const query = `
            SELECT DATE(created_at) as date, query, COUNT(*) as count
            FROM search_history
            WHERE created_at >= NOW() - INTERVAL '$1 days'
            AND query IN (${placeholders})
            GROUP BY DATE(created_at), query
            ORDER BY date ASC;
        `;

        // Reemplazar el intervalo directamente porque pg param no funciona bien dentro de INTERVAL '... days'
        // Mejor usar sintaxis ::interval
        const safeQuery = `
            SELECT DATE(created_at) as date, query, COUNT(*) as count
            FROM search_history
            WHERE created_at >= NOW() - ($1 || ' days')::interval
            AND query IN (${placeholders})
            GROUP BY DATE(created_at), query
            ORDER BY date ASC;
        `;

        const { rows } = await db.query(safeQuery, [days, ...queries]);
        return rows;
    }
    async recordView(entityType, entityId, userId) {
        const query = `
            INSERT INTO page_views(entity_type, entity_id, user_id, created_at)
            VALUES($1, $2, $3, NOW())
        `;
        await db.query(query, [entityType, entityId, userId]);
    }

    async getFeaturedBooks(limit = 10) {
        const query = `
            SELECT r.*, COUNT(pv.id) as view_count
            FROM resources r
            LEFT JOIN page_views pv ON r.id = pv.entity_id AND pv.entity_type = 'book'
            WHERE r.resource_type = 'book'
            GROUP BY r.id
            ORDER BY view_count DESC
            LIMIT $1
        `;
        const { rows } = await db.query(query, [limit]);
        return rows;
    }

    async getFeaturedCourses(limit = 10) {
        const query = `
            SELECT c.*, COUNT(pv.id) as view_count
            FROM courses c
            LEFT JOIN page_views pv ON c.id = pv.entity_id AND pv.entity_type = 'course'
            GROUP BY c.id
            ORDER BY view_count DESC
            LIMIT $1
        `;
        const { rows } = await db.query(query, [limit]);
        return rows;
    }
}

module.exports = AnalyticsRepository;