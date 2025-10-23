const AnalyticsService = require('../../domain/services/analyticsService');

class AnalyticsController {
    constructor() {
        this.analyticsService = new AnalyticsService();
    }

    // Obtener analytics completos
    async getAnalytics(req, res) {
        try {
            const analytics = await this.analyticsService.getCompleteAnalytics();
            res.json(analytics);
        } catch (error) {
            console.error('❌ Error obteniendo analytics:', error);
            res.status(500).json({ error: 'Error al obtener analytics' });
        }
    }

    // Obtener tendencias de búsqueda
    async getSearchTrends(req, res) {
        try {
            const trends = await this.analyticsService.analyticsRepo.getSearchTrends(10);
            res.json(trends);
        } catch (error) {
            console.error('❌ Error obteniendo tendencias:', error);
            res.status(500).json({ error: 'Error al obtener tendencias' });
        }
    }

    // Obtener predicción de curso popular
    async getPopularCoursePrediction(req, res) {
        try {
            const prediction = await this.analyticsService.predictPopularCourse();
            res.json(prediction);
        } catch (error) {
            console.error('❌ Error obteniendo predicción:', error);
            res.status(500).json({ error: 'Error al obtener predicción' });
        }
    }

    // Registrar feedback
    async recordFeedback(req, res) {
        try {
            const { conversationId, rating, comments } = req.body;
            
            await this.analyticsService.recordUserFeedback(conversationId, rating, comments);
            
            res.json({ 
                success: true, 
                message: 'Feedback registrado exitosamente' 
            });
        } catch (error) {
            console.error('❌ Error registrando feedback:', error);
            res.status(500).json({ error: 'Error al registrar feedback' });
        }
    }
}

module.exports = new AnalyticsController();