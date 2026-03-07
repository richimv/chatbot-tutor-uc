const MLService = require('../../domain/services/mlService');
const AnalyticsService = require('../../domain/services/analyticsService');
const KnowledgeBaseRepository = require('../../domain/repositories/knowledgeBaseRepository');
const CourseRepository = require('../../domain/repositories/courseRepository');
const CareerRepository = require('../../domain/repositories/careerRepository');
const BookRepository = require('../../domain/repositories/bookRepository');
// ✅ FASE II: Importar el nuevo servicio de chat para manejar el historial.
const ChatService = require('../../domain/services/chatService');

class ChatController {
    constructor(chatService, analyticsService, usageService) { // ✅ usageService inyectado
        console.log('🔄 Inicializando ChatController...');
        this.mlService = MLService;
        this.analyticsService = analyticsService;
        this.usageService = usageService; // ✅ Guardar referencia
        this.knowledgeBaseRepo = new KnowledgeBaseRepository();
        this.chatService = chatService;
        console.log('✅ ChatController inicializado correctamente');

        // Bindeo explícito para mantener el contexto
        this.processMessage = this.processMessage.bind(this);
        this.trainModel = this.trainModel.bind(this);
        // ✅ FASE II: Bindeo de los nuevos métodos para el historial.
        this.getUserConversations = this.getUserConversations.bind(this);
        this.getConversationMessages = this.getConversationMessages.bind(this);
        this.updateConversationTitle = this.updateConversationTitle.bind(this); // ✅ MEJORA
        this.deleteConversation = this.deleteConversation.bind(this); // ✅ MEJORA
    }

