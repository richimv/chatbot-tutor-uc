const TrainingService = require('../../domain/services/trainingService');
const db = require('../../infrastructure/database/db'); // Acceso directo a BD para guardar scores
const UsageService = require('../../domain/services/usageService');
const usageService = new UsageService();

class QuizController {

    /**
     * POST /api/quiz/start
     * Inicia una sesión de juego o nueva ronda.
     */
    async startQuiz(req, res) {
        try {
            const { target, areas, difficulty, round = 1, limit = 5, topic, career } = req.body;
            const user = req.user;

            const finalTarget = target || 'SERUMS';
            const finalCareer = career || 'Medicina Humana';
            let finalAreas = (areas && areas.length > 0) ? areas : (topic ? [topic] : []);

            // 🔄 FALLBACK SERUMS: Si el usuario no tiene configuración, inyectamos el bloque oficial.
            if (finalAreas.length === 0 || (finalAreas.length === 1 && (finalAreas[0].toUpperCase() === 'MEDICINA GENERAL' || finalAreas[0].toUpperCase() === 'GENERAL'))) {
                finalAreas = [
                    'Salud Pública y Epidemiología',
                    'Gestión de Servicios de Salud',
                    'Ética Deontología e Interculturalidad',
                    'Medicina Legal',
                    'Investigación y Bioestadística',
                    'Cuidado Integral'
                ];
                console.log(`📡 Fallback Controller: Aplicando 6 áreas SERUMS para ${user.email}`);
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

            // 2. MODO ESTRICTO: Respetar la dificultad seleccionada por el usuario
            // Ya no forzamos "Básico" en rondas bajas si el usuario eligió "Experto".
            let aiDifficulty = difficulty || 'Básico';

            console.log(`🎮 Generando Ronda ${round} [Nivel ${aiDifficulty}] de ${finalTarget} para ${user.name}. Limit: ${limit}`);

            // 3. Generar el Quiz Balanceado (Pasamos subscriptionTier para control de IA)
            const categoryOptions = { target: finalTarget, areas: finalAreas, career: finalCareer };
            const quizData = await TrainingService.generateQuiz(categoryOptions, aiDifficulty, user.id, limit, user.subscriptionTier);

            // 💡 FIX: Devolver el tema ESPECÍFICO (ej: "CARDIOLOGIA") rotado por el servicio,
            // en lugar del genérico "Medicina General".
            const returnedTopic = quizData.topic || finalAreas[0];

            const logTopic = finalAreas.length > 1 ? `Multi-Área (${finalAreas.length} áreas)` : returnedTopic;
            console.log(`✅ Quiz Generado. Tema Real: ${logTopic} en Target: ${finalTarget}`);

            res.json({
                success: true,
                topic: returnedTopic,
                areas: finalAreas, // 🔄 Sincronización de Áreas para lotes subsiguientes
                difficulty: aiDifficulty,
                round: round,
                questions: quizData.questions,
                isPremium: isPremium
            });

        } catch (error) {
            // 🎯 CAPTURA DE AGOTAMIENTO DE BANCO (Uso Profesional del Log)
            if (error.message === "BANCO_AGOTADO_TIER") {
                console.log(`🚫 [Limit] Bloqueo de inicio de Quiz: Banco Agotado para el usuario.`);
                return res.status(403).json({ success: false, errorCode: 'BANK_EXHAUSTED' });
            }

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
                difficulty,
                score,
                totalQuestions: total_questions || 10,
                questions: questions || []
            }, { createFlashcards: false });

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

            const TrainingRepository = require('../../infrastructure/repositories/trainingRepository');
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

            const TrainingRepository = require('../../infrastructure/repositories/trainingRepository');
            
            // Reutilizamos el batch method enviando un array de 1 elemento
            await TrainingRepository.createFlashcardsBatch(userId, Array.isArray(question) ? question : [question], topic || 'General', attemptId || null, moduleName);

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

            const userId = req.user.id;

            const db = require('../../infrastructure/database/db');

            // --- 0. CONTEXT FILTER ---
            // Map context to topic keywords if needed, or use generic filter
            let topicFilter = '';
            const params = [userId];
            if (context === 'MEDICINA') {
                if (target) {
                    params.push(target);
                    // Match exams explicitly marked with this target OR legacy exams where difficulty held the valid target
                    topicFilter = `AND (target = $2 OR (target IS NULL AND difficulty = $2))`;
                } else {
                    // Fallback para todo el ecosistema (todas las dificultades antiguas y modernas unificadas)
                    topicFilter = `AND difficulty IN ('ENAM', 'SERUMS', 'ENARM', 'RESIDENTADO', 'Básico', 'Intermedio', 'Avanzado')`;
                }
            } else if (context) {
                // Generic fallback
                params.push(`%${context}%`);
                topicFilter = `AND topic ILIKE $2`;
            }

            // --- 1. QUIZ STATS (KPIs) ---
            // score = correct answers count (from frontend state.score)
            // total_questions = total questions in that game
            const quizQuery = `
                SELECT 
                    COUNT(*) as total_games,
                    COALESCE(SUM(score), 0) as total_correct,
                    COALESCE(SUM(total_questions), 0) as total_questions
                FROM quiz_history
                WHERE user_id = $1 ${topicFilter}
            `;
            const quizRes = await db.query(quizQuery, params);
            const qStats = quizRes.rows[0];

            const totalQ = parseInt(qStats.total_questions) || 0;
            const totalCorrect = parseInt(qStats.total_correct) || 0;
            const totalGames = parseInt(qStats.total_games) || 0;
            const totalIncorrect = totalQ - totalCorrect;

            // Calculate derived stats
            let accuracy = 0;
            let avgScore20 = 0;

            if (totalQ > 0) {
                accuracy = (totalCorrect / totalQ) * 100;
                // Convert to grade 0-20
                avgScore20 = (totalCorrect / totalQ) * 20;
            }

            // --- 2. FLASHCARD STATS (Mastery) ---
            const fcQuery = `
                SELECT COUNT(*) as count_mastered
                FROM user_flashcards
                WHERE user_id = $1 AND repetition_number > 3
            `;
            const fcRes = await db.query(fcQuery, [userId]);
            const mastered = parseInt(fcRes.rows[0].count_mastered);

            // --- 3. WIN/LOSS ANALYSIS (GRANULAR POR ÁREAS) ---
            // Leemos el JSONB 'area_stats' de cada examen y agregamos.
            const topicAnalysisQuery = `
                SELECT 
                    key as subtema,
                    SUM((value->>'correct')::int) as correct_answers,
                    SUM((value->>'total')::int) as total_answers
                FROM quiz_history, jsonb_each(area_stats)
                WHERE user_id = $1 ${topicFilter} AND jsonb_typeof(area_stats) = 'object'
                GROUP BY key
                HAVING SUM((value->>'total')::int) > 0
                ORDER BY (SUM((value->>'correct')::int)::float / SUM((value->>'total')::int)) DESC
            `;

            let strongest = 'N/A';
            let weakest = 'N/A';
            let radarData = []; // Para enviar al UX Frontend

            try {
                const topicRes = await db.query(topicAnalysisQuery, params);
                if (topicRes.rows.length > 0) {
                    strongest = topicRes.rows[0].subtema;
                    weakest = topicRes.rows[topicRes.rows.length - 1].subtema;

                    // Empaquetar data para UI (Radar/Bars)
                    radarData = topicRes.rows.map(row => {
                        const correctAnswers = parseInt(row.correct_answers || 0, 10);
                        const totalAnswers = parseInt(row.total_answers || 0, 10);
                        return {
                            subject: row.subtema,
                            accuracy: totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0,
                            correct: correctAnswers,
                            total: totalAnswers
                        };
                    });
                }
            } catch (e) {
                console.warn("⚠️ No se pudo procesar area_stats JSONB. Fallback al mode antiguo.", e.message);
                // Fallback a modo legacy si hay error (ej: JSONB vacío aún)
                const fallbackQuery = `SELECT topic, AVG(score) as avg_s FROM quiz_history WHERE user_id = $1 ${topicFilter} GROUP BY topic ORDER BY avg_s DESC`;
                const topicRes = await db.query(fallbackQuery, params);
                if (topicRes.rows.length > 0) {
                    strongest = topicRes.rows[0].topic;
                    weakest = topicRes.rows[topicRes.rows.length - 1].topic;
                }
            }

            // --- 4. GET SYSTEM DECK ID ---
            const TrainingRepository = require('../../infrastructure/repositories/trainingRepository');
            let deckId = null;
            if (context) {
                deckId = await TrainingRepository.ensureSystemDeck(userId, context);
            }

            // --- 5. ASSEMBLE KPIS ---
            const kpis = {
                avg_score: avgScore20.toFixed(1),
                accuracy: Math.round(accuracy),
                total_correct: totalCorrect,
                total_incorrect: totalIncorrect,
                mastered_cards: mastered,
                strongest_topic: strongest,
                weakest_topic: weakest,
                radar_data: radarData, // ✅ ENVIADO AL FRONT
                system_deck_id: deckId
            };

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
            const db = require('../../infrastructure/database/db');
            const refinedQuery = `
                WITH RankedScores AS(
                SELECT 
                    u.name,
                    qs.score,
                    qs.topic,
                    qs.difficulty,
                    qs.created_at,
                    ROW_NUMBER() OVER(PARTITION BY qs.user_id ORDER BY qs.score DESC) as rn
                FROM quiz_history qs
                JOIN users u ON qs.user_id = u.id
                )
                SELECT * FROM RankedScores WHERE rn = 1
                ORDER BY score DESC
                LIMIT 10;
            `;
            const result = await db.query(refinedQuery);
            res.json({ success: true, leaderboard: result.rows });
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
            const TrainingRepository = require('../../infrastructure/repositories/trainingRepository');

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
            const { target, areas, difficulty, topic, career } = req.body;
            const userId = req.user.id;

            const finalTarget = target || 'SERUMS';
            const finalCareer = career || 'Medicina Humana';
            let finalAreas = (areas && areas.length > 0) ? areas : (topic ? [topic] : []);

            // 🔄 FALLBACK SERUMS: Si el usuario no tiene configuración (ej: ronda 2 del usuario anterior), inyectamos el bloque oficial.
            if (finalAreas.length === 0 || (finalAreas.length === 1 && (finalAreas[0].toUpperCase() === 'MEDICINA GENERAL' || finalAreas[0].toUpperCase() === 'GENERAL'))) {
                finalAreas = [
                    'Salud Pública y Epidemiología',
                    'Gestión de Servicios de Salud',
                    'Ética Deontología e Interculturalidad',
                    'Medicina Legal',
                    'Investigación y Bioestadística',
                    'Cuidado Integral'
                ];
                console.log(`📡 Fallback Controller [Batch]: Aplicando 6 áreas SERUMS.`);
            }

            // 🎯 OBTENCIÓN DE BANCO: Usar el repositorio para obtener preguntas no vistas.
            // TrainingService.generateQuiz ahora solo consulta la DB para Simulacros Médicos.
            const result = await TrainingService.generateQuiz(
                { target: finalTarget, areas: finalAreas, career: finalCareer },
                difficulty || 'Intermedio',
                userId,
                5,
                req.user.subscriptionTier
            );

            res.json({ 
                success: true, 
                questions: result.questions,
                areas: finalAreas // 🔄 Mantener el contexto multi-área
            });

        } catch (error) {
            // 🎯 CAPTURA DE AGOTAMIENTO DE BANCO (Siguiente Lote)
            if (error.message === "BANCO_AGOTADO_TIER") {
                console.log(`🚫 [Limit] Bloqueo en lotes (batch): Banco Agotado.`);
                return res.status(403).json({ success: false, errorCode: 'BANK_EXHAUSTED' });
            }

            console.error('❌ [Error] getNextBatch:', error);

            if (error.message && error.message.includes("No hay preguntas disponibles")) {
                return res.status(404).json({ error: error.message, noQuestions: true });
            }
            res.status(500).json({ error: 'Error cargando más preguntas.' });
        }
    }
}

module.exports = new QuizController();
