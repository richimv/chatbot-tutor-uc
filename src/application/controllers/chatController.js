const KnowledgeBaseRepository = require('../../domain/repositories/knowledgeBaseRepository');
// ✅ FASE II: Importar el nuevo servicio de chat para manejar el historial.
const ChatService = require('../../domain/services/chatService');
const TutorAiService = require('../../domain/services/tutorAiService');
const asistenteGuiaKnowledge = require('../../domain/services/asistenteGuiaKnowledge');

class ChatController {
    constructor(chatService, analyticsService, usageService) {
        console.log('🔄 Inicializando ChatController...');
        this.analyticsService = analyticsService;
        this.usageService = usageService;
        this.knowledgeBaseRepo = new KnowledgeBaseRepository();
        this.chatService = chatService;
        console.log('✅ ChatController inicializado correctamente');

        // Bindeo explícito para mantener el contexto
        this.processMessage = this.processMessage.bind(this);
        this.trainModel = this.trainModel.bind(this);
        this.getUserConversations = this.getUserConversations.bind(this);
        this.getConversationMessages = this.getConversationMessages.bind(this);
        this.updateConversationTitle = this.updateConversationTitle.bind(this);
        this.deleteConversation = this.deleteConversation.bind(this);
    }

    /**
     * Procesa un mensaje del usuario, lo clasifica, obtiene una respuesta de la IA
     * o devuelve respuestas estáticas de alta velocidad para preguntas frecuentes.
     */
    async processMessage(req, res) {
        try {
            console.log('💬 ChatController.processMessage iniciado');

            const { message, specialization = 'neutral', context, ephemeral = true, resourceId = null, resourceContext = null } = req.body;
            let { conversationId } = req.body;
            const userId = req.user ? req.user.id : null; // Soporte para visitantes no autenticados

            if (!message || message.trim() === '') {
                return res.status(400).json({ error: 'El mensaje no puede estar vacío' });
            }

            const isQuizTutor = context && context.type === 'quiz_tutor';
            const isFlashcardTutor = context && context.type === 'flashcard_tutor';
            const isEphemeral = true; // El chat general ya NO se guarda en PostgreSQL/Supabase

            // ⚡ CHAT GENERAL ES 100% ESTÁTICO Y EFÍMERO PARA TODOS LOS USUARIOS (0ms / 0 Costo IA)
            const isGeneralChat = !isQuizTutor && !isFlashcardTutor;

            if (isGeneralChat) {
                const staticResp = asistenteGuiaKnowledge.matchIntent(message);
                console.log(`⚡ [Asistente Guía 0ms] Respuesta estática devuelta a usuario (${userId ? 'Registrado' : 'Visitante'}): ${staticResp.intencion}`);
                return res.json({
                    intencion: staticResp.intencion,
                    respuesta: staticResp.respuesta,
                    sugerencias: staticResp.sugerencias,
                    isStatic: true,
                    conversationId: 'ephemeral',
                    messageId: 'temp',
                    timestamp: new Date().toISOString()
                });
            }

            console.log('⚡ MODO EFÍMERO: Procesando mensaje en memoria de sesión.');
            conversationId = conversationId || 'ephemeral';
            const conversationHistory = req.body.history || [];

            // Determinar especialización final y examen objetivo
            let finalSpecialization;
            if (isFlashcardTutor) {
                finalSpecialization = 'flashcard_tutor';
            } else {
                const rawSpec = req.body.specialization || req.userSpecialization || (context && (context.examContext || context.specialization)) || 'medicine';
                finalSpecialization = (rawSpec.toLowerCase().includes('educa') || rawSpec === 'EDUCACION') ? 'education' : 'medicine';
            }
            const targetExam = (context && context.target) || req.body.target || req.userTarget || (finalSpecialization === 'education' ? 'ASCENSO' : 'SERUMS');

            // RAG solo se activa si req.useRag fue evaluado como true en checkLimitsMiddleware (exclusivo para Quiz Tutor)
            const hasRAGAccess = isQuizTutor ? (req.useRag === true) : false;

            // ✅ INYECCIÓN DE CONTEXTO PARA TUTOR DE FLASHCARDS (Multidisciplinario y Especializado)
            let processedMessage = message;
            if (context && context.type === 'flashcard_tutor') {
                const deckCategory = context.deckCategory || 'General';
                const deckName = context.deckName || 'Mazo de Estudio';
                const topic = context.topic || 'General';
                const front = context.front || 'Sin texto';
                const back = context.back || 'Sin texto';
                const hasImages = (context.imageUrl || context.explanationImageUrl) ? 'Sí (imágenes disponibles en la tarjeta)' : 'No';
                const hasAudio = (context.audioUrlFront || context.audioUrlBack) ? 'Sí (audio disponible en la tarjeta)' : 'No';
                const isListeningMode = (context.hideTextFront || context.hideTextBack) ? 'Sí (modo de ocultación de texto activo)' : 'No';

                let visualSection = '';
                if (context.imageUrl) {
                    visualSection += `\n- IMAGEN DEL ANVERSO / CONCEPTO: ${context.imageUrl}`;
                }
                if (context.explanationImageUrl) {
                    visualSection += `\n- IMAGEN DEL REVERSO / EXPLICACIÓN: ${context.explanationImageUrl}`;
                }

                const tutorInstruction = `[MODO: TUTOR ACADÉMICO MULTIDISCIPLINARIO DE FLASHCARDS]
Eres un tutor y mentor de élite en Hub Academia, experto en la disciplina de **${deckCategory}**.
El estudiante está repasando sus tarjetas mnemotécnicas y tiene una duda específica.

ESTRUCTURA DEL MAZO Y CONTEXTO DE LA TARJETA:
- ÁREA TEMÁTICA / DISCIPLINA: ${deckCategory}
- MAZO DE ESTUDIO: ${deckName}
- TEMA ESPECÍFICO: ${topic}
- ANVERSO DE LA TARJETA (Pregunta / Concepto Clave):
${front}
- REVERSO DE LA TARJETA (Respuesta / Fundamento Doctrinal / Explicación):
${back}
- RECURSOS VISUALES: ${hasImages}${visualSection}
- RECURSOS DE AUDIO: ${hasAudio}
- MODO ESCUCHA/OCULTACIÓN: ${isListeningMode}

DIRECTRICES DE RESPUESTA:
1. Adopta de inmediato la mentalidad, terminología y rigor técnico de la disciplina correspondiente (${deckCategory}). Por ejemplo:
   - Si es **Derecho**: Fundamenta con doctrina jurídica, preceptos normativos, jurisprudencia y principios generales del derecho.
   - Si es **Medicina**: Explica con precisión clínica, fisiopatología, farmacología o guías de práctica.
   - Si es **Educación**: Explica con didáctica pedagógica, enfoque por competencias y lineamientos del CNEB/MINEDU.
   - Si es **Tecnología / Programación**: Explica con rigor técnico de computación, algoritmos, arquitectura de software, redes, bases de datos, ciberseguridad o conceptos de IA, con ejemplos de código limpio cuando aplique.
   - Si es otra materia (**Matemáticas, Historia, Ciencias**): Utiliza el marco teórico y analítico exacto de la materia.
2. Explica con claridad pedagógica y expande el concepto para consolidar el aprendizaje significativo.
3. 🚨 PROHIBICIÓN ESTRICTA: NO hagas referencias a "consultas médicas", "normas de salud", "cursos de la plataforma" o temas no relacionados a menos que la tarjeta sea explícitamente de esa materia.

PREGUNTA DEL ESTUDIANTE:
${message}`;

                processedMessage = tutorInstruction;
                console.log(`🧠 [FlashcardTutor] Contexto inyectado para área: ${deckCategory} | Mazo: ${deckName}`);
            }

            // ✅ INYECCIÓN DE CONTEXTO PARA TUTOR DE SIMULADOR DE EXAMEN (Quiz Tutor)
            if (context && context.type === 'quiz_tutor') {
                const examDomain = String(context.examDomain || context.examContext || (finalSpecialization === 'education' ? 'EDUCACION' : 'MEDICINA')).toUpperCase();
                const target = context.target || targetExam || (examDomain === 'EDUCACION' ? 'ASCENSO' : 'SERUMS');
                const career = context.career || 'No especificada';
                const difficulty = context.difficulty || 'Senior';
                const topic = context.topic || context.area || 'General';
                const areas = (context.areas && Array.isArray(context.areas) && context.areas.length > 0) 
                    ? context.areas.join(', ') 
                    : topic;

                // 1. Normalización segura de opciones de respuesta
                let rawOptions = context.options || [];
                if (typeof rawOptions === 'string') {
                    try {
                        const parsed = JSON.parse(rawOptions);
                        if (Array.isArray(parsed)) rawOptions = parsed;
                    } catch (e) {
                        rawOptions = [rawOptions];
                    }
                }
                let safeOptions = [];
                if (Array.isArray(rawOptions)) {
                    safeOptions = rawOptions.map(opt => typeof opt === 'string' ? opt : (opt?.text || opt?.option || JSON.stringify(opt)));
                } else if (typeof rawOptions === 'object' && rawOptions !== null) {
                    safeOptions = Object.values(rawOptions).map(opt => typeof opt === 'string' ? opt : (opt?.text || opt?.option || JSON.stringify(opt)));
                }

                // 2. Normalización de pregunta
                const questionText = (context.questionText || context.question_text || context.question || '').trim();

                // 3. Normalización de clave oficial e intento del estudiante
                const correctIdx = (context.correctOptionIndex !== null && context.correctOptionIndex !== undefined && !isNaN(Number(context.correctOptionIndex)))
                    ? Number(context.correctOptionIndex)
                    : null;
                
                const userIdx = (context.userOptionIndex !== null && context.userOptionIndex !== undefined && !isNaN(Number(context.userOptionIndex)))
                    ? Number(context.userOptionIndex)
                    : (context.userAnswer !== null && context.userAnswer !== undefined && !isNaN(Number(context.userAnswer)))
                        ? Number(context.userAnswer)
                        : null;

                const correctLetter = correctIdx !== null ? String.fromCharCode(65 + correctIdx) : 'N/A';
                const correctText = (correctIdx !== null && safeOptions[correctIdx]) ? safeOptions[correctIdx] : (context.correctOptionText || 'No especificada');

                const userLetter = userIdx !== null ? String.fromCharCode(65 + userIdx) : null;
                const userText = (userIdx !== null && safeOptions[userIdx]) ? safeOptions[userIdx] : (context.userOptionText || null);
                const isUserCorrect = Boolean(context.isUserCorrect || (userIdx !== null && correctIdx !== null && userIdx === correctIdx));

                // 4. Formatear opciones para el prompt
                let optionsFormatted = '';
                if (safeOptions.length > 0) {
                    optionsFormatted = safeOptions.map((opt, i) => `  [${String.fromCharCode(65 + i)}] ${opt}`).join('\n');
                } else {
                    optionsFormatted = '  (No se proporcionaron opciones cerradas para este reactivo)';
                }

                // 5. Casuística / Situación compartida / Apoyo visual
                let caseSection = '';
                if (context.caseDescription || context.caseTitle || context.caseTableHtml || context.caseImageUrl) {
                    caseSection = `\nCASUÍSTICA / SITUACIÓN COMPARTIDA:
${context.caseTitle ? `Título: ${context.caseTitle}\n` : ''}${context.caseDescription || ''}${context.caseTableHtml ? `\nTabla / Datos de Apoyo:\n${context.caseTableHtml}\n` : ''}${context.caseImageUrl ? `\nImagen de Casuística: ${context.caseImageUrl}\n` : ''}`;
                }

                let visualSupportSection = '';
                if (context.imageUrl) {
                    visualSupportSection = `\nIMAGEN DE APOYO EN LA PREGUNTA: ${context.imageUrl}`;
                }

                // 6. Información de respuesta del estudiante
                let studentSelectionInfo = '- RESPUESTA SELECCIONADA POR EL ESTUDIANTE: El estudiante aún no ha marcado una alternativa (o está consultando antes de responder).';
                if (userLetter !== null) {
                    studentSelectionInfo = `- RESPUESTA SELECCIONADA POR EL ESTUDIANTE: Opción [${userLetter}] (${userText || ''}) -> ${isUserCorrect ? '✅ Correcta' : '❌ Incorrecta'}`;
                }

                const tutorInstruction = `[MODO: TUTOR DE SIMULADOR DE EXAMEN]
Eres un tutor de élite de Hub Academia especializado en ${examDomain === 'EDUCACION' ? 'Currículo Nacional, Didáctica y Casuística Pedagógica (MINEDU / CNEB)' : 'Medicina Peruana, Normas Técnicas MINSA, GPC y Diagnóstico Clínico'}.
El estudiante está interactuando con este reactivo en un simulacro interactivo y tiene una duda sobre su resolución, la clave o el sustento.

CONFIGURACIÓN DE EXAMEN Y CONTEXTO DEL ALUMNO:
- DOMINIO ACADÉMICO: ${examDomain}
- EXAMEN OBJETIVO (TARGET): ${target}
- NIVEL / ESPECIALIDAD (CAREER): ${career}
- DIFICULTAD CONFIGURADA: ${difficulty}
- ÁREA O TEMA: ${topic}
- ÁREAS SELECCIONADAS EN LA PRUEBA: ${areas}${caseSection}

DETALLES COMPLETOS DEL REACTIVO DEL SIMULADOR:
- ENUNCIADO DE LA PREGUNTA:
${questionText || 'Pregunta del simulacro'}${visualSupportSection}

- OPCIONES DE RESPUESTA:
${optionsFormatted}

- CLAVE CORRECTA OFICIAL: Opción [${correctLetter}] (${correctText})
${studentSelectionInfo}
- EXPLICACIÓN / SUSTENTO OFICIAL DE LA CLAVE:
${context.explanation || 'No especificada en el banco'}

DIRECTRICES CLAVE PARA EL TUTOR:
1. Explica con claridad, rigor pedagógico y didáctica por qué la clave correcta [${correctLetter}] es la opción acertada.
2. Analiza las alternativas cuando sea pertinente para despejar dudas y reforzar el aprendizaje del alumno.
3. 🚨 TIENES ACCESO COMPLETO AL REACTIVO Y A SUS OPCIONES. NUNCA digas que no te proporcionaron las opciones ni la pregunta.

---
PREGUNTA O DUDA DEL ESTUDIANTE:
${message}`;

                processedMessage = tutorInstruction;
                console.log(`🧠 Quiz Tutor Context Injected | Exam: ${target} (${career}) | Domain: ${examDomain} | Options: ${safeOptions.length}`);
            }

            // --- ✅ FASE III: PROCESAMIENTO IA (V6 - TutorAiService) ---
            let aiResult;
            try {
                console.log(`🤖 Generando respuesta V6. RAG: ${hasRAGAccess}. Tier: ${req.userTier}. Spec: ${finalSpecialization}. Target: ${targetExam}`);

                // Llamada al servicio especializado con el mensaje procesado
                aiResult = await TutorAiService.handleChat(processedMessage, conversationHistory, {
                    rawUserMessage: message,
                    target: targetExam,
                    specialization: finalSpecialization,
                    category: (context && context.deckCategory) || null,
                    userTier: req.userTier,
                    namespace: (finalSpecialization === 'medicine' || finalSpecialization === 'education') ? finalSpecialization : 'general',
                    resourceContext: resourceContext, // ✅ Pasar el contexto del recurso cargado al servicio IA
                    context: context, // ✅ Pasar el contexto estructurado de reactivo o flashcard para resolución multimodal
                    useRag: hasRAGAccess
                });

                // TutorAiService ya devuelve { intencion, respuesta, sugerencias } parseados

            } catch (aiError) {
                console.error('❌ ERROR CRÍTICO llamando a TutorAiService:', aiError);
                return res.status(500).json({ error: 'El servicio de IA no está disponible' });
            }

            const response = await this.enrichResponse(message, aiResult);

            // 4. Guardar la respuesta del bot en la BD (Solo si no es efímero).
            let botMessage = { id: 'temp' };
            if (!isEphemeral) {
                botMessage = await this.chatService.chatRepository.addMessage(conversationId, 'bot', response.respuesta);
            }

            // 5. REGISTRAR EN ANALYTICS (Solo si hay usuario autenticado)
            if (this.analyticsService && userId) {
                const isEducational = this.analyticsService.isQueryEducational(message);

                await this.analyticsService.recordSearchWithIntent(
                    message,
                    [],
                    isEducational,
                    userId, 'chatbot'
                ).catch(err => console.warn("⚠️ Analytics error:", err.message));
            }

            // 6. ACTUALIZAR LÍMITES DE USO IA (Solo si aplica cobro y hay usuario autenticado)
            if (userId && req.usageType) {
                try {
                    if (req.usageType === 'usage_count') {
                        const cost = req.cost || 1;
                        await this.usageService.checkAndIncrementUsage(userId, cost);
                        console.log(`📉 Límite de usage_count incrementado (+${cost}) para usuario ${userId}.`);
                    } else if (req.usageType) {
                        const pool = require('../../infrastructure/database/db');
                        if (req.incrementRag) {
                            await pool.query(`UPDATE users SET ${req.usageType} = ${req.usageType} + 1, daily_rag_usage = daily_rag_usage + 1 WHERE id = $1`, [userId]);
                            console.log(`📉 Límite de ${req.usageType} (+1) y daily_rag_usage (+1) incrementado para usuario ${userId}.`);
                        } else {
                            await pool.query(`UPDATE users SET ${req.usageType} = ${req.usageType} + 1 WHERE id = $1`, [userId]);
                            console.log(`📉 Límite de ${req.usageType} (+1) incrementado para usuario ${userId}.`);
                        }
                    }
                } catch (limitErr) {
                    console.error("⚠️ No se pudo actualizar el límite del usuario:", limitErr.message);
                }
            }

            console.log('✅ Respuesta generada exitosamente');

            // ✅ NUEVO: Generación de título inteligente para conversaciones nuevas
            if (!conversationId && !isEphemeral) {
                // (Ya se creó arriba con un placeholder)
            } else if (!req.body.conversationId && !isEphemeral) {
                // Detectamos que era una conversación nueva por la ausencia de ID en el request original
                TutorAiService.generateConversationTitle(message, response.respuesta)
                    .then(newTitle => {
                        console.log(`✨ Nuevo título generado: ${newTitle}`);
                        this.chatService.chatRepository.updateTitle(conversationId, newTitle, userId);
                    })
                    .catch(err => console.warn("⚠️ Fallo al generar título inteligente:", err));
            }

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
        const { intencion, confianza, respuesta, idioma_detectado } = llmResult;
        console.log('🎯 Generando respuesta contextual para:', intencion);

        let enrichedResponse = respuesta;
        // La lógica de enriquecimiento de cursos ahora la maneja Gemini con Function Calling.

        return {
            intencion,
            confianza: confianza || 0.85,
            respuesta: enrichedResponse,
            idioma_detectado: idioma_detectado || 'es',
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
            "Quiero saber más",
            "Dame un ejemplo",
            "¿Cómo puedo aplicar esto?"
        ];
    }

    async trainModel(req, res) {
        try {
            console.log('🎯 Solicitado re-entrenamiento del modelo...');
            const MLService = require('../../domain/services/mlService');
            const result = await MLService.trainModel();
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
