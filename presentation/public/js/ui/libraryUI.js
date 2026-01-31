/**
 * libraryUI.js
 * Controlador de Interfaz para "Mi Biblioteca"
 * 
 * Responsabilidades:
 * 1. Escuchar eventos de `libraryService`.
 * 2. Actualizar AUTOMÁTICAMENTE todos los botones en pantalla.
 * 3. Manejar clics usando delegación de eventos (sin onclicks inline).
 * 4. Renderizar el Drawer (Panel lateral).
 */
class LibraryUI {
    constructor() {
        this.service = window.libraryService;
        this.selectors = {
            btn: '.js-library-btn', // Clase clave para los botones
            drawer: '.library-drawer',
            listContainer: '#library-list-container'
        };

        this.currentTab = 'saved'; // 'saved' | 'favorites'
    }

    init() {
        console.log('🎨 LibraryUI: Iniciando...');

        // 1. Suscribirse a cambios de estado del servicio
        window.addEventListener('library:state-changed', () => {
            this.updateAllButtons();
            if (this.isDrawerOpen()) {
                this.renderDrawerList();
            }
        });

        // 2. Delegación Global de Clics (El reemplazo de onclick="")
        document.body.addEventListener('click', (e) => this._handleBodyClick(e));

        // 3. Renderizar Estructura del Drawer (Lazy load)
        this._renderDrawerStructure();

        // 4. Botón Flotante
        if (localStorage.getItem('authToken')) {
            this._renderFloatingButton();
        }

        // 5. OBSERVER: La pieza clave para SPAs y contenido dinámico
        // Observa cambios en el DOM y actualiza automáticamente los botones nuevos
        this._initObserver();

        // 6. Primera actualización
        this.updateAllButtons();
    }