    /**
     * Procesa un mensaje del usuario, lo clasifica, obtiene una respuesta de la IA
     * y guarda toda la interacción en la base de datos.
     */
    async processMessage(req, res) {
        try {
            console.log('💬 ChatController.processMessage: this context:', {
                hasMlService: !!this.mlService,
                hasAnalyticsService: !!this.analyticsService,
            });

            // ✅ FASE II: Extraer datos del request.
            const { message } = req.body;
            let { conversationId } = req.body; // 'let' porque puede ser creado.
            const userId = req.user.id; // Obtenido del token JWT.

            if (!message || message.trim() === '') {
                return res.status(400).json({ error: 'El mensaje no puede estar vacío' });
            }

            console.log('💬 Procesando mensaje:', message);

            if (!this.mlService) {
                console.error('❌ ERROR CRÍTICO: mlService no está disponible');
                throw new Error('Servicio ML no disponible');
            }

            if (!this.analyticsService) {
                console.error('❌ ERROR CRÍTICO: analyticsService no está disponible');
            }

            // --- ✅ FASE II: LÓGICA DE PERSISTENCIA DEL CHAT ---
            // 1. Si es un mensaje nuevo, crear la conversación en la BD.
            if (!conversationId) {
                const title = message.substring(0, 50) + (message.length > 50 ? '...' : '');
                const newConversation = await this.chatService.chatRepository.createConversation(userId, title);
                conversationId = newConversation.id;
            }

            // 2. Guardar el mensaje del usuario en la BD.
            await this.chatService.chatRepository.addMessage(conversationId, 'user', message);

            // 3. Obtener el historial COMPLETO desde la BD para dar contexto a la IA.
            const conversationHistory = await this.chatService.chatRepository.getMessagesByConversationId(conversationId, userId);

            // --- ✅ FASE III: PREVENCIÓN RAG INTELIGENTE (PRE-FLIGHT CHECK) ---
            const pool = require('../../infrastructure/database/db');
            const userQuery = await pool.query('SELECT subscription_tier, monthly_thinking_usage FROM users WHERE id = $1', [userId]);
            const userAct = userQuery.rows[0];
            const tierLimits = { free: 0, basic: 0, advanced: 5 }; // Hardcode referencial a matriz de límites
            const maxThinking = tierLimits[userAct.subscription_tier] || 0;
            const hasThinkingQuota = userAct.monthly_thinking_usage < maxThinking;

            // --- LÓGICA ORIGINAL DE IA (MODIFICADA PARA USAR EL HISTORIAL Y FILTROS) ---
            let classification;
            try {
                const loadedKBSet = await this.knowledgeBaseRepo.load();

                console.log(`🤖 Intentando generar respuesta con LLM. Cuota Thinking Activa: ${hasThinkingQuota}. Tier: ${req.userTier}.`);
                // Se pasa el historial obtenido de la base de datos.
                classification = await this.mlService.classifyIntent(message, conversationHistory, {
                    knowledgeBaseRepo: this.knowledgeBaseRepo,
                    courseRepo: new CourseRepository(),
                    careerRepo: new CareerRepository(),
                    bookRepo: new BookRepository(),
                    knowledgeBaseSet: loadedKBSet,
                    userTier: req.userTier || 'free',
                    disableRAG: !hasThinkingQuota // Bloquea silenciosamente RAG si no hay cuota, degradando la IA
                });

                if (classification.usedRAG) {
                    console.log(`📚 RAG EXITOSO: La IA utilizó fragmentos de la base documental.`);
                } else if (!hasThinkingQuota) {
                    console.log(`🚫 RAG SKIPPED: Usuario no tiene cuota 'Thinking' (Tier: ${req.userTier}).`);
                }
            } catch (mlError) {
                console.error('❌ ERROR CRÍTICO llamando a mlService:', mlError);
                return res.status(500).json({ error: 'El servicio de IA no está disponible' });
            }

            const response = await this.enrichResponse(message, classification);

            // 4. Guardar la respuesta del bot en la BD.
            const botMessage = await this.chatService.chatRepository.addMessage(conversationId, 'bot', response.respuesta);

            // 5. REGISTRAR EN ANALYTICS (Lógica original)
            if (this.analyticsService) {
                // ✅ REFACTOR: Usar clasificación centralizada basada en CONTENIDO
                const isEducational = this.analyticsService.isQueryEducational(message);

                await this.analyticsService.recordSearchWithIntent(
                    message,
                    [], // No hay "resultados" directos en una conversación de chat
                    isEducational,
                    userId, 'chatbot' // ✅ MEJORA: Especificar que la fuente es el chatbot.
                );
            }

            // 6. ACTUALIZAR LÍMITES DE USO IA (Cobro Híbrido: Standard vs Thinking)
            try {
                const pool = require('../../infrastructure/database/db');
                // Si la IA empleó contexto RAG complejo, se cobrará de la cuota mensual Thinking (solo disponible para Avanzados)
                // ✅ RESTRICCIÓN: Jamás sobrescribir si el Middleware dictó el consumo de una Vida Global Trial (usage_count)
                if (classification && classification.usedRAG && req.usageType !== 'usage_count') {
                    req.usageType = 'monthly_thinking_usage';
                }

                if (req.usageType) {
                    await pool.query(
                        `UPDATE users SET ${req.usageType} = ${req.usageType} + 1 WHERE id = $1`,
                        [userId]
                    );
                    console.log(`📉 Límite de ${req.usageType} incrementado para usuario ${userId}.`);
                }
            } catch (limitErr) {
                console.error("⚠️ No se pudo actualizar el límite del usuario. Continuando igualmente...", limitErr);
            }

            console.log('✅ Respuesta generada exitosamente');

            res.json({
                ...response,
                // Devolver siempre el ID de la conversación para que el frontend pueda continuarla.
                conversationId: conversationId,
                // ✅ NUEVO: Devolver el ID del mensaje del bot para el feedback.
                messageId: botMessage.id,
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

    /**
     * Obtiene la lista de todas las conversaciones de un usuario.
     */
    async getUserConversations(req, res) {
        try {
            const userId = req.user.id;
            const conversations = await this.chatService.getConversations(userId);
            res.json(conversations);
        } catch (error) {
            console.error('❌ Error obteniendo conversaciones:', error);
            res.status(500).json({ error: 'Error al obtener las conversaciones.' });
        }
    }

    /**
     * Obtiene todos los mensajes de una conversación específica.
     */
    async getConversationMessages(req, res) {
        try {
            const userId = req.user.id;
            const conversationId = parseInt(req.params.id, 10);
            const messages = await this.chatService.getMessages(conversationId, userId);
            res.json(messages);
        } catch (error) {
            console.error('❌ Error obteniendo mensajes:', error);
            res.status(500).json({ error: 'Error al obtener los mensajes de la conversación.' });
        }
    }

    /**
     * Actualiza el título de una conversación.
     */
    async updateConversationTitle(req, res) {
        try {
            const userId = req.user.id;
            const conversationId = parseInt(req.params.id, 10);
            const { title } = req.body;

            if (!title || title.trim() === '') {
                return res.status(400).json({ error: 'El título no puede estar vacío.' });
            }

            const updatedConversation = await this.chatService.updateConversationTitle(conversationId, title, userId);
            res.json(updatedConversation);
        } catch (error) {
            console.error('❌ Error actualizando título de conversación:', error);
            res.status(500).json({ error: 'Error al actualizar el título.' });
        }
    }

    /**
     * Elimina una conversación.
     */
    async deleteConversation(req, res) {
        try {
            const userId = req.user.id;
            const conversationId = parseInt(req.params.id, 10);

            const wasDeleted = await this.chatService.deleteConversation(conversationId, userId);

            if (wasDeleted) {
                res.status(204).send(); // No Content
            } else {
                // Esto puede pasar si el usuario intenta borrar un chat que no es suyo o no existe.
                res.status(404).json({ error: 'Conversación no encontrada o no tienes permiso para eliminarla.' });
            }
        } catch (error) {
            console.error('❌ Error eliminando conversación:', error);
            res.status(500).json({ error: 'Error al eliminar la conversación.' });
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
        // Si no, usamos las sugerencias predefinidas como fallback.
        // ✅ MEJORA: Sugerencias centradas en el usuario ("Yo quiero...") en lugar de preguntas del bot.
        // ✅ MEJORA: Sugerencias centradas en el usuario ("Yo quiero...") 
        const predefinedSuggestions = {
            'solicitar_material': [
                "Ver libros del curso",
                "Buscar papers clave"
            ],
            'duda_teorica': [
                "Dame ejemplos",
                "¿Qué libros hablan de esto?"
            ],
            'consulta_evaluacion': [
                "¿Qué temas entran?",
                "Ver fechas importantes"
            ],
            'consulta_administrativa': [
                "Ver fechas de matrícula",
                "Contactar soporte"
            ]
        };
        // Fallback general más útil y seguro
        return predefinedSuggestions[intencion] || [
            "Buscar cursos",
            "Ver libros de Anatomía",
            "Explícame un tema"
        ];
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

module.exports = ChatController; // ✅ CORRECCIÓN: Exportar la clase, no la instancia.