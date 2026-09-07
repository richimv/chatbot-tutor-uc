const AnalyticsService = require('../../domain/services/analyticsService');
const UserRepository = require('../../domain/repositories/userRepository'); // 1. Importar la CLASE del repositorio.
const { VertexAI } = require('@google-cloud/vertexai'); // ✅ NUEVO: Importar Vertex para el Analizador
const securityUtils = require('../../domain/utils/securityUtils');

// CONFIGURACIÓN VERTEX AI
const project = process.env.GOOGLE_CLOUD_PROJECT || 'mock-gcp-project';
const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
let vertex_ai = null;
try {
    vertex_ai = new VertexAI({ project: project, location: location });
} catch (e) {
    console.warn('⚠️ AnalyticsController: VertexAI no inicializado (Modo test o sin credenciales).');
}

class AnalyticsController {
    constructor(analyticsService, userRepository) { // 2. Recibir el repositorio en el constructor.
        this.analyticsService = analyticsService;
        this.userRepository = userRepository; // 3. Guardar la instancia del repositorio.

        // SOLUCIÓN DEFINITIVA: Bindeo explícito para mantener el contexto de 'this' en las rutas de Express.
        // Esto asegura que `this.analyticsService` siempre esté disponible.
        // BIND EXPLÍCITO para mantener el contexto de 'this' en las rutas de Express
        this.getAnalytics = this.getAnalytics.bind(this);
        this.getSearchTrends = this.getSearchTrends.bind(this);
        this.getInteractionTrends = this.getInteractionTrends.bind(this);
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
        this.recordPulse = this.recordPulse.bind(this); // ✅ NUEVO: Registro de pulso
        this.getRealTimeStats = this.getRealTimeStats.bind(this); // ✅ NUEVO: Estadísticas en vivo
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

    async getInteractionTrends(req, res) {
        try {
            const days = parseInt(req.query.days, 10) || 30;
            const trends = await this.analyticsService.getInteractionTrends(days);
            res.json(trends);
        } catch (error) {
            console.error('❌ Error obteniendo tendencias de interacción:', error);
            res.status(500).json({ error: 'Error al obtener las tendencias de interacción.' });
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
            const userId = req.user ? req.user.id : null; // ✅ Soporte para invitados

            if (!entityType || !entityId) {
                return res.status(400).json({ error: 'entityType y entityId son requeridos.' });
            }
            await this.analyticsService.recordView(entityType, entityId, userId);
            res.status(202).send(); // 202 Accepted
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
            const { deckId } = req.query;
            const heatmap = await this.analyticsService.getHeatmapData(userId, deckId || null);
            res.json({ success: true, heatmap });
        } catch (error) {
            console.error('❌ Error in getHeatmap:', error);
            res.status(500).json({ error: 'Error fetching heatmap' });
        }
    }

    async _callGeminiDiagnostic(prompt) {
        const apiKey = process.env.GEMINI_API_KEY;

        // 1. Canal Primario: Google Cloud Vertex AI (GCP Enterprise)
        const vertexCandidateModels = [
            'gemini-2.5-flash-lite',
            'gemini-2.5-flash'
        ];
        console.log(`📡 [VertexAI Analytics] Conectando a Vertex AI SDK (GCP Enterprise)...`);
        for (const modelName of vertexCandidateModels) {
            try {
                const vertexModel = vertex_ai.getGenerativeModel({
                    model: modelName,
                    generationConfig: {
                        maxOutputTokens: 2048,
                        temperature: 0.4,
                        responseMimeType: 'application/json'
                    }
                });
                const result = await vertexModel.generateContent(prompt);
                if (result && result.response && result.response.candidates && result.response.candidates[0] && result.response.candidates[0].content) {
                    const rawText = result.response.candidates[0].content.parts[0].text;
                    console.log(`✅ [VertexAI Analytics Éxito] Diagnóstico generado con modelo: ${modelName}`);
                    return rawText;
                }
            } catch (err) {
                console.warn(`⚠️ [VertexAI Analytics Fallo - ${modelName}]:`, err.message);
            }
        }

        // 2. Canal Secundario de Contingencia: Google AI Studio REST API
        if (apiKey) {
            const candidateModels = [
                'gemini-3.5-flash-lite',
                'gemini-3.1-flash-lite',
                'gemini-2.5-flash-lite'
            ];
            const axios = require('axios');
            for (const modelName of candidateModels) {
                try {
                    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
                    const payload = {
                        contents: [{ role: 'user', parts: [{ text: prompt }] }],
                        generationConfig: {
                            responseMimeType: 'application/json',
                            temperature: 0.4,
                            maxOutputTokens: 2048
                        }
                    };
                    console.log(`📡 [REST Analytics Contingencia] Llamando a ${modelName} vía Google AI Studio...`);
                    const res = await axios.post(url, payload, { timeout: 20000 });
                    if (res.data && res.data.candidates && res.data.candidates[0] && res.data.candidates[0].content) {
                        const rawText = res.data.candidates[0].content.parts[0].text;
                        console.log(`✅ [REST Analytics Éxito] Diagnóstico generado con modelo: ${modelName}`);
                        return rawText;
                    }
                } catch (err) {
                    console.warn(`⚠️ [REST Analytics Fallo - ${modelName}]:`, err.message);
                }
            }
        }

        throw new Error('No se pudo conectar con los proveedores de IA (Vertex y REST).');
    }

    async getAIDiagnostic(req, res) {
        try {
            const userId = req.user.id;
            const tier = req.userTier || 'free';
            const { stats: rawStats, context: rawContext = 'MEDICINA' } = req.body;

            // Sanitizar/Validar entrada de contexto
            const context = typeof rawContext === 'string' 
                ? rawContext.replace(/[^A-Z]/g, '').substring(0, 20) 
                : 'MEDICINA';

            // Validación de datos estadísticos mínimos y sanitización
            if (!rawStats || !rawStats.radar_data) {
                return res.status(400).json({ error: 'Faltan datos estadísticos para analizar.' });
            }

            let stats;
            try {
                stats = securityUtils.validateDiagnosticStats(rawStats);
            } catch (err) {
                return res.status(400).json({ error: 'Datos estadísticos inválidos o corruptos.' });
            }

            // 💸 DESCONTAR CUOTA / VIDAS según el tipo definido por el middleware (usage_count para Free, daily_ai_usage para Advanced)
            if (req.usageType && tier !== 'admin') {
                try {
                    const db = require('../../infrastructure/database/db');
                    await db.query(
                        `UPDATE users SET ${req.usageType} = ${req.usageType} + 1 WHERE id = $1`,
                        [userId]
                    );
                    console.log(`📉 Cuota de ${req.usageType} incrementada para usuario ${userId} en Diagnóstico.`);
                } catch (limitErr) {
                    console.error("⚠️ No se pudo actualizar el límite en base de datos. Continuando...", limitErr);
                }
            }

            // Retornar Diagnóstico Heurístico Inteligente para cuentas no Premium (free, basic, pending, etc.) o si se forzó el fallback
            if ((tier !== 'advanced' && tier !== 'admin') || req.fallbackToStatic) {
                const diagnostic = this.analyticsService.generateHeuristicDiagnostic(stats, context);
                return res.json({ success: true, ...diagnostic });
            }

            console.log(`🧠 [IA MULTI-MÓDULO] Generando diagnóstico cognitivo profundo con IA para el usuario ${userId} en contexto ${context}...`);

            // Adaptar dinámicamente el prompt según el contexto
            let tutorRole = "Tutor Médico experto y evaluador del Examen Nacional de Medicina (ENAM / SERUMS / Residentado)";
            let examType = "médico cirujano en preparación intensiva para sus exámenes oficiales nacionales";
            let areaLabel = "RENDIMIENTO Y MATRIZ POR ÁREAS CLÍNICAS";
            let strengthTextPrompt = "El análisis debe centrarse en el dominio clínico, razonamiento diagnóstico, correlación fisiopatológica y precisión terapéutica. Destaca sus áreas más sólidas con porcentajes reales de acierto.";
            let weaknessTextPrompt = "Identifica patrones de error sistemático, sesgos diagnósticos (ej. sesgo de anclaje, confusión en dosis críticas o no reconocer signos de alarma) y el riesgo real en el puntaje de la prueba oficial.";
            let highYieldPrompt = "Una 'Píldora Clínica High-Yield' de alto impacto que suelen preguntar en los exámenes oficiales sobre una de sus áreas débiles.";
            let step1Title = "Refuerzo Clínico y Guías Oficiales";
            let step2Title = "Entrenamiento en Descarte Rápido";
            let step3Title = "Simulacros de Alta Exigencia";

            if (context === 'EDUCACION') {
                tutorRole = "Asesor Pedagógico Especialista en Evaluación y Currículo Nacional (CNEB / Minedu)";
                examType = "docente en preparación para la Prueba Nacional de Nombramiento o Ascenso de Escala Magisterial";
                areaLabel = "RENDIMIENTO POR COMPETENCIAS PEDAGÓGICAS";
                strengthTextPrompt = "El análisis debe centrarse en la mediación pedagógica, resolución de casuísticas de aula, criterios de retroalimentación reflexiva y didáctica específica.";
                weaknessTextPrompt = "Identifica patrones de confusión en casuísticas (ej. confundir retroalimentación descriptiva con reflexiva, o confundir conflicto cognitivo con disonancia) y el impacto en la matriz de rúbricas oficiales.";
                highYieldPrompt = "Una 'Píldora Pedagógica High-Yield' sobre un principio doctrinal clave del CNEB de alta recurrencia en la prueba nacional.";
                step1Title = "Refuerzo Doctrinal del CNEB";
                step2Title = "Casuísticas de Retroalimentación";
                step3Title = "Simulacros de Gestión y Rúbricas";
            }

            // Prompt analítico adaptado para Plan Avanzado (Deep Reasoning)
            const prompt = `
            Actúa como un ${tutorRole}.
            Analiza el historial de rendimiento de un ${examType}:
            
            Nota Promedio: ${stats.avg_score} / 20
            Precisión Global: ${stats.accuracy}%
            Tarjetas Repasadas y Dominadas: ${stats.mastered_cards}
            
            ${areaLabel}:
            ${JSON.stringify(stats.radar_data, null, 2)}
            
            TAREA:
            Genera una auditoría diagnóstica cognitiva profunda de alto nivel profesional y analítico. Detecta sesgos de razonamiento, patrones de error frente a distractores y oportunidades críticas de mejora antes de la prueba oficial. Usa un tono de mentor de élite: analítico, riguroso, pero altamente motivador y accionable.
            
            JSON ESTRICTO:
            {
                "readinessIndex": 82,
                "readinessLevel": "Nivel Competente Avanzado",
                "strengths": "HTML sin etiquetas <html> o <body>. Usa <p style='color:var(--text-secondary); font-size:0.85rem; line-height:1.6; margin-bottom:1rem;'> para un resumen inicial. Luego usa <ul style='margin:0; padding:0; list-style:none;'> con items <li style='display:flex; align-items:start; gap:0.75rem; margin-bottom:0.75rem; color:var(--text-main); font-size:0.85rem; line-height:1.4;'><i class='fas fa-check-circle' style='color:var(--primary); margin-top:2px;'></i><span>...</span></li>. ${strengthTextPrompt} Menciona su precisión específica.",
                "weaknesses": "Mismo formato HTML (Párrafo + Lista ul/li). El icono de la lista debe ser: <i class='fas fa-crosshairs' style='color:var(--text-muted); margin-top:2px;'></i>. ${weaknessTextPrompt}",
                "strategy": "Texto conciso de 1 o 2 oraciones con la recomendación de estudio más importante para su próxima sesión.",
                "highYieldTip": "${highYieldPrompt}",
                "sprint": [
                    { "step": 1, "title": "${step1Title}", "desc": "Acción concreta de estudio y revisión teórica recomendada." },
                    { "step": 2, "title": "${step2Title}", "desc": "Acción de práctica focalizada en simuladores comentados." },
                    { "step": 3, "title": "${step3Title}", "desc": "Acción de consolidación y prueba de velocidad para la prueba oficial." }
                ]
            }
            `;

            let diagnostic;
            try {
                const rawText = await this._callGeminiDiagnostic(prompt);
                diagnostic = JSON.parse(rawText.replace(/```json/g, '').replace(/```/g, '').trim());
            } catch(err) {
                console.warn("⚠️ [Diagnóstico IA Fallback] Usando motor heurístico enriquecido por:", err.message);
                diagnostic = this.analyticsService.generateHeuristicDiagnostic(stats, context);
            }

            return res.json({ success: true, ...diagnostic });

        } catch (error) {
            console.error('❌ Error en getAIDiagnostic:', error);
            try {
                const fallback = this.analyticsService.generateHeuristicDiagnostic(req.body.stats || {}, req.body.context || 'MEDICINA');
                return res.json({ success: true, ...fallback });
            } catch (fallbackErr) {
                res.status(500).json({ error: 'Hubo un problema generando tu diagnóstico con IA.' });
            }
        }
    }

    // ==========================================
    // NUEVO: CONTROLADORES DE TRÁFICO REAL-TIME
    // ==========================================

    async recordPulse(req, res) {
    try {
        const { sessionId, isMobile } = req.body;
        const userId = req.user ? req.user.id : null;

        if (!sessionId) {
            return res.status(400).json({ error: 'sessionId es requerido.' });
        }

        await this.analyticsService.logPulse(sessionId, userId, isMobile);
        res.status(204).send();
    } catch (error) {
        // ✅ CORRECCIÓN: Si es un error de red (DNS/Conexión), logeamos un warning silencioso
        // Esto evita que el servidor se llene de errores rojos por micro-cortes de internet.
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.syscall === 'getaddrinfo') {
            console.warn('⚠️ Pulso de tráfico omitido temporalmente por inestabilidad de red (DNS/Supabase).');
        } else {
            console.error('❌ Error registrando pulso:', error);
        }
        // Respondemos 200/204 de todos modos para no afectar al frontend
        res.status(204).send();
    }
}

    async getRealTimeStats(req, res) {
    try {
        const stats = await this.analyticsService.getRealTimeStats();
        res.json(stats);
    } catch (error) {
        console.error('❌ Error obteniendo tráfico real-time:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas en vivo.' });
    }
}
}

module.exports = AnalyticsController;
