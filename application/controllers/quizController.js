const QuizService = require('../../domain/services/quizService');
const db = require('../../infrastructure/database/db'); // Acceso directo a BD para guardar scores

class QuizController {

    /**
     * POST /api/quiz/start
     * Inicia una sesión de juego o nueva ronda.
     */
    async startQuiz(req, res) {
        try {
            const { topic, difficulty, round = 1 } = req.body; // round por defecto 1
            const user = req.user;

            // Validación básica
            if (!topic) {
                return res.status(400).json({ error: 'Falta el parámetro: topic.' });
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

            // 2. Ajuste Dinámico de Dificultad por Ronda
            let aiDifficulty = 'Básico';
            if (round >= 3 && round <= 4) aiDifficulty = 'Profesional';
            if (round >= 5) aiDifficulty = 'Experto';

            // Si el usuario eligió una dificultad inicial hard, respetarla o escalar desde ahí? 
            // El requerimiento dice: Ronda 1-2 Básico, 3-4 Medio, 5 Hard. 
            // Ignoramos el selector inicial para la generación de la IA o lo usamos como base?
            // Seguiremos la regla estricta del prompt:
            // "Ronda 1-2: easy, 3-4: medium, 5: hard"

            // Mapeo para Gemini (QuizService espera Básico/Profesional/Experto)
            // Si el servicio acepta strings directos, los enviamos.

            console.log(`🎮 Generando Ronda ${round} (${aiDifficulty}) de ${topic} para ${user.name}`);

            // Llamar al servicio de IA
            const questions = await QuizService.generateRound(topic, aiDifficulty);

            res.json({
                success: true,
                topic,
                difficulty: aiDifficulty,
                round: round,
                questions,
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
            const { topic, difficulty, score, correct_answers_count, total_questions, rounds_completed } = req.body;
            const userId = req.user.id;

            if (score === undefined || !topic) {
                return res.status(400).json({ error: 'Datos de puntaje incompletos.' });
            }

            const queryInsert = `
                INSERT INTO quiz_scores 
                (user_id, topic, difficulty, score, correct_answers_count, total_questions_played, rounds_completed)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id
            `;
            const values = [userId, topic, difficulty, score, correct_answers_count, total_questions || 10, rounds_completed || 1];
            await db.query(queryInsert, values);

            const queryMax = `SELECT MAX(score) as high_score FROM quiz_scores WHERE user_id = $1`;
            const resultMax = await db.query(queryMax, [userId]);
            const currentHighScore = resultMax.rows[0].high_score || 0;

            const isNewRecord = parseInt(score) >= parseInt(currentHighScore);

            res.json({
                success: true,
                message: 'Puntaje registrado exitosamente.',
                isNewRecord: isNewRecord
            });

        } catch (error) {
            console.error('Error en submitScore:', error);
            res.status(500).json({ error: 'Error guardando el puntaje.' });
        }
    }

    /**
     * GET /api/quiz/stats
     * Obtiene estadísticas del jugador (High Score, Total Partidas).
     */
    async getStats(req, res) {
        try {
            const userId = req.user.id;

            const query = `
                SELECT 
                    MAX(score) as high_score,
                    COUNT(*) as total_games
                FROM quiz_scores 
                WHERE user_id = $1
            `;
            const result = await db.query(query, [userId]);

            res.json({
                success: true,
                highScore: result.rows[0].high_score || 0,
                totalGames: result.rows[0].total_games || 0
            });

        } catch (error) {
            console.error('Error en getStats:', error);
            res.status(500).json({ error: 'Error obteniendo estadísticas.' });
        }
    }

    /**
     * GET /api/quiz/leaderboard
     * Top 10 Mejores Puntajes ÚNICOS por usuario.
     */
    async getLeaderboard(req, res) {
        try {
            const refinedQuery = `
                WITH RankedScores AS (
                    SELECT 
                        u.name,
                        qs.score,
                        qs.topic,
                        qs.difficulty,
                        qs.created_at,
                        ROW_NUMBER() OVER (PARTITION BY qs.user_id ORDER BY qs.score DESC) as rn
                    FROM quiz_scores qs
                    JOIN users u ON qs.user_id = u.id
                )
                SELECT * FROM RankedScores WHERE rn = 1
                ORDER BY score DESC
                LIMIT 10;
            `;

            const result = await db.query(refinedQuery);

            res.json({
                success: true,
                leaderboard: result.rows
            });

        } catch (error) {
            console.error('Error en getLeaderboard:', error);
            res.status(500).json({ error: 'Error obteniendo leaderboard.' });
        }
    }
}

module.exports = new QuizController();
