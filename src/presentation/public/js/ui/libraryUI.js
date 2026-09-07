/**
 * libraryUI.js — V2.1 Premium Editor
 * Controlador de Interfaz para "Mi Biblioteca"
 */
class LibraryUI {
    constructor() {
        this.service = window.libraryService;
        this.selectors = {
            btn: '.js-library-btn',
            drawer: '.library-drawer',
            listContainer: '#library-list-container'
        };

        this.currentTab = 'resources';
        this.currentFilter = 'all';
        this.isFullscreen = false;
        this.editingNoteId = null; // ID de la nota que se está editando

        this.typeLabels = {
            all: 'Todo',
            book: 'Libros',
            paper: 'Papers',
            norma: 'Normas',
            guia: 'Guías',
            video: 'Videos',
            course: 'Cursos',
            other: 'Otros'
        };
    }

    init() {
        console.log('🎨 LibraryUI V2.1: Iniciando...');

        const pageContainer = document.getElementById('library-page-container');
        this.isPageMode = !!pageContainer;

        window.addEventListener('library:state-changed', () => {
            this.updateAllButtons();
            if (this.isPageMode || this.isDrawerOpen()) this.renderDrawerList();
        });

        // ✅ Escuchar cambios de sesión
        if (window.sessionManager) {
            window.sessionManager.onStateChange((user) => {
                this._syncTabVisibility(user);
                if (user) {
                    this.service.init().then(() => {
                        this.renderDrawerList();
                    });
                } else {
                    if (this.isPageMode) {
                        if (['saved', 'favorites', 'notes'].includes(this.currentTab)) {
                            this.switchTab('resources');
                        }
                    }
                }
            });
            // Sincronizar visibilidad inicial
            this._syncTabVisibility(window.sessionManager.getUser());
        }

        document.body.addEventListener('click', (e) => this._handleBodyClick(e));
        document.body.addEventListener('error', (e) => {
            const image = e.target.closest?.('img[data-fallback-src]');
            if (image && image.src !== image.dataset.fallbackSrc) image.src = image.dataset.fallbackSrc;
        }, true);

        if (this.isPageMode) {
            // Leer tab por defecto de la URL (?tab=resources / saved / favorites / notes)
            const params = new URLSearchParams(window.location.search);
            const tabParam = params.get('tab');
            const isLoggedIn = !!(window.sessionManager?.isLoggedIn() || localStorage.getItem('authToken'));
            
            if (['resources', 'saved', 'favorites', 'notes'].includes(tabParam)) {
                if (!isLoggedIn && ['saved', 'favorites', 'notes'].includes(tabParam)) {
                    this.currentTab = 'resources';
                } else {
                    this.currentTab = tabParam;
                }
            } else {
                this.currentTab = 'resources';
            }
            
            // Cargar datos
            this.service.loadFullLibrary();
            this.switchTab(this.currentTab);
        } else {
            console.log('📚 Modo silencioso (Biblioteca en página dedicada).');
        }

        this._initObserver();
        this.updateAllButtons();
        this._renderNoteModal();
    }

