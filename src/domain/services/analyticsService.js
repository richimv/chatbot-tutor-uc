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
        // Obsoleto: Chat General es efímero y la tabla feedback fue eliminada.
        return;
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

    async getHeatmapData(userId, deckId = null) {
        const heatmap = {};
        const res = await this.analyticsRepo.getHeatmapDataRaw(userId, deckId);

        // Contabilizar exclusivamente repasos de tarjetas (user_flashcards)
        if (res && res.cardResRows) {
            res.cardResRows.forEach(row => {
                if (row.day) {
                    heatmap[row.day] = (heatmap[row.day] || 0) + parseInt(row.count);
                }
            });
        }

        return heatmap;
    }

    /**
     * Genera un diagnóstico heurístico inteligente basado en los datos reales del usuario
     * para usuarios gratuitos (Free), básicos (Basic), invitados (Guest) y fallback de IA.
     * 
     * @param {object} stats - Estadísticas de rendimiento (radar_data, avg_score, accuracy, etc.)
     * @param {string} context - 'MEDICINA' o 'EDUCACION'
     * @returns {object} { strengths, weaknesses, strategy, readinessIndex, readinessLevel, sprint }
     */
    generateHeuristicDiagnostic(stats, context = 'MEDICINA') {
        const isEducacion = context === 'EDUCACION';
        const accuracy = Number(stats?.accuracy) || 0;
        const avgScore = Number(stats?.avg_score) || 0;

        // 1. Cálculo de Nivel de Competencia y Readiness Index
        let readinessLevel = 'Nivel Inicial';
        let readinessColor = '#f43f5e';
        let readinessIndex = 45;

        if (accuracy >= 80 || avgScore >= 16) {
            readinessLevel = 'Nivel Sobresaliente';
            readinessColor = '#10b981';
            readinessIndex = Math.min(Math.round(accuracy * 0.6 + (avgScore / 20 * 100) * 0.4), 98);
        } else if (accuracy >= 65 || avgScore >= 13) {
            readinessLevel = 'Nivel Competente';
            readinessColor = '#3b82f6';
            readinessIndex = Math.min(Math.round(accuracy * 0.6 + (avgScore / 20 * 100) * 0.4), 84);
        } else if (accuracy >= 45 || avgScore >= 9) {
            readinessLevel = 'Nivel en Desarrollo';
            readinessColor = '#f59e0b';
            readinessIndex = Math.max(Math.round(accuracy * 0.6 + (avgScore / 20 * 100) * 0.4), 45);
        } else {
            readinessLevel = 'Nivel Inicial';
            readinessColor = '#f43f5e';
            readinessIndex = Math.max(Math.round(accuracy * 0.6 + (avgScore / 20 * 100) * 0.4), 25);
        }

        let topics = [];
        if (Array.isArray(stats?.radar_data)) {
            topics = stats.radar_data.filter(t => t && t.subject);
        } else if (stats?.radar_data && typeof stats.radar_data === 'object') {
            topics = Object.entries(stats.radar_data).map(([subject, acc]) => ({
                subject,
                accuracy: Number(acc) || 0,
                correct: 0,
                total: 0
            }));
        }

        // Ordenar por precisión descendente
        topics.sort((a, b) => b.accuracy - a.accuracy);

        let strengths = '';
        let weaknesses = '';
        let strategy = '';
        let sprint = [];

        if (topics.length === 0) {
            // Usuario sin historial de simulacros aún
            if (isEducacion) {
                strengths = `
                    <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.75rem;">
                        <span style="font-size:0.72rem; font-weight:700; padding:2px 8px; border-radius:6px; background:var(--primary-glow-sm, rgba(59,130,246,0.1)); color:var(--primary); border:1px solid var(--primary-glow, rgba(59,130,246,0.25)); text-transform:uppercase; letter-spacing:0.04em;">ESTÁNDAR OFICIAL CNEB</span>
                    </div>
                    <p style="color:var(--text-secondary); font-size:0.85rem; line-height:1.6; margin-bottom:1rem;">El temario oficial de la Carrera Pública Magisterial evalúa competencias fundamentales para la prueba nacional:</p>
                    <ul style="margin:0; padding:0; list-style:none;">
                        <li style="display:flex; align-items:start; gap:0.75rem; margin-bottom:0.75rem; color:var(--text-main); font-size:0.85rem; line-height:1.4;">
                            <i class="fas fa-check-circle" style="color:var(--primary); margin-top:2px;"></i>
                            <span>Fundamentos de <strong>Planificación Curricular</strong>, diseño de situaciones significativas y mediación pedagógica.</span>
                        </li>
                        <li style="display:flex; align-items:start; gap:0.75rem; margin-bottom:0.75rem; color:var(--text-main); font-size:0.85rem; line-height:1.4;">
                            <i class="fas fa-check-circle" style="color:var(--primary); margin-top:2px;"></i>
                            <span>Principios del CNEB para <strong>Convivencia Democrática</strong>, inclusión y clima de aula.</span>
                        </li>
                    </ul>
                `;
                weaknesses = `
                    <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.75rem;">
                        <span style="font-size:0.72rem; font-weight:700; padding:2px 8px; border-radius:6px; background:var(--surface-hover); color:var(--text-secondary); border:1px solid var(--border-color); text-transform:uppercase; letter-spacing:0.04em;">CALIBRACIÓN PENDIENTE</span>
                    </div>
                    <p style="color:var(--text-secondary); font-size:0.85rem; line-height:1.6; margin-bottom:1rem;">Es fundamental establecer tu línea base de rendimiento mediante una primera evaluación:</p>
                    <ul style="margin:0; padding:0; list-style:none;">
                        <li style="display:flex; align-items:start; gap:0.75rem; margin-bottom:0.75rem; color:var(--text-main); font-size:0.85rem; line-height:1.4;">
                            <i class="fas fa-exclamation-triangle" style="color:var(--text-muted); margin-top:2px;"></i>
                            <span>Sin calibración en <strong>Evaluación Formativa y Rúbricas</strong> (retroalimentación descriptiva vs reflexiva).</span>
                        </li>
                        <li style="display:flex; align-items:start; gap:0.75rem; margin-bottom:0.75rem; color:var(--text-main); font-size:0.85rem; line-height:1.4;">
                            <i class="fas fa-exclamation-triangle" style="color:var(--text-muted); margin-top:2px;"></i>
                            <span>Casuísticas complejas de <strong>Teorías y Procesos del Aprendizaje</strong> (Piaget, Vygotsky, Bruner).</span>
                        </li>
                    </ul>
                `;
                strategy = "Inicia con un simulacro rápido de 10 preguntas para calibrar tu matriz de competencias y activar tu diagnóstico adaptativo con métricas.";
                sprint = [
                    { step: 1, title: "Prueba Diagnóstica", desc: "Resuelve un Simulacro Rápido (10q) para calibrar tus notas iniciales." },
                    { step: 2, title: "Revisión de Casuísticas", desc: "Usa el Modo Estudio (20q) para analizar el sustento técnico de cada reactivo." },
                    { step: 3, title: "Consolidación de Criterios", desc: "Repasa los procesos didácticos oficiales del CNEB antes del examen oficial." }
                ];
            } else {
                strengths = `
                    <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.75rem;">
                        <span style="font-size:0.72rem; font-weight:700; padding:2px 8px; border-radius:6px; background:var(--primary-glow-sm, rgba(13,148,136,0.1)); color:var(--primary); border:1px solid var(--primary-glow, rgba(13,148,136,0.25)); text-transform:uppercase; letter-spacing:0.04em;">ESTÁNDAR OFICIAL MINSA / ASPEFAM</span>
                    </div>
                    <p style="color:var(--text-secondary); font-size:0.85rem; line-height:1.6; margin-bottom:1rem;">Las pruebas oficiales médicas (SERUMS/ENAM) ponderan con alta carga las siguientes especialidades troncales:</p>
                    <ul style="margin:0; padding:0; list-style:none;">
                        <li style="display:flex; align-items:start; gap:0.75rem; margin-bottom:0.75rem; color:var(--text-main); font-size:0.85rem; line-height:1.4;">
                            <i class="fas fa-check-circle" style="color:var(--primary); margin-top:2px;"></i>
                            <span>Diagnóstico y terapéutica en <strong>Medicina Interna</strong> y <strong>Pediatría</strong> basada en guías clínicas.</span>
                        </li>
                        <li style="display:flex; align-items:start; gap:0.75rem; margin-bottom:0.75rem; color:var(--text-main); font-size:0.85rem; line-height:1.4;">
                            <i class="fas fa-check-circle" style="color:var(--primary); margin-top:2px;"></i>
                            <span>Manejo de algoritmos de shock, soporte vital y emergencias en el primer nivel de atención.</span>
                        </li>
                    </ul>
                `;
                weaknesses = `
                    <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.75rem;">
                        <span style="font-size:0.72rem; font-weight:700; padding:2px 8px; border-radius:6px; background:var(--surface-hover); color:var(--text-secondary); border:1px solid var(--border-color); text-transform:uppercase; letter-spacing:0.04em;">CALIBRACIÓN PENDIENTE</span>
                    </div>
                    <p style="color:var(--text-secondary); font-size:0.85rem; line-height:1.6; margin-bottom:1rem;">Es necesario medir tu nivel inicial para identificar qué áreas requieren mayor refuerzo:</p>
                    <ul style="margin:0; padding:0; list-style:none;">
                        <li style="display:flex; align-items:start; gap:0.75rem; margin-bottom:0.75rem; color:var(--text-main); font-size:0.85rem; line-height:1.4;">
                            <i class="fas fa-exclamation-triangle" style="color:var(--text-muted); margin-top:2px;"></i>
                            <span>Sin calibración en <strong>Salud Pública, Epidemiología y Gestión</strong> (Grupo D del SERUMS).</span>
                        </li>
                        <li style="display:flex; align-items:start; gap:0.75rem; margin-bottom:0.75rem; color:var(--text-main); font-size:0.85rem; line-height:1.4;">
                            <i class="fas fa-exclamation-triangle" style="color:var(--text-muted); margin-top:2px;"></i>
                            <span>Casos de alto riesgo materno-perinatal en <strong>Ginecología y Obstetricia</strong>.</span>
                        </li>
                    </ul>
                `;
                strategy = "Resuelve tu primer simulacro de 10 preguntas para diagnosticar tus áreas fuertes y focos de refuerzo.";
                sprint = [
                    { step: 1, title: "Calibración Inicial", desc: "Completa un Simulacro Rápido (10q) para obtener tu primera radiografía de aciertos." },
                    { step: 2, title: "Estudio Guiado", desc: "Realiza simulacros de 20 preguntas leyendo los sustentos de cada caso clínico." },
                    { step: 3, title: "Repaso de Salud Pública", desc: "Refuerza la Norma Técnica MINSA y Cuidado Integral de Salud para el SERUMS." }
                ];
            }
        } else {
            // Usuario con datos reales de temas practicados
            const best1 = topics[0];
            const best2 = topics.length > 1 ? topics[1] : null;

            // Peores temas (orden inverso)
            const reversed = [...topics].reverse();
            const worst1 = reversed[0];
            const worst2 = (reversed.length > 1 && reversed[1].subject !== worst1.subject) ? reversed[1] : null;

            if (isEducacion) {
                const bestTotalStr1 = best1.total ? ` (${best1.correct}/${best1.total} aciertos)` : '';
                const bestTotalStr2 = (best2 && best2.total) ? ` (${best2.correct}/${best2.total} aciertos)` : '';
                const worstFailStr1 = worst1.total ? ` (${worst1.total - worst1.correct} errores en ${worst1.total} reactivos)` : '';
                const worstFailStr2 = (worst2 && worst2.total) ? ` (${worst2.total - worst2.correct} errores en ${worst2.total} reactivos)` : '';

                strengths = `
                    <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.75rem;">
                        <span style="font-size:0.72rem; font-weight:700; padding:2px 8px; border-radius:6px; background:var(--primary-glow-sm, rgba(59,130,246,0.1)); color:var(--primary); border:1px solid var(--primary-glow, rgba(59,130,246,0.25)); text-transform:uppercase; letter-spacing:0.04em;">${readinessLevel.toUpperCase()}</span>
                        <span style="font-size:0.75rem; color:var(--text-secondary);">${accuracy}% Precisión Global</span>
                    </div>
                    <p style="color:var(--text-secondary); font-size:0.85rem; line-height:1.6; margin-bottom:1rem;">Has consolidado un sólido criterio pedagógico en tus áreas con mayor efectividad:</p>
                    <ul style="margin:0; padding:0; list-style:none;">
                        <li style="display:flex; align-items:start; gap:0.75rem; margin-bottom:0.75rem; color:var(--text-main); font-size:0.85rem; line-height:1.4;">
                            <i class="fas fa-check-circle" style="color:var(--primary); margin-top:2px;"></i>
                            <span>Dominio consolidado en <strong>${best1.subject}</strong> con <strong>${best1.accuracy}%</strong> de efectividad${bestTotalStr1}. Evidencias buen manejo de procesos didácticos y mediación del aprendizaje.</span>
                        </li>
                        ${best2 ? `
                        <li style="display:flex; align-items:start; gap:0.75rem; margin-bottom:0.75rem; color:var(--text-main); font-size:0.85rem; line-height:1.4;">
                            <i class="fas fa-check-circle" style="color:var(--primary); margin-top:2px;"></i>
                            <span>Rendimiento favorable en <strong>${best2.subject}</strong> con <strong>${best2.accuracy}%</strong> de precisión${bestTotalStr2}, reflejando criterio formativo consistente.</span>
                        </li>` : ''}
                    </ul>
                `;

                weaknesses = `
                    <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.75rem;">
                        <span style="font-size:0.72rem; font-weight:700; padding:2px 8px; border-radius:6px; background:var(--surface-hover); color:var(--text-secondary); border:1px solid var(--border-color); text-transform:uppercase; letter-spacing:0.04em;">FOCO CRÍTICO PRIORITARIO</span>
                    </div>
                    <p style="color:var(--text-secondary); font-size:0.85rem; line-height:1.6; margin-bottom:1rem;">Se identificaron áreas de alta incidencia en la prueba que presentan oportunidades de mejora inmediata:</p>
                    <ul style="margin:0; padding:0; list-style:none;">
                        <li style="display:flex; align-items:start; gap:0.75rem; margin-bottom:0.75rem; color:var(--text-main); font-size:0.85rem; line-height:1.4;">
                            <i class="fas fa-exclamation-triangle" style="color:var(--text-muted); margin-top:2px;"></i>
                            <span>Brecha detectada en <strong>${worst1.subject}</strong> con <strong>${worst1.accuracy}%</strong> de precisión${worstFailStr1}. Conviene repasar criterios de retroalimentación formativa y rúbricas.</span>
                        </li>
                        ${worst2 ? `
                        <li style="display:flex; align-items:start; gap:0.75rem; margin-bottom:0.75rem; color:var(--text-main); font-size:0.85rem; line-height:1.4;">
                            <i class="fas fa-exclamation-triangle" style="color:var(--text-muted); margin-top:2px;"></i>
                            <span>Vulnerabilidad en <strong>${worst2.subject}</strong> (${worst2.accuracy}% de efectividad${worstFailStr2}), donde los distractores teóricos reducen tu puntaje.</span>
                        </li>` : ''}
                    </ul>
                `;

                strategy = `Prioriza la resolución de simulacros focalizados en ${worst1.subject} para afianzar casuísticas del CNEB y maximizar tu nota en la prueba de Ascenso o Nombramiento.`;
                sprint = [
                    { step: 1, title: `Refuerzo en ${worst1.subject}`, desc: `Repasa las definiciones doctrinales y normativas del CNEB específicas de ${worst1.subject}.` },
                    { step: 2, title: "Modo Estudio (20 Preguntas)", desc: "Entrena con justificaciones completas para aprender a descartar distractores típicos." },
                    { step: 3, title: `Mantenimiento en ${best1.subject}`, desc: `Consolida tu ventaja en ${best1.subject} mediante simulacros rápidos de 10 preguntas.` }
                ];
            } else {
                const bestTotalStr1 = best1.total ? ` (${best1.correct}/${best1.total} aciertos)` : '';
                const bestTotalStr2 = (best2 && best2.total) ? ` (${best2.correct}/${best2.total} aciertos)` : '';
                const worstFailStr1 = worst1.total ? ` (${worst1.total - worst1.correct} fallas en ${worst1.total} reactivos)` : '';
                const worstFailStr2 = (worst2 && worst2.total) ? ` (${worst2.total - worst2.correct} fallas en ${worst2.total} reactivos)` : '';

                strengths = `
                    <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.75rem;">
                        <span style="font-size:0.72rem; font-weight:700; padding:2px 8px; border-radius:6px; background:var(--primary-glow-sm, rgba(13,148,136,0.1)); color:var(--primary); border:1px solid var(--primary-glow, rgba(13,148,136,0.25)); text-transform:uppercase; letter-spacing:0.04em;">${readinessLevel.toUpperCase()}</span>
                        <span style="font-size:0.75rem; color:var(--text-secondary);">${accuracy}% Precisión Global</span>
                    </div>
                    <p style="color:var(--text-secondary); font-size:0.85rem; line-height:1.6; margin-bottom:1rem;">Tu perfil de respuestas refleja solvencia diagnóstica y criterio clínico en tus áreas top:</p>
                    <ul style="margin:0; padding:0; list-style:none;">
                        <li style="display:flex; align-items:start; gap:0.75rem; margin-bottom:0.75rem; color:var(--text-main); font-size:0.85rem; line-height:1.4;">
                            <i class="fas fa-check-circle" style="color:var(--primary); margin-top:2px;"></i>
                            <span>Excelente precisión clínica en <strong>${best1.subject}</strong> con un <strong>${best1.accuracy}%</strong> de aciertos${bestTotalStr1}. Evidencias buen manejo de algoritmos diagnósticos y tratamiento.</span>
                        </li>
                        ${best2 ? `
                        <li style="display:flex; align-items:start; gap:0.75rem; margin-bottom:0.75rem; color:var(--text-main); font-size:0.85rem; line-height:1.4;">
                            <i class="fas fa-check-circle" style="color:var(--primary); margin-top:2px;"></i>
                            <span>Buen criterio clínico en <strong>${best2.subject}</strong> (${best2.accuracy}% de efectividad${bestTotalStr2}), manteniendo una base terapéutica sólida.</span>
                        </li>` : ''}
                    </ul>
                `;

                weaknesses = `
                    <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.75rem;">
                        <span style="font-size:0.72rem; font-weight:700; padding:2px 8px; border-radius:6px; background:var(--surface-hover); color:var(--text-secondary); border:1px solid var(--border-color); text-transform:uppercase; letter-spacing:0.04em;">FOCO CLÍNICO PRIORITARIO</span>
                    </div>
                    <p style="color:var(--text-secondary); font-size:0.85rem; line-height:1.6; margin-bottom:1rem;">Se detectaron áreas clínicas críticas con margen de error que deben reforzarse:</p>
                    <ul style="margin:0; padding:0; list-style:none;">
                        <li style="display:flex; align-items:start; gap:0.75rem; margin-bottom:0.75rem; color:var(--text-main); font-size:0.85rem; line-height:1.4;">
                            <i class="fas fa-exclamation-triangle" style="color:var(--text-muted); margin-top:2px;"></i>
                            <span>Foco de refuerzo inmediato en <strong>${worst1.subject}</strong> con <strong>${worst1.accuracy}%</strong> de precisión${worstFailStr1}. Requiere repaso de normas técnicas y manejo de casos complejos.</span>
                        </li>
                        ${worst2 ? `
                        <li style="display:flex; align-items:start; gap:0.75rem; margin-bottom:0.75rem; color:var(--text-main); font-size:0.85rem; line-height:1.4;">
                            <i class="fas fa-exclamation-triangle" style="color:var(--text-muted); margin-top:2px;"></i>
                            <span>Inestabilidad en <strong>${worst2.subject}</strong> (${worst2.accuracy}% de aciertos${worstFailStr2}), donde los distractores farmacológicos aumentan la tasa de fallo.</span>
                        </li>` : ''}
                    </ul>
                `;

                strategy = `Enfócate en resolver simulacros en ${worst1.subject} para dominar el diagnóstico diferencial y guías clínicas clave antes de la prueba oficial.`;
                sprint = [
                    { step: 1, title: `Protocolos de ${worst1.subject}`, desc: `Revisa guías de práctica clínica y algoritmos de manejo para ${worst1.subject}.` },
                    { step: 2, title: "Simulacros Modo Estudio", desc: "Entrena con reactivos comentados para afianzar el diagnóstico diferencial y tratamiento." },
                    { step: 3, title: `Retención en ${best1.subject}`, desc: `Mantén la memoria activa en ${best1.subject} con repasos ágiles de 10 preguntas.` }
                ];
            }
        }

        // Llamado a Suscripción Avanzada
        const upgradeCallout = `
            <div style="margin-top:1.25rem; padding:1.1rem; background:var(--surface-hover); border:1px solid var(--border-color); border-radius:12px;">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.4rem; flex-wrap:wrap; gap:0.5rem;">
                    <span style="font-weight:700; color:var(--text-main); font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em;">👑 Auditoría Cognitiva IA (Plan Avanzado)</span>
                    <span style="font-size:0.7rem; background:var(--primary-glow-sm, rgba(59,130,246,0.12)); color:var(--primary); border:1px solid var(--primary-glow, rgba(59,130,246,0.25)); padding:2px 6px; border-radius:6px; font-weight:700;">Deep Reasoning</span>
                </div>
                <p style="color:var(--text-secondary); margin:0 0 0.75rem 0; font-size:0.83rem; line-height:1.5;">Desbloquea análisis en tiempo real generados por Gemini con <strong>detección de sesgos de razonamiento</strong>, <strong>píldoras High-Yield</strong> y <strong>auditoría de preguntas trampa</strong>.</p>
                <a href="/pricing" style="display:inline-flex; align-items:center; gap:0.35rem; font-size:0.75rem; font-weight:700; color:var(--primary); text-decoration:none;">Activar Plan Avanzado <i class="fas fa-arrow-right"></i></a>
            </div>
        `;

        weaknesses += upgradeCallout;

        return {
            strengths,
            weaknesses,
            strategy,
            readinessIndex,
            readinessLevel,
            sprint
        };
    }
}

module.exports = AnalyticsService;