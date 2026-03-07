/* global AuthApiService */ // Le decimos al linter que esta clase existe

class SessionManager {
    constructor() {
        this.currentUser = null;
        this.onStateChangeCallbacks = [];
    }

    async initialize() {
        // ✅ Pre-check: Clean malformed tokens to avoid server spam
        const rawToken = localStorage.getItem('authToken');
        if (rawToken && rawToken.split('.').length !== 3) {
            console.warn("🧹 Removing malformed token from localStorage.");
            localStorage.removeItem('authToken');
        }

        try {
            // 1. Intentar obtener usuario del backend
            const token = localStorage.getItem('authToken');
            if (!token) {
                this.currentUser = null;
            } else {
                try {
                    this.currentUser = await AuthApiService.getMe();
                } catch (err) {
                    console.warn("Backend no reconoce sesión (401/404), verificando Supabase...", err);
                    this.currentUser = null;
                }
            }

            // 2. Lógica de Sincronización (Si el backend falló, pero Supabase tiene sesión)
            if (!this.currentUser) {
                if (window.supabaseClient) {
                    const { data } = await window.supabaseClient.auth.getSession();

                    if (data && data.session && data.session.user) {
                        try {
                            // Mostrar loading en UI mientras sincronizamos
                            const userControls = document.getElementById('user-session-controls');
                            if (userControls) userControls.innerHTML = '<span class="loading-user"><i class="fas fa-spinner fa-spin"></i> Sincronizando...</span>';

                            // ✅ CORRECCIÓN RACE CONDITION: Esperar respuesta del backend con el perfil REAL
                            const syncResponse = await AuthApiService.syncGoogleUser(data.session.user);

                            if (syncResponse && syncResponse.user) {
                                // ✅ Usar el usuario retornado por el backend (con subscriptionStatus real)
                                this.currentUser = syncResponse.user;

                                // Guardar token de Supabase para futuras peticiones
                                localStorage.setItem('authToken', data.session.access_token);

                                console.log('🎉 Sesión sincronizada y recuperada correctamente.');
                            } else {
                                // Fallback: Si sync no devuelve user, intentar getMe
                                this.currentUser = await AuthApiService.getMe();
                            }

                        } catch (syncError) {
                            console.error('❌ Error crítico al sincronizar usuario Google:', syncError);
                            // Si falla la sincronización crítica, limpiamos para no dejar estados zombies
                            this.logout();
                            return;
                        }
                    }
                }
            }

        } catch (error) {
            console.error("Error general al inicializar sesión:", error);
            this.currentUser = null;
        }
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