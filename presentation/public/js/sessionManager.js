/* global AuthApiService */ // Le decimos al linter que esta clase existe

class SessionManager {
    constructor() {
        this.currentUser = null;
        this.onStateChangeCallbacks = [];
    }

    async initialize() {
        try {
            this.currentUser = await AuthApiService.getMe();
        } catch (error) {
            console.error("Error al inicializar sesión:", error);
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