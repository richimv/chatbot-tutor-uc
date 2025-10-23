const MLService = require('../../domain/services/mlService');
const AnalyticsService = require('../../domain/services/analyticsService');

class ChatController {
    constructor() {
        console.log('🔄 Inicializando ChatController...');
        this.mlService = MLService;
        this.analyticsService = new AnalyticsService();
        console.log('✅ ChatController inicializado correctamente');
        
        // ✅ BIND EXPLÍCITO para mantener el contexto
        this.processMessage = this.processMessage.bind(this);
        this.trainModel = this.trainModel.bind(this);
    }

    async processMessage(req, res) {
        try {
            console.log('💬 ChatController.processMessage: this context:', {
                hasMlService: !!this.mlService,
                hasAnalyticsService: !!this.analyticsService,
            });

            const { message, conversationId = null, conversationHistory = [] } = req.body;
            
            if (!message || message.trim() === '') {
                return res.status(400).json({ error: 'El mensaje no puede estar vacío' });
            }

            console.log('💬 Procesando mensaje:', message);

            // ✅ VERIFICAR SERVICIOS
            if (!this.mlService) {
                console.error('❌ ERROR CRÍTICO: mlService no está disponible');
                throw new Error('Servicio ML no disponible');
            }

            if (!this.analyticsService) {
                console.error('❌ ERROR CRÍTICO: analyticsService no está disponible');
            }

            // 1. GENERAR RESPUESTA CON LLM (GEMINI)
            // Ya no hay fallback. La llamada al LLM es la única fuente de verdad.
            let classification;
            try { // Pasa el historial de conversación a mlService
                console.log('🤖 Intentando generar respuesta con LLM...');
                classification = await this.mlService.classifyIntent(message, conversationHistory);
                console.log('✅ Respuesta de LLM recibida:', classification);
            } catch (mlError) {
                console.error('❌ ERROR CRÍTICO llamando a mlService:', mlError);
                // Si el servicio de ML falla por completo, devolvemos un error 500.
                return res.status(500).json({ error: 'El servicio de IA no está disponible' });
            }

            // 2. ENRIQUECER LA RESPUESTA (Opcional)
            // La respuesta principal ya viene del LLM. Aquí podemos añadir datos extra si es necesario.
            const response = await this.enrichResponse(message, classification);
            
            // 3. REGISTRAR EN ANALYTICS
            if (this.analyticsService) {
                await this.analyticsService.recordChatInteraction(
                    message, 
                    response.respuesta, 
                    response.intencion, 
                    response.confianza || 0.9
                );
            }

            console.log('✅ Respuesta generada exitosamente');

            res.json({
                ...response,
                conversationId: conversationId || Date.now().toString(),
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Error en ChatController.processMessage:', error);
            res.status(500).json({ 
                error: 'Error al procesar el mensaje',
                respuesta: 'Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta nuevamente.'
            });
        }
    }

    async enrichResponse(userMessage, llmResult) {
        // La respuesta principal ya viene del LLM.
        // Esta función ahora solo añade información extra o sugerencias.
        const { intencion, confianza, respuesta } = llmResult;
        console.log('🎯 Generando respuesta contextual para:', intencion);

        let enrichedResponse = respuesta;
        // La lógica de enriquecimiento de cursos ahora la maneja Gemini con Function Calling.

        return {
            intencion,
            confianza: confianza || 0.85,
            respuesta: enrichedResponse,
            sugerencias: await this.generateChatSuggestions(intencion, llmResult)
        };
    }
    
    // findRelevantCourses ya no es necesario aquí, la lógica de búsqueda de cursos
    // se maneja directamente en mlService a través de la herramienta getCourseDetails
    // que llama a CourseRepository.

    async generateChatSuggestions(intencion, llmResult) {
        // Si el LLM ya proveyó sugerencias, podríamos usarlas.
        if (llmResult.sugerencias && llmResult.sugerencias.length > 0) {
            return llmResult.sugerencias;
        }

        // Si no, usamos las sugerencias predefinidas como fallback.
        const predefinedSuggestions = {
            'consulta_horario': [
                "¿Horarios de teoría o laboratorio?",
                "¿De qué curso específico?"
            ],
            'solicitar_material': [
                "Material de 'Programación I'",
                "¿Buscas PDFs o videos?"
            ],
            'duda_teorica': [
                "Explícame 'qué es una API'",
                "¿Necesitas ejemplos prácticos?"
            ],
            'consulta_evaluacion': [
                "¿Examen parcial o final?",
                "¿Fechas o contenidos?"
            ],
            'consulta_administrativa': [
                "Información sobre matrícula",
                "¿Horarios de atención?"
            ]
        };
        return predefinedSuggestions[intencion] || ["¿En qué más puedo ayudarte?", "¿Necesitas información de otro curso?"];
    }

    async trainModel(req, res) {
        try {
            console.log('🎯 Solicitado re-entrenamiento del modelo...');
            if (!this.mlService) {
                throw new Error('Servicio ML no disponible');
            }
            const result = await this.mlService.trainModel();
            res.json(result);
        } catch (error) {
            console.error('❌ Error entrenando modelo:', error);
            res.status(500).json({ 
                error: 'Error entrenando el modelo',
                detalles: error.message 
            });
        }
    }
}

// ✅ CREAR INSTANCIA Y HACER BIND
const chatControllerInstance = new ChatController();

// ✅ VERIFICAR QUE LOS MÉTODOS ESTÉN BINDEADOS
console.log('🔧 ChatController métodos bindeados:', {
    processMessage: typeof chatControllerInstance.processMessage,
    trainModel: typeof chatControllerInstance.trainModel
});

module.exports = chatControllerInstance;