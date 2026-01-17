/* global AuthApiService */ // Le decimos al linter que esta clase existe

class SessionManager {
    constructor() {
        this.currentUser = null;
        this.onStateChangeCallbacks = [];
    }

    async initialize() {
        try {
            // 1. Intentar obtener usuario del backend
            try {
                this.currentUser = await AuthApiService.getMe();
            } catch (err) {
                console.warn("Backend no reconoce sesión (401/404), verificando Supabase...", err);
                this.currentUser = null;
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

    login(token, user) {
        localStorage.setItem('authToken', token);
        this.currentUser = user;
        this.notifyStateChange();
    }

    logout() {
        localStorage.removeItem('authToken');
        // También cerramos sesión en Supabase para limpiar todo
        if (window.supabaseClient) {
            window.supabaseClient.auth.signOut();
        }
        this.currentUser = null;
        this.notifyStateChange();
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