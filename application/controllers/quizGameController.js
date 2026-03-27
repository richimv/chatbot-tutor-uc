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
            const { topic } = req.body;
            const user = req.user;

            if (!user || !user.id) {
                console.error("❌ QuizGameController: User ID no encontrado en request.");
                return res.status(401).json({ error: 'Usuario no autenticado correctamente.' });
            }

            console.log(`⚔️ Iniciando Quiz Battle: ${topic || 'Aleatorio'} para ${user.name} (ID: ${user.id})`);

            // 1. Generar Preguntas (Modo Rápido: General / Arcade)
            const questions = await TrainingService.generateGeneralQuiz(topic || 'Cultura General', user.id, user.subscriptionTier);

            // 2. ACTUALIZAR LÍMITES DE USO IA (Cobro de token figurativo tras éxito)
            // 💡 IMPORTANTE: Aquí se hace efectivo el cobro de "1 Vida" para usuarios Free (1/1), Basic (5/5) o Advanced (10/10).
            // Se inyecta la columna a actualizar a través del middleware (req.usageType = 'daily_arena_usage').
            try {
                if (req.usageType) {
                    await db.query(
                        `UPDATE users SET ${req.usageType} = ${req.usageType} + 1 WHERE id = $1`,
                        [user.id]
                    );
                    console.log(`📉 Límite de ${req.usageType} incrementado (1 Vida descontada) para usuario ${user.id}.`);
                }
            } catch (limitErr) {
                console.error("⚠️ No se pudo actualizar el límite. Continuando...", limitErr);
            }

            res.json({
                success: true,
                gameId: Date.now().toString(), // Simple ID
                lives: 3,
                timePerQuestion: 20,
                questions: questions.map(q => ({
                    id: Math.random().toString(36).substr(2, 9),
                    question: q.question_text,
                    options: q.options,
                    correctAnswer: q.correct_option_index,
                    explanation: q.explanation,
                    image_url: q.image_url,
                    explanation_image_url: q.explanation_image_url
                }))
            });

        } catch (error) {
            console.error('❌ Error en QuizGameController.startGame:', error);

            // ✅ MANEJO DE AGOTAMIENTO DE BANCO (Para mostrar modal correcto en el front)
            if (error.message === "BANCO_AGOTADO_TIER") {
                return res.status(403).json({ 
                    success: false, 
                    errorCode: 'BANK_EXHAUSTED',
                    error: 'Has agotado las preguntas disponibles en este tema. Prueba con otro o sube a Advanced.' 
                });
            }

            res.status(500).json({ error: 'Error iniciando batalla.' });
        }
    }

    /**
     * POST /api/arena/questions
     * Genera un lote de preguntas extra (Infinite Mode).
     */
    async getQuestions(req, res) {
        try {
            const { topic } = req.body;
            const user = req.user;

            // No se descuenta vida aquí — solo en startGame.
            // Las preguntas adicionales son parte del mismo juego.

            // Generar nuevo lote
            const questions = await TrainingService.generateGeneralQuiz(topic || 'General', user.id, user.subscriptionTier);

            res.json({
                success: true,
                questions: questions.map(q => ({
                    id: Math.random().toString(36).substr(2, 9),
                    question: q.question_text,
                    options: q.options,
                    correctAnswer: q.correct_option_index,
                    explanation: q.explanation,
                    image_url: q.image_url,
                    explanation_image_url: q.explanation_image_url
                }))
            });
        } catch (error) {
            console.error('Error fetching more questions:', error);

            if (error.message === "BANCO_AGOTADO_TIER") {
                return res.status(403).json({ 
                    success: false, 
                    errorCode: 'BANK_EXHAUSTED',
                    error: 'Has agotado las preguntas disponibles en este tema.' 
                });
            }

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
            const userId = req.user.id;

            const difficulty = 'Senior'; // Estándar Unificado para Ranking

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
