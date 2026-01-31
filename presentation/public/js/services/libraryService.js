/**
 * libraryService.js
 * Servicio Central de Estado para "Mi Biblioteca"
 * 
 * Responsabilidades:
 * 1. Mantener la "Verdad Única" de qué items están guardados/favoritos.
 * 2. Comunicarse con el API Backend.
 * 3. Emitir eventos cuando el estado cambia para que la UI reaccione.
 */
class LibraryService {
    constructor() {
        this.state = {
            saved: new Set(),     // IDs de items guardados: "type-id" (ej: "course-1")
            favorites: new Set(), // IDs de items favoritos: "type-id"
            data: { courses: [], books: [] } // Cache de datos completos
        };
        this.CONSTANTS = {
            EVENT_CHANGE: 'library:state-changed',
            EVENT_ERROR: 'library:error'
        };
    }

    // Inicializa el servicio cargando el estado inicial del usuario
    async init() {
        if (!this._getToken()) return; // No hacer nada si no hay usuario
        try {
            await this._loadStatus();
            this._dispatchChange();
            console.log('📚 LibraryService: Inicializado y sincronizado.');
        } catch (error) {
            console.error('📚 LibraryService Error:', error);
        }
    }

    // --- API PÚBLICA ---

    /**
     * Verifica si un item está guardado
     */
    isSaved(type, id) {
        return this.state.saved.has(`${type}-${id}`);
    }

    /**
     * Verifica si un item es favorito
     */
    isFavorite(type, id) {
        return this.state.favorites.has(`${type}-${id}`);
    }

    /**
     * Acción principal: Toggle Guardar/Favorito
     */
    async toggleItem(type, id, action) {
        if (!type || !id || !action) return;

        const key = `${type}-${id}`;
        const set = action === 'save' ? this.state.saved : this.state.favorites;
        const wasActive = set.has(key);

        // 1. UPDATE OPTIMISTA (Feedback instantáneo)
        if (wasActive) set.delete(key);
        else set.add(key);

        // Notificar a la UI inmediatamente
        this._dispatchChange();

        // 2. LLAMADA AL SERVIDOR
        try {
            const response = await fetch(`${window.AppConfig.API_URL}/api/library/toggle`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this._getToken()}`
                },
                body: JSON.stringify({ type, id, action })
            });

            if (!response.ok) throw new Error('Error en servidor');

            // Si la vista de detalle del drawer está abierta, recargar datos
            if (this.shouldReloadData) {
                this.loadFullLibrary();
            }

        } catch (error) {
            console.error('❌ Error sincronizando:', error);
            // Revertir cambio en caso de error
            if (wasActive) set.add(key); else set.delete(key);
            this._dispatchChange(); // Notificar reversión
            this._dispatchError('No se pudo guardar el cambio. Revisa tu conexión.');
        }
    }

    /**
     * Carga la data completa (para el Drawer/Mi Biblioteca)
     */
    async loadFullLibrary() {
        try {
            const response = await fetch(`${window.AppConfig.API_URL}/api/library/my-library`, {
                headers: { 'Authorization': `Bearer ${this._getToken()}` }
            });
            const data = await response.json();
            this.state.data = data;
            // Podríamos emitir otro evento específico si fuera necesario, 
            // pero state-changed suele ser suficiente si la UI lee this.state.data
            this.shouldReloadData = true; // Flag para saber que ya se cargó una vez
            this._dispatchChange();
        } catch (error) {
            console.error('Error cargando biblioteca completa:', error);
        }
    }

    getLibraryData() {
        return this.state.data;
    }

    // --- MÉTODOS PRIVADOS ---

    async _loadStatus() {
        const response = await fetch(`${window.AppConfig.API_URL}/api/library/status`, {
            headers: { 'Authorization': `Bearer ${this._getToken()}` }
        });
        const data = await response.json();

        // Limpiar y llenar sets
        this.state.saved.clear();
        this.state.favorites.clear();

        if (Array.isArray(data)) {
            data.forEach(item => {
                const key = `${item.type}-${item.id}`;
                if (item.is_saved) this.state.saved.add(key);
                if (item.is_favorite) this.state.favorites.add(key);
            });
        }
    }

    _getToken() {
        return localStorage.getItem('authToken');
    }

    _dispatchChange() {
        window.dispatchEvent(new CustomEvent(this.CONSTANTS.EVENT_CHANGE, {
            detail: {
                savedCount: this.state.saved.size,
                favoritesCount: this.state.favorites.size
            }
        }));
    }

    _dispatchError(msg) {
        // Opcional: Integrar con sistema de notificaciones toast
        alert(msg);
    }
}

// Singleton Export
window.libraryService = new LibraryService();
