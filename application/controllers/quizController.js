const TrainingService = require('../../domain/services/trainingService');
// const db = require('../../infrastructure/database/db'); // ❌ REMOVED: Clean Architecture enforcement
const UsageService = require('../../domain/services/usageService');
const usageService = new UsageService();

class QuizController {

    /**
     * POST /api/quiz/start
     * Inicia una sesión de juego o nueva ronda.
     */
    async startQuiz(req, res) {
        try {
            const { target, areas, round = 1, limit = 5, topic, career } = req.body;
            const user = req.user;

            const finalTarget = target || 'SERUMS';
            const finalCareer = career || 'Medicina Humana';
            let finalAreas = (areas && areas.length > 0) ? areas : (topic ? [topic] : []);

            // 🔄 FALLBACK SERUMS: Si el usuario no tiene configuración, inyectamos el bloque oficial.
            if (finalAreas.length === 0 || (finalAreas.length === 1 && (finalAreas[0].toUpperCase() === 'MEDICINA GENERAL' || finalAreas[0].toUpperCase() === 'GENERAL'))) {
                finalAreas = [
                    'Salud Pública',
                    'Gestión De Servicios De Salud',
                    'Ética E Interculturalidad',
                    'Investigación',
                    'Cuidado Integral De Salud'
                ];
                console.log(`📡 Fallback Controller: Aplicando 5 ejes MINSA para ${user.email}`);
            }

            // Validación básica
            if (finalAreas.length === 0) {
                return res.status(400).json({ error: 'Falta proveer áreas o un tema válido.' });
            }

            // 1. Lógica FREEMIUM: Verificar Límite Global de Vidas (Solo en Ronda 1)
            // ✅ CORRECCIÓN: Basado en Tiers oficiales (Case-Insensitive)
            const tier = String(user.subscriptionTier || 'free').toLowerCase();
            const isPremium = ['basic', 'advanced'].includes(tier) || user.role === 'admin';

            if (round === 1 && !isPremium) {
                const usageCheck = await usageService.checkAndIncrementUsage(user.id);
                if (!usageCheck.allowed) {
                    return res.status(403).json({
                        error: 'Has alcanzado tu límite de acciones gratuitas.',
                        limitReached: true,
                        usage: usageCheck.usage,
                        limit: usageCheck.limit
                    });
                }
            }

            // 🎯 Round Cap for Free Users
            // Rounds 1-2: Free
            // Rounds 3-5: Premium Only
            if (round > 2 && !isPremium) {
                return res.status(403).json({
                    error: 'Los niveles Profesional y Experto son exclusivos de usuarios Premium.',
                    premiumLock: true
                });
            }

            console.log(`🎮 Generando Ronda ${round} de ${finalTarget} para ${user.name}. Limit: ${limit}`);

            // 3. Generar el Quiz Balanceado (Pasamos subscriptionTier para control de IA)
            const categoryOptions = { target: finalTarget, areas: finalAreas, career: finalCareer };
            const quizData = await TrainingService.generateQuiz(categoryOptions, user.id, limit, user.subscriptionTier);

            // 💡 FIX: Devolver el tema ESPECÍFICO (ej: "CARDIOLOGIA") rotado por el servicio,
            // en lugar del genérico "Medicina General".
            const returnedTopic = quizData.topic || finalAreas[0];

            const logTopic = finalAreas.length > 1 ? `Multi-Área (${finalAreas.length} áreas)` : returnedTopic;
            console.log(`✅ Quiz Generado. Tema Real: ${logTopic} en Target: ${finalTarget}`);

            res.json({
                success: true,
                topic: returnedTopic,
                areas: finalAreas, 
                round: round,
                questions: quizData.questions,
                isPremium: isPremium,
                source: quizData.source // Informar al front si fue IA o BANK
            });

        } catch (error) {
            // 🎯 CAPTURA DE AGOTAMIENTO DE BANCO (Uso Profesional del Log)
            // ✅ IA FALLBACK: El servicio ahora gestiona la reposición IA de forma transparente.

            console.error('❌ [Error] startQuiz:', error);

            if (error.message && error.message.includes("No hay preguntas disponibles")) {
                return res.status(404).json({ error: error.message, noQuestions: true });
            }
            res.status(500).json({ error: 'Error interno generando el quiz.' });
        }
    }

