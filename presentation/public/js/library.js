class LibraryManager {
    constructor() {
        this.library = { saved: new Set(), favorites: new Set() };
        this.cache = { courses: [], books: [] };

        // Determinar qué pestaña mostrar por defecto
        this.currentTab = 'saved'; // 'saved' | 'favorites'
    }

    async init() {
        // 1. Obtener estado inicial (IDs) para marcar los botones
        await this.loadStatus();

        // 2. Renderizar el Drawer (HTML) si no existe
        this.renderDrawerStructure();

        // 3. Añadir botón flotante (Solo si está logueado)
        if (localStorage.getItem('authToken')) {
            this.renderFloatingButton();
        }

        // 4. Escuchar clics globales para manejar toggles
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.action-btn');
            if (btn) {
                e.preventDefault();
                e.stopPropagation();

                // ✅ NUEVO: Bloqueo Soft para usuarios no registrados
                window.uiManager.checkAuthAndExecute(() => {
                    const type = btn.dataset.type;
                    const id = btn.dataset.id;
                    const action = btn.dataset.action; // 'save' | 'favorite'
                    this.toggleItem(type, id, action, btn);
                });
            }
        });
    }

    async loadStatus() {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) return;

            const response = await fetch('/api/library/status', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            this.library.saved.clear();
            this.library.favorites.clear();

            data.forEach(item => {
                const key = `${item.type}-${item.id}`;
                if (item.is_saved) this.library.saved.add(key);
                if (item.is_favorite) this.library.favorites.add(key);
            });

            // Actualizar botones visibles
            this.updateButtons();
        } catch (error) {
            console.error('Error loading library status:', error);
        }
    }

    async loadFullLibrary() {
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch('/api/library/my-library', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            this.cache = data; // { courses: [], books: [] }
            this.renderDrawerContent();
        } catch (error) {
            console.error('Error loading library:', error);
        }
    }

    updateButtons() {
        // Busca todos los botones de acción en el DOM y actualiza su estado
        document.querySelectorAll('.action-btn').forEach(btn => {
            const key = `${btn.dataset.type}-${btn.dataset.id}`;
            const action = btn.dataset.action;
            const isActive = action === 'save'
                ? this.library.saved.has(key)
                : this.library.favorites.has(key);

            if (isActive) {
                btn.classList.add('active');
                if (action === 'save') btn.querySelector('i').className = 'fas fa-bookmark';
                if (action === 'favorite') btn.querySelector('i').className = 'fas fa-heart';
            } else {
                btn.classList.remove('active');
                if (action === 'save') btn.querySelector('i').className = 'far fa-bookmark';
                if (action === 'favorite') btn.querySelector('i').className = 'far fa-heart';
            }
        });
    }

    async toggleItem(type, id, action, btnElement) {
        if (!id || !type) {
            console.error("❌ Error: Intentando guardar un item sin ID o Tipo válidos", { type, id });
            return;
        }

        // UI Optimista
        const key = `${type}-${id}`;
        const set = action === 'save' ? this.library.saved : this.library.favorites;
        const wasActive = set.has(key);

        // Toggle local
        if (wasActive) set.delete(key);
        else set.add(key);

        this.updateButtons(); // Re-render icon state

        try {
            const token = localStorage.getItem('authToken');
            await fetch('/api/library/toggle', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ type, id, action })
            });

            // Recargar datos completos del drawer si está abierto para reflejar cambios
            if (document.querySelector('.library-drawer.open')) {
                this.loadFullLibrary();
            }
        } catch (error) {
            console.error('Error toggling item:', error);
            // Revertir si falla
            if (wasActive) set.add(key); else set.delete(key);
            this.updateButtons();
        }
    }

    renderDrawerStructure() {
        if (document.querySelector('.library-drawer')) return;

        const drawer = document.createElement('div');
        drawer.className = 'library-drawer';
        drawer.innerHTML = `
            <div class="library-header">
                <span class="library-title">Mi Biblioteca</span>
                <button class="close-drawer-btn" onclick="libraryManager.toggleDrawer()"><i class="fas fa-times"></i></button>
            </div>
            <div class="library-tabs">
                <button class="library-tab active" data-tab="saved" onclick="libraryManager.switchTab('saved')">Guardados</button>
                <button class="library-tab" data-tab="favorites" onclick="libraryManager.switchTab('favorites')">Favoritos</button>
            </div>
            <div class="library-content">
                <div class="library-list" id="library-list-container">
                    <!-- Items injected here -->
                    <div class="empty-state">
                        <i class="fas fa-spinner fa-spin"></i> Cargando...
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(drawer);
    }

    renderFloatingButton() {
        if (document.querySelector('.library-toggle')) return;

        const btn = document.createElement('div');
        btn.className = 'library-toggle';
        btn.innerHTML = `<i class="fas fa-layer-group"></i>`;
        btn.title = "Abrir Mi Biblioteca";
        btn.onclick = () => this.toggleDrawer();
        document.body.appendChild(btn);
    }

    renderDrawerContent() {
        const container = document.getElementById('library-list-container');
        if (!container) return;

        const items = [];

        // Helper para procesar items
        const processItem = (item, type) => {
            const id = item.id;
            const isRelevant = this.currentTab === 'saved' ? item.is_saved : item.is_favorite;
            if (isRelevant) {
                items.push({
                    type,
                    id,
                    title: item.name || item.title,
                    image: item.image_url || 'assets/images/placeholder.jpg',
                    updated_at: new Date(item.updated_at)
                });
            }
        };

        this.cache.courses.forEach(c => processItem(c, 'course'));
        this.cache.books.forEach(b => processItem(b, 'book'));

        // Ordenar por más reciente
        items.sort((a, b) => b.updated_at - a.updated_at);

        if (items.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="far ${this.currentTab === 'saved' ? 'fa-bookmark' : 'fa-heart'}"></i>
                    <p>No tienes ${this.currentTab === 'saved' ? 'guardados' : 'favoritos'} aún.</p>
                </div>`;
            return;
        }

        container.innerHTML = items.map(item => `
            <div class="library-item" onclick="window.location.href='${item.type}.html?id=${item.id}'">
                <img src="${item.image}" alt="${item.title}" onerror="this.src='https://via.placeholder.com/60?text=${item.type[0].toUpperCase()}'">
                <div class="library-item-info">
                    <div class="library-item-title">${item.title}</div>
                    <div class="library-item-type">${item.type === 'course' ? 'Curso' : 'Libro'}</div>
                </div>
            </div>
        `).join('');
    }

    toggleDrawer() {
        const drawer = document.querySelector('.library-drawer');
        drawer.classList.toggle('open');

        if (drawer.classList.contains('open')) {
            this.loadFullLibrary(); // Cargar datos frescos al abrir
        }
    }

    switchTab(tab) {
        this.currentTab = tab;
        document.querySelectorAll('.library-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });
        this.renderDrawerContent();
    }
}

// Instanciar globalmente
const libraryManager = new LibraryManager();

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    // Pequeño delay para asegurar que otros scripts cargaron
    setTimeout(() => libraryManager.init(), 100);
});