    _initObserver() {
        const observer = new MutationObserver((mutations) => {
            let shouldUpdate = false;
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === 1 && (node.classList.contains('js-library-btn') || node.querySelector(this.selectors.btn))) {
                            shouldUpdate = true;
                            break;
                        }
                    }
                }
                if (shouldUpdate) break;
            }
            if (shouldUpdate) this.updateAllButtons();
        });

        const mainContainer = document.getElementById('content-container') || document.body;
        observer.observe(mainContainer, { childList: true, subtree: true });
    }

    updateAllButtons() {
        document.querySelectorAll(this.selectors.btn).forEach(btn => {
            const { type, id, action } = btn.dataset;
            if (!type || !id || !action) return;

            let isActive = false;
            if (action === 'save') {
                isActive = this.service.isSaved(type, id);
                this._updateIcon(btn, isActive, 'fa-bookmark');
            } else if (action === 'favorite') {
                isActive = this.service.isFavorite(type, id);
                this._updateIcon(btn, isActive, 'fa-heart');
            }

            btn.classList.toggle('active', isActive);
        });
    }

    _updateIcon(btn, isActive, iconName) {
        const icon = btn.querySelector('i');
        if (!icon) return;
        icon.className = `${isActive ? 'fas' : 'far'} ${iconName}`;
    }

    _handleBodyClick(e) {
        const noteAction = e.target.closest('[data-note-action]');
        if (noteAction) {
            e.preventDefault();
            e.stopPropagation();
            const { noteAction: action, noteId } = noteAction.dataset;
            if (action === 'delete') this.deleteNote(noteId);
            else this.openNoteEditor(noteId);
            return;
        }

        const btn = e.target.closest(this.selectors.btn);
        if (btn) {
            e.preventDefault();
            e.stopPropagation();
            if (window.uiManager) {
                if (!window.uiManager.validateFreemiumAction(e)) return;
                window.uiManager.checkAuthAndExecute(() => {
                    btn.style.transform = "scale(1.2)";
                    setTimeout(() => btn.style.transform = "scale(1)", 200);
                    this.service.toggleItem(btn.dataset.type, btn.dataset.id, btn.dataset.action);
                });
            }
            return;
        }

        const resource = e.target.closest('[data-library-resource]');
        if (resource) {
            const { itemId, itemType, itemTitle, itemKind, premium } = resource.dataset;
            if (itemKind === 'course') {
                window.location.href = `course?id=${encodeURIComponent(itemId)}`;
            } else {
                window.uiManager.unlockResource(itemId, itemType || 'book', premium === 'true', itemTitle || 'Recurso');
            }
            return;
        }

        if (e.target.classList.contains('library-drawer-overlay')) {
            this.toggleDrawer(false);
        }
    }

    // --- DRAWER ---

    toggleDrawer(forceState) {
        const drawer = document.querySelector(this.selectors.drawer);
        if (!drawer) return;

        const isOpen = typeof forceState === 'boolean' ? forceState : !drawer.classList.contains('open');
        drawer.classList.toggle('open', isOpen);

        if (isOpen) {
            this.service.loadFullLibrary();
            this.renderDrawerList();
        } else {
            if (this.isFullscreen) this.toggleFullscreen();
        }
    }

    toggleFullscreen() {
        const drawer = document.querySelector(this.selectors.drawer);
        if (!drawer) return;

        this.isFullscreen = !this.isFullscreen;
        drawer.classList.toggle('fullscreen', this.isFullscreen);

        const expandIcon = drawer.querySelector('.library-expand-btn i');
        if (expandIcon) expandIcon.className = this.isFullscreen ? 'fas fa-compress' : 'fas fa-expand';

        const toggleBtn = document.querySelector('.library-toggle');
        if (toggleBtn) toggleBtn.style.display = this.isFullscreen ? 'none' : '';

        document.body.style.overflow = this.isFullscreen ? 'hidden' : '';

        this.renderDrawerList();
    }

    switchTab(tabName) {
        this.currentTab = tabName;
        this.currentFilter = 'all';
        document.querySelectorAll('.library-tab').forEach(t =>
            t.classList.toggle('active', t.dataset.tab === tabName)
        );

        // Ocultar todos los paneles y mostrar el activo
        document.querySelectorAll('.library-panel').forEach(panel => {
            panel.style.display = 'none';
        });
        const activePanel = document.getElementById(`panel-${tabName}`);
        if (activePanel) {
            activePanel.style.display = 'block';
        }

        if (this.isPageMode) {
            const url = new URL(window.location);
            url.searchParams.set('tab', tabName);
            window.history.replaceState({}, '', url);

            if (window.globalSidebar) {
                window.globalSidebar.highlightActiveItem();
            }
        }

        if (tabName !== 'resources') {
            this.renderDrawerList();
        } else {
            const browseContainer = document.getElementById('browse-container');
            if (browseContainer && !browseContainer.innerHTML.trim() && window.searchComponent) {
                window.searchComponent.renderInitialView();
            }
        }
    }

    switchFilter(filter) {
        this.currentFilter = filter;
        document.querySelectorAll('.library-cat-btn').forEach(btn =>
            btn.classList.toggle('active', btn.dataset.category === filter)
        );
        this._renderList();
    }

    renderDrawerList() {
        if (this.isPageMode) {
            this.selectors.listContainer = `#${this.currentTab}-list-container`;
        } else {
            this.selectors.listContainer = '#library-list-container';
        }

        if (this.currentTab === 'notes') {
            this._renderNotesList();
            return;
        }

        const data = this.service.getLibraryData();
        const items = [];

        const processItems = (list, itemType) => {
            list.forEach(item => {
                const isSaved = this.service.isSaved(itemType, item.id);
                const isFav = this.service.isFavorite(itemType, item.id);
                const show = this.currentTab === 'saved' ? isSaved : isFav;
                if (show) {
                    items.push({ ...item, _uiType: itemType, _resourceType: item.resource_type || itemType });
                }
            });
        };

        processItems(data.courses || [], 'course');
        processItems(data.books || [], 'book');

        this._allItems = items;
        this._renderFilters(items);
        this._renderList();
    }

    _renderFilters(items) {
        const filterContainer = this.isPageMode ? document.getElementById(`${this.currentTab}-category-filters`) : document.querySelector('.library-category-filters');
        if (!filterContainer) return;

        if (this.currentTab === 'notes') {
            filterContainer.style.display = 'none';
            return;
        }
        filterContainer.style.display = '';

        const counts = {};
        items.forEach(item => {
            const rawType = item._resourceType || 'other';
            const t = this.typeLabels[rawType] ? rawType : 'other';
            counts[t] = (counts[t] || 0) + 1;
        });

        let filtersHTML = `<button class="library-cat-btn ${this.currentFilter === 'all' ? 'active' : ''}" data-category="all" onclick="window.libraryUI.switchFilter('all')">Todo <span class="cat-count">${items.length}</span></button>`;

        Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
            const label = this.typeLabels[type] || type;
            filtersHTML += `<button class="library-cat-btn ${this.currentFilter === type ? 'active' : ''}" data-category="${type}" onclick="window.libraryUI.switchFilter('${type}')">${label} <span class="cat-count">${count}</span></button>`;
        });

        filterContainer.innerHTML = filtersHTML;

        // Soporte para scroll horizontal con rueda del ratón en PC
        filterContainer.addEventListener('wheel', (e) => {
            if (e.deltaY !== 0) {
                e.preventDefault();
                filterContainer.scrollLeft += e.deltaY;
            }
        });
    }

    _renderList() {
        const container = document.querySelector(this.selectors.listContainer);
        if (!container) return;

        let items = this._allItems || [];
        if (this.currentFilter !== 'all') {
            items = items.filter(i => i._resourceType === this.currentFilter);
        }

        if (items.length === 0) {
            const isSaved = this.currentTab === 'saved';
            const icon = isSaved ? 'fa-bookmark' : 'fa-heart';
            const title = isSaved ? 'No tienes recursos guardados' : 'No tienes recursos favoritos';
            const desc = isSaved 
                ? 'Guarda libros, papers o guías técnicas del catálogo para consultarlos rápidamente aquí.' 
                : 'Marca tus documentos más importantes con el corazón para tenerlos siempre a mano.';
            
            container.innerHTML = `
                <div class="library-empty-state" style="grid-column: 1 / -1;">
                    <div class="empty-icon-circle"><i class="far ${icon}"></i></div>
                    <h3>${title}</h3>
                    <p>${desc}</p>
                    <button type="button" class="btn-primary" onclick="window.libraryUI.switchTab('resources')">
                        <i class="fas fa-compass"></i> Explorar Catálogo
                    </button>
                </div>`;
            return;
        }

        if (this.isPageMode) {
            // Render as unified resource cards in page mode for premium grid consistency
            container.innerHTML = items.map(item => {
                const mappedItem = {
                    ...item,
                    type: item._resourceType || item.resource_type || 'other'
                };
                return createUnifiedResourceCardHTML(mappedItem);
            }).join('');
            
            // Sync saved/favorite states of the rendered resource cards
            this.updateAllButtons();
        } else {
            // Keep compact layout for drawer
            container.innerHTML = items.map(item => this._createDrawerItemHTML(item)).join('');
        }
    }

    _renderNotesList() {
        const filterContainer = this.isPageMode ? document.getElementById(`${this.currentTab}-category-filters`) : document.querySelector('.library-category-filters');
        if (filterContainer) filterContainer.style.display = 'none';

        if (this.isPageMode) {
            const contentDiv = document.querySelector('#panel-notes .library-content');
            if (!contentDiv) return;

            // If toolbar doesn't exist, inject it
            let toolbar = document.getElementById('notes-toolbar');
            if (!toolbar) {
                toolbar = document.createElement('div');
                toolbar.id = 'notes-toolbar';
                toolbar.className = 'notes-toolbar';
                toolbar.innerHTML = `
                    <div class="notes-search-wrapper">
                        <i class="fas fa-search search-icon"></i>
                        <input type="text" id="notes-search-input" placeholder="Buscar en tus notas..." oninput="window.libraryUI.filterAndSortNotes()">
                    </div>
                    <div class="notes-sort-wrapper">
                        <label for="notes-sort-select">Ordenar:</label>
                        <select id="notes-sort-select" onchange="window.libraryUI.filterAndSortNotes()">
                            <option value="recent">Recientes</option>
                            <option value="oldest">Más antiguas</option>
                            <option value="title">Título (A-Z)</option>
                        </select>
                    </div>
                `;
                contentDiv.insertBefore(toolbar, contentDiv.firstChild);
            }

            const data = this.service.getLibraryData();
            const notes = data.notes || [];
            const container = document.querySelector(this.selectors.listContainer);
            if (!container) return;

            let html = `
                <div class="library-add-note-btn" onclick="window.libraryUI.openNoteModal()">
                    <div class="add-icon-circle"><i class="fas fa-plus"></i></div>
                    <span style="font-weight: 700;">Nueva Nota</span>
                    <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0; margin-top: 4px;">Crear apunte de estudio</p>
                </div>
            `;

            if (notes.length === 0) {
                html += `
                    <div class="library-empty-state" style="grid-column: 2 / -1;">
                        <div class="empty-icon-circle"><i class="far fa-sticky-note"></i></div>
                        <h3>No tienes notas guardadas</h3>
                        <p>Crea notas manuales con el botón "Nueva Nota" o guarda respuestas con el ícono 🔖 del tutor en los módulos de estudio.</p>
                    </div>`;
            } else {
                html += notes.map(note => this._createNoteItemHTML(note)).join('');
            }

            container.innerHTML = html;
        } else {
            // Drawer view
            const data = this.service.getLibraryData();
            const notes = data.notes || [];
            const container = document.querySelector(this.selectors.listContainer);
            if (!container) return;

            let html = `
                <div class="library-item library-add-note-inline" onclick="window.libraryUI.openNoteModal()" style="cursor: pointer; display: flex; align-items: center; gap: 10px; padding: 10px; background: rgba(59, 130, 246, 0.1); border: 1px dashed var(--primary); border-radius: 8px; margin-bottom: 12px; color: var(--primary); font-weight: 600;">
                    <i class="fas fa-plus-circle"></i>
                    <span>Crear nueva nota</span>
                </div>
            `;

            if (notes.length === 0) {
                html += `<div class="library-empty-state"><i class="far fa-sticky-note" style="font-size:2rem; margin-bottom:0.5rem; color:var(--text-muted);"></i><p>No tienes notas guardadas.</p></div>`;
            } else {
                html += notes.map(note => this._createNoteItemHTML(note)).join('');
            }

            container.innerHTML = html;
        }
    }

    filterAndSortNotes() {
        const container = document.getElementById('notes-list-container');
        if (!container) return;

        const data = this.service.getLibraryData();
        let notes = [...(data.notes || [])];

        // 1. Apply Search Filter
        const searchInput = document.getElementById('notes-search-input');
        if (searchInput) {
            const query = searchInput.value.toLowerCase().trim();
            if (query) {
                notes = notes.filter(note => 
                    (note.title || '').toLowerCase().includes(query) || 
                    (note.content || '').toLowerCase().includes(query)
                );
            }
        }

        // 2. Apply Sorting
        const sortSelect = document.getElementById('notes-sort-select');
        const sortBy = sortSelect ? sortSelect.value : 'recent';

        notes.sort((a, b) => {
            if (sortBy === 'recent') {
                return new Date(b.created_at || b.updated_at) - new Date(a.created_at || a.updated_at);
            }
            if (sortBy === 'oldest') {
                return new Date(a.created_at || a.updated_at) - new Date(b.created_at || b.updated_at);
            }
            if (sortBy === 'title') {
                return (a.title || '').localeCompare(b.title || '');
            }
            if (sortBy === 'color') {
                return (a.color || '').localeCompare(b.color || '');
            }
            if (sortBy === 'source') {
                return (a.source_type || '').localeCompare(b.source_type || '');
            }
            return 0;
        });

        // 3. Render HTML
        let html = `<button class="library-add-note-btn" onclick="window.libraryUI.openNoteEditor()"><i class="fas fa-plus"></i> Crear nota</button>`;

        if (notes.length === 0) {
            html += `<div class="empty-state" style="grid-column: span 6; text-align: center; padding: 3rem;"><i class="far fa-sticky-note" style="font-size: 2.5rem; color: var(--text-muted); opacity: 0.5; margin-bottom: 1rem; display: block;"></i><p>No se encontraron notas.</p></div>`;
        } else {
            html += notes.map(note => this._createNoteItemHTML(note)).join('');
        }

        container.innerHTML = html;
    }

    _createDrawerItemHTML(item) {
        const typeLabel = item._uiType === 'course' ? 'Curso' : (this.typeLabels[item.resource_type] || 'Recurso');
        const title = item.title || item.name || 'Sin título';

        const rType = item.resource_type || item._uiType || 'other';
        const coverImage = this._safeImageUrl(window.resolveImageUrl(item.image_url, rType));
        const fallbackImg = this._safeImageUrl(window.getDefaultResourceImage(rType));
        const isPremium = item.is_premium === true || String(item.is_premium).toLowerCase() === 'true' || item.is_premium === 1;
        const escape = window.escapeHtml;

        return `
            <div class="library-item" data-library-resource data-item-id="${escape(item.id)}"
                 data-item-kind="${item._uiType === 'course' ? 'course' : 'resource'}"
                 data-item-type="${escape(item.type || 'book')}" data-premium="${isPremium}"
                 data-item-title="${escape(title)}">
                <img src="${escape(coverImage)}" alt="${escape(title)}" class="resource-cover" data-fallback-src="${escape(fallbackImg)}">
                <div class="library-item-info">
                    <div class="library-item-title">${escape(title)}</div>
                    <div class="library-item-type">${escape(typeLabel)}</div>
                </div>
            </div>
        `;
    }

    _createNoteItemHTML(note) {
        const preview = (note.content || '').substring(0, 140).replace(/[*#>\-\[\]]/g, '').trim();
        const sourceLabel = note.source_type === 'chat' ? 'Chat' : (note.source_type === 'flashcard' ? 'Flashcard' : 'Manual');
        const dateStr = new Date(note.created_at).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });

        let color = this._safeNoteColor(note.color);
        if (!note.color) {
            if (note.source_type === 'chat') color = '#3b82f6';
            else if (note.source_type === 'audio_assistant') color = '#8b5cf6';
            else if (note.source_type === 'flashcard') color = '#10b981';
            else color = '#64748b';
        }

        if (this.isPageMode) {
            const noteId = window.escapeHtml(note.id);
            return `
                <div class="note-card" data-note-id="${noteId}" data-note-action="edit" style="--note-color: ${color};">
                    <div class="note-card-accent"></div>
                    <div class="note-card-actions">
                        <button class="note-card-action-btn edit" data-note-id="${noteId}" data-note-action="edit" title="Editar nota">
                            <i class="fas fa-pen"></i>
                        </button>
                        <button class="note-card-action-btn delete" data-note-id="${noteId}" data-note-action="delete" title="Eliminar nota">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                    <div class="note-card-content">
                        <h4 class="note-card-title">${window.escapeHtml(note.title || 'Sin título')}</h4>
                        <p class="note-card-preview">${window.escapeHtml(preview || 'Sin contenido...')}${note.content && note.content.length > 140 ? '...' : ''}</p>
                    </div>
                    <div class="note-card-footer">
                        <span class="note-card-badge" style="background: ${color}15; color: ${color};">${sourceLabel}</span>
                        <span class="note-card-date">${dateStr}</span>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="library-item note-item" data-note-id="${window.escapeHtml(note.id)}" data-note-action="edit" style="border-left: 4px solid ${color};">
                    <div class="library-item-info">
                        <div class="library-item-title">${window.escapeHtml(note.title || 'Sin título')}</div>
                        <div class="note-preview">${window.escapeHtml(preview)}...</div>
                        <div class="note-source" style="color:${color}; font-weight:600;">${sourceLabel} <span style="color:#94a3b8; font-weight:normal;">· ${dateStr}</span></div>
                    </div>
                </div>
            `;
        }
    }

    _safeNoteColor(value) {
        return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : '#64748b';
    }

    _safeImageUrl(value) {
        if (!value) return '';
        try {
            const url = new URL(value, window.location.origin);
            return ['http:', 'https:', 'blob:'].includes(url.protocol) ? url.href : '';
        } catch (error) {
            return '';
        }
    }

    _syncTabVisibility(user) {
        const token = localStorage.getItem('authToken');
        const isLoggedIn = !!(user || token);
        
        const savedTab = document.getElementById('tab-btn-saved');
        const favoritesTab = document.getElementById('tab-btn-favorites');
        const notesTab = document.getElementById('tab-btn-notes');
        const tabsContainer = document.querySelector('.library-tabs');
        
        [savedTab, favoritesTab, notesTab].forEach(tab => {
            if (tab) {
                if (isLoggedIn) {
                    tab.style.setProperty('display', '', 'important');
                    tab.classList.remove('hidden');
                } else {
                    tab.style.setProperty('display', 'none', 'important');
                    tab.classList.add('hidden');
                }
            }
        });
        
        if (tabsContainer) {
            tabsContainer.classList.toggle('guest-mode', !isLoggedIn);
        }
    }

    _renderDrawerStructure() {
        if (document.querySelector(this.selectors.drawer)) return;

        const div = document.createElement('div');
        div.className = 'library-drawer';
        div.innerHTML = `
            <div class="library-header">
                <span class="library-title">Mi Biblioteca</span>
                <div style="display:flex;align-items:center;gap:4px;">
                    <button class="library-expand-btn" onclick="window.libraryUI.toggleFullscreen()" title="Pantalla completa"><i class="fas fa-expand"></i></button>
                    <button class="close-drawer-btn" onclick="window.libraryUI.toggleDrawer(false)"><i class="fas fa-times"></i></button>
                </div>
            </div>
            <div class="library-tabs">
                <button class="library-tab active" data-tab="saved" onclick="window.libraryUI.switchTab('saved')">Guardados</button>
                <button class="library-tab" data-tab="favorites" onclick="window.libraryUI.switchTab('favorites')">Favoritos</button>
                <button class="library-tab" data-tab="notes" onclick="window.libraryUI.switchTab('notes')">Notas</button>
            </div>
            <div class="library-category-filters"></div>
            <div class="library-content">
                <div class="library-list" id="library-list-container">
                    <div class="empty-state"><i class="fas fa-spinner fa-spin"></i> Cargando...</div>
                </div>
            </div>
        `;
        document.body.appendChild(div);
    }

    _renderFloatingButton() {
        if (document.querySelector('.library-toggle')) return;
        const btn = document.createElement('div');
        btn.className = 'library-toggle';
        btn.innerHTML = `<i class="fas fa-book"></i>`;
        btn.onclick = () => this.toggleDrawer();
        document.body.appendChild(btn);
    }

    // --- NOTE MODAL / EDITOR ---

    _renderNoteModal() {
        if (document.querySelector('.note-modal-overlay')) return;

        const modal = document.createElement('div');
        modal.className = 'note-modal-overlay';
        modal.id = 'note-modal-overlay';
        modal.innerHTML = `
            <div class="note-modal">
                <div class="note-modal-header">
                    <h3 id="note-modal-header-text"><i class="fas fa-sticky-note"></i> Ver Nota</h3>
                    <button class="note-modal-close" onclick="window.libraryUI.closeNoteModal()"><i class="fas fa-times"></i></button>
                </div>
                
                <div class="note-modal-body" id="note-modal-viewer" style="display:block;">
                </div>

                <div class="note-modal-body" id="note-modal-editor" style="display:none;">
                    <input type="text" id="note-editor-title" class="note-editor-title" placeholder="Título de la nota">
                    <div class="note-editor-toolbar" style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
                        <button class="note-toolbar-btn" onclick="window.libraryUI.insertFormat('**', '**')" title="Negrita"><i class="fas fa-bold"></i></button>
                        <button class="note-toolbar-btn" onclick="window.libraryUI.insertFormat('*', '*')" title="Cursiva"><i class="fas fa-italic"></i></button>
                        <button class="note-toolbar-btn" onclick="window.libraryUI.insertFormat('### ', '')" title="Título"><i class="fas fa-heading"></i></button>
                        <button class="note-toolbar-btn" onclick="window.libraryUI.insertFormat('- ', '')" title="Lista"><i class="fas fa-list-ul"></i></button>
                        <button class="note-toolbar-btn" onclick="window.libraryUI.insertFormat('> ', '')" title="Cita"><i class="fas fa-quote-left"></i></button>
                        
                        <!-- Color Selector -->
                        <div style="margin-left:auto; display:flex; gap:0.3rem;" id="note-color-picker">
                            <input type="hidden" id="note-editor-color" value="">
                        </div>
                    </div>
                    <textarea id="note-editor-textarea" class="note-editor-textarea" placeholder="Escribe aquí tu nota..."></textarea>
                </div>

                <div class="note-modal-footer">
                    <div id="note-view-actions">
                        <button class="note-delete-btn" id="note-modal-delete" onclick="window.libraryUI.deleteNote(window.libraryUI.editingNoteId)"><i class="fas fa-trash"></i> Eliminar</button>
                        <button onclick="window.libraryUI.switchToEditor()"><i class="fas fa-edit"></i> Editar</button>
                    </div>
                    <div id="note-edit-actions" style="display:none;">
                        <button onclick="window.libraryUI.switchToViewer()">Cancelar</button>
                        <button class="active" style="background:var(--primary); color:white; border:none;" onclick="window.libraryUI.saveNote()">Guardar Cambios</button>
                    </div>
                    <button onclick="window.libraryUI.closeNoteModal()">Cerrar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => { if (e.target === modal) this.closeNoteModal(); });
    }

    openNoteModal(noteId = null) {
        this.openNoteEditor(noteId);
    }

    openNoteEditor(noteId = null) {
        this.editingNoteId = noteId;
        const viewer = document.getElementById('note-modal-viewer');
        const editor = document.getElementById('note-modal-editor');
        const viewActions = document.getElementById('note-view-actions');
        const editActions = document.getElementById('note-edit-actions');
        const headerText = document.getElementById('note-modal-header-text');

        if (noteId) {
            const data = this.service.getLibraryData();
            const note = (data.notes || []).find(n => n.id == noteId);
            if (!note) return;

            document.getElementById('note-editor-title').value = note.title;
            document.getElementById('note-editor-textarea').value = note.content;
            this._renderColorOptions(note.color || '');
            viewer.innerHTML = `
                <h3 class="note-viewer-title" style="margin-top: 0; margin-bottom: 1rem; color: var(--text-main); font-size: 1.3rem; font-weight: 700; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; text-align: left;">${window.escapeHtml(note.title || 'Sin título')}</h3>
                <div class="markdown-content">${this._renderMarkdown(note.content)}</div>
            `;
            
            const sourceLabel = note.source_type === 'chat' ? 'Nota de Chat' : (note.source_type === 'flashcard' ? 'Nota de Repaso' : 'Nota');
            headerText.innerHTML = `<i class="fas fa-sticky-note" style="color: ${this._safeNoteColor(note.color)}"></i> ${sourceLabel}`;

            this.switchToViewer();
        } else {
            document.getElementById('note-editor-title').value = '';
            document.getElementById('note-editor-textarea').value = '';
            const defaultNewColor = '#64748b'; // Lighter Slate for new notes
            this._renderColorOptions(defaultNewColor);
            headerText.innerHTML = `<i class="fas fa-plus"></i> Nueva Nota`;

            this.switchToEditor();
        }

        document.getElementById('note-modal-overlay').classList.add('open');
        if (window.uiManager) {
            window.uiManager.pushModalState('note-modal-overlay');
        } else {
            document.body.classList.add('modal-open');
        }
    }

    _renderColorOptions(selectedColor) {
        const picker = document.getElementById('note-color-picker');
        if (!picker) return;

        const options = ['#3b82f6', '#8b5cf6', '#10b981', '#64748b', '#f43f5e', '#f59e0b', '#0ea5e9', '#d946ef', '#14b8a6'];
        
        // Reset picker and create a new hidden input
        picker.innerHTML = '';
        const colorInput = document.createElement('input');
        colorInput.type = 'hidden';
        colorInput.id = 'note-editor-color';
        colorInput.value = selectedColor;
        picker.appendChild(colorInput);

        options.forEach(color => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.style.cssText = `width:20px; height:20px; border-radius:50%; border:2px solid ${color === selectedColor ? 'white' : 'transparent'}; background:${color}; cursor:pointer; transition: all 0.2s;`;
            btn.onclick = () => {
                colorInput.value = color;
                Array.from(picker.children).forEach(c => {
                    if (c.tagName === 'BUTTON') c.style.borderColor = 'transparent';
                });
                btn.style.borderColor = 'white';
            };
            picker.appendChild(btn);
        });
    }

    switchToEditor() {
        document.getElementById('note-modal-viewer').style.display = 'none';
        document.getElementById('note-modal-editor').style.display = 'block';
        document.getElementById('note-view-actions').style.display = 'none';
        document.getElementById('note-edit-actions').style.display = 'block';
        
        const headerText = document.getElementById('note-modal-header-text');
        if (headerText) {
            headerText.innerHTML = `<i class="fas fa-edit"></i> Editar Nota`;
        }
    }

    switchToViewer() {
        if (!this.editingNoteId) {
            this.closeNoteModal();
            return;
        }
        document.getElementById('note-modal-viewer').style.display = 'block';
        document.getElementById('note-modal-editor').style.display = 'none';
        document.getElementById('note-view-actions').style.display = 'block';
        document.getElementById('note-edit-actions').style.display = 'none';

        const headerText = document.getElementById('note-modal-header-text');
        if (headerText) {
            const data = this.service.getLibraryData();
            const note = (data.notes || []).find(n => n.id == this.editingNoteId);
            if (note) {
                const sourceLabel = note.source_type === 'chat' ? 'Nota de Chat' : (note.source_type === 'flashcard' ? 'Nota de Repaso' : 'Nota');
                headerText.innerHTML = `<i class="fas fa-sticky-note" style="color: ${this._safeNoteColor(note.color)}"></i> ${sourceLabel}`;
            }
        }
    }

    insertFormat(prefix, suffix) {
        const textarea = document.getElementById('note-editor-textarea');
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const selected = text.substring(start, end);

        textarea.value = text.substring(0, start) + prefix + selected + suffix + text.substring(end);
        textarea.focus();
        textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }

    async saveNote() {
        const title = document.getElementById('note-editor-title').value.trim() || 'Nota sin título';
        const content = document.getElementById('note-editor-textarea').value.trim();

        if (!content) {
            window.uiManager.showToast('⚠️ El contenido de la nota no puede estar vacío.');
            return;
        }

        try {
            const method = this.editingNoteId ? 'PUT' : 'POST';
            const url = this.editingNoteId ?
                `${window.AppConfig.API_URL}/api/library/notes/${this.editingNoteId}` :
                `${window.AppConfig.API_URL}/api/library/notes`;

            const res = await window.NetworkService.fetch(url, {
                method: method,
                body: JSON.stringify({
                    title,
                    content,
                    color: document.getElementById('note-editor-color') ? document.getElementById('note-editor-color').value : undefined,
                    sourceType: this.editingNoteId ? undefined : 'manual'
                })
            });

            if (res.ok) {
                await this.service.loadFullLibrary();
                this.closeNoteModal();
            } else {
                window.uiManager.showToast('❌ Error al guardar la nota. Verifica tu conexión.');
            }
        } catch (err) {
            console.error('Error guardando nota:', err);
        }
    }

    closeNoteModal() {
        document.getElementById('note-modal-overlay').classList.remove('open');
        if (window.uiManager) {
            window.uiManager.popModalState('note-modal-overlay');
        } else {
            document.body.classList.remove('modal-open');
        }
        this.editingNoteId = null;
    }

    _renderMarkdown(text) {
        if (!text) return '';

        // ✅ USAR RENDERIZADOR UNIFICADO
        return window.MarkdownRenderer
            ? window.MarkdownRenderer.render(text)
            : window.escapeHtml(text).replace(/\n/g, '<br>');
    }

    async deleteNote(noteId) {
        // Ensure window.confirmationModal is defined
        if (!window.confirmationModal && typeof ConfirmationModal !== 'undefined') {
            window.confirmationModal = new ConfirmationModal();
        }

        const confirmed = window.confirmationModal 
            ? await window.confirmationModal.show('¿Estás seguro de eliminar esta nota?', 'Eliminar Nota', 'Eliminar', 'Cancelar')
            : confirm('¿Estás seguro de eliminar esta nota?');
            
        if (!confirmed) return;

        try {
            await window.NetworkService.fetch(`${window.AppConfig.API_URL}/api/library/notes/${noteId}`, {
                method: 'DELETE'
            });
            this.service.loadFullLibrary();
            this.closeNoteModal();
        } catch (err) {
            console.error('Error eliminando nota:', err);
        }
    }

    isDrawerOpen() {
        const d = document.querySelector(this.selectors.drawer);
        return d && d.classList.contains('open');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.libraryService) {
        window.libraryUI = new LibraryUI();
        window.libraryService.init().then(() => {
            window.libraryUI.init();
        });
    } else {
        console.error('LibraryService not found!');
    }
});
