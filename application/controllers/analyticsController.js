const AnalyticsService = require('../../domain/services/analyticsService');
const UserRepository = require('../../domain/repositories/userRepository'); // 1. Importar la CLASE del repositorio.

class AnalyticsController {
    constructor(analyticsService, userRepository) { // 2. Recibir el repositorio en el constructor.
        this.analyticsService = analyticsService;
        this.userRepository = userRepository; // 3. Guardar la instancia del repositorio.

        // SOLUCIÓN DEFINITIVA: Bindeo explícito para mantener el contexto de 'this' en las rutas de Express.
        // Esto asegura que `this.analyticsService` siempre esté disponible.
        // BIND EXPLÍCITO para mantener el contexto de 'this' en las rutas de Express
        this.getAnalytics = this.getAnalytics.bind(this);
        this.getSearchTrends = this.getSearchTrends.bind(this);
        this.getPopularCoursePrediction = this.getPopularCoursePrediction.bind(this);
        this.recordFeedback = this.recordFeedback.bind(this);
        this.getFeedback = this.getFeedback.bind(this);
        this.getAnalyticsForML = this.getAnalyticsForML.bind(this);
        this.recordView = this.recordView.bind(this);
        this.getTimeSeriesData = this.getTimeSeriesData.bind(this);
        this.getCourseTimeSeriesData = this.getCourseTimeSeriesData.bind(this); // NUEVO
        this.getTopicTimeSeriesData = this.getTopicTimeSeriesData.bind(this); // NUEVO
        this.getFeaturedBooks = this.getFeaturedBooks.bind(this); // NUEVO
        this.getFeaturedCourses = this.getFeaturedCourses.bind(this); // NUEVO
    }

    async getAnalytics(req, res) {
        try {
            const days = parseInt(req.query.days, 10) || 30; // Filtro por defecto: 30 días
            const analytics = await this.analyticsService.getDashboardAnalytics(days);
            res.json(analytics);
        } catch (error) {
            console.error('❌ Error obteniendo analytics:', error);
            res.status(500).json({ error: 'Error al obtener las estadísticas.' });
        }
    }

    async getSearchTrends(req, res) {
        try {
            // SOLUCIÓN: Leer el parámetro 'days' de la URL y pasarlo al servicio.
            const days = parseInt(req.query.days, 10) || 30;
            const trends = await this.analyticsService.getSearchTrends(days);
            res.json(trends);
        } catch (error) {
            console.error('❌ Error obteniendo tendencias de búsqueda:', error);
            res.status(500).json({ error: 'Error al obtener las tendencias.' });
        }
    }

    async getPopularCoursePrediction(req, res) {
        try {
            const days = parseInt(req.query.days, 10) || 30; // ✅ Acepta days
            const prediction = await this.analyticsService.predictPopularCourse(days);
            res.json(prediction);
        } catch (error) {
            console.error('❌ Error obteniendo predicción de curso:', error);
            res.status(500).json({ error: 'Error al obtener la predicción.' });
        }
    }

    // ... (recordFeedback, recordView, getFeedback, getAnalyticsForML remain the same)

    // Endpoint para series de tiempo de CURSOS
    async getCourseTimeSeriesData(req, res) {
        try {
            const days = parseInt(req.query.days, 10) || 30;
            const data = await this.analyticsService.getCourseTimeSeriesData(days);
            res.json(data);
        } catch (error) {
            console.error('❌ Error obteniendo series de tiempo de cursos:', error);
            res.status(500).json({ error: 'Error al obtener las series de tiempo de cursos.' });
        }
    }

    // Endpoint para series de tiempo de TEMAS
    async getTopicTimeSeriesData(req, res) {
        try {
            const days = parseInt(req.query.days, 10) || 30;
            const data = await this.analyticsService.getTopicTimeSeriesData(days);
            res.json(data);
        } catch (error) {
            console.error('❌ Error obteniendo series de tiempo de temas:', error);
            res.status(500).json({ error: 'Error al obtener las series de tiempo de temas.' });
        }
    }

    // DEPRECATED: El endpoint genérico anterior se mantiene por compatibilidad si es necesario, 
    // pero el frontend usará los específicos.
    async getTimeSeriesData(req, res) {
        try {
            const days = parseInt(req.query.days, 10) || 7;
            const data = await this.analyticsService.getTimeSeriesData(days);
            res.json(data);
        } catch (error) {
            console.error('❌ Error obteniendo series de tiempo:', error);
            res.status(500).json({ error: 'Error al obtener las series de tiempo.' });
        }
    }
    async recordFeedback(req, res) {
        try {
            const { query, response, isHelpful, messageId } = req.body;
            // ✅ OBTENER EL ID DEL USUARIO DESDE EL TOKEN
            // El middleware 'auth' ya nos da el usuario en req.user.
            // ✅ 4. Usar la instancia correcta del repositorio que fue inyectada.
            const userRecord = req.user ? await this.userRepository.findById(req.user.id) : null;
            await this.analyticsService.recordFeedback(query, response, isHelpful, userRecord ? userRecord.id : null, messageId);
            // Se cambia a 204 No Content, que es más apropiado para una acción que no necesita devolver datos.
            res.status(204).send();
        } catch (error) {
            console.error('❌ Error registrando feedback:', error);
            res.status(500).json({ error: 'Error al registrar el feedback.' });
        }
    }

    // Controlador para registrar una vista de página.
    async recordView(req, res) {
        try {
            const { entityType, entityId } = req.body;
            const userId = req.user.id;

            if (!entityType || !entityId) {
                return res.status(400).json({ error: 'entityType y entityId son requeridos.' });
            }
            await this.analyticsService.recordView(entityType, entityId, userId);
            res.status(202).send(); // 202 Accepted: La petición fue aceptada, no necesita devolver contenido.
        } catch (error) {
            console.error('❌ Error registrando vista de página:', error);
            res.status(500).json({ error: 'Error al registrar la vista.' });
        }
    }

    // Controlador para obtener todos los feedbacks.
    async getFeedback(req, res) {
        try {
            const feedbackData = await this.analyticsService.getAllFeedback();
            res.json(feedbackData);
        } catch (error) {
            console.error('❌ Error obteniendo todos los feedbacks:', error);
            res.status(500).json({ error: 'Error al obtener los datos de feedback.' });
        }
    }

    async getFeaturedBooks(req, res) {
        try {
            const limit = parseInt(req.query.limit, 10) || 10;
            const books = await this.analyticsService.getFeaturedBooks(limit);
            res.json(books);
        } catch (error) {
            console.error('❌ Error obteniendo libros destacados:', error);
            res.status(500).json({ error: 'Error al obtener libros destacados.' });
        }
    }

    async getFeaturedCourses(req, res) {
        try {
            const limit = parseInt(req.query.limit, 10) || 10;
            const courses = await this.analyticsService.getFeaturedCourses(limit);
            res.json(courses);
        } catch (error) {
            console.error('❌ Error obteniendo cursos destacados:', error);
            res.status(500).json({ error: 'Error al obtener cursos destacados.' });
        }
    }

    async getAnalyticsForML(req, res) {
        try {
            // ✅ SOLUCIÓN: Aceptar parámetro de días (default 90 para ML si no se especifica)
            const days = parseInt(req.query.days, 10) || 90;
            const data = await this.analyticsService.getAnalyticsForML(days);
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener datos de analítica.' });
        }
    }
}

module.exports = AnalyticsController; // ✅ CORRECCIÓN: Exportar la clase, no la instancia.