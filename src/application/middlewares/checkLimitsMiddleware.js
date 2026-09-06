const pool = require('../../infrastructure/database/db');
const { LIMITS } = require('../../infrastructure/config/limits');
const UsageService = require('../../domain/services/usageService');
const usageService = new UsageService();

/**
 * Middleware para controlar los límites de uso de IA (Diarios normales vs Mensuales complejos)
 * 
 * @param {string} type - Tipo de operación ('chat_standard', 'chat_thinking', 'quiz_arena', 'simulator')
 */
const checkAILimits = (type) => {
    return async (req, res, next) => {
        try {
            // Permitir que visitantes no autenticados usen el Chat Guía (efímero, sin RAG)
            if (!req.user) {
                req.useRag = false;
                req.userTier = 'free';
                req.usageType = null;
                return next();
            }

            const userId = req.user.id;

            // Obtener estado completo del usuario actual
            const result = await pool.query(`
                SELECT 
                    role,
                    subscription_tier, 
                    subscription_status,
                    usage_count,
                    max_free_limit,
                    subscription_expires_at, 
                    daily_ai_usage, 
                    daily_rag_usage,
                    monthly_flashcards_usage,
                    daily_simulator_usage,
                    daily_import_usage,
                    last_usage_reset,
                    last_free_renewal
                FROM users 
                WHERE id = $1
            `, [userId]);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }

            let user = result.rows[0];
            const userRole = user.role || req.user?.role || 'student';
            const isAdmin = (userRole === 'admin' || user.subscription_tier === 'admin' || req.user?.role === 'admin');
            let tier = isAdmin ? 'admin' : (user.subscription_tier || 'free');
            const status = user.subscription_status || 'pending';

            // 0. RENOVACIÓN SEMANAL DE VIDAS - Delegada a UsageService (Fuente Única de Verdad)
            if (!isAdmin && (tier === 'free' || status === 'pending' || status === 'expired')) {
                try {
                    const wasRenewed = await usageService.renewWeeklyLivesIfNeeded(userId);
                    
                    if (wasRenewed) {
                        // Recargar los valores actualizados del usuario tras la renovación
                        const reloadRes = await pool.query("SELECT usage_count, max_free_limit, last_free_renewal FROM users WHERE id = $1", [userId]);
                        if (reloadRes.rows.length > 0) {
                            user.usage_count = reloadRes.rows[0].usage_count;
                            user.max_free_limit = reloadRes.rows[0].max_free_limit;
                            user.last_free_renewal = reloadRes.rows[0].last_free_renewal;
                        }
                    }
                } catch (e) {
                    console.error('⚠️ Error al renovar vidas semanales en middleware:', e.message);
                }
            }

            // --- LOGICA DE RESETEO ROBUSTA ---
            const now = new Date();
            const todayDate = now.toLocaleDateString('sv-SE', { timeZone: 'America/Lima' }); // Hoy en Perú: "YYYY-MM-DD"

            let lastResetDateStr = "";
            if (user.last_usage_reset) {
                // Si pg devuelve objeto Date, toISOString() es seguro. 
                // Si devuelve string (depende de config), tomamos solo la parte de la fecha.
                lastResetDateStr = (user.last_usage_reset instanceof Date)
                    ? user.last_usage_reset.toISOString().split('T')[0]
                    : String(user.last_usage_reset).split('T')[0];
            }

            // 1. REVISIÓN DE EXPIRACIÓN DE PLAN
            if (tier !== 'free') {
                if (user.subscription_expires_at) {
                    const expiresAt = new Date(user.subscription_expires_at);
                    if (Date.now() > expiresAt.getTime()) {
                        // ✅ CORRECCIÓN CRÍTICA: Rebajar Tier Y Status, y resetear vidas como beneficio de fidelización
                        await pool.query("UPDATE users SET subscription_tier = 'free', subscription_status = 'expired', usage_count = 0, max_free_limit = 10, last_free_renewal = CURRENT_TIMESTAMP WHERE id = $1", [userId]);
                        user.subscription_tier = 'free';
                        user.subscription_status = 'expired';
                        user.usage_count = 0;
                        user.max_free_limit = 10;
                        user.last_free_renewal = new Date();
                    }
                }
            }

            req.userTier = isAdmin ? 'admin' : (user.subscription_tier || 'free');

            // 2. REINICIO DE CONTADORES (DIARIOS Y MENSUALES)
            if (!user.last_usage_reset || lastResetDateStr !== todayDate) {
                console.log(`♻️ [Quota Reset] Iniciando reset para ${user.subscription_tier} (${userId}). De ${lastResetDateStr} a ${todayDate}`);

                const lastResetDateObj = user.last_usage_reset ? new Date(user.last_usage_reset) : new Date(0);
                const currentMonth = now.getUTCMonth();
                const lastResetMonth = lastResetDateObj.getUTCMonth();

                let resetMonthlyFlashcards = false;
                if (!user.last_usage_reset || lastResetMonth !== currentMonth) {
                    resetMonthlyFlashcards = true;
                }

                if (resetMonthlyFlashcards) {
                    await pool.query(`
                        UPDATE users SET 
                            daily_ai_usage = 0, 
                            daily_rag_usage = 0,
                            daily_simulator_usage = 0,
                            daily_import_usage = 0,
                            monthly_flashcards_usage = 0,
                            last_usage_reset = $1 
                        WHERE id = $2
                    `, [todayDate, userId]);
                    user.monthly_flashcards_usage = 0;
                    user.daily_import_usage = 0;
                } else {
                    await pool.query(`
                        UPDATE users SET 
                            daily_ai_usage = 0, 
                            daily_rag_usage = 0,
                            daily_simulator_usage = 0,
                            daily_import_usage = 0,
                            last_usage_reset = $1 
                        WHERE id = $2
                    `, [todayDate, userId]);
                    user.daily_import_usage = 0;
                }

                user.daily_ai_usage = 0;
                user.daily_rag_usage = 0;
                user.daily_simulator_usage = 0;
                user.last_usage_reset = todayDate;
            }

            // 3. MATRIZ DE LÍMITES POR TIER (Calculado en base a matemática del doc MD)
            // 🧠 FLASHCARDS (Mensual): Se mide por INTENTOS de generación (Adaptativos 1-15 tjs/int).
            // - Básico: 10 intentos/mes.
            // - Avanzado: 30 intentos/mes.

            const userLimits = LIMITS[tier] || (isAdmin ? LIMITS.advanced : LIMITS.free);

            // 4. BIFURCACIÓN MAESTRA DE SUBSCRIPCIÓN
            // ✅ MEJORA: Un usuario solo es "Active" si tiene plan premium y status activo, o si es Admin.
            const isActiveAccount = (user.subscription_status === 'active' && user.subscription_tier !== 'free') || isAdmin;
            const hasGlobalLives = (user.usage_count || 0) < (user.max_free_limit || 10);

            // 5. CHEQUEO DE LA OPERACIÓN SOLICITADA
            let effectiveType = type;

            if (effectiveType === 'chat_standard') {
                const pathStr = req.path || '';
                const urlStr = req.originalUrl || '';
                const isDiagnostic = pathStr.includes('/diagnostic') || urlStr.includes('/diagnostic');
                if (isDiagnostic) {
                    if (isActiveAccount) {
                        if (tier === 'basic') {
                            // 📘 Plan Básico Activo: Diagnóstico Heurístico Estático (0 tokens diarios de IA, 0 vidas)
                            req.usageType = null;
                            req.cost = 0;
                            req.fallbackToStatic = true;
                        } else {
                            // 🚀 Plan Avanzado / Admin Activo: Diagnóstico Dinámico Gemini (1 token daily_ai_usage si hay saldo, Admin siempre saldo)
                            if (!isAdmin && (user.daily_ai_usage || 0) >= userLimits.chat_standard) {
                                req.usageType = null;
                                req.cost = 0;
                                req.fallbackToStatic = true;
                            } else {
                                req.usageType = isAdmin ? null : 'daily_ai_usage';
                                req.cost = isAdmin ? 0 : 1;
                            }
                        }
                    } else {
                        // 🪙 Cuenta Gratuita / Pending / Expired: Consume 1 vida de prueba semanal (10 max)
                        if ((user.usage_count || 0) >= (user.max_free_limit || 10)) {
                            return res.status(403).json({
                                error: 'Se han agotado tus 10 vidas de prueba semanal. Mejora tu plan a Basic o Advanced para continuar usando los diagnósticos con IA.',
                                reason: 'FREE_LIVES_EXHAUSTED',
                                paywall: true
                            });
                        }
                        req.usageType = 'usage_count';
                        req.cost = 1;
                        req.fallbackToStatic = true;
                    }
                } else {
                    const context = req.body && req.body.context;
                    const spec = req.body && req.body.specialization;
                    const isTutorChat = (context && (context.type === 'quiz_tutor' || context.type === 'flashcard_tutor')) || spec === 'flashcard_tutor';

                    if (isTutorChat) {
                        if (isActiveAccount) {
                            // 🛡️ CONTROL DE LÍMITE DIARIO DE CONSULTAS IA PARA PLANES BASIC Y ADVANCED (Admin exento)
                            if (!isAdmin && (user.daily_ai_usage || 0) >= userLimits.chat_standard) {
                                return res.status(403).json({
                                    error: `Has alcanzado tu límite diario de consultas al Tutor IA (${userLimits.chat_standard} mensajes/día). Vuelve mañana o mejora tu plan.`,
                                    reason: 'DAILY_LIMIT_EXHAUSTED',
                                    paywall: true
                                });
                            }

                            // 🧠 REGLAS DE USO RAG:
                            // - Usuario Basic (tier === 'basic'): NO usa RAG (0 msgs/día RAG, sin excepciones).
                            // - Usuario Advanced (tier === 'advanced' / 'admin'): Usa RAG hasta 25 msgs/día. Si se agota, degrada a IA Estándar sin RAG.
                            // - Usuario Admin: RAG habilitado con exención de límites.
                            const isAdvancedTier = (tier === 'advanced' || tier === 'admin' || isAdmin);
                            const ragLimit = userLimits.daily_rag_limit || 25;
                            const currentRagUsage = user.daily_rag_usage || 0;
                            const isFlashcardTutor = (context && context.type === 'flashcard_tutor') || spec === 'flashcard_tutor';

                            // Flashcard Tutor es multidisciplinario (cero Pinecone RAG); no consume cuota diaria de RAG
                            if (isAdvancedTier && !isFlashcardTutor && (isAdmin || currentRagUsage < ragLimit)) {
                                req.useRag = true;
                                req.incrementRag = !isAdmin;
                            } else {
                                req.useRag = false;
                                req.incrementRag = false;
                            }

                            req.usageType = isAdmin ? null : 'daily_ai_usage';
                            req.cost = isAdmin ? 0 : 1;
                        } else {
                            // 🪙 CONTROL DE VIDAS DE PRUEBA PARA USUARIOS FREE PENDING
                            if ((user.usage_count || 0) >= (user.max_free_limit || 10)) {
                                return res.status(403).json({
                                    error: 'Se han agotado tus 10 vidas de prueba gratis. Mejora tu plan a Basic o Advanced para continuar usando los simuladores y tutores IA.',
                                    reason: 'FREE_LIVES_EXHAUSTED',
                                    paywall: true
                                });
                            }

                            req.useRag = false; // Usuarios Free Pending NUNCA usan RAG
                            req.incrementRag = false;
                            req.usageType = 'usage_count';
                            req.cost = 1;
                        }
                    } else {
                        // 💬 CHAT GENERAL (Asistente Guía): 0 consumo de vidas ni de límites diarios para todos los planes
                        req.useRag = false;
                        req.incrementRag = false;
                        req.usageType = null;
                        req.cost = 0;
                    }
                }
            }
            else if (effectiveType === 'monthly_flashcards') {
                if (!isActiveAccount) {
                    // 🛡️ REGLA DE BLOQUEO: Carga masiva es SOLO para Premium
                    const isBatchImport = req.path.includes('/batch');
                    if (isBatchImport) {
                        return res.status(403).json({ error: 'La Carga Masiva (Excel) es una función exclusiva para usuarios Premium. ¡Mejora tu plan para ahorrar tiempo!', reason: 'PREMIUM_ONLY_FEATURE' });
                    }

                    // 🛡️ REGLA DE BLOQUEO: Generación con IA (Gemini) es SOLO para Premium
                    const isAiGeneration = req.path.includes('/generate') || req.path.includes('check-ai-limits');
                    if (isAiGeneration) {
                        return res.status(403).json({
                            error: 'La Generación de Flashcards con IA es una función exclusiva para usuarios Premium. ¡Mejora tu plan para crear cientos de tarjetas al instante!',
                            reason: 'PREMIUM_ONLY_FEATURE',
                            paywall: true
                        });
                    }

                    // 🛡️ REGLA DE JUSTICIA: Edición (PUT) y Eliminación (DELETE) son GRATUITOS
                    // Nota: El controlador decidirá si el PUT es una "Guía" (Paga) o un "Renombrar" (Gratis)
                    const isMaintenance = req.method === 'DELETE' || (req.method === 'PUT' && !req.path.includes('/study')) || req.path.includes('/reorder');

                    if (isMaintenance) {
                        req.usageType = null;
                    } else if (hasGlobalLives) {
                        req.usageType = 'usage_count';
                    } else {
                        return res.status(403).json({ error: 'Se han agotado tus vidas de Prueba. Mejora tu plan para continuar creando y estudiando.', reason: 'FREE_LIVES_EXHAUSTED' });
                    }
                } else {
                    // ✅ LÓGICA REFINADA PARA PREMIUM: 
                    // El CRUD manual (crear, editar, subir imagen) es ILIMITADO.
                    const isAiGeneration = req.path.includes('/generate') || req.path.includes('check-ai-limits');
                    const isBatchImport = req.path.includes('/batch');

                    if (isAiGeneration) {
                        if (!isAdmin && tier !== 'advanced' && tier !== 'admin') {
                            return res.status(403).json({
                                error: 'La Generación de Flashcards con IA es una función exclusiva del Plan Avanzado. ¡Mejora tu plan para crear cientos de tarjetas al instante!',
                                reason: 'PREMIUM_ONLY_FEATURE',
                                paywall: true
                            });
                        }
                        if (!isAdmin && (user.monthly_flashcards_usage || 0) >= userLimits.monthly_flashcards) {
                            return res.status(403).json({ error: `Límite mensual de generación de flashcards alcanzado (${userLimits.monthly_flashcards} intentos). Mejora tu plan.`, reason: 'MONTHLY_LIMIT_EXHAUSTED' });
                        }
                        req.usageType = isAdmin ? null : 'monthly_flashcards_usage';
                    } else if (isBatchImport) {
                        if (!isAdmin && (user.daily_import_usage || 0) >= userLimits.batch_import) {
                            return res.status(403).json({ error: `Límite diario de importación masiva alcanzado (${userLimits.batch_import}). Vuelve mañana o mejora tu plan.`, reason: 'DAILY_LIMIT_EXHAUSTED' });
                        }
                        req.usageType = isAdmin ? null : 'daily_import_usage';
                    } else {
                        req.usageType = null;
                    }
                }
            }
            else if (effectiveType === 'simulator') {
                if (!isActiveAccount) {
                    if (hasGlobalLives) {
                        req.usageType = 'usage_count';
                    } else {
                        return res.status(403).json({ error: 'Límite de simulacros de Prueba agotado. Mejora tu plan para continuar.', reason: 'FREE_LIVES_EXHAUSTED' });
                    }
                } else {
                    if (!isAdmin && (user.daily_simulator_usage || 0) >= userLimits.simulator) {
                        return res.status(403).json({ error: 'Límite diario de simulacros alcanzado. Vuelve mañana.', reason: 'DAILY_LIMIT_EXHAUSTED' });
                    }
                    req.usageType = isAdmin ? null : 'daily_simulator_usage';
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
