/**
 * Tests unitarios para la lógica de Paywall y Freemium de UI (uiManager)
 * Valida la detección de límites y configuración de modales para 'diagnostic', 'quiz_tutor', 'simulator'.
 */

describe('UI Paywall & Freemium Action Validation', () => {

    class MockUIManager {
        constructor() {
            this.lastModalConfig = null;
            this.modalVisible = false;
            this.lastToast = null;
        }

        validateFreemiumAction(event, type = 'arena', user) {
            if (!user) return true;

            const userTier = String(user.subscriptionTier || user.subscription_tier || 'free').toLowerCase();
            const userStatus = String(user.subscriptionStatus || user.subscription_status || 'pending').toLowerCase();
            const isAdmin = user.role === 'admin' || userTier === 'admin';
            if (isAdmin) return true;

            const isPaidActive = (userTier === 'basic' || userTier === 'advanced' || userTier === 'premium') && userStatus === 'active';
            const usageCount = Number(user.usageCount !== undefined ? user.usageCount : (user.usage_count || 0));
            const maxFreeLimit = Number(user.maxFreeLimit !== undefined ? user.maxFreeLimit : (user.max_free_limit || 10));
            const dailySimUsage = Number(user.dailySimulatorUsage !== undefined ? user.dailySimulatorUsage : (user.daily_simulator_usage || 0));

            // 1. Lógica para Usuarios FREE / PENDING / EXPIRED (Vidas Globales)
            if (!isPaidActive) {
                if (usageCount >= maxFreeLimit) {
                    if (event && typeof event.preventDefault === 'function') {
                        event.preventDefault();
                        event.stopPropagation();
                    }
                    this.showPaywallModal(null, type, user);
                    return false;
                }
                return true;
            }

            // 2. Lógica para Usuarios PREMIUM (Límites Diarios)
            if (type === 'simulator' || type === 'diagnostic') {
                const limits = user.limits || {};
                const limit = Number(limits.simulator !== undefined ? limits.simulator : (userTier === 'basic' ? 15 : 50));
                if (dailySimUsage >= limit) {
                    if (event && typeof event.preventDefault === 'function') {
                        event.preventDefault();
                        event.stopPropagation();
                    }
                    this.showPaywallModal(null, type, user);
                    return false;
                }
            } else if (type === 'chat_standard' || type === 'chat' || type === 'flashcard_tutor' || type === 'quiz_tutor') {
                const dailyAiUsage = Number(user.dailyAiUsage !== undefined ? user.dailyAiUsage : (user.daily_ai_usage || 0));
                const limits = user.limits || {};
                const limit = Number(limits.chat_standard !== undefined ? limits.chat_standard : (userTier === 'basic' ? 50 : 100));
                if (dailyAiUsage >= limit) {
                    if (event && typeof event.preventDefault === 'function') {
                        event.preventDefault();
                        event.stopPropagation();
                    }
                    this.showPaywallModal(null, 'quiz_tutor', user);
                    return false;
                }
            }

            return true;
        }

        isResourceLocked(isPremium, user = null) {
            if (!isPremium) return false;
            if (!user) return true;

            const status = String(user.subscriptionStatus || user.subscription_status || '').toLowerCase();
            const tier = String(user.subscriptionTier || user.subscription_tier || 'free').toLowerCase();
            if ((status === 'active' && tier !== 'free') || user.role === 'admin' || tier === 'admin') return false;

            const usage = Number(user.usageCount !== undefined ? user.usageCount : (user.usage_count || 0));
            const limit = Number(user.maxFreeLimit !== undefined ? user.maxFreeLimit : (user.max_free_limit || 10));
            return usage >= limit;
        }

        showLifeDecrementToast(remaining, limit = 10) {
            const numRemaining = Number(remaining);
            const numLimit = Number(limit) || 10;

            if (numRemaining <= 0) {
                this.lastToast = { message: 'Has consumido tu última vida de prueba semanal. Te quedan 0 vidas.', type: 'warning' };
                // NOTA: Nunca debe abrir showPaywallModal() prematuramente
                return;
            }

            if (numRemaining === 1 || numRemaining === 2) {
                this.lastToast = { message: `¡Atención! Te quedan solo ${numRemaining}/${numLimit} vidas de prueba.`, type: 'warning' };
            } else {
                this.lastToast = { message: `1 crédito utilizado. Te quedan ${numRemaining}/${numLimit} vidas de prueba.`, type: 'life' };
            }
        }

        showPaywallModal(customMsg = null, context = 'arena', user = null) {
            let userTier = 'free';
            if (user) userTier = (user.subscriptionTier || user.subscription_tier || 'free').toLowerCase();

            let config = {
                title: '¡Desbloquea el Acceso Premium! 💎',
                message: customMsg || 'Suscríbete hoy y accede a todos los beneficios y herramientas ilimitadas de Hub Academia.',
                btnText: 'Ver Planes Premium',
                btnUrl: '/pricing',
                icon: 'fa-crown'
            };

            if (context === 'chat_standard' || context === 'chat' || context === 'flashcard_tutor' || context === 'quiz_tutor') {
                config.icon = 'fa-comments';
                if (userTier === 'basic') {
                    config.title = '¡Límite de Consultas Alcanzado! 🚀';
                    config.message = customMsg || 'Has alcanzado tu límite de consultas diarias al Tutor IA para el Plan Básico (50 consultas/día). Mejora tu plan a Avanzado para obtener 100 consultas diarias y soporte pedagógico/médico profundo.';
                    config.btnText = 'Mejorar a Avanzado';
                    config.btnUrl = '/pricing';
                    config.icon = 'fa-rocket';
                } else if (userTier === 'advanced' || userTier === 'admin') {
                    config.title = '¡Meta Diaria Alcanzada! 🏆';
                    config.message = customMsg || 'Has completado tus consultas diarias al Tutor IA para el Plan Avanzado (100 consultas/día). ¡Mañana se renovará automáticamente tu cuota!';
                    config.btnText = 'Volver al Inicio';
                    config.btnUrl = '/';
                    config.icon = 'fa-medal';
                } else {
                    config.title = '¡Prueba Gratuita Finalizada! 💎';
                    config.message = customMsg || 'Has consumido tus 10 vidas de prueba gratuitas. Activa un plan premium para continuar practicando con el Tutor IA sin interrupciones.';
                    config.btnText = 'Ver Planes Premium';
                    config.btnUrl = '/pricing';
                    config.icon = 'fa-crown';
                }
            } else if (context === 'simulator' || context === 'diagnostic') {
                config.icon = 'fa-chart-pie';
                if (userTier === 'basic') {
                    config.title = '¡Límite Diario Alcanzado! 🚀';
                    config.message = customMsg || 'Has alcanzado tu límite diario para este recurso. Mejora tu plan a Avanzado para acceder a diagnósticos IA en tiempo real y mayor capacidad.';
                    config.btnText = 'Mejorar a Avanzado';
                    config.btnUrl = '/pricing';
                    config.icon = 'fa-rocket';
                } else if (userTier === 'advanced' || userTier === 'admin') {
                    config.title = '¡Meta Diaria Alcanzada! 🏆';
                    config.message = customMsg || 'Has completado tus diagnósticos y simulacros de hoy. ¡Mañana se renovará automáticamente tu cuota!';
                    config.btnText = 'Volver al Inicio';
                    config.btnUrl = '/';
                    config.icon = 'fa-medal';
                } else {
                    config.title = '¡Desbloquea el Acceso Premium! 💎';
                    config.message = customMsg || 'Has consumido tus 10 vidas de prueba gratuitas. Suscríbete hoy para acceder a diagnósticos inteligentes con IA y simulacros ilimitados.';
                    config.btnText = 'Ver Planes Premium';
                    config.btnUrl = '/pricing';
                    config.icon = 'fa-crown';
                }
            }

            this.lastModalConfig = config;
            this.modalVisible = true;
            return config;
        }
    }

    let uiManager;

    beforeEach(() => {
        uiManager = new MockUIManager();
    });

    test('should block FREE user with 0 lives on Extraer Insights (diagnostic) and show Paywall', () => {
        const freeUser = { subscriptionTier: 'free', usageCount: 10, maxFreeLimit: 10 };
        const allowed = uiManager.validateFreemiumAction(null, 'diagnostic', freeUser);

        expect(allowed).toBe(false);
        expect(uiManager.modalVisible).toBe(true);
        expect(uiManager.lastModalConfig.title).toContain('Desbloquea');
        expect(uiManager.lastModalConfig.message).toContain('Has consumido tus 10 vidas de prueba gratuitas');
        expect(uiManager.lastModalConfig.btnText).toBe('Ver Planes Premium');
    });

    test('should allow FREE user with remaining lives on Extraer Insights', () => {
        const freeUser = { subscriptionTier: 'free', usageCount: 4, maxFreeLimit: 10 };
        const allowed = uiManager.validateFreemiumAction(null, 'diagnostic', freeUser);

        expect(allowed).toBe(true);
        expect(uiManager.modalVisible).toBe(false);
    });

    test('should ALLOW FREE user with their LAST life (usage 9 of 10) and NOT show Paywall prematurely', () => {
        const freeUser = { subscriptionTier: 'free', usageCount: 9, maxFreeLimit: 10 };
        const allowed = uiManager.validateFreemiumAction(null, 'flashcards', freeUser);

        expect(allowed).toBe(true);
        expect(uiManager.modalVisible).toBe(false);
    });

    test('should ALLOW FREE user with their LAST life even when values are STRINGS ("9" and "10")', () => {
        // En JS sin coerción estricta: '9' >= '10' es TRUE! La coerción Number() previene este bug crítico
        const stringUser = { subscriptionTier: 'free', usageCount: '9', maxFreeLimit: '10' };
        const allowed = uiManager.validateFreemiumAction(null, 'flashcards', stringUser);

        expect(allowed).toBe(true);
        expect(uiManager.modalVisible).toBe(false);
    });

    test('should ALLOW user with PENDING subscription status having 1 life remaining', () => {
        const pendingUser = { subscriptionTier: 'basic', subscriptionStatus: 'pending', usageCount: 9, maxFreeLimit: 10 };
        const allowed = uiManager.validateFreemiumAction(null, 'flashcards', pendingUser);

        expect(allowed).toBe(true);
        expect(uiManager.modalVisible).toBe(false);
    });

    test('should BLOCK user with PENDING or EXPIRED subscription status having 0 lives remaining', () => {
        const expiredUser = { subscriptionTier: 'basic', subscriptionStatus: 'expired', usageCount: 10, maxFreeLimit: 10 };
        const allowed = uiManager.validateFreemiumAction(null, 'flashcards', expiredUser);

        expect(allowed).toBe(false);
        expect(uiManager.modalVisible).toBe(true);
    });

    test('isResourceLocked should return FALSE when user has 1 life remaining', () => {
        const user = { subscriptionTier: 'free', usageCount: 9, maxFreeLimit: 10 };
        const locked = uiManager.isResourceLocked(true, user);

        expect(locked).toBe(false);
    });

    test('isResourceLocked should return FALSE when values are strings and 1 life remains ("9" and "10")', () => {
        const user = { subscriptionTier: 'free', usageCount: '9', maxFreeLimit: '10' };
        const locked = uiManager.isResourceLocked(true, user);

        expect(locked).toBe(false);
    });

    test('isResourceLocked should return TRUE only when user has 0 lives remaining', () => {
        const user = { subscriptionTier: 'free', usageCount: 10, maxFreeLimit: 10 };
        const locked = uiManager.isResourceLocked(true, user);

        expect(locked).toBe(true);
    });

    test('isResourceLocked should return FALSE for active paid subscribers regardless of usageCount', () => {
        const paidUser = { subscriptionTier: 'basic', subscriptionStatus: 'active', usageCount: 50, maxFreeLimit: 10 };
        const locked = uiManager.isResourceLocked(true, paidUser);

        expect(locked).toBe(false);
    });

    test('showLifeDecrementToast should NOT trigger showPaywallModal when remaining reaches 0', () => {
        uiManager.showLifeDecrementToast(0, 10);

        expect(uiManager.lastToast).toBeDefined();
        expect(uiManager.lastToast.message).toContain('Has consumido tu última vida de prueba semanal');
        expect(uiManager.modalVisible).toBe(false); // ✅ Crucial: No abre el modal prematuramente
    });

    test('showLifeDecrementToast should show appropriate warning when 1 life remains', () => {
        uiManager.showLifeDecrementToast(1, 10);

        expect(uiManager.lastToast).toBeDefined();
        expect(uiManager.lastToast.message).toContain('solo 1/10 vidas de prueba');
        expect(uiManager.modalVisible).toBe(false);
    });

    test('should block BASIC user who reached daily AI limit on Quiz Tutor', () => {
        const basicUser = { subscriptionTier: 'basic', subscriptionStatus: 'active', dailyAiUsage: 50 };
        const allowed = uiManager.validateFreemiumAction(null, 'quiz_tutor', basicUser);

        expect(allowed).toBe(false);
        expect(uiManager.modalVisible).toBe(true);
        expect(uiManager.lastModalConfig.title).toContain('Límite de Consultas');
        expect(uiManager.lastModalConfig.btnText).toBe('Mejorar a Avanzado');
    });

    test('should block ADVANCED user who reached daily AI limit on Quiz Tutor with completion message', () => {
        const advUser = { subscriptionTier: 'advanced', subscriptionStatus: 'active', dailyAiUsage: 100 };
        const allowed = uiManager.validateFreemiumAction(null, 'quiz_tutor', advUser);

        expect(allowed).toBe(false);
        expect(uiManager.modalVisible).toBe(true);
        expect(uiManager.lastModalConfig.title).toContain('Meta Diaria');
        expect(uiManager.lastModalConfig.message).toContain('Has completado tus consultas diarias al Tutor IA');
        expect(uiManager.lastModalConfig.btnText).toBe('Volver al Inicio');
    });

    test('should block FREE user with 0 lives on Quiz Tutor (during exam or in review)', () => {
        const freeUser = { subscriptionTier: 'free', usageCount: 10, maxFreeLimit: 10 };
        const allowed = uiManager.validateFreemiumAction(null, 'quiz_tutor', freeUser);

        expect(allowed).toBe(false);
        expect(uiManager.modalVisible).toBe(true);
        expect(uiManager.lastModalConfig.title).toContain('Prueba Gratuita');
        expect(uiManager.lastModalConfig.message).toContain('Has consumido tus 10 vidas de prueba gratuitas');
    });
});

