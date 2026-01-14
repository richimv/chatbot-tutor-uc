/* global AuthApiService */ // Le decimos al linter que esta clase existe

class SessionManager {
    constructor() {
        this.currentUser = null;
        this.onStateChangeCallbacks = [];
    }

    /**
     * ✅ CORRECCIÓN: Este método se llama al recargar la página.
     * El `AuthApiService.getMe()` ahora devuelve el payload completo del token,
     * que ya incluye el email. Almacenamos este objeto en `this.currentUser`.
     */
    async initialize() {
        try {
            // 1. Intentar obtener usuario del backend
            this.currentUser = await AuthApiService.getMe();

            // 2. Lógica de Sincronización (Google Login Fix)
            if (!this.currentUser) {
                // Verificar si hay sesión en Supabase
                const { data } = await supabase.auth.getSession();
                if (data && data.session && data.session.user) {
                    console.warn('⚠️ Usuario autenticado en Supabase pero no en Backend. Intentando sincronizar...');
                    try {
                        await AuthApiService.syncGoogleUser(data.session.user);
                        // Reintentar getMe
                        this.currentUser = await AuthApiService.getMe();
                        console.log('✅ Sincronización completada. Sesión restaurada.');
                    } catch (syncError) {
                        console.error('❌ Error crítico al sincronizar usuario Google:', syncError);
                        // Opcional: Cerrar sesión en Supabase si no se puede sincronizar
                        // await supabase.auth.signOut();
                    }
                }
            }

        } catch (error) {
            console.error("Error al inicializar sesión:", error);
            this.currentUser = null;
        }
        this.notifyStateChange();
    }

    /**
     * Este método se llama durante el login.
     * El objeto `user` que viene del `authService` ya es correcto y contiene el email.
     * Lo guardamos en `this.currentUser`.
     */
    login(token, user) {
        localStorage.setItem('authToken', token);
        // ✅ SOLUCIÓN DEFINITIVA: Guardar el objeto 'user' completo que viene de la API.
        // Este objeto contiene { id, name, email, role }, que es lo que necesitamos.
        this.currentUser = user;
        this.notifyStateChange();
    }

    logout() {
        localStorage.removeItem('authToken');
        this.currentUser = null;
        this.notifyStateChange();
        // Opcional: redirigir a la página de inicio
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

    /**
     * ✅ LÓGICA DE MONETIZACIÓN AJUSTADA
     * Antes: Redirigía agresivamente si no era 'active'.
     * Ahora: Permite la navegación para usuarios 'pending' (Freemium/3 Vidas).
     * El bloqueo real ocurrirá al intentar abrir un libro (backend).
     */
    checkSubscriptionStatus() {
        if (!this.currentUser) return;

        // Si es admin, dejamos pasar siempre.
        if (this.currentUser.role === 'admin') return;

        // 🛑 CAMBIO EXACTO AQUÍ:
        // Hemos desactivado la redirección automática.
        // Ahora el usuario puede ver el dashboard y gastar sus vidas gratis.

        console.log(`👤 Verificando estatus: ${this.currentUser.subscriptionStatus}`);

        /* BLOQUE DESACTIVADO PARA PERMITIR MODELO FREEMIUM
        const isPricingPage = window.location.pathname.includes('pricing.html');
        if (this.currentUser.subscriptionStatus !== 'active' && !isPricingPage) {
            console.warn('🔒 Usuario sin suscripción activa. Redirigiendo a precios...');
            window.location.href = 'pricing.html';
        }
        */
    }
}

// Instancia global
window.sessionManager = new SessionManager();

// ✅ Hook para verificar suscripción cuando cambia el estado (login/init)
window.sessionManager.onStateChange((user) => {
    if (user) {
        window.sessionManager.checkSubscriptionStatus();
    }
});