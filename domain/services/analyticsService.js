// const db = require('../../infrastructure/database/db'); // ❌ REMOVED: Clean Architecture enforcement

const KnowledgeBaseRepository = require('../repositories/knowledgeBaseRepository');
const AnalyticsRepository = require('../repositories/analyticsRepository');
const { normalizeText } = require('../utils/textUtils');
const CourseRepository = require('../repositories/courseRepository');
const TopicRepository = require('../repositories/topicRepository');

class AnalyticsService {
    constructor() {
        this.knowledgeBaseRepo = new KnowledgeBaseRepository();
        this.analyticsRepo = new AnalyticsRepository();
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
        try {
            await this.analyticsRepo.recordSearchWithIntent(query, results.length, isEducationalQuery, userId, source);
        } catch (error) {
            console.error('❌ Error al registrar la búsqueda en la base de datos:', error);
        }
    }

    async recordFeedback(query, response, isHelpful, userId = null, messageId = null) {
        try {
            if (messageId) {
                const parsedMessageId = parseInt(messageId, 10);
                if (isNaN(parsedMessageId)) {
                    console.warn(`⚠️ No se puede registrar el feedback: message_id "${messageId}" no es un número válido.`);
                    return;
                }
                const exists = await this.analyticsRepo.isMessageExists(parsedMessageId);
                if (!exists) {
                    console.warn(`⚠️ No se puede registrar el feedback: message_id ${parsedMessageId} no existe en la tabla chat_messages.`);
                    return;
                }
                messageId = parsedMessageId;
            } else {
                console.warn(`⚠️ No se puede registrar el feedback: message_id no proporcionado.`);
                return;
            }

            await this.analyticsRepo.recordFeedbackFromService(query, response, isHelpful, userId, messageId);
        } catch (error) {
            console.error('❌ Error al registrar el feedback en la base de datos:', error);
        }
    }

    async recordView(entityType, entityId, userId) {
        try {
            await this.analyticsRepo.recordView(entityType, entityId, userId);
        } catch (error) {
            console.error(`❌ Error al registrar la vista para ${entityType} ${entityId}:`, error);
        }
    }

    // ==========================================
    // NUEVO: SISTEMA DE PULSO (REAL-TIME)
    // ==========================================

    async logPulse(sessionId, userId = null, isMobile = false) {
        // Redirigimos al repo, el error se captura en el Controller para manejo centralizado
        await this.analyticsRepo.logPulse(sessionId, userId, isMobile);
    }

