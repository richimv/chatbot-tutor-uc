const AnalyticsRepository = require('../repositories/analyticsRepository');
const CourseRepository = require('../repositories/courseRepository');
const PythonMLService = require('./pythonMLService'); // ✅ Importamos el nuevo servicio

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
        // ✅ Delegamos la lógica al servicio de Python.
        // Pasamos un query vacío porque solo nos interesa la predicción general.
        const recommendations = await PythonMLService.getRecommendations('', []);
        return recommendations.popularCourse || { predictedCourse: 'N/A', confidence: 0, reason: 'Servicio ML no disponible' };
    }

    // ✅ NUEVO: PREDICCIÓN DE TEMA MÁS BUSCADO
    async predictPopularTopic() {
        // ✅ Delegamos la lógica al servicio de Python.
        const recommendations = await PythonMLService.getRecommendations('', []);
        return recommendations.popularTopic || { predictedTopic: 'N/A', confidence: 0, reason: 'Servicio ML no disponible' };
    }

    // Obtener analytics completos
    async getCompleteAnalytics() {
        const [searchTrends, chatAnalytics, popularCourse, popularTopic] = await Promise.all([
            this.analyticsRepo.getSearchTrends(10),
            this.analyticsRepo.getChatAnalytics(),
            this.predictPopularCourse(), // Esta función ahora llama al servicio de Python
            this.predictPopularTopic()  // Esta también
        ]);

        return {
            searchTrends,
            chatAnalytics,
            popularCourse,
            popularTopic, // ✅ Devolvemos el tema popular
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