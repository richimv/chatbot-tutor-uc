const AnalyticsService = require('../../domain/services/analyticsService');

class AnalyticsController {
    constructor() {
        console.log('🔄 Inicializando AnalyticsController...');
        this.analyticsService = new AnalyticsService();
        console.log('✅ AnalyticsController inicializado correctamente');

        // ✅ BIND EXPLÍCITO para mantener el contexto de 'this' en las rutas de Express
        this.getAnalytics = this.getAnalytics.bind(this);
        this.getSearchTrends = this.getSearchTrends.bind(this);
        this.getPopularCoursePrediction = this.getPopularCoursePrediction.bind(this);
        this.recordFeedback = this.recordFeedback.bind(this);
    }

    async getAnalytics(req, res) {
        try {
            // Ahora 'this' se refiere a la instancia de AnalyticsController
            const analytics = await this.analyticsService.getDashboardAnalytics();
            res.json(analytics);
        } catch (error) {
            console.error('❌ Error obteniendo analytics:', error);
            res.status(500).json({ error: 'Error al obtener las estadísticas.' });
        }
    }

    async getSearchTrends(req, res) {
        try {
            const trends = await this.analyticsService.getSearchTrends();
            res.json(trends);
        } catch (error) {
            console.error('❌ Error obteniendo tendencias de búsqueda:', error);
            res.status(500).json({ error: 'Error al obtener las tendencias.' });
        }
    }

    async getPopularCoursePrediction(req, res) {
        try {
            const prediction = await this.analyticsService.predictPopularCourse();
            res.json(prediction);
        } catch (error) {
            console.error('❌ Error obteniendo predicción de curso:', error);
            res.status(500).json({ error: 'Error al obtener la predicción.' });
        }
    }

    async recordFeedback(req, res) {
        try {
            const { query, response, isHelpful } = req.body;
            // ✅ OBTENER EL ID DEL USUARIO DESDE EL TOKEN
            // El middleware 'auth' ya nos da el usuario en req.user.
            // Necesitamos buscar su ID numérico de la tabla 'users'.
            const userRecord = req.user ? await new (require('../../domain/repositories/userRepository'))().findById(req.user.id) : null;
            await this.analyticsService.recordFeedback(query, response, isHelpful, userRecord ? userRecord.id : null);
            res.status(200).json({ message: 'Feedback registrado.' });
        } catch (error) {
            console.error('❌ Error registrando feedback:', error);
            res.status(500).json({ error: 'Error al registrar el feedback.' });
        }
    }    

    async getAnalyticsForML(req, res) {
        try {
            const data = await this.analyticsService.getAnalyticsForML();
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener datos de analítica.' });
        }
    }
    
}

// ✅ CREAR Y EXPORTAR UNA ÚNICA INSTANCIA DEL CONTROLADOR
// Esto asegura que los métodos estén bindeados correctamente antes de ser usados.
const analyticsControllerInstance = new AnalyticsController();

module.exports = analyticsControllerInstance;