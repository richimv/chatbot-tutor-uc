const TrainingService = require('../../domain/services/trainingService');
const db = require('../../infrastructure/database/db'); // Acceso directo a BD para guardar scores

class QuizController {

    /**
     * POST /api/quiz/start
     * Inicia una sesión de juego o nueva ronda.
     */
    async startQuiz(req, res) {
        try {
            const { target, areas, difficulty, round = 1, limit = 5, topic } = req.body;
            const user = req.user;

            const finalTarget = target || 'MEDICINA';
            const finalAreas = (areas && areas.length > 0) ? areas : (topic ? [topic] : ['Medicina General']);

            // Validación básica
            if (finalAreas.length === 0) {
                return res.status(400).json({ error: 'Falta proveer áreas o un tema válido.' });
            }

            // 1. Lógica FREEMIUM: Verificar Límite Diario (Solo en Ronda 1)
            // Fix: User model uses camelCase (subscriptionStatus), DB row uses snake_case. 
            // Repository maps it to camelCase.
            const isPremium = user.subscriptionStatus === 'active' || user.role === 'admin';

            if (round === 1 && !isPremium) {
                const today = new Date().toISOString().split('T')[0];
                const queryUsage = `
                    SELECT COUNT(*) as count 
                    FROM quiz_scores 
                    WHERE user_id = $1 
                    AND created_at::date = $2
                `;
                const resultUsage = await db.query(queryUsage, [user.id, today]);
                const gamesToday = parseInt(resultUsage.rows[0].count);
                const DAILY_LIMIT = 3;

                if (gamesToday >= DAILY_LIMIT) {
                    return res.status(403).json({
                        error: 'Has alcanzado tu límite diario de 3 partidas.',
                        limitReached: true
                    });
                }
            }

            // 🎯 NEW: Round Cap for Free Users
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

            // Llamar al servicio de IA Médico (TrainingService)
            const result = await TrainingService.generateQuiz({ target: finalTarget, areas: finalAreas }, aiDifficulty, user.id, limit);

            // 💡 FIX: Devolver el tema ESPECÍFICO (ej: "CARDIOLOGIA") rotado por el servicio,
            // en lugar del genérico "Medicina General".
            const returnedTopic = result.topic || finalAreas[0];

            console.log(`✅ Quiz Generado. Tema Real: ${returnedTopic} en Target: ${finalTarget}`);

            res.json({
                success: true,
                topic: returnedTopic,
                difficulty: aiDifficulty,
                round: round,
                questions: result.questions,
                isPremium: isPremium
            });

        } catch (error) {
            console.error('Error en startQuiz:', error);
            res.status(500).json({ error: 'Error interno generando el quiz.' });
        }
    }

    /**
     * POST /api/quiz/submit
     * Guarda el puntaje final.
     */
    async submitScore(req, res) {
        try {
            const { topic, areas, target, difficulty, score, correct_answers_count, total_questions, rounds_completed, questions } = req.body;
            const userId = req.user.id;

            if (score === undefined || !topic) {
                return res.status(400).json({ error: 'Datos de puntaje incompletos.' });
            }

            // Llamar al servicio de Entrenamiento para guardar historial y crear flashcards
            // ✅ CONFIGURACIÓN EXPLÍCITA: "Simulacro Médico" SIEMPRE genera flashcards.
            const result = await TrainingService.submitQuizResult(userId, {
                topic,
                areas, // Pasamos al servicio
                target, // Pasamos al servicio
                difficulty,
                score,
                totalQuestions: total_questions || 10,
                questions: questions || []
            }, { createFlashcards: true });

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
            const userId = req.user.id;
            const { context } = req.query; // 'MEDICINA', etc.

            const db = require('../../infrastructure/database/db');

            // --- 0. CONTEXT FILTER ---
            // Map context to topic keywords if needed, or use generic filter
            let topicFilter = '';
            const params = [userId];
            if (context === 'MEDICINA') {
                // ✅ FIX: Usar 'difficulty' para filtrar Medicina (ENAM), 
                // ya que los topics ahora son variados (Pediatría, Cardiología, etc.)
                topicFilter = `AND difficulty = 'ENAM'`;
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
                    jsonb_object_keys(area_stats) as subtema,
                    SUM((area_stats->jsonb_object_keys(area_stats)->>'correct')::int) as correct_answers,
                    SUM((area_stats->jsonb_object_keys(area_stats)->>'total')::int) as total_answers
                FROM quiz_history
                WHERE user_id = $1 ${topicFilter}
                GROUP BY subtema
                HAVING SUM((area_stats->jsonb_object_keys(area_stats)->>'total')::int) > 0
                ORDER BY (SUM((area_stats->jsonb_object_keys(area_stats)->>'correct')::int)::float / SUM((area_stats->jsonb_object_keys(area_stats)->>'total')::int)) DESC
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
                    radarData = topicRes.rows.map(row => ({
                        subject: row.subtema,
                        accuracy: Math.round((row.correct_answers / row.total_answers) * 100),
                        total: row.total_answers
                    }));
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
            const userId = req.user.id;
            const { context } = req.query;
            const TrainingRepository = require('../../infrastructure/repositories/trainingRepository');

            const data = await TrainingRepository.getQuizEvolution(userId, context);

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
            const { target, areas, difficulty, seenIds, topic } = req.body;
            const userId = req.user.id;
            const TrainingRepository = require('../../infrastructure/repositories/trainingRepository');

            const finalTarget = target || 'MEDICINA';
            const finalAreas = (areas && areas.length > 0) ? areas : (topic ? [topic] : ['Medicina General']);

            // Fetch 5 new questions 
            // We pass the finalTarget (as domain) and finalAreas (as multiple topics)
            const questions = await TrainingRepository.findQuestionsInBankBatch(finalTarget, finalAreas, difficulty, 5, userId);

            // Filter out any that strictly match seenIds just in case
            const newQuestions = questions.filter(q => !seenIds.includes(q.id));

            res.json({ success: true, questions: newQuestions });

        } catch (error) {
            console.error('Error fetching next batch:', error);
            res.status(500).json({ error: 'Error cargando más preguntas.' });
        }
    }
}

module.exports = new QuizController();