    async getRealTimeStats() {
        try {
            const stats = await this.analyticsRepo.getRealTimeStats();
            return {
                activeNow: parseInt(stats.active_now, 10),
                mobileActive: parseInt(stats.mobile_active, 10),
                desktopActive: parseInt(stats.active_now, 10) - parseInt(stats.mobile_active, 10)
            };
        } catch (error) {
            console.error('❌ Error obteniendo tráfico en tiempo real:', error);
            return { activeNow: 0, mobileActive: 0, desktopActive: 0 };
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

        const metrics = await this.analyticsRepo.getDashboardMetricsRaw(days);

        const totalInteractions = metrics.totalSearches + metrics.totalChatQueries;

        const classifiedTopSearches = metrics.topSearchesRaw.map(term => ({
            ...term,
            type: this.classifySearchTerm(term.query)
        }));

        return {
            totalSearches: metrics.totalSearches,
            totalChatQueries: metrics.totalChatQueries,
            chatAdoptionRate: totalInteractions > 0 ? ((metrics.totalChatQueries / totalInteractions) * 100).toFixed(1) : 0,
            educationalQueryPercentage: totalInteractions > 0 ? ((metrics.educationalQueries / totalInteractions) * 100).toFixed(1) : 0,
            totalFeedbacks: metrics.totalFeedbacks,
            positiveFeedbacks: metrics.positiveFeedbacks,
            users: {
                active: metrics.activeUsers,
                total: metrics.totalUsers
            },
            totalChatMessages: metrics.totalChatMessages,
            topSearches: classifiedTopSearches,
            categoryDistribution: await this.getCategoryDistribution(days),
            topCareers: await this.getTopViewedEntities('career', days),
            topCourses: await this.getTopViewedEntities('course', days),
            topTopics: await this.getTopViewedEntities('topic', days),
            topInstructors: this.getTopInstructorsFromSearches(await this.getTopSearchesRaw(days, 100)),
            zeroResultSearches: await this.getZeroResultSearches(days),
            uniqueVisitors: await this.getUniqueVisitorsCount(days)
        };
    }

    async getUniqueVisitorsCount(days = 1) {
        try {
            return await this.analyticsRepo.getUniqueVisitorsCountRaw(days);
        } catch (error) {
            console.error('❌ Error en getUniqueVisitorsCount:', error);
            return 0;
        }
    }

    // ==========================================
    // MÉTODOS DE CLASIFICACIÓN Y UTILIDADES
    // ==========================================

    classifySearchTerm(query) {
        const normalizedQuery = normalizeText(query);
        if (normalizedQuery.length < 3) return 'General';
        const scores = { Curso: 0, Tema: 0, Carrera: 0, Docente: 0 };

        const scoreCategory = (category, nameSet) => {
            if (!nameSet) return;
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
        const query = normalizeText(queryText);
        const educationalPatterns = [
            /(que|cual|como|por que|para que|donde|cuando|quien)\s+(es|son|sirve|funciona|hacer|estudiar)/i,
            /\b(definicion|concepto|significado|explicacion|resumen)\s+(de|del|sobre)\b/i,
            /\b(diferencia|comparacion|versus|vs)\b/i,
            /\b(ejemplos?|tipos?|caracteristicas|ventajas?|desventajas?)\s+(de|del)\b/i,
            /\b(ayuda|necesito|busco|quiero)\s+(aprender|saber|entender|conocer)\b/i,
            /\b(pasos|guia|tutorial|manual)\s+(para|de)\b/i,
            /\b(recomienda|sugiere)\s+(un|el|la|los|las)\b/i
        ];
        if (educationalPatterns.some(pattern => pattern.test(query))) return true;

        const entityType = this.classifySearchTerm(queryText);
        if (entityType !== 'General') return false;

        const academicKeywords = ['aprender', 'estudiar', 'entender', 'explicar', 'resolver'];
        if (academicKeywords.some(keyword => new RegExp(`\\b${keyword}\\b`, 'i').test(query))) return true;
        if (query.split(/\s+/).length > 4) return true;
        return false;
    }

    // ==========================================
    // MÉTODOS DE AGRUPACIÓN Y Gráficas (CORREGIDO FINAL)
    // ==========================================

    async getEntityTimeSeriesData(type, days = 30) {
        const rawTerms = await this.getTopSearchesRaw(days, 500); 

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

        const groupedEntities = {};
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

        const JACCARD_THRESHOLD = 0.8;

        for (const term of rawTerms) {
            const queryTokensSet = tokenizeToSet(term.query);
            if (queryTokensSet.size === 0) continue;

            let bestMatch = null;
            let maxJaccardScore = 0;

            for (const name of canonicalNames) {
                const nameTokensSet = tokenizeToSet(name);
                if (nameTokensSet.size === 0) continue;
                const intersection = new Set([...queryTokensSet].filter(x => nameTokensSet.has(x)));
                const union = new Set([...queryTokensSet, ...nameTokensSet]);
                const jaccardScore = intersection.size / union.size;

                if (jaccardScore >= JACCARD_THRESHOLD) {
                    if (jaccardScore > maxJaccardScore) {
                        maxJaccardScore = jaccardScore;
                        bestMatch = name;
                    }
                    if (jaccardScore === 1.0) break;
                }
            }

            const entityName = bestMatch;
            if (entityName) {
                if (!groupedEntities[entityName]) {
                    groupedEntities[entityName] = { name: entityName, count: 0, rawQueries: [] };
                }
                groupedEntities[entityName].count += parseInt(term.count, 10);
                groupedEntities[entityName].rawQueries.push(term.query);
            }
        }

        const top5Entities = Object.values(groupedEntities)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        if (top5Entities.length === 0) {
            return { labels: [], datasets: [] };
        }

        const allRawQueries = top5Entities.flatMap(e => e.rawQueries);
        const rawRows = await this.analyticsRepo.getTimeSeriesForQueries(allRawQueries, days);

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
        const rows = await this.analyticsRepo.getSearchTrendsRaw(days);
        return {
            labels: rows.map(row => new Date(row.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })),
            values: rows.map(row => row.count)
        };
    }

    async getInteractionTrends(days = 30) {
        return await this.analyticsRepo.getInteractionTrendsRaw(days);
    }

    async getTopViewedEntities(type, days = 30) {
        try {
            return await this.analyticsRepo.getTopViewedEntitiesRaw(type, days);
        } catch (error) {
            console.error(`❌ Error obteniendo top ${type}:`, error);
            return [];
        }
    }

    async getFeaturedBooks(limit = 10) {
        return this.analyticsRepo.getFeaturedBooks(limit);
    }

    async getFeaturedCourses(limit = 10) {
        return this.analyticsRepo.getFeaturedCourses(limit);
    }

    getTopInstructorsFromSearches(rawTerms) {
        if (!rawTerms || !Array.isArray(rawTerms)) return [];
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
        return await this.analyticsRepo.getTopSearchesRawData(days, limit);
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
        return await this.analyticsRepo.getZeroResultSearchesRaw(days);
    }

    async getAnalyticsForML(days = 90) {
        try {
            return await this.analyticsRepo.getAnalyticsForMLRaw(days);
        } catch (error) {
            console.error('❌ Error al obtener datos de analítica para ML:', error);
            return { searchHistory: [], feedback: [] };
        }
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

    async logAIInteraction(query, intentType, eventType, userId = null) {
        try {
            await this.analyticsRepo.logAIInteractionRaw(query, intentType, eventType, userId);
        } catch (error) {
            console.error('❌ Error registrando interacción de IA:', error);
        }
    }

    async getAIAnalytics(days = 30) {
        const stats = await this.analyticsRepo.getAIAnalyticsRaw(days);
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
        return await this.analyticsRepo.getTopDeepQuestionsRaw(days);
    }

    async predictPopularCourse(days = 30) {
        // ✅ PYTHON SERVICE DEPRECATED: Removido
        return { popularCourse: null, popularTopic: null };
    }

    async getAllFeedback() {
        return await this.analyticsRepo.getAllFeedbackRaw();
    }

    async getTimeSeriesData(days = 30) {
        const rawRows = await this.analyticsRepo.getSearchHistoryTimeSeries(days);
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

    async getHeatmapData(userId) {
        const heatmap = {};
        const res = await this.analyticsRepo.getHeatmapDataRaw(userId);
        
        // Add Quizzes (Value: 2 points per quiz)
        res.quizResRows.forEach(row => {
            heatmap[row.day] = (heatmap[row.day] || 0) + parseInt(row.count) * 2;
        });

        // Add Cards (Value: 1 point per card)
        res.cardResRows.forEach(row => {
            heatmap[row.day] = (heatmap[row.day] || 0) + parseInt(row.count);
        });

        return heatmap;
    }
}

module.exports = AnalyticsService;