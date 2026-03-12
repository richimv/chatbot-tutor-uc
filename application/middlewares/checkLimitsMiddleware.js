const pool = require('../../infrastructure/database/db');

/**
 * Middleware para controlar los límites de uso de IA (Diarios normales vs Mensuales complejos)
 * 
 * @param {string} type - Tipo de operación ('chat_standard', 'chat_thinking', 'quiz_arena', 'simulator')
 */
const checkAILimits = (type) => {
    return async (req, res, next) => {
        try {
            const userId = req.user.id;

            // Obtener estado completo del usuario actual
            const result = await pool.query(`
                SELECT 
                    subscription_tier, 
                    subscription_status,
                    usage_count,
                    max_free_limit,
                    subscription_expires_at, 
                    daily_ai_usage, 
                    monthly_flashcards_usage,
                    daily_arena_usage, 
                    last_usage_reset
                FROM users 
                WHERE id = $1
            `, [userId]);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }

            let user = result.rows[0];
            const tier = user.subscription_tier || 'free';
            const todayDate = new Date().toISOString().split('T')[0];

            // 1. REVISION DE EXPIRACION DE PLAN
            if (tier !== 'free') {
                if (user.subscription_expires_at) {
                    const expiresAt = new Date(user.subscription_expires_at);
                    if (Date.now() > expiresAt.getTime()) {
                        // Plan Vencido -> Reducir a 'free' por seguridad
                        await pool.query("UPDATE users SET subscription_tier = 'free' WHERE id = $1", [userId]);
                        user.subscription_tier = 'free';
                    }
                }
                // Si subscription_expires_at es nulo (usuarios antiguos de transición), no lo rebajamos automáticamente.
            }

            req.userTier = user.subscription_tier; // Inyectado para que los Controladores sepan el nivel exacto

            // 2. REINICIO DE CONTADORES (DIARIOS Y MENSUALES POR CAMBIO TEMPORAL)
            if (!user.last_usage_reset || user.last_usage_reset.toISOString().split('T')[0] !== todayDate) {

                const lastResetDate = user.last_usage_reset ? new Date(user.last_usage_reset) : new Date(0);
                const currentMonth = new Date().getMonth();

                let resetMonthlyFlashcards = false;

                if (!user.last_usage_reset || lastResetDate.getMonth() !== currentMonth) {
                    resetMonthlyFlashcards = true;
                }

                if (resetMonthlyFlashcards) {
                    await pool.query(`
                        UPDATE users SET 
                            daily_ai_usage = 0, 
                            daily_arena_usage = 0, 
                            monthly_flashcards_usage = 0,
                            last_usage_reset = $1 
                        WHERE id = $2
                    `, [todayDate, userId]);
                    user.monthly_flashcards_usage = 0;
                } else {
                    await pool.query(`
                        UPDATE users SET 
                            daily_ai_usage = 0, 
                            daily_arena_usage = 0, 
                            last_usage_reset = $1 
                        WHERE id = $2
                    `, [todayDate, userId]);
                }

                user.daily_ai_usage = 0;
                user.daily_arena_usage = 0;
            }

            // 3. MATRIZ DE LÍMITES POR TIER (Calculado en base a matemática del doc MD)
            // Flashcards: Las tarjetas se generan de 5 en 5. 
            // - Básico: 20 tarjetas/mes = 4 llamadas.
            // - Avanzado: 100 tarjetas/mes = 20 llamadas.
            const LIMITS = {
                free: { chat_standard: 5, quiz_arena: 3, monthly_flashcards: 1 },
                basic: { chat_standard: 20, quiz_arena: 5, monthly_flashcards: 4 },
                advanced: { chat_standard: 30, quiz_arena: 10, monthly_flashcards: 20 }
            };

            const userLimits = LIMITS[user.subscription_tier] || LIMITS.free;

            // 4. BIFURCACIÓN MAESTRA DE SUBSCRIPCIÓN
            // Por regla de negocio, los límites "Diarios" solo aplican a los usuarios activos (Planes pagados).
            // Los usuarios "Pending" o Inactivos están gobernados puramente por sus Vidas Globales.
            const isActiveAccount = user.subscription_status === 'active';
            const hasGlobalLives = (user.usage_count || 0) < (user.max_free_limit || 3);

            // 5. CHEQUEO DE LA OPERACIÓN SOLICITADA
            if (type === 'chat_standard') {
                if (!isActiveAccount) {
                    if (hasGlobalLives) {
                        req.usageType = 'usage_count'; // Gasta la vida dorada
                    } else {
                        return res.status(403).json({ error: 'Límite de consultas de Prueba agotado. Mejora tu plan para continuar aprendiendo con IA.', reason: 'FREE_LIVES_EXHAUSTED' });
                    }
                } else {
                    if (user.daily_ai_usage >= userLimits.chat_standard) {
                        return res.status(403).json({ error: 'Límite de mensajes diarios estándar alcanzado. Vuelve mañana o mejora tu plan.', reason: 'DAILY_LIMIT_EXHAUSTED' });
                    }
                    req.usageType = 'daily_ai_usage';
                }
            }
            // El tipo 'chat_thinking' ha sido retirado. Los diagnósticos/chat usarán chat_standard o rutas sin límite.
            else if (type === 'quiz_arena') {
                if (!isActiveAccount) {
                    if (hasGlobalLives) {
                        req.usageType = 'usage_count'; // Gasta la vida dorada Global
                    } else {
                        return res.status(403).json({ error: 'Límite de partidas de Prueba en Arena alcanzado. ¡Mejora tu plan para seguir compitiendo!', reason: 'FREE_LIVES_EXHAUSTED' });
                    }
                } else {
                    if (user.daily_arena_usage >= userLimits.quiz_arena) {
                        return res.status(403).json({ error: 'Límite de partidas diarias en Quiz Arena alcanzado. Regresa mañana.', reason: 'DAILY_LIMIT_EXHAUSTED' });
                    }
                    req.usageType = 'daily_arena_usage';
                }
            }
            else if (type === 'monthly_flashcards') {
                if (!isActiveAccount) {
                    if (hasGlobalLives) {
                        req.usageType = 'usage_count'; // Permite generar flashcards a costa de su vida global
                    } else {
                        return res.status(403).json({ error: 'Se han agotado tus vidas de Prueba. Mejora tu plan para crear más tarjetas inteligentes.', reason: 'FREE_LIVES_EXHAUSTED' });
                    }
                } else {
                    if ((user.monthly_flashcards_usage || 0) >= userLimits.monthly_flashcards) {
                        return res.status(403).json({ error: `Límite mensual de generación de flashcards alcanzado (${LIMITS[user.subscription_tier].monthly_flashcards * 5} tarjetas). Mejora tu plan.`, reason: 'MONTHLY_LIMIT_EXHAUSTED' });
                    }
                    req.usageType = 'monthly_flashcards_usage';
                }
            }
            // Todo Ok. Se le pasa el control a la ruta. Luego el controlador DEBE sumar +1 al req.usageType
            next();

        } catch (error) {
            console.error("Middleware Limits Error:", error);
            res.status(500).json({ error: 'Error del servidor al validar suscripción.' });
        }
    };
};

module.exports = checkAILimits;