describe('Session Lifecycle, Freemium Status & Welcome Modal Guards', () => {
    let mockDOM;

    beforeEach(() => {
        mockDOM = {
            bar: { style: { display: 'none' }, classList: { add: jest.fn(), remove: jest.fn() } },
            body: { classList: { add: jest.fn(), remove: jest.fn() } },
            localStorage: {}
        };
    });

    function evaluateFreemiumStatus(user, pathname = '/dashboard') {
        const isExcludedPage = pathname.includes('/flashcards') || 
                               pathname.includes('/quiz') || 
                               pathname.endsWith('flashcards.html') || 
                               pathname.endsWith('quiz.html');

        const tier = user ? String(user.subscriptionTier || user.subscription_tier || 'free').toLowerCase().trim() : 'free';
        const status = user ? String(user.subscriptionStatus || user.subscription_status || 'pending').toLowerCase().trim() : 'pending';
        const isPaidActive = user && (tier === 'basic' || tier === 'advanced') && status === 'active';
        const isOptimistic = Boolean(user && user._isOptimistic);

        if (isExcludedPage || !user || isPaidActive || (user && user.role === 'admin') || isOptimistic || tier === 'unknown') {
            mockDOM.bar.style.display = 'none';
            mockDOM.body.classList.remove('has-trial-mode');
            return false; // Not displayed
        }

        mockDOM.bar.style.display = 'flex';
        mockDOM.body.classList.add('has-trial-mode');
        return true; // Displayed
    }

    function evaluateWelcomeModal(user, pathname = '/dashboard', lastSeen = null) {
        if (!user || user._isOptimistic) return false;

        const isExcludedPage = pathname.includes('/flashcards') || 
                               pathname.includes('/quiz') || 
                               pathname.includes('/simulator') ||
                               pathname.endsWith('flashcards.html') || 
                               pathname.endsWith('quiz.html') ||
                               pathname.endsWith('simulator-dashboard.html');
        if (isExcludedPage) return false;

        if (user.role === 'admin') return false;

        const tier = String(user.subscriptionTier || user.subscription_tier || 'free').toLowerCase().trim();
        const status = String(user.subscriptionStatus || user.subscription_status || 'pending').toLowerCase().trim();
        if (tier !== 'free' || tier === 'basic' || tier === 'advanced' || status === 'active') return false;

        const usage = user.usageCount !== undefined ? user.usageCount : (user.usage_count || 0);
        if (usage > 0) return false;

        const lastRenewalStr = user.lastFreeRenewal || user.last_free_renewal;
        if (!lastRenewalStr) return false;

        const lastRenewalDate = String(lastRenewalStr).split('T')[0];
        if (lastSeen === lastRenewalDate) return false;

        return true;
    }

    test('updateFreemiumStatus oculta la barra si el usuario está en fase optimista (_isOptimistic: true) para evitar parpadeos', () => {
        const optimisticUser = {
            id: 'sb-123',
            email: 'user@example.com',
            subscriptionTier: 'unknown',
            subscriptionStatus: 'pending',
            _isOptimistic: true
        };

        const shown = evaluateFreemiumStatus(optimisticUser, '/dashboard');
        expect(shown).toBe(false);
        expect(mockDOM.bar.style.display).toBe('none');
        expect(mockDOM.body.classList.remove).toHaveBeenCalledWith('has-trial-mode');
    });

    test('updateFreemiumStatus oculta permanentemente la barra para usuarios de pago BASIC o ADVANCED activos', () => {
        const basicUser = {
            id: 'usr_basic',
            subscriptionTier: 'basic',
            subscriptionStatus: 'active',
            _isOptimistic: false
        };

        const shown = evaluateFreemiumStatus(basicUser, '/dashboard');
        expect(shown).toBe(false);
        expect(mockDOM.bar.style.display).toBe('none');
    });

    test('updateFreemiumStatus muestra la barra únicamente para usuarios FREE confirmados', () => {
        const freeUser = {
            id: 'usr_free',
            subscriptionTier: 'free',
            subscriptionStatus: 'active',
            _isOptimistic: false,
            usageCount: 2,
            maxFreeLimit: 10
        };

        const shown = evaluateFreemiumStatus(freeUser, '/dashboard');
        expect(shown).toBe(true);
        expect(mockDOM.bar.style.display).toBe('flex');
        expect(mockDOM.body.classList.add).toHaveBeenCalledWith('has-trial-mode');
    });

    test('checkAndShowWelcomeModal NUNCA se muestra para usuarios de pago BASIC o ADVANCED', () => {
        const paidUser = {
            id: 'usr_paid',
            subscriptionTier: 'advanced',
            subscriptionStatus: 'active',
            lastFreeRenewal: '2026-09-05T00:00:00.000Z',
            usageCount: 0,
            _isOptimistic: false
        };

        const triggered = evaluateWelcomeModal(paidUser, '/dashboard');
        expect(triggered).toBe(false);
    });

    test('checkAndShowWelcomeModal NUNCA se muestra en páginas de examen o simuladores (quiz, simulator-dashboard)', () => {
        const freeUser = {
            id: 'usr_free',
            subscriptionTier: 'free',
            subscriptionStatus: 'pending',
            lastFreeRenewal: '2026-09-05T00:00:00.000Z',
            usageCount: 0,
            _isOptimistic: false
        };

        expect(evaluateWelcomeModal(freeUser, '/quiz.html')).toBe(false);
        expect(evaluateWelcomeModal(freeUser, '/simulator-dashboard.html')).toBe(false);
        expect(evaluateWelcomeModal(freeUser, '/flashcards.html')).toBe(false);
    });

    test('checkAndShowWelcomeModal NUNCA se muestra para usuarios optimistas no confirmados', () => {
        const optimisticUser = {
            id: 'usr_opt',
            subscriptionTier: 'free',
            subscriptionStatus: 'pending',
            lastFreeRenewal: '2026-09-05T00:00:00.000Z',
            usageCount: 0,
            _isOptimistic: true
        };

        expect(evaluateWelcomeModal(optimisticUser, '/dashboard')).toBe(false);
    });

    test('checkAndShowWelcomeModal se muestra para usuario FREE confirmado que recibe renovación semanal', () => {
        const freeUser = {
            id: 'usr_free',
            subscriptionTier: 'free',
            subscriptionStatus: 'pending',
            lastFreeRenewal: '2026-09-05T00:00:00.000Z',
            usageCount: 0,
            _isOptimistic: false
        };

        expect(evaluateWelcomeModal(freeUser, '/dashboard', '2026-08-28')).toBe(true);
        // Si ya vio la renovación de hoy, no se repite
        expect(evaluateWelcomeModal(freeUser, '/dashboard', '2026-09-05')).toBe(false);
    });
});
