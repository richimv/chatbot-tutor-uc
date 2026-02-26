const TrainingService = require('../../domain/services/trainingService');
const db = require('../../infrastructure/database/db');
const UsageService = require('../../domain/services/usageService');
const usageService = new UsageService();

class QuizGameController {

    /**
     * POST /api/arena/start
     * Inicia una partida Arcade (Battle Mode).
     */
    async startGame(req, res) {
        try {
            const { topic, difficulty } = req.body;
            const user = req.user;

            if (!user || !user.id) {
                console.error("❌ QuizGameController: User ID no encontrado en request.");
                return res.status(401).json({ error: 'Usuario no autenticado correctamente.' });
            }

            console.log(`⚔️ Iniciando Quiz Battle: ${topic || 'Aleatorio'} para ${user.name} (ID: ${user.id})`);

            // 0. VERIFICAR USO (Limitar Free Users para ahorrar tokens)
            // No aplicamos bloqueo estricto al Simulador Serum (como pidió el usuario), pero sí al Arena General.
            const usageCheck = await usageService.checkAndIncrementUsage(user.id);
            if (!usageCheck.allowed) {
                console.warn(`⛔ Límite alcanzado para usuario ${user.id} (${usageCheck.plan})`);
                return res.status(403).json({
                    error: 'Has alcanzado tu límite diario de juegos gratuitos. 😢 ¡Suscríbete para jugar sin límites!',
                    limitReached: true
                });
            }

            // 1. Generar Preguntas (Modo Rápido: General / Arcade)
            // Usamos generateGeneralQuiz para evitar contexto médico forzado
            const questions = await TrainingService.generateGeneralQuiz(topic || 'Cultura General', difficulty || 'Intermedio', user.id);

            res.json({
                success: true,
                gameId: Date.now().toString(), // Simple ID
                lives: 3,
                timePerQuestion: 20,
                questions: questions.map(q => ({
                    id: Math.random().toString(36).substr(2, 9),
                    question: q.question,
                    options: q.options,
                    correctAnswer: q.correctAnswerIndex,
                    explanation: q.explanation // ✅ FEEDBACK IMPORTANTE
                }))
            });

        } catch (error) {
            console.error('Error en QuizGameController.startGame:', error);
            res.status(500).json({ error: 'Error iniciando batalla.' });
        }
    }

    /**
     * POST /api/arena/questions
     * Genera un lote de preguntas extra (Infinite Mode).
     */
    async getQuestions(req, res) {
        try {
            const { topic, difficulty } = req.body;
            const user = req.user;

            // No se descuenta vida aquí — solo en startGame.
            // Las preguntas adicionales son parte del mismo juego.

            // Generar nuevo lote
            const questions = await TrainingService.generateGeneralQuiz(topic || 'General', difficulty || 'Intermedio', user.id);

            res.json({
                success: true,
                questions: questions.map(q => ({
                    id: Math.random().toString(36).substr(2, 9),
                    question: q.question,
                    options: q.options,
                    correctAnswer: q.correctAnswerIndex,
                    explanation: q.explanation
                }))
            });
        } catch (error) {
            console.error('Error fetching more questions:', error);
            res.status(500).json({ error: 'Error generando preguntas.' });
        }
    }