    /**
     * POST /api/quiz/submit
     * Guarda el puntaje final.
     */
    async submitScore(req, res) {
        try {
            const { topic, areas, target, difficulty, career, score, correct_answers_count, total_questions, rounds_completed, questions } = req.body;
            const userId = req.user.id;

            if (score === undefined || !topic) {
                return res.status(400).json({ error: 'Datos de puntaje incompletos.' });
            }

            // Llamar al servicio de Entrenamiento para guardar historial y crear flashcards
            // ✅ CONFIGURACIÓN MODIFICADA: "Simulacro Médico" ya NO genera flashcards automáticamente.
            const result = await TrainingService.submitQuizResult(userId, {
                topic,
                areas, // Pasamos al servicio
                target, // Pasamos al servicio
                career, // Pasamos al servicio
                score,
                totalQuestions: total_questions || 10,
                questions: questions || []
            }, { createFlashcards: false });

            // 🎯 ACTUALIZAR LÍMITES DE USO PREMIUM (Solo al CULMINAR el examen)
            // Solo para usuarios Basic o Advanced con suscripción activa.
            const tier = String(req.user.subscriptionTier || 'free').toLowerCase();
            const isActiveAccount = req.user.subscriptionStatus === 'active';

            if (isActiveAccount && ['basic', 'advanced'].includes(tier)) {
                try {
                    await TrainingService.incrementUserSimulatorUsage(userId);
                    console.log(`📉 [Simulator Limit] +1 Simulator Usage (Culminación) para Premium: ${req.user.email}`);
                } catch (limitErr) {
                    console.error("⚠️ Error incrementando uso de simulador al culminar:", limitErr);
                }
            }

            res.json({
                success: true,
                message: 'Puntaje registrado exitosamente.',
                attemptId: result.attemptId,
                flashcardsCreated: result.flashcardsCreated
            });

        } catch (error) {
            console.error('Error en submitScore:', error);
            res.status(500).json({ error: 'Error guardando el puntaje.' });
        }
    }

    /**
     * GET /api/training/flashcards/due
     * Obtiene flashcards pendientes.
     */
    async getDueFlashcards(req, res) {
        try {
            const FlashcardService = require('../../domain/services/flashcardService');
            const cards = await FlashcardService.getDueFlashcards(req.user.id);
            res.json({ success: true, cards });
        } catch (error) {
            console.error('Error getting flashcards:', error);
            res.status(500).json({ error: 'Error obteniendo flashcards.' });
        }
    }

    /**
     * POST /api/training/flashcards/review
     * Procesa el repaso (SM-2).
     */
    async reviewFlashcard(req, res) {
        try {
            const { cardId, quality, currentInterval, currentEf, currentReps } = req.body;
            const FlashcardService = require('../../domain/services/flashcardService');

            const result = await FlashcardService.processReview(cardId, quality, {
                interval_days: currentInterval,
                easiness_factor: currentEf,
                repetition_number: currentReps
            });

            res.json(result);
        } catch (error) {
            console.error('Error reviewing flashcard:', error);
            res.status(500).json({ error: 'Error procesando repaso.' });
        }
    }

    /**
     * POST /api/training/flashcards/check-saved
     * Comprueba si ciertas preguntas ya están guardadas como flashcards.
     */
    async checkSavedFlashcards(req, res) {
        try {
            const { questions, moduleName = 'MEDICINA' } = req.body;
            const userId = req.user.id;

            if (!questions || !Array.isArray(questions) || questions.length === 0) {
                return res.json({ success: true, savedFronts: [] });
            }

            const TrainingRepository = require('../../domain/repositories/trainingRepository');
            const deckId = await TrainingRepository.ensureSystemDeck(userId, moduleName);

            const fronts = questions.map(q => q.question_text ? q.question_text.trim() : typeof q === 'string' ? q.trim() : '');
            
            const savedFronts = await TrainingRepository.checkExistingFlashcards(userId, deckId, fronts);
            
            res.json({ success: true, savedFronts });
        } catch (error) {
            console.error('Error checking saved flashcards:', error);
            res.status(500).json({ error: 'Error comprobando flashcards guardadas.' });
        }
    }

    /**
     * POST /api/training/flashcards/save-from-question
     * Guarda una o varias preguntas manualmente como flashcards.
     */
    async saveFlashcardFromQuestion(req, res) {
        try {
            const { question, topic, attemptId, moduleName = 'MEDICINA' } = req.body;
            const userId = req.user.id;

            if (!question) {
                return res.status(400).json({ error: 'Faltan datos de la pregunta.' });
            }

            const TrainingRepository = require('../../domain/repositories/trainingRepository');
            
            // ✅ ESTRATEGIA "SOLO RESPUESTA": Para optimizar UI y velocidad de repaso,
            // el dorso solo contendrá el texto de la respuesta correcta.
            const questionsArray = Array.isArray(question) ? question : [question];
            const processedQuestions = questionsArray.map(q => {
                return {
                    ...q,
                    explanation_image_url: null // Sin imagen en el dorso para evitar desbordes
                };
            });

            await TrainingRepository.createFlashcardsBatch(userId, processedQuestions, topic || 'General', attemptId || null, moduleName);

            res.json({ success: true, message: 'Flashcard guardada exitosamente.' });
        } catch (error) {
            console.error('Error saving flashcard from question:', error);
            res.status(500).json({ error: 'Error guardando flashcard.' });
        }
    }

