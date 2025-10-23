const AnalyticsRepository = require('../repositories/analyticsRepository');
const CourseRepository = require('../repositories/courseRepository');

class AnalyticsService {
    constructor() {
        this.analyticsRepo = new AnalyticsRepository();
        this.courseRepo = new CourseRepository();
    }

    // Registrar búsqueda con análisis de intención
    async recordSearchWithIntent(query, results, intent = null) {
        await this.analyticsRepo.recordSearch(query, results.length);
        
        // Si no se proporciona intención, intentar inferirla
        if (!intent) {
            intent = this.inferIntentFromQuery(query);
        }
        
        console.log(`📊 Analytics: Búsqueda "${query}" → ${intent} (${results.length} resultados)`);
    }

    // Inferir intención de la consulta
    inferIntentFromQuery(query) {
        query = query.toLowerCase();
        
        if (query.includes('hora') || query.includes('horario') || query.includes('cuándo')) {
            return 'consulta_horario';
        } else if (query.includes('material') || query.includes('ejercicio') || query.includes('tarea')) {
            return 'solicitar_material';
        } else if (query.includes('qué es') || query.includes('que es') || query.includes('explicame') || query.includes('cómo funciona')) {
            return 'duda_teorica';
        } else if (query.includes('examen') || query.includes('parcial') || query.includes('califica')) {
            return 'consulta_evaluacion';
        } else {
            return 'consulta_general';
        }
    }

    // PREDICCIÓN DE CURSO MÁS BUSCADO
    async predictPopularCourse() {
        const trends = await this.analyticsRepo.getSearchTrends(20);
        const courses = await this.courseRepo.findAll();
        
        if (trends.length === 0) {
            return {
                predictedCourse: 'Programación I', // Default
                confidence: 0.5,
                reason: 'Sin datos suficientes, curso por defecto',
                searchCount: 0
            };
        }

        // Análisis de correlación entre búsquedas y cursos
        const courseScores = {};
        
        for (const trend of trends) {
            const foundCourses = await this.courseRepo.search(trend.query);
            foundCourses.forEach(course => {
                courseScores[course.nombre] = (courseScores[course.nombre] || 0) + trend.count;
            });
        }

        // Encontrar curso con mayor score
        let topCourse = { nombre: '', score: 0 };
        Object.entries(courseScores).forEach(([nombre, score]) => {
            if (score > topCourse.score) {
                topCourse = { nombre, score };
            }
        });

        const confidence = Math.min(topCourse.score / 50, 0.95); // Máximo 95% de confianza

        return {
            predictedCourse: topCourse.nombre || 'Programación I',
            confidence: confidence,
            searchCount: topCourse.score,
            reason: `Basado en ${topCourse.score} búsquedas relacionadas este mes`,
            trendingQueries: trends.slice(0, 5)
        };
    }

    // Obtener analytics completos
    async getCompleteAnalytics() {
        const [searchTrends, chatAnalytics, popularCourse] = await Promise.all([
            this.analyticsRepo.getSearchTrends(10),
            this.analyticsRepo.getChatAnalytics(),
            this.predictPopularCourse()
        ]);

        return {
            searchTrends,
            chatAnalytics,
            popularCourse,
            timestamp: new Date().toISOString()
        };
    }

    // Registrar conversación del chatbot
    async recordChatInteraction(userMessage, botResponse, intent, confidence) {
        return await this.analyticsRepo.recordChatMessage(
            userMessage, 
            botResponse, 
            intent, 
            confidence
        );
    }

    // Registrar feedback del usuario
    async recordUserFeedback(conversationId, rating, comments) {
        return await this.analyticsRepo.recordFeedback(conversationId, rating, comments);
    }
}

module.exports = AnalyticsService;