    _initObserver() {
        const observer = new MutationObserver((mutations) => {
            let shouldUpdate = false;

            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    // Verificar si alguno de los nodos añadidos contiene botones de librería
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === 1) { // Element node
                            if (node.classList.contains('js-library-btn') || node.querySelector(this.selectors.btn)) {
                                shouldUpdate = true;
                                break;
                            }
                        }
                    }
                }
                if (shouldUpdate) break;
            }

            if (shouldUpdate) {
                this.updateAllButtons();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        console.log('👀 LibraryUI: Observador del DOM activado.');
    }

    /**
     * Escanea todo el DOM buscando botones .js-library-btn y actualiza su estado visual
     */
    updateAllButtons() {
        const buttons = document.querySelectorAll(this.selectors.btn);

        buttons.forEach(btn => {
            const { type, id, action } = btn.dataset; // data-type, data-id, data-action
            if (!type || !id || !action) return;

            let isActive = false;

            if (action === 'save') {
                isActive = this.service.isSaved(type, id);
                this._updateIcon(btn, isActive, 'fa-bookmark');
            } else if (action === 'favorite') {
                isActive = this.service.isFavorite(type, id);
                this._updateIcon(btn, isActive, 'fa-heart');
            }

            // Toggle clase active
            if (isActive) btn.classList.add('active');
            else btn.classList.remove('active');
        });
    }

    _updateIcon(btn, isActive, iconName) {
        const icon = btn.querySelector('i');
        if (!icon) return;

        // FAS = Solid (Activo), FAR = Regular (Inactivo)
        const prefix = isActive ? 'fas' : 'far';
        icon.className = `${prefix} ${iconName}`;
    }

    _handleBodyClick(e) {
        // A. Clic en Botón de Acción (Guardar/Fav)
        const btn = e.target.closest(this.selectors.btn);
        if (btn) {
            e.preventDefault();
            e.stopPropagation(); // Evitar abrir la tarjeta

            // Validaciones externas (Freemium, Auth)
            if (window.uiManager) {
                if (!window.uiManager.validateFreemiumAction(e)) return;

                window.uiManager.checkAuthAndExecute(() => {
                    const { type, id, action } = btn.dataset;
                    // Animación simple de feedback clic
                    btn.style.transform = "scale(1.2)";
                    setTimeout(() => btn.style.transform = "scale(1)", 200);

                    this.service.toggleItem(type, id, action);
                });
            }
            return;
        }

        // B. Clic fuera del drawer para cerrar
        if (e.target.classList.contains('library-drawer-overlay')) {
            this.toggleDrawer(false);
        }
    }

    // --- DRAWER LOGIC ---

    toggleDrawer(forceState) {
        const drawer = document.querySelector(this.selectors.drawer);
        if (!drawer) return;

        const isOpen = typeof forceState === 'boolean' ? forceState : !drawer.classList.contains('open');

        drawer.classList.toggle('open', isOpen);

        if (isOpen) {
            this.service.loadFullLibrary(); // Pedir data fresca
            this.renderDrawerList();
        }
    }

    switchTab(tabName) {
        this.currentTab = tabName;
        // Update tabs UI
        document.querySelectorAll('.library-tab').forEach(t =>
            t.classList.toggle('active', t.dataset.tab === tabName)
        );
        this.renderDrawerList();
    }

    renderDrawerList() {
        const container = document.querySelector(this.selectors.listContainer);
        if (!container) return;

        const data = this.service.getLibraryData(); // { courses: [], books: [] }
        const items = [];

        // Filtrar y unificar
        const process = (list, itemType) => {
            list.forEach(item => {
                const isSaved = this.service.isSaved(itemType, item.id);
                const isFav = this.service.isFavorite(itemType, item.id);

                // Si estamos en tab 'saved', debe estar guardado. Si 'favorites', debe ser fav.
                const show = this.currentTab === 'saved' ? isSaved : isFav;

                if (show) {
                    items.push({ ...item, _uiType: itemType });
                }
            });
        };

        process(data.courses || [], 'course');
        process(data.books || [], 'book');

        // Render
        if (items.length === 0) {
            const icon = this.currentTab === 'saved' ? 'fa-bookmark' : 'fa-heart';
            container.innerHTML = `
                <div class="empty-state">
                    <i class="far ${icon}"></i>
                    <p>No tienes items en esta lista aún.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = items.map(item => this._createDrawerItemHTML(item)).join('');
    }

    _createDrawerItemHTML(item) {
        const typeLabel = item._uiType === 'course' ? 'Curso' : 'Libro';
        const img = item.image_url || 'https://via.placeholder.com/60';

        // Acción al hacer clic en el item del drawer
        let clickAttr = '';
        if (item._uiType === 'course') {
            clickAttr = `onclick="window.location.href='course.html?id=${item.id}'"`;
        } else {
            // Libro -> Abrir URL externa
            clickAttr = `onclick="window.open('${item.url || '#'}', '_blank')"`;
        }

        return `
            <div class="library-item" ${clickAttr}>
                <img src="${img}" alt="${item.title || item.name}" onerror="this.src='https://via.placeholder.com/60'">
                <div class="library-item-info">
                    <div class="library-item-title">${item.title || item.name}</div>
                    <div class="library-item-type">${typeLabel}</div>
                </div>
            </div>
        `;
    }

    _renderDrawerStructure() {
        if (document.querySelector(this.selectors.drawer)) return;

        const div = document.createElement('div');
        div.className = 'library-drawer';
        div.innerHTML = `
            <div class="library-header">
                <span class="library-title">Mi Biblioteca</span>
                <button class="close-drawer-btn" onclick="window.libraryUI.toggleDrawer(false)"><i class="fas fa-times"></i></button>
            </div>
            <div class="library-tabs">
                <button class="library-tab active" data-tab="saved" onclick="window.libraryUI.switchTab('saved')">Guardados</button>
                <button class="library-tab" data-tab="favorites" onclick="window.libraryUI.switchTab('favorites')">Favoritos</button>
            </div>
            <div class="library-content">
                <div class="library-list" id="library-list-container">
                    <div class="empty-state">
                        <i class="fas fa-spinner fa-spin"></i> Cargando...
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(div);
    }

    _renderFloatingButton() {
        if (document.querySelector('.library-toggle')) return;
        const btn = document.createElement('div');
        btn.className = 'library-toggle';
        btn.innerHTML = `<i class="fas fa-layer-group"></i>`;
        btn.onclick = () => this.toggleDrawer();
        document.body.appendChild(btn);
    }

    isDrawerOpen() {
        const d = document.querySelector(this.selectors.drawer);
        return d && d.classList.contains('open');
    }
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    // Esperar a que el servicio exista
    if (window.libraryService) {
        window.libraryUI = new LibraryUI();
        window.libraryService.init().then(() => {
            window.libraryUI.init();
        });
    } else {
        console.error('LibraryService not found!');
    }
});
