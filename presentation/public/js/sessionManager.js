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
            this.currentUser = await AuthApiService.getMe();
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
}

// Instancia global
window.sessionManager = new SessionManager();