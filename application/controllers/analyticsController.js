const AnalyticsService = require('../../domain/services/analyticsService');
const UserRepository = require('../../domain/repositories/userRepository'); // 1. Importar la CLASE del repositorio.
const { VertexAI } = require('@google-cloud/vertexai'); // ✅ NUEVO: Importar Vertex para el Analizador

// CONFIGURACIÓN VERTEX AI
const project = process.env.GOOGLE_CLOUD_PROJECT;
const location = process.env.GOOGLE_CLOUD_LOCATION;
const vertex_ai = new VertexAI({ project: project, location: location });

// Instancia Modelo PRO (Para Análisis de Patrones Clínicos)
const modelPro = vertex_ai.preview.getGenerativeModel({
    model: 'gemini-2.5-flash', // Flash / Pro (lo que use Thinking)
    generationConfig: {
        maxOutputTokens: 2048, // Un resumen estructurado
        temperature: 0.3, // Análisis objetivo
        responseMimeType: 'application/json'
    },
});

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
        this.getAIAnalytics = this.getAIAnalytics.bind(this); // ✅ NUEVO: Bindeo para método de IA
        this.getHeatmap = this.getHeatmap.bind(this); // ✅ NUEVO: Heatmap
        this.getAIDiagnostic = this.getAIDiagnostic.bind(this); // ✅ NUEVO: Diagnóstico Thinking
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

    async getAIAnalytics(req, res) {
        try {
            const days = parseInt(req.query.days, 10) || 30;
            const data = await this.analyticsService.getAIAnalytics(days);
            res.json(data);
        } catch (error) {
            console.error('❌ Error obteniendo analítica de IA:', error);
            res.status(500).json({ error: 'Error al obtener estadísticas de IA.' });
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

    async getHeatmap(req, res) {
        try {
            const userId = req.user.id;
            const heatmap = await this.analyticsService.getHeatmapData(userId);
            res.json({ success: true, heatmap });
        } catch (error) {
            console.error('❌ Error in getHeatmap:', error);
            res.status(500).json({ error: 'Error fetching heatmap' });
        }
    }

    // ✅ NUEVO ESPACIO PENSANTE (Thinking API / Reasoning)
    async getAIDiagnostic(req, res) {
        try {
            const userId = req.user.id;
            const { stats } = req.body; // Llega cacheado desde el front (radar_data, avg_score, accuracy)

            if (!stats || !stats.radar_data) {
                return res.status(400).json({ error: 'Faltan datos estadísticos para analizar.' });
            }

            console.log(`🧠 [THINKING] Generando diagnóstico clínico para el usuario ${userId}...`);

            // Prompt analítico (Rol: Tutor Jefe de Residentes)
            const prompt = `
            Actúa como un Tutor Médico experto (Jefe de Residentes).
            Analiza el siguiente historial reciente de un estudiante de medicina preparando sus exámenes de titulación:
            
            Nota Promedio: ${stats.avg_score} / 20
            Precisión Global: ${stats.accuracy}%
            Tarjetas Repasadas y Dominadas: ${stats.mastered_cards}
            
            RENDIMIENTO POR ÁREAS CLÍNICAS:
            ${JSON.stringify(stats.radar_data, null, 2)}
            
            TAREA:
            Genera un diagnóstico preciso y directo de máximo 2 párrafos indicando en qué áreas es fuerte, y en cuáles DEBE reforzar su estudio para no jalar el examen. Usa un tono alentador pero estricto y profesional.
            
            JSON ESTRICTO:
            {
                "strengths": "Texto HTML crudo con puntos fuertes (ej. <strong>Cardiología:</strong> Buen manejo de ECG...).",
                "weaknesses": "Texto HTML crudo con debilidades críticas resaltadas (ej. <strong>Pediatría:</strong> Urge repasar inmunizaciones...)"
            }
            `;

            const result = await modelPro.generateContent(prompt);
            const text = result.response.candidates[0].content.parts[0].text;

            let diagnostic;
            try {
                diagnostic = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());

                // 💸 DESCONTAR LÍMITE (Thinking Token) - SOLO SI EL PARSEO FUE EXITOSO
                try {
                    const db = require('../../infrastructure/database/db');
                    if (req.usageType) {
                        await db.query(
                            `UPDATE users SET ${req.usageType} = ${req.usageType} + 1 WHERE id = $1`,
                            [userId]
                        );
                        console.log(`📉 Límite de ${req.usageType} incrementado para usuario ${userId}. (THINKING EXITOSO)`);
                    }
                } catch (limitErr) {
                    console.error("⚠️ No se pudo actualizar el límite Thinking. Continuando...", limitErr);
                }

            } catch (err) {
                console.error("❌ Fallo parseando el JSON del Diagnóstico", err);
                diagnostic = {
                    strengths: "Tus datos base son sólidos, sigue practicando.",
                    weaknesses: "Hubo un pequeño error procesando tus áreas débiles, intenta más tarde. (No se consumió cuota)"
                };
            }

            res.json({ success: true, ...diagnostic });

        } catch (error) {
            console.error('❌ Error en getAIDiagnostic:', error);
            res.status(500).json({ error: 'Hubo un problema generando tu diagnóstico con IA.' });
        }
    }
}

module.exports = AnalyticsController;