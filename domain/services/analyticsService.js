const db = require('../../infrastructure/database/db');
const PythonMLService = require('./pythonMLService'); // ✅ NUEVO: Importar el servicio de Python.
const KnowledgeBaseRepository = require('../repositories/knowledgeBaseRepository'); // Importar para clasificar términos

class AnalyticsService {
    // ✅ SOLUCIÓN: Añadir un constructor para inicializar el repositorio.
    constructor() {
        this.knowledgeBaseRepo = new KnowledgeBaseRepository();
        this.isKBReady = false; // Flag para controlar la carga
    }

    /**
     * Registra una consulta de búsqueda en la base de datos.
     * @param {string} query La consulta del usuario.
     * @param {Array} results Los resultados directos encontrados.
     * @param {boolean} isEducationalQuery Si la consulta es de tipo pregunta.
     * @param {number} [userId=null] El ID numérico del usuario de la tabla 'users'.
     */
    async recordSearchWithIntent(query, results, isEducationalQuery, userId = null, source = 'search_bar') {
        console.log(`📊 Registrando búsqueda en BD: "${query}"`);
        try {
            const queryText = `
                INSERT INTO search_history(query, results_count, is_educational_query, user_id, source)
                VALUES($1, $2, $3, $4, $5)
            `;
            const values = [query, results.length, isEducationalQuery, userId, source];
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
     * @param {string} [messageId=null] El ID único del mensaje que recibe el feedback.
     */
    async recordFeedback(query, response, isHelpful, userId = null, messageId = null) {
        console.log(`📊 Registrando feedback en BD para la consulta: "${query}"`);
        try {
            // ✅ NUEVO: Verificar si el messageId es un número válido antes de usarlo.
            if (messageId) {
                const parsedMessageId = parseInt(messageId, 10);
                if (isNaN(parsedMessageId)) {
                    console.warn(`⚠️ No se puede registrar el feedback: message_id "${messageId}" no es un número válido.`);
                    return; // Salir de la función si el messageId no es un número.
                }
                // Usar el messageId parseado para la verificación y la inserción.
                const messageExists = await db.query('SELECT 1 FROM chat_messages WHERE id = $1', [parsedMessageId]);
                if (messageExists.rows.length === 0) {
                    console.warn(`⚠️ No se puede registrar el feedback: message_id ${parsedMessageId} no existe en la tabla chat_messages.`);
                    return; // Salir de la función si el messageId no es válido.
                }
                messageId = parsedMessageId; // Actualizar messageId con el valor parseado.
            } else {
                console.warn(`⚠️ No se puede registrar el feedback: message_id no proporcionado.`);
                return; // Salir de la función si no hay messageId.
            }

            const queryText = `
                INSERT INTO feedback(query, response, is_helpful, user_id, message_id)
                VALUES($1, $2, $3, $4, $5)
            `;
            const values = [query, response, isHelpful, userId, messageId];
            await db.query(queryText, values);
        } catch (error) {
            console.error('❌ Error al registrar el feedback en la base de datos:', error);
        }
    }

    /**
     * ✅ NUEVO: Registra una vista de página en la base de datos.
     * @param {string} entityType - El tipo de entidad ('course', 'topic', 'career').
     * @param {number} entityId - El ID de la entidad.
     * @param {string} userId - El UUID del usuario.
     */
    async recordView(entityType, entityId, userId) {
        try {
            const queryText = `
                INSERT INTO page_views(entity_type, entity_id, user_id)
                VALUES($1, $2, $3)
            `;
            await db.query(queryText, [entityType, entityId, userId]);
        } catch (error) {
            console.error(`❌ Error al registrar la vista para ${entityType} ${entityId}:`, error);
        }
    }

    /**
     * ✅ NUEVO: Obtiene las métricas principales para el dashboard.
     * @returns {Promise<object>}
     */
    async getDashboardAnalytics(days = 30) { // ✅ Acepta un parámetro de días
        // ✅ SOLUCIÓN: Cargar la base de conocimiento solo si no ha sido cargada antes.
        if (!this.isKBReady) {
            await this.knowledgeBaseRepo.load();
            this.isKBReady = true;
        }

        console.log('📊 Obteniendo KPIs del dashboard desde la BD...');
        const dateFilter = `created_at >= NOW() - INTERVAL '${days} days'`;
 
        // ✅ MEJORA: Consultas más específicas y claras
        const totalSearchesQuery = `SELECT COUNT(*) FROM search_history WHERE source = 'search_bar' AND ${dateFilter}`;
        const totalChatQueriesQuery = `SELECT COUNT(*) FROM search_history WHERE source = 'chatbot' AND ${dateFilter}`;
        const educationalQueriesQuery = `SELECT COUNT(*) FROM search_history WHERE is_educational_query = TRUE AND ${dateFilter}`;
        const totalFeedbacksQuery = `SELECT COUNT(*) FROM feedback WHERE ${dateFilter}`;
        const positiveFeedbacksQuery = `SELECT COUNT(*) FROM feedback WHERE is_helpful = TRUE AND ${dateFilter}`;
        
        const activeUsersQuery = `
            SELECT COUNT(DISTINCT user_id) 
            FROM (
                SELECT user_id FROM search_history WHERE ${dateFilter} AND user_id IS NOT NULL
                UNION
                SELECT user_id FROM conversations WHERE updated_at >= NOW() - INTERVAL '${days} days' AND user_id IS NOT NULL 
            ) AS active_users;
        `;
        // ✅ NUEVO KPI: Total de mensajes en el chat
        const totalChatMessagesQuery = `SELECT COUNT(*) FROM chat_messages WHERE ${dateFilter}`;
        const topSearchesQuery = `
            SELECT query, COUNT(*) as count 
            FROM search_history 
            WHERE ${dateFilter}
            GROUP BY query 
            ORDER BY count DESC
            LIMIT 5`;

        // ✅ PLAN DE EJECUCIÓN: Añadir consulta para total de usuarios (histórico)
        const totalUsersQuery = 'SELECT COUNT(*) FROM users';
 
        const [
            totalSearchesRes,
            totalChatQueriesRes,
            educationalQueriesRes,
            totalFeedbacksRes,
            positiveFeedbacksRes,
            activeUsersRes,
            totalChatMessagesRes,
            topSearchesRes,
            totalUsersRes
        ] = await Promise.all([
            db.query(totalSearchesQuery),
            db.query(totalChatQueriesQuery),
            db.query(educationalQueriesQuery),
            db.query(totalFeedbacksQuery),
            db.query(positiveFeedbacksQuery),
            db.query(activeUsersQuery),
            db.query(totalChatMessagesQuery),
            db.query(topSearchesQuery),
            db.query(totalUsersQuery) // Ejecutar la nueva consulta
        ]);
 
        const totalSearches = parseInt(totalSearchesRes.rows[0].count, 10);
        const totalChatQueries = parseInt(totalChatQueriesRes.rows[0].count, 10);
        const educationalQueries = parseInt(educationalQueriesRes.rows[0].count, 10);
        const totalInteractions = totalSearches + totalChatQueries; // Suma de ambas fuentes

        // ✅ PLAN DE EJECUCIÓN: Clasificar los términos de búsqueda
        // ✅ SOLUCIÓN: Usar una función de flecha para preservar el contexto de `this`.
        const classifiedTopSearches = topSearchesRes.rows.map(term => ({
            ...term,
            type: this._classifySearchTerm(term.query)
        }));

        return {
            // KPIs Refactorizados
            totalSearches: totalSearches, // Búsquedas en la barra principal
            totalChatQueries: totalChatQueries, // Consultas iniciadas en el chatbot
            chatAdoptionRate: totalInteractions > 0 ? ((totalChatQueries / totalInteractions) * 100).toFixed(1) : 0,
            
            educationalQueryPercentage: totalInteractions > 0 ? ((educationalQueries / totalInteractions) * 100).toFixed(1) : 0,
            totalFeedbacks: parseInt(totalFeedbacksRes.rows[0].count, 10),
            positiveFeedbacks: parseInt(positiveFeedbacksRes.rows[0].count, 10),
            // Datos de Usuarios para el modal
            users: {
                active: parseInt(activeUsersRes.rows[0].count, 10),
                total: parseInt(totalUsersRes.rows[0].count, 10)
            },
            totalChatMessages: parseInt(totalChatMessagesRes.rows[0].count, 10),
            topSearches: classifiedTopSearches // La consulta ya limita a 5
        };
    }

    /**
     * Clasifica un término de búsqueda comparándolo con la base de conocimiento.
     * @private
     */
    _classifySearchTerm(query) {
        const normalizedQuery = query.toLowerCase().trim();
        if (normalizedQuery.length < 3) return 'General'; // Evitar clasificar palabras muy cortas
        
        // --- ✅ SOLUCIÓN DEFINITIVA: Clasificación por Puntuación de Especificidad ---
        const scores = { Curso: 0, Tema: 0, Carrera: 0, Docente: 0 };

        // Función auxiliar para comprobar y puntuar
        const scoreCategory = (category, nameSet) => {
            for (const name of nameSet) {
                if (name === normalizedQuery) { // Coincidencia exacta
                    scores[category] = Math.max(scores[category], 3);
                    return; // Máxima puntuación, no necesita seguir buscando en este set
                }
                if (name.startsWith(normalizedQuery)) { // La entidad empieza con la búsqueda
                    scores[category] = Math.max(scores[category], 2);
                }
                if (name.includes(normalizedQuery)) { // La búsqueda está contenida en la entidad
                    scores[category] = Math.max(scores[category], 1);
                }
            }
        };

        // Puntuar todas las categorías
        scoreCategory('Curso', this.knowledgeBaseRepo.courseNames);
        scoreCategory('Tema', this.knowledgeBaseRepo.topicNames);
        scoreCategory('Carrera', this.knowledgeBaseRepo.careerNames);
        scoreCategory('Docente', this.knowledgeBaseRepo.instructorNames);

        // Encontrar la puntuación más alta
        const maxScore = Math.max(...Object.values(scores));

        // Si ninguna categoría puntuó, es 'General'
        if (maxScore === 0) return 'General';

        // Orden de prioridad para desempates (si varios tienen la misma puntuación máxima)
        const priorityOrder = ['Curso', 'Tema', 'Carrera', 'Docente'];
        for (const category of priorityOrder) {
            if (scores[category] === maxScore) {
                return category; // Devolver la primera categoría que tenga la máxima puntuación
            }
        }

        return 'General';
    }

    /**
     * ✅ NUEVO: Obtiene las tendencias de búsqueda por día.
     * @returns {Promise<object>}
     */
    async getSearchTrends(days = 30) {
        console.log('📊 Obteniendo tendencias de búsqueda desde la BD...');
        const trendsQuery = `
            SELECT DATE(created_at) as date, COUNT(*) as count
            FROM search_history
            WHERE created_at >= NOW() - INTERVAL '${days} days'
            GROUP BY DATE(created_at)
            ORDER BY date ASC;
        `;
        const trendsData = await db.query(trendsQuery);
        // ✅ CORRECCIÓN: Acceder a .rows del resultado.
        return {
            labels: trendsData.rows.map(row => new Date(row.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })),
            values: trendsData.rows.map(row => row.count)
        };
    }

    /**
     * ✅ NUEVO: Obtiene las tendencias de interacción por canal (chatbot vs. buscador).
     * @param {number} days - El número de días a consultar.
     * @returns {Promise<object>}
     */
    async getInteractionTrends(days = 30) {
        console.log('📊 Obteniendo tendencias de interacción por canal...');
        const query = `
            WITH all_dates AS (
                SELECT generate_series(
                    (NOW() - INTERVAL '${days - 1} days')::date,
                    NOW()::date,
                    '1 day'::interval
                )::date AS date
            )
            SELECT
                d.date,
                COALESCE(SUM(CASE WHEN s.source = 'chatbot' THEN 1 ELSE 0 END), 0) AS chatbot_queries,
                COALESCE(SUM(CASE WHEN s.source = 'search_bar' THEN 1 ELSE 0 END), 0) AS search_bar_queries
            FROM all_dates d
            LEFT JOIN search_history s ON d.date = DATE(s.created_at)
            GROUP BY d.date
            ORDER BY d.date ASC;
        `;
        const { rows } = await db.query(query);
        return rows;
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

/**
 * ✅ MEJORA: Obtiene las predicciones de tendencias desde el servicio de Python.
 * @returns {Promise<object>}
 */
async predictPopularCourse() {
        console.log('🤖 Obteniendo predicciones de tendencias desde el servicio de Python ML...');
        try {
            return await PythonMLService.getTrends();
        } catch (error) {
            console.warn(`⚠️ No se pudieron obtener las predicciones de ML: ${error.message}`);
            return { popularCourse: 'No disponible', popularTopic: 'No disponible' };
        }
    }

    async getAllFeedback() {
        const res = await db.query('SELECT * FROM feedback ORDER BY created_at DESC');
        return res.rows;
    }
}

module.exports = AnalyticsService;