    /**
     * POST /api/arena/submit
     * Guarda el puntaje final de la partida.
     */
    async submitScore(req, res) {
        try {
            const { score, totalQuestions, maxCombo, topic } = req.body;
            let { difficulty } = req.body; // Recibir dificultad del cliente
            const userId = req.user.id;

            // Fallback si no llega
            if (!difficulty) difficulty = 'Profesional';

            // Validación básica
            if (!score && score !== 0) return res.status(400).json({ error: 'Score required' });

            console.log(`💾 Guardando Score Arcade: ${score} para usuario ${userId}`);

            // Insertar en quiz_scores (Tabla unificada)
            const query = `
                INSERT INTO quiz_scores (user_id, topic, difficulty, score, total_questions_played, rounds_completed, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, NOW())
                RETURNING id
            `;

            // Mapeamos params: rounds_completed lo usaremos como "max_combo" hack o simplemente 1
            // FIX: Enviamos source: 'ARENA' explícitamente para evitar ensuciar Flashcards
            // Sin embargo, TrainingService.submitQuizResult se llama desde QuizController (Simulacro).
            // Arena usa su PROPIO submitScore que guarda en `quiz_scores` (SQL INSERT directo).
            // WOW. Arena NO llama a `TrainingService.submitQuizResult`.
            // Llama a db.query directo.

            // VERIFICACIÓN CRÍTICA:
            // QuizController (Simulacro) -> Llama a `TrainingService.submitQuizResult`.
            // QuizGameController (Arena) -> Llama a `INSERT INTO quiz_scores` DIRECTAMENTE.

            // CONCLUSIÓN:
            // El ARENA YA ESTÁ SEPARADO. NO LLAMA A `submitQuizResult` DE TRAINING SERVICE.
            // POR LO TANTO, NO GENERA FLASHCARDS.

            await db.query(query, [userId, topic || 'General', difficulty, score, totalQuestions || 0, maxCombo || 0]);

            res.json({
                success: true,
                message: 'Score guardado',
                rank: 'Pending'
            });

        } catch (error) {
            console.error('Error submitScore:', error);
            res.status(500).json({ error: 'Error guardando puntaje.' });
        }
    }

    /**
    * GET /api/arena/ranking
    * Devuelve el Top 10 Global de la tabla quiz_scores.
    */
    async getRanking(req, res) {
        try {
            // Consulta real a quiz_scores uniendo con users
            // Consulta real: Mejores puntajes únicos por usuario
            const query = `
                SELECT DISTINCT ON (qs.user_id) 
                    u.name, 
                    qs.score, 
                    qs.topic,
                    qs.difficulty
                FROM quiz_scores qs
                JOIN users u ON qs.user_id = u.id
                ORDER BY qs.user_id, qs.score DESC
            `;

            // Nota: Para ordenar el resultado final por Score DESC, necesitamos una subconsulta o reordenamiento en JS/SQL
            // Versión mejorada con CTE o Subquery para Top 10 Global Real
            const finalQuery = `
                WITH RankedScores AS (
                    SELECT 
                        u.name, 
                        qs.score, 
                        qs.topic,
                        qs.difficulty,
                        ROW_NUMBER() OVER (PARTITION BY qs.user_id ORDER BY qs.score DESC) as rn
                    FROM quiz_scores qs
                    JOIN users u ON qs.user_id = u.id
                )
                SELECT name, score, topic, difficulty
                FROM RankedScores
                WHERE rn = 1
                ORDER BY score DESC
                LIMIT 10;
            `;

            const result = await db.query(finalQuery);

            const leaderboard = result.rows.map(row => ({
                name: row.name,
                score: row.score,
                topic: row.topic, // ✅ Ahora enviamos el TEMA
                difficulty: row.difficulty,
                avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(row.name)}&background=random`
            }));

            res.json({
                success: true,
                leaderboard
            });

        } catch (error) {
            console.error('Error getting ranking:', error);
            res.status(500).json({ error: 'Error obteniendo ranking' });
        }
    }
    /**
     * GET /api/arena/stats
     * Devuelve estadísticas del usuario actual (Mejor puntaje, partidas jugadas).
     */
    async getUserStats(req, res) {
        try {
            const userId = req.user.id;

            const query = `
                SELECT 
                    COALESCE(MAX(score), 0) as high_score,
                    COUNT(*) as total_games
                FROM quiz_scores
                WHERE user_id = $1
            `;

            const result = await db.query(query, [userId]);
            const stats = result.rows[0];

            res.json({
                success: true,
                stats: {
                    highScore: stats.high_score,
                    totalGames: stats.total_games
                }
            });

        } catch (error) {
            console.error('Error getting user stats:', error);
            res.status(500).json({ error: 'Error obteniendo estadísticas' });
        }
    }
}

module.exports = new QuizGameController();