    // --- Legacy Stats & Leaderboard (Mantenidos) ---
    /**
     * GET /api/quiz/stats
     * Obtiene estadísticas del jugador (High Score, Total Partidas).
     */
    /**
     * GET /api/quiz/stats
     * Obtiene estadísticas avanzadas para el Dashboard del Estudiante.
     */
    /**
     * GET /api/quiz/stats
     * Query Params: ?context=MEDICINA (Optional)
     */
    async getStats(req, res) {
        try {
            const { context, target } = req.query; // 'MEDICINA', etc.

            // ✅ GUEST MODE: Return example stats if not logged in
            if (!req.user) {
                const exampleKpis = {
                    avg_score: "14.5",
                    accuracy: 72,
                    total_correct: 145,
                    total_incorrect: 55,
                    mastered_cards: 12,
                    strongest_topic: "Cardiología",
                    weakest_topic: "Nefrología",
                    radar_data: [
                        { subject: "Cardiología", accuracy: 85, correct: 40, total: 47 },
                        { subject: "Pediatría", accuracy: 70, correct: 35, total: 50 },
                        { subject: "Ginecología", accuracy: 65, correct: 30, total: 46 },
                        { subject: "Cirugía", accuracy: 60, correct: 25, total: 41 },
                        { subject: "Nefrología", accuracy: 40, correct: 15, total: 37 }
                    ],
                    system_deck_id: "example-deck",
                    isGuest: true
                };
                return res.json({ success: true, kpis: exampleKpis });
            }

            const kpis = await TrainingService.getUserQuizStats(req.user.id, context, target);

            res.json({
                success: true,
                kpis: kpis
            });

        } catch (error) {
            console.error('Error en getStats:', error);
            res.status(500).json({ error: 'Error obteniendo estadísticas.' });
        }
    }

    async getLeaderboard(req, res) {
        try {
            const resultRows = await TrainingService.getLeaderboard();
            res.json({ success: true, leaderboard: resultRows });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error leaderboard' });
        }
    }

    /**
     * GET /api/quiz/evolution
     * Returns data for the progress chart (Last 10 games).
     */
    async getEvolution(req, res) {
        try {
            const { context, target } = req.query;

            // ✅ GUEST MODE: Return example chart data
            if (!req.user) {
                const exampleChart = {
                    labels: ["1 Mar", "2 Mar", "3 Mar", "4 Mar", "5 Mar"],
                    scores: ["12.0", "13.5", "12.8", "15.0", "14.5"]
                };
                return res.json({ success: true, chart: exampleChart });
            }

            const userId = req.user.id;
            const TrainingRepository = require('../../domain/repositories/trainingRepository');

            const data = await TrainingRepository.getQuizEvolution(userId, context, target);

            // Format for Chart.js
            const chartData = {
                labels: data.map(d => d.date_label),
                scores: data.map(d => parseFloat(d.score_20).toFixed(1))
            };

            res.json({ success: true, chart: chartData });

        } catch (error) {
            console.error('Error fetching evolution:', error);
            res.status(500).json({ error: 'Error obteniendo evolución.' });
        }
    }


    /**
     * POST /api/quiz/next-batch
     * Fetches more questions for the same session (Study Mode).
     */
    async getNextBatch(req, res) {
        try {
            const { target, areas, difficulty, topic, career, seenIds } = req.body;
            const userId = req.user.id;

            const finalTarget = target || 'SERUMS';
            const finalCareer = career || 'Medicina Humana';
            let finalAreas = (areas && areas.length > 0) ? areas : (topic ? [topic] : []);

            // 🔄 FALLBACK SERUMS: Si el usuario no tiene configuración (ej: ronda 2 del usuario anterior), inyectamos el bloque oficial.
            if (finalAreas.length === 0 || (finalAreas.length === 1 && (finalAreas[0].toUpperCase() === 'MEDICINA GENERAL' || finalAreas[0].toUpperCase() === 'GENERAL'))) {
                finalAreas = [
                    'Salud Pública',
                    'Gestión De Servicios De Salud',
                    'Ética E Interculturalidad',
                    'Investigación',
                    'Cuidado Integral De Salud'
                ];
                console.log(`📡 Fallback Controller [Batch]: Aplicando 5 ejes MINSA.`);
            }

            // TrainingService.generateQuiz ahora solo consulta la DB para Simulacros Médicos.
            const result = await TrainingService.generateQuiz(
                { target: finalTarget, areas: finalAreas, career: finalCareer },
                userId,
                5,
                req.user.subscriptionTier,
                seenIds || []
            );

            res.json({ 
                success: true, 
                questions: result.questions,
                areas: finalAreas,
                source: result.source
            });

        } catch (error) {
            // 🎯 CAPTURA DE AGOTAMIENTO DE BANCO (Siguiente Lote)
            // ✅ IA FALLBACK

            console.error('❌ [Error] getNextBatch:', error);

            if (error.message && error.message.includes("No hay preguntas disponibles")) {
                return res.status(404).json({ error: error.message, noQuestions: true });
            }
            res.status(500).json({ error: 'Error cargando más preguntas.' });
        }
    }
}

module.exports = new QuizController();
