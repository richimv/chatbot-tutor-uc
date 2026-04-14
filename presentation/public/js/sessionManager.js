/* global AuthApiService */ // Le decimos al linter que esta clase existe

class SessionManager {
    constructor() {
        this.currentUser = null;
        this.onStateChangeCallbacks = [];
        this.initSupabaseListener();
    }

    // ✅ Centralizar la escucha de Supabase
    initSupabaseListener() {
        if (window.supabaseClient) {
            window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
                console.log(`🔄 SessionManager [Evento Supabase]: ${event}`);

                if (event === 'SIGNED_IN' && session) {
                    // Evitar múltiples sincronizaciones paralelas
                    if (window._isSyncing) return;
                    if (this.currentUser && this.currentUser.id === session.user.id) return;

                    try {
                        window._isSyncing = true;
                        window._isAuthenticating = true;

                        const syncResponse = await AuthApiService.syncGoogleUser(session.user);
                        if (syncResponse && syncResponse.user) {
                            this.currentUser = syncResponse.user;
                            localStorage.setItem('authToken', session.access_token);
                            this.notifyStateChange();
                        }
                    } catch (err) {
                        console.error('❌ Error de sincronización:', err);
                    } finally {
                        window._isSyncing = false;
                        window._isAuthenticating = false;
                    }
                } else if (event === 'SIGNED_OUT') {
                    this.currentUser = null;
                    localStorage.removeItem('authToken');
                    this.notifyStateChange();
                }
            });
        }
    }

    async initialize() {
        // 1. Limpieza rápida de URL
        if (window.location.hash && window.location.hash.includes('access_token')) {
            window.history.replaceState(null, '', window.location.pathname + '#home');
        }

        // 2. Recuperar sesión local si existe
        const token = localStorage.getItem('authToken');
        if (token) {
            try {
                // No bloqueamos desesperadamente, intentamos recuperar
                this.currentUser = await AuthApiService.getMe();
            } catch (err) {
                this.currentUser = null;
                localStorage.removeItem('authToken');
            }
        }

        // Si no hay usuario tras initialize, notificamos para que aparezca el botón "Acceder"
        this.notifyStateChange();
    }

    // ✅ NUEVO: Método para refrescar sesión sin recargar (para actualizar vidas/tokens)
    async refreshUser() {
        if (!this.currentUser) return;
        try {
            console.log('🔄 Refrescando sesión de usuario en segundo plano...');
            const updatedUser = await AuthApiService.getMe();
            if (updatedUser) {
                this.currentUser = updatedUser;
                this.notifyStateChange();
                console.log('✅ Sesión refrescada. Vidas actualizadas:', updatedUser.usageCount);
            }
        } catch (error) {
            console.warn('⚠️ Falló el refresco silencioso de sesión:', error);
            // No hacemos logout, solo ignoramos el error de red momentáneo
        }
    }

    // 🛡️ NUEVO: Método para validar activamente si el token caducó en el backend y forzar logout en la UI
    async validateSession() {
        if (!this.currentUser) return;
        try {
            // getMe() retorna destructivamente null si el servidor responde 401 (Expirado)
            const isValid = await AuthApiService.getMe();
            if (!isValid) {
                console.warn('🕒 Sesión local detectada como EXPIRADA por el servidor. Forzando cierre de sesión...');
                if (typeof window.handleLogout === 'function') {
                    window.handleLogout();
                } else {
                    this.logout();
                }
            }
        } catch (error) {
            // Ignorar errores de red temporales, solo destruir si el backend explícitamente rechaza el token
        }
    }

    login(token, user) {
        localStorage.setItem('authToken', token);
        this.currentUser = user;
        this.notifyStateChange();
    }

    async logout() {
        try {
            // 1. Limpiar estado local de Supabase (y revocar si es posible)
            if (window.supabaseClient) {
                await window.supabaseClient.auth.signOut();
            }
        } catch (e) {
            console.warn('⚠️ Supabase Logout Warning:', e);
        }

        // 2. Limpieza Agresiva de LocalStorage
        localStorage.removeItem('authToken');
        localStorage.removeItem('sb-rayjtupppcbhzjizhamn-auth-token'); // Limpiar token específico de Supabase si se conoce
        // Opcional: Limpiar todo si es seguro para la app
        // localStorage.clear(); 

        this.currentUser = null;
        this.notifyStateChange();

        // 3. Redirigir solo cuando estemos limpios
        window.location.href = '/';
    }

    isLoggedIn() {
        return !!this.currentUser;
    }

    getUser() {
        return this.currentUser;
    }

    onStateChange(callback) {
        this.onStateChangeCallbacks.push(callback);
    }

    notifyStateChange() {
        this.onStateChangeCallbacks.forEach(cb => cb(this.currentUser));
    }

    checkSubscriptionStatus() {
        if (!this.currentUser) return;
        if (this.currentUser.role === 'admin') return;
        console.log(`👤 Verificando estatus: ${this.currentUser.subscriptionStatus}`);
    }
}

// Instancia global
window.sessionManager = new SessionManager();

window.sessionManager.onStateChange((user) => {
    if (user) {
        window.sessionManager.checkSubscriptionStatus();
    }
});