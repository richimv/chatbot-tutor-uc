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
            const queryText = `
                INSERT INTO page_views(entity_type, entity_id, user_id)
                VALUES($1, $2, $3)
            `;
            await db.query(queryText, [entityType, entityId, userId]);
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

        const normalizeQuery = (text) => {
            return text
                .toLowerCase()
                .trim()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/^[¿?¡!]+|[¿?¡!]+$/g, '');
        };

        const query = normalizeQuery(queryText);

        const entityClassification = this.classifySearchTerm(queryText);
        if (entityClassification !== 'General') return true;

        const academicKeywords = [
            'curso', 'materia', 'asignatura', 'tema', 'topico', 'unidad',
            'leccion', 'capitulo', 'modulo', 'carrera', 'programa', 'malla',
            'curricular', 'plan de estudios', 'creditos', 'semestre', 'ciclo',
            'profesor', 'docente', 'instructor', 'maestro', 'catedratico',
            'clase', 'horario', 'examen', 'evaluacion', 'tarea', 'trabajo',
            'practica', 'laboratorio', 'taller', 'seminario', 'libro', 'pdf',
            'material', 'recurso', 'guia', 'manual', 'apuntes', 'bibliografia', 'lectura'
        ];

        if (academicKeywords.some(keyword => new RegExp(`\\b${keyword}\\b`, 'i').test(query))) return true;

        const noiseWords = ['hola', 'gracias', 'adios', 'buenos dias', 'buenas tardes', 'buenas noches', 'buenas', 'test', 'prueba', 'ok', 'si', 'no', 'bien', 'mal', 'ayuda', 'chao'];
        if (noiseWords.some(noise => query === noise || query === noise.replace(/ /g, ''))) return false;

        if (query.length < 3) return false;

        const educationalPatterns = [
            /(que|que)\s+(es|son)\b/i, /\bdefinicion\s+(de|del)\b/i, /\bconcepto\s+(de|del)\b/i,
            /\bsignificado\s+(de|del)\b/i, /\bque\s+significa\b/i, /(como|como)\s+(se|puedo|hacer|funciona)\b/i,
            /\bpasos\s+para\b/i, /\bproceso\s+(de|para)\b/i, /\bforma\s+de\b/i, /(por\s*que|porque)\b/i,
            /\bcausa\s+(de|del)\b/i, /\bmotivo\s+(de|del)\b/i, /\brazon\s+(de|del)\b/i, /(para\s*que|para\s*que)\b/i,
            /\bobjetivo\s+(de|del)\b/i, /(donde|donde)\b/i, /(cuando|cuando)\b/i, /\bayudame\s+con\b/i,
            /\bnecesito\s+(ayuda|informacion|info)\b/i, /\bpodrias\s+(explicar|decirme|mostrar)\b/i,
            /\bpuedes\s+(explicar|decirme|mostrar)\b/i, /\bmaterial\s+(sobre|de)\b/i, /\bejemplos?\s+(de|del)\b/i,
            /\brecomienda(s|me)?\b/i, /\bdiferencia\s+(entre|de)\b/i, /\bcomparar\b/i, /\bversus\b/i, /\bvs\b/i,
            /\ba\s+diferencia\s+de\b/i, /\blista\s+(de|del)\b/i, /\btipos\s+(de|del)\b/i, /\bcuales\s+son\b/i,
            /\bque\s+son\b/i, /\benumera\b/i, /\bexplica(me)?\b/i, /\bexplicacion\s+(de|del)\b/i,
            /\bque\s+es\s+el\b/i, /\bque\s+es\s+la\b/i, /\baprender\b/i, /\bestudiar\b/i, /\bentender\b/i,
            /\bcomprender\b/i, /\bresolver\b/i, /\bense(n|ñ)ar\b/i,
            /\b(matematicas?|fisica|quimica|historia|biologia|lenguaje|geografia|filosofia|arte)\b/i,
            /\b(libro|libros|bibliografia)\s+(de|sobre|para)\b/i,
            /\b(ejercicios?|problemas?)\s+(de|sobre|resueltos)\b/i
        ];

        if (educationalPatterns.some(pattern => pattern.test(query))) return true;

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

    getTopInstructorsFromSearches(rawTerms) {
        if (!rawTerms || !Array.isArray(rawTerms)) return [];
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

    async predictPopularCourse(days = 30) {
        console.log(`🤖 Obteniendo predicciones de tendencias (Last ${days} days)...`);
        try {
            const trends = await PythonMLService.getTrends(days);
            return trends || { popularCourse: 'No disponible', popularTopic: 'No disponible' };
        } catch (error) {
            console.warn(`⚠️ No se pudieron obtener las predicciones de ML: ${error.message}`);
            return { popularCourse: 'No disponible', popularTopic: 'No disponible' };
        }
    }

    async getAllFeedback() {
        const res = await db.query('SELECT * FROM feedback ORDER BY created_at DESC');
        return res.rows;
    }

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