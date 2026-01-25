const db = require('../../infrastructure/database/db');
const PythonMLService = require('./pythonMLService');
const KnowledgeBaseRepository = require('../repositories/knowledgeBaseRepository');

class AnalyticsService {
    constructor() {
        this.knowledgeBaseRepo = new KnowledgeBaseRepository();
        this.isKBReady = false;
    }

    async ensureReady() {
        if (!this.isKBReady) {
            await this.knowledgeBaseRepo.load();
            this.isKBReady = true;
        }
    }

    // ==========================================
    // MÉTODOS DE REGISTRO (ESCRITURA)
    // ==========================================

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
        }
    }

    async recordFeedback(query, response, isHelpful, userId = null, messageId = null) {
        console.log(`📊 Registrando feedback en BD para la consulta: "${query}"`);
        try {
            if (messageId) {
                const parsedMessageId = parseInt(messageId, 10);
                if (isNaN(parsedMessageId)) {
                    console.warn(`⚠️ No se puede registrar el feedback: message_id "${messageId}" no es un número válido.`);
                    return;
                }
                const messageExists = await db.query('SELECT 1 FROM chat_messages WHERE id = $1', [parsedMessageId]);
                if (messageExists.rows.length === 0) {
                    console.warn(`⚠️ No se puede registrar el feedback: message_id ${parsedMessageId} no existe en la tabla chat_messages.`);
                    return;
                }
                messageId = parsedMessageId;
            } else {
                console.warn(`⚠️ No se puede registrar el feedback: message_id no proporcionado.`);
                return;
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

    async recordView(entityType, entityId, userId) {
        try {
            // ✅ REFACTOR: Delegar en el repositorio
            const AnalyticsRepository = require('../repositories/analyticsRepository');
            const repo = new AnalyticsRepository();
            await repo.recordView(entityType, entityId, userId);
        } catch (error) {
            console.error(`❌ Error al registrar la vista para ${entityType} ${entityId}:`, error);
        }
    }

    // ==========================================
    // MÉTODOS DE ANALÍTICA (LECTURA)
    // ==========================================

    async getDashboardAnalytics(days = 30) {
        if (!this.isKBReady) {
            await this.knowledgeBaseRepo.load();
            this.isKBReady = true;
        }

        console.log('📊 Obteniendo KPIs del dashboard desde la BD...');
        const dateFilter = `created_at >= NOW() - INTERVAL '${days} days'`;

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
        const totalChatMessagesQuery = `SELECT COUNT(*) FROM chat_messages WHERE ${dateFilter}`;
        const topSearchesQuery = `
            SELECT query, COUNT(*) as count 
            FROM search_history 
            WHERE ${dateFilter}
            GROUP BY query 
            ORDER BY count DESC
            LIMIT 5`;
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
            db.query(totalUsersQuery)
        ]);

        const totalSearches = parseInt(totalSearchesRes.rows[0].count, 10);
        const totalChatQueries = parseInt(totalChatQueriesRes.rows[0].count, 10);
        const educationalQueries = parseInt(educationalQueriesRes.rows[0].count, 10);
        const totalInteractions = totalSearches + totalChatQueries;

        const classifiedTopSearches = topSearchesRes.rows.map(term => ({
            ...term,
            type: this.classifySearchTerm(term.query)
        }));

        return {
            totalSearches: totalSearches,
            totalChatQueries: totalChatQueries,
            chatAdoptionRate: totalInteractions > 0 ? ((totalChatQueries / totalInteractions) * 100).toFixed(1) : 0,
            educationalQueryPercentage: totalInteractions > 0 ? ((educationalQueries / totalInteractions) * 100).toFixed(1) : 0,
            totalFeedbacks: parseInt(totalFeedbacksRes.rows[0].count, 10),
            positiveFeedbacks: parseInt(positiveFeedbacksRes.rows[0].count, 10),
            users: {
                active: parseInt(activeUsersRes.rows[0].count, 10),
                total: parseInt(totalUsersRes.rows[0].count, 10)
            },
            totalChatMessages: parseInt(totalChatMessagesRes.rows[0].count, 10),
            topSearches: classifiedTopSearches,
            categoryDistribution: await this.getCategoryDistribution(days),
            topCareers: await this.getTopViewedEntities('career', days),
            topCourses: await this.getTopViewedEntities('course', days),
            topTopics: await this.getTopViewedEntities('topic', days),
            topInstructors: this.getTopInstructorsFromSearches(await this.getTopSearchesRaw(days, 100)),
            zeroResultSearches: await this.getZeroResultSearches(days)
        };
    }

    // ==========================================
    // MÉTODOS DE CLASIFICACIÓN Y UTILIDADES
    // ==========================================

    classifySearchTerm(query) {
        const { normalizeText } = require('../utils/textUtils');
        const normalizedQuery = normalizeText(query);

        if (normalizedQuery.length < 3) return 'General';

        const scores = { Curso: 0, Tema: 0, Carrera: 0, Docente: 0 };

        const scoreCategory = (category, nameSet) => {
            if (!nameSet) return; // ✅ FIX: Guard against undefined sets
            for (const name of nameSet) {
                if (name === normalizedQuery) {
                    scores[category] = Math.max(scores[category], 3);
                    return;
                }
                if (name.startsWith(normalizedQuery)) {
                    scores[category] = Math.max(scores[category], 2);
                }
                if (name.includes(normalizedQuery)) {
                    scores[category] = Math.max(scores[category], 1);
                }
            }
        };

        scoreCategory('Curso', this.knowledgeBaseRepo.courseNames);
        scoreCategory('Tema', this.knowledgeBaseRepo.topicNames);
        scoreCategory('Carrera', this.knowledgeBaseRepo.careerNames);
        scoreCategory('Docente', this.knowledgeBaseRepo.instructorNames);

        const maxScore = Math.max(...Object.values(scores));
        if (maxScore === 0) return 'General';

        const priorityOrder = ['Curso', 'Tema', 'Carrera', 'Docente'];
        for (const category of priorityOrder) {
            if (scores[category] === maxScore) {
                return category;
            }
        }
        return 'General';
    }

    isQueryEducational(queryText) {
        if (!queryText || typeof queryText !== 'string') return false;

        const { normalizeText } = require('../utils/textUtils'); // ✅ Usar utilidad centralizada (Path corregido)
        const query = normalizeText(queryText);

        // 1. Detectar Patrones de Pregunta (PRIORIDAD ALTA)
        // Se busca intención explícita de aprendizaje o duda.
        const educationalPatterns = [
            // Preguntas directas e indirectas
            /(que|cual|como|por que|para que|donde|cuando|quien)\s+(es|son|sirve|funciona|hacer|estudiar)/i,
            /\b(definicion|concepto|significado|explicacion|resumen)\s+(de|del|sobre)\b/i,
            /\b(diferencia|comparacion|versus|vs)\b/i,
            /\b(ejemplos?|tipos?|caracteristicas|ventajas?|desventajas?)\s+(de|del)\b/i,
            /\b(ayuda|necesito|busco|quiero)\s+(aprender|saber|entender|conocer)\b/i,
            /\b(pasos|guia|tutorial|manual)\s+(para|de)\b/i,
            /\b(recomienda|sugiere)\s+(un|el|la|los|las)\b/i
        ];

        // Si coincide con un patrón de pregunta, es educativo (Pregunta Profunda)
        if (educationalPatterns.some(pattern => pattern.test(query))) return true;

        // 2. Detectar Entidades Exactas (PRIORIDAD MEDIA)
        // Si el usuario busca "Medicina Humana" (nombre exacto de carrera), es una búsqueda navegacional, NO una pregunta profunda.
        const entityType = this.classifySearchTerm(queryText);

        // Si el sistema reconoce la entidad y NO hubo patrón de pregunta, asumimos que quiere VER la entidad (navigational intent).
        // Por lo tanto, NO es "educational query" en el sentido de "necesito explicación", sino "necesito el recurso".
        if (entityType !== 'General') {
            return false; // ✅ CORRECCIÓN: "Medicina Humana" -> False (Mostrar resultados, no banner de pregunta)
        }

        // 3. Palabras Clave Académicas Genéricas (PRIORIDAD BAJA)
        // Si no es un patrón de pregunta ni una entidad conocida, buscamos keywords sueltas.
        const academicKeywords = [
            'aprender', 'estudiar', 'entender', 'explicar', 'resolver'
        ];

        if (academicKeywords.some(keyword => new RegExp(`\\b${keyword}\\b`, 'i').test(query))) return true;

        // 4. Heurística de Longitud
        // Búsquedas muy largas que no coincidieron con nada anterior pueden ser preguntas complejas no estructuradas.
        if (query.split(/\s+/).length > 4) return true;

        return false;
    }

    // ==========================================
    // MÉTODOS DE AGRUPACIÓN Y Gráficas (CORREGIDO FINAL)
    // ==========================================

    /**
     * ✅ REFACTORIZADO FINAL (JACCARD SIMILARITY): Obtiene datos de series de tiempo.
     * Usa el Índice de Jaccard (similitud de conjuntos de tokens) con un umbral estricto (0.8)
     * para evitar que búsquedas genéricas o parciales inflen entidades específicas.
     */
    async getEntityTimeSeriesData(type, days = 30) {
        // 1. Obtener muestra de términos crudos
        const rawTerms = await this.getTopSearchesRaw(days, 500); // Muestra más grande

        // 2. Cargar Catálogo Canónico
        const CourseRepository = require('../repositories/courseRepository');
        const TopicRepository = require('../repositories/topicRepository');
        const courseRepo = new CourseRepository();
        const topicRepo = new TopicRepository();

        let canonicalNames = [];
        if (type === 'Curso') {
            const courses = await courseRepo.findAll();
            canonicalNames = courses.map(c => c.name);
        } else {
            const topics = await topicRepo.findAll();
            canonicalNames = topics.map(t => t.name);
        }

        // 3. Agrupación Estricta usando Jaccard Similarity
        const groupedEntities = {};

        // Helper de tokenización interna (usando Set para unicidad y eficiencia)
        const tokenizeToSet = (str) => {
            if (!str) return new Set();
            const stopwords = ['el', 'la', 'los', 'las', 'de', 'del', 'en', 'y', 'para', 'por', 'con', 'un', 'una', 'sobre', 'curso', 'tema', 'ingenieria'];
            const tokens = str.toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9\s]/g, "")
                .split(/\s+/)
                .filter(w => w.length > 2)
                .filter(w => !stopwords.includes(w));
            return new Set(tokens);
        };

        // Umbral de Jaccard muy estricto (80% de coincidencia de conjunto)
        const JACCARD_THRESHOLD = 0.8;

        for (const term of rawTerms) {
            const queryTokensSet = tokenizeToSet(term.query);
            if (queryTokensSet.size === 0) continue;

            let bestMatch = null;
            let maxJaccardScore = 0;

            for (const name of canonicalNames) {
                const nameTokensSet = tokenizeToSet(name);
                if (nameTokensSet.size === 0) continue;

                // Cálculo del Índice de Jaccard: Intersección / Unión
                // 1. Intersección
                const intersection = new Set([...queryTokensSet].filter(x => nameTokensSet.has(x)));

                // 2. Unión
                const union = new Set([...queryTokensSet, ...nameTokensSet]);

                // 3. Score
                const jaccardScore = intersection.size / union.size;

                // Aplicar umbral estricto
                if (jaccardScore >= JACCARD_THRESHOLD) {
                    if (jaccardScore > maxJaccardScore) {
                        maxJaccardScore = jaccardScore;
                        bestMatch = name;
                    }
                    // Si encontramos un match perfecto (1.0), podemos parar de buscar para esta query
                    if (jaccardScore === 1.0) break;
                }
            }

            const entityName = bestMatch;

            if (entityName) {
                if (!groupedEntities[entityName]) {
                    groupedEntities[entityName] = {
                        name: entityName,
                        count: 0,
                        rawQueries: []
                    };
                }
                groupedEntities[entityName].count += parseInt(term.count, 10);
                groupedEntities[entityName].rawQueries.push(term.query);
            }
        }

        // 4. Top 5 y Procesamiento de Series de Tiempo (Igual que antes)
        const top5Entities = Object.values(groupedEntities)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        if (top5Entities.length === 0) {
            return { labels: [], datasets: [] };
        }

        const allRawQueries = top5Entities.flatMap(e => e.rawQueries);
        const AnalyticsRepository = require('../repositories/analyticsRepository');
        const repo = new AnalyticsRepository();
        const rawRows = await repo.getTimeSeriesForQueries(allRawQueries, days);

        const uniqueDates = [...new Set(rawRows.map(r => new Date(r.date).toISOString().split('T')[0]))].sort();

        const datasets = top5Entities.map(entity => {
            const data = uniqueDates.map(date => {
                let dailyTotal = 0;
                entity.rawQueries.forEach(rawQuery => {
                    const row = rawRows.find(r =>
                        new Date(r.date).toISOString().split('T')[0] === date &&
                        r.query === rawQuery
                    );
                    if (row) dailyTotal += parseInt(row.count, 10);
                });
                return dailyTotal;
            });
            return { label: entity.name, data: data };
        });

        return {
            labels: uniqueDates.map(d => new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })),
            datasets: datasets
        };
    }

    // ==========================================
    // MÉTODOS AUXILIARES Y OTROS
    // ==========================================

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
        return {
            labels: trendsData.rows.map(row => new Date(row.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })),
            values: trendsData.rows.map(row => row.count)
        };
    }

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

    async getTopViewedEntities(type, days = 30) {
        let tableName = '';
        let nameField = 'name';
        switch (type) {
            case 'career': tableName = 'careers'; break;
            case 'course': tableName = 'courses'; break;
            case 'topic': tableName = 'topics'; break;
            default: return [];
        }
        const query = `
            SELECT t.${nameField} as name, COUNT(pv.id) as count, t.id
            FROM page_views pv
            JOIN ${tableName} t ON pv.entity_id = t.id
            WHERE pv.entity_type = $1 
            AND pv.created_at >= NOW() - INTERVAL '${days} days'
            GROUP BY t.id, t.${nameField}
            ORDER BY count DESC
            LIMIT 5;
        `;
        try {
            const res = await db.query(query, [type]);
            return res.rows;
        } catch (error) {
            console.error(`❌ Error obteniendo top ${type}:`, error);
            return [];
        }
    }

    async getFeaturedBooks(limit = 10) {
        const AnalyticsRepository = require('../repositories/analyticsRepository');
        const repo = new AnalyticsRepository();
        return repo.getFeaturedBooks(limit);
    }

    async getFeaturedCourses(limit = 10) {
        const AnalyticsRepository = require('../repositories/analyticsRepository');
        const repo = new AnalyticsRepository();
        return repo.getFeaturedCourses(limit);
    }

    getTopInstructorsFromSearches(rawTerms) {
        if (!rawTerms || !Array.isArray(rawTerms)) return [];
        // ✅ SAFETY CHECK: Si no hay instructores cargados, retornar vacío.
        if (!this.knowledgeBaseRepo.instructorNames || this.knowledgeBaseRepo.instructorNames.size === 0) {
            return [];
        }

        const classifiedTerms = rawTerms.map(term => ({
            ...term,
            type: this.classifySearchTerm(term.query)
        }));
        const instructorTerms = classifiedTerms.filter(term => term.type === 'Docente');
        if (instructorTerms.length >= 5) return instructorTerms.slice(0, 5);

        const foundQueries = new Set(instructorTerms.map(t => t.query));
        const potentialInstructors = [...instructorTerms];

        for (const term of rawTerms) {
            if (foundQueries.has(term.query)) continue;
            // Usa Array.from solo si estamos seguros, pero ya validamos el size arriba.
            const isInstructor = Array.from(this.knowledgeBaseRepo.instructorNames).some(name =>
                name.includes(term.query.toLowerCase()) || term.query.toLowerCase().includes(name)
            );
            if (isInstructor) {
                potentialInstructors.push({ query: term.query, count: term.count, type: 'Docente' });
                foundQueries.add(term.query);
            }
        }
        return potentialInstructors.slice(0, 5);
    }

    async getTopSearchesRaw(days = 30, limit = 100) {
        const query = `
            SELECT query, COUNT(*) as count 
            FROM search_history 
            WHERE created_at >= NOW() - INTERVAL '${days} days'
            GROUP BY query 
            ORDER BY count DESC
            LIMIT $1`;
        const res = await db.query(query, [limit]);
        return res.rows;
    }

    async getCategoryDistribution(days = 30) {
        const searches = await this.getTopSearchesRaw(days, 500);
        const distribution = { Curso: 0, Tema: 0, Carrera: 0, Docente: 0, General: 0 };
        searches.forEach(item => {
            const type = this.classifySearchTerm(item.query);
            distribution[type] += parseInt(item.count, 10);
        });
        return distribution;
    }

    async getZeroResultSearches(days = 30) {
        const query = `
            SELECT query, COUNT(*) as count
            FROM search_history
            WHERE results_count = 0
            AND created_at >= NOW() - INTERVAL '${days} days'
            GROUP BY query
            ORDER BY count DESC
            LIMIT 5;
        `;
        const res = await db.query(query);
        return res.rows;
    }

    async getAnalyticsForML(days = 90) {
        try {
            const querySearch = `SELECT query, results_count, created_at FROM search_history WHERE created_at >= NOW() - INTERVAL '${days} days' ORDER BY created_at DESC LIMIT 50000`;
            const queryFeedback = `SELECT query, response, is_helpful, created_at FROM feedback WHERE created_at >= NOW() - INTERVAL '${days} days' ORDER BY created_at DESC LIMIT 10000`;
            const searchHistoryRes = await db.query(querySearch);
            const feedbackRes = await db.query(queryFeedback);
            return { searchHistory: searchHistoryRes.rows, feedback: feedbackRes.rows };
        } catch (error) {
            console.error('❌ Error al obtener datos de analítica para ML:', error);
            return { searchHistory: [], feedback: [] };
        }
    }

    /**
     * ✅ REFACTORIZADO FINAL (JACCARD SIMILARITY): Obtiene datos de series de tiempo.
     * Usa el Índice de Jaccard (similitud de conjuntos de tokens) con un umbral estricto (0.8)
     * para evitar que búsquedas genéricas o parciales inflen entidades específicas.
     */
    async getEntityTimeSeriesData(type, days = 30) {
        // 1. Obtener muestra de términos crudos
        const rawTerms = await this.getTopSearchesRaw(days, 500); // Muestra más grande

        // 2. Cargar Catálogo Canónico
        const CourseRepository = require('../repositories/courseRepository');
        const TopicRepository = require('../repositories/topicRepository');
        const courseRepo = new CourseRepository();
        const topicRepo = new TopicRepository();

        let canonicalNames = [];
        if (type === 'Curso') {
            const courses = await courseRepo.findAll();
            canonicalNames = courses.map(c => c.name);
        } else {
            const topics = await topicRepo.findAll();
            canonicalNames = topics.map(t => t.name);
        }

        // 3. Agrupación Estricta usando Jaccard Similarity
        const groupedEntities = {};

        // Helper de tokenización interna (usando Set para unicidad y eficiencia)
        const tokenizeToSet = (str) => {
            if (!str) return new Set();
            const stopwords = ['el', 'la', 'los', 'las', 'de', 'del', 'en', 'y', 'para', 'por', 'con', 'un', 'una', 'sobre', 'curso', 'tema', 'ingenieria'];
            const tokens = str.toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9\s]/g, "")
                .split(/\s+/)
                .filter(w => w.length > 2)
                .filter(w => !stopwords.includes(w));
            return new Set(tokens);
        };

        // Umbral de Jaccard muy estricto (80% de coincidencia de conjunto)
        const JACCARD_THRESHOLD = 0.8;

        for (const term of rawTerms) {
            const queryTokensSet = tokenizeToSet(term.query);
            if (queryTokensSet.size === 0) continue;

            let bestMatch = null;
            let maxJaccardScore = 0;

            for (const name of canonicalNames) {
                const nameTokensSet = tokenizeToSet(name);
                if (nameTokensSet.size === 0) continue;

                // Cálculo del Índice de Jaccard: Intersección / Unión
                // 1. Intersección
                const intersection = new Set([...queryTokensSet].filter(x => nameTokensSet.has(x)));

                // 2. Unión
                const union = new Set([...queryTokensSet, ...nameTokensSet]);

                // 3. Score
                const jaccardScore = intersection.size / union.size;

                // Aplicar umbral estricto
                if (jaccardScore >= JACCARD_THRESHOLD) {
                    if (jaccardScore > maxJaccardScore) {
                        maxJaccardScore = jaccardScore;
                        bestMatch = name;
                    }
                    // Si encontramos un match perfecto (1.0), podemos parar de buscar para esta query
                    if (jaccardScore === 1.0) break;
                }
            }

            const entityName = bestMatch;

            if (entityName) {
                if (!groupedEntities[entityName]) {
                    groupedEntities[entityName] = {
                        name: entityName,
                        count: 0,
                        rawQueries: []
                    };
                }
                groupedEntities[entityName].count += parseInt(term.count, 10);
                groupedEntities[entityName].rawQueries.push(term.query);
            }
        }

        // 4. Top 5 y Procesamiento de Series de Tiempo (Igual que antes)
        const top5Entities = Object.values(groupedEntities)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        if (top5Entities.length === 0) {
            return { labels: [], datasets: [] };
        }

        const allRawQueries = top5Entities.flatMap(e => e.rawQueries);
        const AnalyticsRepository = require('../repositories/analyticsRepository');
        const repo = new AnalyticsRepository();
        const rawRows = await repo.getTimeSeriesForQueries(allRawQueries, days);

        const uniqueDates = [...new Set(rawRows.map(r => new Date(r.date).toISOString().split('T')[0]))].sort();

        const datasets = top5Entities.map(entity => {
            const data = uniqueDates.map(date => {
                let dailyTotal = 0;
                entity.rawQueries.forEach(rawQuery => {
                    const row = rawRows.find(r =>
                        new Date(r.date).toISOString().split('T')[0] === date &&
                        r.query === rawQuery
                    );
                    if (row) dailyTotal += parseInt(row.count, 10);
                });
                return dailyTotal;
            });
            return { label: entity.name, data: data };
        });

        return {
            labels: uniqueDates.map(d => new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })),
            datasets: datasets
        };
    }

    // Wrappers específicos
    async getCourseTimeSeriesData(days) { return this.getEntityTimeSeriesData('Curso', days); }
    async getTopicTimeSeriesData(days) { return this.getEntityTimeSeriesData('Tema', days); }

    formatTimeSeriesForChart(rawRows, queries) {
        const uniqueDates = [...new Set(rawRows.map(r => new Date(r.date).toISOString().split('T')[0]))].sort();
        const datasets = queries.map(query => {
            const data = uniqueDates.map(date => {
                const row = rawRows.find(r => new Date(r.date).toISOString().split('T')[0] === date && r.query === query);
                return row ? parseInt(row.count, 10) : 0;
            });
            return { label: query, data: data };
        });
        return {
            labels: uniqueDates.map(d => new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })),
            datasets: datasets
        };
    }

    // ==========================================
    // MÉTODOS DE ANALÍTICA DE IA (NUEVO)
    // ==========================================

    /**
     * Registra una interacción específica con las funciones de IA.
     * @param {string} query - La consulta del usuario.
     * @param {string} intentType - 'deep_question', 'navigational', etc.
     * @param {string} eventType - 'impression', 'click_explanation', etc.
     * @param {string} userId - ID del usuario (opcional).
     */
    async logAIInteraction(query, intentType, eventType, userId = null) {
        console.log(`🤖 AI Event: ${eventType} [${intentType}] for "${query}"`);
        try {
            const queryText = `
                INSERT INTO ai_analytics(query, intent_type, event_type, user_id)
                VALUES($1, $2, $3, $4)
            `;
            await db.query(queryText, [query, intentType, eventType, userId]);
        } catch (error) {
            console.error('❌ Error registrando interacción de IA:', error);
        }
    }

    async getAIAnalytics(days = 30) {
        const query = `
            SELECT 
                COUNT(*) FILTER (WHERE event_type = 'impression') as impressions,
                COUNT(*) FILTER (WHERE event_type = 'click_explanation') as clicks,
                COUNT(DISTINCT query) as unique_questions
            FROM ai_analytics
            WHERE created_at >= NOW() - INTERVAL '${days} days'
        `;
        const res = await db.query(query);
        const stats = res.rows[0];

        // Calcular CTR
        const ctr = stats.impressions > 0
            ? ((parseInt(stats.clicks) / parseInt(stats.impressions)) * 100).toFixed(1)
            : 0;

        return {
            impressions: parseInt(stats.impressions),
            clicks: parseInt(stats.clicks),
            uniqueQuestions: parseInt(stats.unique_questions),
            ctr: ctr
        };
    }

    async getTopDeepQuestions(days = 30) {
        // Preguntas profundas más populares donde hubo clic (Interés Real)
        const query = `
            SELECT query, COUNT(*) as count
            FROM ai_analytics
            WHERE event_type = 'click_explanation'
            AND created_at >= NOW() - INTERVAL '${days} days'
            GROUP BY query
            ORDER BY count DESC
            LIMIT 5
        `;
        const res = await db.query(query);
        return res.rows;
    }

    async predictPopularCourse(days = 30) {
        console.log(`🤖 Obteniendo predicciones de tendencias (Last ${days} days)...`);
        try {
            // ✅ FETCH DESDE SERVICIO PYTHON (Endpoints internos)
            // Aseguramos que la petición sea interna y rápida.
            const stats = await PythonMLService.getTrends(days);

            // Si el servicio responde null/vacío, devolvemos fallback structure
            if (!stats) return { popularCourse: null, popularTopic: null };

            return {
                popularCourse: stats.popularCourse,
                popularTopic: stats.popularTopic,
                popularBook: stats.popularBook // ✅ NUEVO: Incluir libro
            };
        } catch (error) {
            console.warn(`⚠️ No se pudieron obtener las predicciones de ML: ${error.message}`);
            return { popularCourse: null, popularTopic: null };
        }
    }

    async getAllFeedback() {
        const res = await db.query('SELECT * FROM feedback ORDER BY created_at DESC');
        return res.rows;
    }

    // ... (Mantener resto de métodos getTimeSeriesData) ...
    async getTimeSeriesData(days = 30) {
        const AnalyticsRepository = require('../repositories/analyticsRepository');
        const repo = new AnalyticsRepository();
        const rawRows = await repo.getSearchHistoryTimeSeries(days);
        const uniqueDates = [...new Set(rawRows.map(r => new Date(r.date).toISOString().split('T')[0]))].sort();
        const uniqueQueries = [...new Set(rawRows.map(r => r.query))];
        const datasets = uniqueQueries.map(query => {
            const data = uniqueDates.map(date => {
                const row = rawRows.find(r => new Date(r.date).toISOString().split('T')[0] === date && r.query === query);
                return row ? parseInt(row.count, 10) : 0;
            });
            return { label: query, data: data };
        });
        return {
            labels: uniqueDates.map(d => new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })),
            datasets: datasets
        };
    }
}

module.exports = AnalyticsService;