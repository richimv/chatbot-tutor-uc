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
                // Verificar si hay sesión en Supabase (Usando cliente global)
                if (window.supabaseClient) {

                    const { data } = await window.supabaseClient.auth.getSession();

                    if (data && data.session && data.session.user) {
                        console.log('⚠️ Usuario Google detectado en Supabase. Sincronizando con Backend...');
                        try {
                            // Sincronizar (Crear en BD Local)
                            await AuthApiService.syncGoogleUser(data.session.user);
                            console.log('✅ Sincronización enviada. Reintentando obtener perfil...');

                            // Reintentar getMe (Ahora sí debería funcionar y devolver 200)
                            this.currentUser = await AuthApiService.getMe();
                            console.log('🎉 Sesión recuperada exitosamente.');
                        } catch (syncError) {
                            console.error('❌ Error crítico al sincronizar usuario Google:', syncError);
                            // Opcional: Cerrar sesión en Supabase si falla la sincronización para evitar estado corrupto
                            // window.supabaseClient.auth.signOut(); 
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