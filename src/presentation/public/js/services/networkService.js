/**
 * NetworkService (Architecture v2.0)
 * Centralized hub for all API communications.
 * Handles automatic token injection, refreshing, and global error interceptors.
 */
class NetworkService {
    /**
     * Core request method that wraps fetch with auth logic.
     * @param {string} url - API Endpoint
     * @param {Object} options - Fetch options
     * @returns {Promise<Response>}
     */
    static async fetch(url, options = {}) {
        if (url && typeof url !== 'string') {
            url = url.toString();
        }
        // 1. Respetar una identidad explícita del flujo llamador. Esto es
        // especialmente importante dentro de onAuthStateChange(SIGNED_IN), donde
        // volver a consultar la sesión de Supabase puede competir con su persistencia.
        const headers = {
            ...options.headers
        };
        const hasExplicitAuthorization = Object.keys(headers)
            .some(headerName => headerName.toLowerCase() === 'authorization');

        // 2. Si el llamador no proporcionó Authorization, obtener el token fresco.
        let token = null;
        if (!hasExplicitAuthorization) {
            if (window.AuthApiService) {
                token = await window.AuthApiService.getValidToken();
            } else {
                token = localStorage.getItem('authToken');
            }
        }

        // 🛡️ FIX: No forzar application/json si el body es FormData (permite que el browser ponga el boundary)
        if (!(options.body instanceof FormData) && !headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }

        if (!hasExplicitAuthorization && token && token !== 'null' && token !== 'undefined') {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const fetchOptions = {
            ...options,
            headers
        };

        // Detectar si es un endpoint que consume vidas para free/pending
        const isStudyEndpoint = url.includes('/cards/due') || url.includes('/flashcard/due') || (url.includes('/cards/') && url.includes('/study')) || url.includes('/study-public');
        const isDeckWriteEndpoint = (url.includes('/api/decks') || url.includes('/api/cards')) && (options.method === 'POST' || options.method === 'PUT') && !url.includes('/visibility') && !url.includes('/reorder') && !url.includes('/tree');
        const isDeckClone = url.includes('/clone') && (options.method === 'POST' || !options.method);
        const isSimulatorStart = (url.includes('/api/medico/start') || url.includes('/api/docente/start')) && (options.method === 'POST' || !options.method);
        const isTutorOrAIChat = url.includes('/api/chat') && !url.includes('/conversations') && !(options.headers && (options.headers['X-General-Chat'] || options.headers['x-general-chat'])) && (options.method === 'POST' || !options.method);
        const isDiagnostic = url.includes('/api/analytics/diagnostic') && options.method === 'POST';

        const isConsumptionEndpoint = isStudyEndpoint || isDeckWriteEndpoint || isDeckClone || isSimulatorStart || isTutorOrAIChat || isDiagnostic;

        let optimisticallyDecremented = false;

        if (isConsumptionEndpoint && window.sessionManager && !url.includes('/api/auth/')) {
            // Asegurar que sessionManager haya resuelto la sesión antes de evaluar consumo si está en curso
            if (!window.sessionManager.getUser() && window.sessionManager.initPromise) {
                try {
                    await window.sessionManager.initPromise;
                } catch (_) {}
            }

            const currentUser = window.sessionManager.getUser();
            if (currentUser && currentUser.role !== 'admin') {
                // Si el usuario está en fase optimista inicial, esperar confirmación del backend para no penalizar a usuarios de pago
                if (!currentUser._isOptimistic) {
                    const tier = String(currentUser.subscriptionTier || currentUser.subscription_tier || 'free').toLowerCase();
                    const status = String(currentUser.subscriptionStatus || currentUser.subscription_status || 'pending').toLowerCase();
                    const isPaidActive = (tier === 'basic' || tier === 'advanced') && status === 'active';

                    if (!isPaidActive) {
                        window.sessionManager.decrementUsage(1);
                        optimisticallyDecremented = true;
                    }
                }
            }
        }

        let retries = 1;
        while (true) {
            try {
                const response = await fetch(url, fetchOptions);

                // 3. INTERCEPTOR GLOBAL: Manejo de Errores de Autorización (Sesión Expirada)
                if (response.status === 401) {
                    console.warn(`⚠️ [NetworkService] Error de autorización (401) en: ${url}`);
                    
                    const currentToken = localStorage.getItem('authToken');
                    // Si ya no hay token en localStorage, no intentar desloguear (evita bucles infinitos)
                    if (!currentToken || currentToken === 'null' || currentToken === 'undefined') {
                        const error = new Error('Unauthorized');
                        error.status = response.status;
                        throw error;
                    }

                    // 🛡️ NO forzar logout si estamos en pleno flujo de login / OAuth / Sync
                    const isAuthenticating = window._isAuthenticating || window._isGlobalSyncing || (window.location.hash && window.location.hash.includes('access_token')) || url.includes('/api/auth/sync');

                    // Si el backend dice que la sesión expiró y NO estamos en login, forzamos limpieza
                    if (window.sessionManager && !isAuthenticating) {
                        // Notificar al usuario antes de redirigir si es posible
                        if (window.uiManager && window.uiManager.showToast) {
                            window.uiManager.showToast('Tu sesión ha expirado. Por seguridad, debes volver a ingresar.', 'warning');
                        }
                        
                        const isQuizPage = window.location.pathname.includes('quiz.html') || window.location.pathname.includes('simulator');
                        const isHomePage = window.location.pathname === '/' || window.location.pathname.endsWith('index.html');
                        
                        // Esperar un poco para que el toast sea visible si no estamos en un flujo crítico
                        setTimeout(() => {
                            // Solo redireccionar si no estamos en la página de inicio y no es quiz
                            const shouldRedirect = !isQuizPage && !isHomePage;
                            window.sessionManager.logout(shouldRedirect);
                            
                            if (isQuizPage && window.uiManager && typeof window.uiManager.showAuthPromptModal === 'function') {
                                window.uiManager.showAuthPromptModal();
                            }
                        }, 2000);
                    }
                    
                    const error = new Error('Unauthorized');
                    error.status = response.status;
                    throw error;
                }

                // Sincronizar vidas en segundo plano tras respuesta exitosa, o revertir si falló
                if (response.ok && isConsumptionEndpoint && window.sessionManager) {
                    window.sessionManager.refreshUser().catch(() => {});
                } else if (!response.ok && optimisticallyDecremented && window.sessionManager) {
                    window.sessionManager.refreshUser().catch(() => {});
                }

                return response;
            } catch (error) {
                if (optimisticallyDecremented && window.sessionManager) {
                    window.sessionManager.refreshUser().catch(() => {});
                }

                // Manejo de errores de red (offline, DNS, Wake-Up delay, etc.)
                if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
                    if (retries > 0) {
                        console.warn(`🔄 [NetworkService] Red inestable, aplicando Soft Fallback (Reintento en 800ms) para: ${url}`);
                        retries--;
                        await new Promise(res => setTimeout(res, 800));
                        continue; // Reintenta el ciclo
                    }

                    console.error('❌ [NetworkService] Error de conexión crítica tras reintentos:', error);
                    if (window.uiManager && window.uiManager.showToast) {
                        window.uiManager.showToast('Problema de conexión con el servidor.', 'error');
                    }
                }
                throw error;
            }
        }
    }

    /**
     * Helper para peticiones GET rápidas que devuelven JSON directamente.
     */
    static async get(url, options = {}) {
        const response = await this.fetch(url, { ...options, method: 'GET' });
        return response.json();
    }

    /**
     * Helper para peticiones POST rápidas.
     */
    static async post(url, body, options = {}) {
        const response = await this.fetch(url, {
            ...options,
            method: 'POST',
            body: JSON.stringify(body)
        });
        return response.json();
    }
}

// Hacerlo disponible globalmente
window.NetworkService = NetworkService;
