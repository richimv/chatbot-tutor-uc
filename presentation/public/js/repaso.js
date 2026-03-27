/**
 * RepasoManager (Premium UI Edition)
 * Orchestrates the Right Content Panel based on Sidebar Selection.
 */
class RepasoManager {
    constructor() {
        this.explorer = new DeckExplorer(this);
        this.token = localStorage.getItem('authToken');
        this.currentDeck = null;

        // Callback para interceptar el botón Atrás del móvil cuando hay tarjetas seleccionadas
        this.handlePopState = this.handlePopState.bind(this);
        window.addEventListener('popstate', this.handlePopState);

        this.subDecksCollapsed = localStorage.getItem('subDecksCollapsed') === 'true';
    }

    /**
     * Renders icon with its vibrant color applied. Used for card icons and headers.
     */
    static renderColoredIcon(icon, fallbackFA = 'fas fa-folder') {
        const resolved = RepasoManager._resolveIcon(icon, fallbackFA);
        const color = resolved.color;
        if (resolved.html) return `<span style="color:${color}">${resolved.html}</span>`;
        return `<i class="${resolved.faClass}" style="color:${color}"></i>`;
    }

    /**
     * Returns both the FA class and a vibrant color for the icon.
     */
    static _resolveIcon(icon, fallbackFA = 'fas fa-folder') {
        // Default fallback
        if (!icon) return { faClass: fallbackFA, color: '#60a5fa' };
        // Already HTML
        if (icon.startsWith('<')) return { faClass: null, html: icon, color: '#60a5fa' };
        // FontAwesome class string
        if (icon.startsWith('fa')) return { faClass: icon, color: RepasoManager._iconColor(icon) };

        // Map emojis → FA + color
        const emojiMap = {
            '📚': { fa: 'fas fa-layer-group', color: '#60a5fa' },
            '📁': { fa: 'fas fa-folder', color: '#fbbf24' },
            '🏠': { fa: 'fas fa-home', color: '#34d399' },
            '🧠': { fa: 'fas fa-brain', color: '#f472b6' },
            '🩺': { fa: 'fas fa-stethoscope', color: '#22d3ee' },
            '🗣️': { fa: 'fas fa-comments', color: '#a78bfa' },
            '🗣': { fa: 'fas fa-comments', color: '#a78bfa' },
            '💡': { fa: 'fas fa-lightbulb', color: '#fbbf24' },
            '⭐': { fa: 'fas fa-star', color: '#fbbf24' },
            '🎓': { fa: 'fas fa-graduation-cap', color: '#818cf8' },
            '📖': { fa: 'fas fa-book-open', color: '#2dd4bf' },
            '📝': { fa: 'fas fa-pen-alt', color: '#fb923c' },
            '🔬': { fa: 'fas fa-microscope', color: '#c084fc' },
            '💊': { fa: 'fas fa-pills', color: '#f87171' },
            '❤️': { fa: 'fas fa-heartbeat', color: '#f87171' },
            '🫀': { fa: 'fas fa-heartbeat', color: '#f87171' },
            '👶': { fa: 'fas fa-baby', color: '#fda4af' },
            '🦴': { fa: 'fas fa-bone', color: '#d4d4d8' },
            '👁️': { fa: 'fas fa-eye', color: '#67e8f9' },
            '🧬': { fa: 'fas fa-dna', color: '#34d399' },
        };
        if (emojiMap[icon]) {
            return { faClass: emojiMap[icon].fa, color: emojiMap[icon].color };
        }
        // Unknown emoji — render as-is
        return { faClass: null, html: icon, color: '#94a3b8' };
    }

    /**
     * Maps FA class → vibrant color for known icon types.
     */
    static _iconColor(faClass) {
        const colorMap = {
            'fas fa-layer-group': '#60a5fa',
            'fas fa-folder': '#fbbf24',
            'fas fa-folder-open': '#fbbf24',
            'fas fa-home': '#34d399',
            'fas fa-brain': '#f472b6',
            'fas fa-stethoscope': '#22d3ee',
            'fas fa-comments': '#a78bfa',
            'fas fa-lightbulb': '#fbbf24',
            'fas fa-star': '#fbbf24',
            'fas fa-graduation-cap': '#818cf8',
            'fas fa-book-open': '#2dd4bf',
            'fas fa-pen-alt': '#fb923c',
            'fas fa-microscope': '#c084fc',
            'fas fa-pills': '#f87171',
            'fas fa-heartbeat': '#f87171',
            'fas fa-baby': '#fda4af',
            'fas fa-bone': '#d4d4d8',
            'fas fa-eye': '#67e8f9',
            'fas fa-dna': '#34d399',
        };
        return colorMap[faClass] || '#60a5fa';
    }


    async init() {
        // No longer enforcing redirect here.
        // Component will handle missing token by showing restricted views.

        // Init Components
        await this.explorer.init();

        // Load Default View or Deep Link
        const urlParams = new URLSearchParams(window.location.search);
        const deckId = urlParams.get('deckId');

        if (deckId) {
            this.loadFolder(deckId); // Deep link
        } else {
            this.loadDashboard(); // Start at Home
        }

        // --- NEW: Guest Banner for Repaso ---
        if (!this.token) {
            this.renderGuestBanner();
        }

        document.getElementById('loading').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';

        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('create-deck-form').addEventListener('submit', (e) => {
            if (!this.token && window.uiManager) {
                e.preventDefault();
                window.uiManager.showAuthPromptModal();
                return;
            }
            this.handleCreateDeck(e);
        });
        document.getElementById('card-form').addEventListener('submit', (e) => this.handleSaveCard(e));

        // Force refresh when returning from flashcard study via browser back button
        window.addEventListener('pageshow', (event) => {
            if (event.persisted && this.currentDeck) {
                // If loaded from back-forward cache, refresh stats silently
                this.loadFolder(this.currentDeck.id);
            }
        });
    }

    // --- Views ---

    loadDashboard(pushState = true) {
        document.getElementById('dashboard-view').style.display = 'block';
        document.getElementById('folder-view').style.display = 'none';
        this.currentDeck = null;

        // Sync URL: If we go to Dashboard, clear deckId
        if (pushState && window.history.pushState) {
            const url = new URL(window.location.href);
            url.searchParams.delete('deckId');
            window.history.pushState({ view: 'dashboard' }, 'Centro de Repaso', url.toString());
        }

        this.renderRootDecks();

        if (!this.token) {
            this.renderGuestBanner();
        }
    }

    async loadFolder(deckId, pushState = true) {
        document.getElementById('dashboard-view').style.display = 'none';
        document.getElementById('folder-view').style.display = 'block';

        // Sync URL: If navigatived internally, push state
        if (pushState && window.history.pushState) {
            const url = new URL(window.location.href);
            if (url.searchParams.get('deckId') !== deckId) {
                url.searchParams.set('deckId', deckId);
                window.history.pushState({ view: 'folder', deckId }, `Mazo ${deckId}`, url.toString());
            }
        }

        // Show loading state in the content area if possible
        const container = document.getElementById('folder-header');
        if (container) container.innerHTML = '<div style="text-align:center; padding:2rem;"><i class="fas fa-circle-notch fa-spin fa-2x"></i></div>';

        try {
            const [deck, children, cards] = await Promise.all([
                this.fetchDeck(deckId),
                this.fetchDecks(deckId),
                this.fetchCards(deckId)
            ]);

            if (!deck) {
                console.warn(`Deck with ID ${deckId} not found or inaccessible.`);
                if (window.uiManager && window.uiManager.showToast) {
                    window.uiManager.showToast('El mazo solicitado no existe o fue eliminado.', 'error');
                }
                this.loadDashboard();
                return;
            }

            this.currentDeck = deck;
            this.currentCards = cards || [];
            this.renderDeckHeader(deck, cards);
            this.renderSubDecks(children);
            this.renderCards(this.currentCards);

        } catch (e) {
            console.error('Error in loadFolder:', e);
            if (window.uiManager && window.uiManager.showToast) {
                window.uiManager.showToast('No se pudo cargar el mazo. Intente de nuevo.', 'error');
            } else {
                alert('Ocurrió un error al cargar el contenido. Por favor, recarga la página.');
            }
            this.loadDashboard();
        }
    }

    // --- Renderers ---

    renderRootDecks() {
        const container = document.getElementById('dashboard-view');
        container.innerHTML = `
            <h2 style="margin-bottom:1.5rem">Mis Mazos</h2>
            <div id="root-decks-grid" class="decks-grid"></div>
        `;

        this.fetchDecks(null).then(decks => {
            this.renderDeckCards(decks, document.getElementById('root-decks-grid'), null);
        });
    }

    renderDeckHeader(deck, cards = []) {
        if (!deck) return;

        const container = document.getElementById('folder-header');
        const total = cards?.length || 0;
        const mastered = cards?.filter(c => c.interval_days > 21).length || 0;
        const pending = deck.due_cards || 0;

        container.innerHTML = `
            <div class="deck-header-info">
                <div style="display: flex; gap: 1rem; align-items: flex-start;">
                    <div class="deck-icon-large">
                        ${RepasoManager.renderColoredIcon(deck?.icon, 'fas fa-layer-group')}
                    </div>

                    <div style="flex-grow: 1; min-width: 0;">
                        <h1 class="deck-title">${deck?.name || 'Mazo sin nombre'}</h1>
                        
                        <div class="deck-meta">
                            <div style="display:flex; align-items:center; gap:0.4rem;">
                                <i class="fas fa-layer-group"></i> ${total} <span class="desktop-only">tarjetas</span>
                            </div>
                            <div style="display:flex; align-items:center; gap:0.4rem; color:${pending > 0 ? '#f87171' : '#94a3b8'};">
                                <i class="fas fa-clock"></i> ${pending} <span class="desktop-only">pendientes</span>
                            </div>
                            <div style="display:flex; align-items:center; gap:0.4rem; color:#34d399;">
                                <i class="fas fa-brain"></i> ${mastered} <span class="desktop-only">dominadas</span>
                            </div>
                        </div>

                        <div class="action-bar">
                            ${total > 0 && this.token ? `
                            <button class="btn-premium btn-premium-primary" onclick="window.repasoManager.startStudy('${deck.id}', '${this.escapeHtml(deck.name)}', ${total})">
                                <i class="fas fa-play"></i> <span class="btn-text">Estudiar Ahora</span>
                            </button>
                            ` : ''}

                            ${!this.token ? `
                            <button class="btn-premium btn-premium-primary" onclick="window.repasoManager.startStudyDemo('${deck.id}')">
                                <i class="fas fa-play-circle"></i> <span class="btn-text">¡PROBAR DEMO!</span>
                            </button>
                            ` : ''}

                            ${this.token ? `
                            <button class="btn-premium btn-premium-secondary" onclick="window.repasoManager.openAddCardModal()">
                                <i class="fas fa-plus"></i> <span class="btn-text">Añadir Tarjeta</span>
                            </button>
                            <button class="btn-premium btn-premium-ia" onclick="window.repasoManager.openAiModal()">
                                <i class="fas fa-magic"></i> <span class="btn-text">Con IA</span>
                            </button>
                            ` : ''}
                            
                            <button class="btn-premium btn-premium-secondary" onclick="${this.token ? `window.repasoManager.openStatsModal(${total}, ${mastered})` : 'window.uiManager.showAuthPromptModal()'}">
                                <i class="fas fa-chart-pie"></i> <span class="btn-text">Estadísticas</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderSubDecks(decks = []) {
        const container = document.getElementById('subdecks-container');
        if (!container) return;
        container.innerHTML = '';

        // If guest and no decks, hide. If registered, show (to see the "Create" button)
        if ((!decks || decks.length === 0) && !this.token) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block'; // Changed to block to contain header + grid
        
        const count = decks.length;
        const title = count > 0 ? `Sub-mazos (${count})` : 'Sub-mazos';
        const icon = this.subDecksCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-down';

        container.innerHTML = `
            <div class="subdecks-header" onclick="window.repasoManager.toggleSubDecks()">
                <div style="display:flex; align-items:center; gap:0.5rem;">
                    <i class="${icon} toggle-icon"></i>
                    <h3 style="margin:0; font-size:0.9rem; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px;">${title}</h3>
                </div>
                <div class="subdecks-line"></div>
            </div>
            <div id="subdecks-grid" class="decks-grid ${this.subDecksCollapsed ? 'collapsed' : ''}" style="margin-top:1rem;"></div>
        `;

        const grid = document.getElementById('subdecks-grid');
        this.renderDeckCards(decks, grid, this.currentDeck?.id || null);
    }

    toggleSubDecks() {
        this.subDecksCollapsed = !this.subDecksCollapsed;
        localStorage.setItem('subDecksCollapsed', this.subDecksCollapsed);
        
        const grid = document.getElementById('subdecks-grid');
        const icon = document.querySelector('.subdecks-header .toggle-icon');
        
        if (this.subDecksCollapsed) {
            grid?.classList.add('collapsed');
            if (icon) {
                icon.classList.remove('fa-chevron-down');
                icon.classList.add('fa-chevron-right');
            }
        } else {
            grid?.classList.remove('collapsed');
            if (icon) {
                icon.classList.remove('fa-chevron-right');
                icon.classList.add('fa-chevron-down');
            }
        }
    }

    renderDeckCards(decks, container, parentId = null) {
        container.innerHTML = '';

        // --- 1. NEW: Add "Create Deck" Card (Only for Logged Users) ---
        if (this.token) {
            const addCard = document.createElement('div');
            addCard.className = 'deck-card add-deck-card';
            addCard.onclick = () => DeckExplorer.openCreateModal(parentId);
            addCard.innerHTML = `
                <!-- Desktop -->
                <div class="deck-card-desktop add-content">
                    <div style="font-size: 2rem; color: #3b82f6; margin-bottom: 0.5rem;">
                        <i class="fas fa-plus"></i>
                    </div>
                    <div style="font-size: 0.95rem; font-weight: 600;">Crear Mazo</div>
                </div>

                <!-- Mobile -->
                <div class="deck-card-mobile" style="align-items:center; gap:0.8rem;">
                    <div style="font-size: 1.2rem; color: #3b82f6; flex-shrink:0;">
                        <i class="fas fa-plus-circle"></i>
                    </div>
                    <div style="font-size: 0.85rem; font-weight: 600;">Crear Mazo</div>
                </div>
            `;
            container.appendChild(addCard);
        }

        // --- 2. Render Decks ---
        decks.forEach(deck => {
            const card = document.createElement('div');
            card.className = 'deck-card';
            card.style.padding = '1rem';
            card.style.cursor = 'pointer';

            const isSystem = deck.type === 'SYSTEM';
            const mastery = deck.mastery_percentage || 0;
            const iconHtml = RepasoManager.renderColoredIcon(deck.icon, 'fas fa-folder-open');
            const hasDue = parseInt(deck.due_cards) > 0;
            const badgeClass = isSystem ? 'badge-system' : 'badge-user';
            const badgeText = isSystem ? 'AUTOMÁTICO' : 'PERSONAL';

            // --- Dynamic Actions Logic ---
            let actionBtns = '';
            if (this.token) {
                // Registered User: Play (Real) + Edit/Delete (if not system)
                actionBtns = `
                    <div style="display:flex; gap:0.4rem; align-items:center;">
                        <button class="deck-action-btn" style="background:rgba(59,130,246,0.15); color:#60a5fa; border: 1px solid rgba(59,130,246,0.2);" 
                            onclick="event.stopPropagation(); window.repasoManager.startStudy('${deck.id}', '${this.escapeHtml(deck.name)}', ${deck.total_cards || 0})" 
                            title="Estudiar">
                            <i class="fas fa-play"></i>
                        </button>
                        ${!isSystem ? `
                            <button class="deck-action-btn" style="background:rgba(255,255,255,0.05); color:#cbd5e1; border: 1px solid rgba(255,255,255,0.1);" 
                                onclick="event.stopPropagation(); window.repasoManager.openEditDeckModal('${deck.id}', '${this.escapeHtml(deck.name)}', '${deck.icon || ''}')" 
                                title="Editar nombre/icono">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="deck-action-btn deck-action-btn--delete" 
                                onclick="event.stopPropagation(); window.repasoManager.confirmDeleteDeck('${deck.id}', '${this.escapeHtml(deck.name)}')" 
                                title="Eliminar mazo">
                                <i class="fas fa-trash"></i>
                            </button>
                        ` : ''}
                    </div>`;
            } else {
                // Guest User: Only Demo Play
                actionBtns = `
                    <div style="display:flex; gap:0.3rem;">
                        <button class="deck-action-btn" style="background:rgba(59,130,246,0.1); color:#60a5fa;" 
                            onclick="event.stopPropagation(); window.repasoManager.startStudyDemo('${deck.id}')" 
                            title="Probar Demo">
                            <i class="fas fa-play"></i>
                        </button>
                    </div>`;
            }

            card.innerHTML = `
                <!-- Desktop layout -->
                <div class="deck-card-desktop">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                        ${actionBtns}
                        <span class="deck-badge ${badgeClass}" style="font-size:0.6rem; padding:0.15rem 0.5rem;">${badgeText}</span>
                    </div>
                    <div style="font-size:1.5rem; margin-bottom:0.5rem;">${iconHtml}</div>
                    <h3 style="font-size:0.9rem; margin-bottom:0.2rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${this.escapeHtml(deck.name)}">${deck.name}</h3>
                    <div style="font-size:0.75rem; color:#94a3b8; margin-bottom:0.5rem;">
                        ${deck.total_cards || 0} tarjetas
                        ${hasDue ? `<span style="color:#ef4444; font-weight:600; margin-left:0.5rem;">${deck.due_cards} pend.</span>` : ''}
                    </div>
                    <div style="margin-top:auto; width:100%;">
                        <div style="display:flex; justify-content:space-between; font-size:0.65rem; color:#cbd5e1; margin-bottom:3px;">
                            <span>Dominio</span><span>${mastery}%</span>
                        </div>
                        <div style="height:3px; background:rgba(255,255,255,0.05); border-radius:2px;">
                            <div style="width:${mastery}%; height:100%; background:#3b82f6; border-radius:2px;"></div>
                        </div>
                    </div>
                </div>

                <!-- Mobile layout -->
                <div class="deck-card-mobile">
                    <div style="font-size:1.2rem; flex-shrink:0;">${iconHtml}</div>
                    <div style="flex:1; min-width:0;">
                        <div style="font-size:0.85rem; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${deck.name}</div>
                        <div style="font-size:0.7rem; color:#94a3b8;">
                            ${deck.total_cards || 0} tarj.
                            ${hasDue ? `<span style="color:#ef4444; font-weight:600;">${deck.due_cards} pend.</span>` : ''}
                        </div>
                    </div>
                    <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.4rem; flex-shrink:0;">
                        ${actionBtns}
                        <span class="deck-badge ${badgeClass}" style="font-size:0.5rem; padding:0.1rem 0.4rem;">${isSystem ? 'AUTO' : 'PERS.'}</span>
                    </div>
                </div>
            `;

            card.onclick = (e) => {
                if (e.target.closest('button')) return;
                const node = document.querySelector(`.tree-node[data-id="${deck.id}"]`);
                if (node) {
                    this.explorer.toggleNode(deck.id, node);
                    this.explorer.setActive(deck.id);
                }
                this.loadFolder(deck.id);
            }
            container.appendChild(card);
        });
    }

    renderCards(cards = this.currentCards) {
        const container = document.getElementById('cards-container');
        if (!container) return;

        if (!cards || cards.length === 0) {
            container.innerHTML = '<div style="color:#94a3b8; padding:2rem; text-align:center; background:rgba(255,255,255,0.02); border-radius:16px;">No hay tarjetas en este mazo. ¡Crea la primera!</div>';
            return;
        }

        this.isSelectionMode = false;

        container.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:1rem; align-items:center; flex-wrap:wrap; gap:1rem;">
                <h3 style="margin:0; font-size:1.2rem; font-weight:600;">Tarjetas (${cards.length})</h3>
                <div style="position:relative; width:100%; max-width:250px;">
                    <i class="fas fa-search" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:#94a3b8; font-size:0.85rem;"></i>
                    <input type="text" id="card-search-input" placeholder="Buscar tarjetas..." style="width:100%; padding:0.6rem 1rem 0.6rem 2.2rem; border-radius:8px; border:1px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.2); color:white; font-size:0.9rem;" onkeyup="window.repasoManager.filterCards(this.value)">
                </div>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem; align-items:center; background:rgba(255,255,255,0.02); padding:0.5rem 1rem; border-radius:8px;">
                <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; margin:0;">
                    <input type="checkbox" id="select-all-cards" onchange="window.repasoManager.toggleSelectAllCards(this.checked)" class="card-checkbox">
                    <span style="font-size:0.85rem; color:#94a3b8; font-weight:500;">Seleccionar todo</span>
                </label>
                <button id="btn-bulk-delete" class="btn-action deck-action-btn--delete" style="display:none; padding:0.4rem 0.8rem; font-size:0.8rem; border-radius:6px; background:rgba(239, 68, 68, 0.1); color:#ef4444; border:1px solid rgba(239,68,68,0.3); font-weight:600;" onclick="${this.token ? 'window.repasoManager.confirmBulkDelete()' : 'window.uiManager.showAuthPromptModal()'}">
                    <i class="fas fa-trash"></i> Eliminar Selección
                </button>
            </div>
            <div id="cards-list-container"></div>
        `;

        const listContainer = document.getElementById('cards-list-container');
        const fragment = document.createDocumentFragment();

        cards.forEach((c, index) => {
            const srsClass = this._getSrsClass(c);
            const isDue = new Date(c.next_review_at) <= new Date();
            const row = document.createElement('div');
            row.className = `card-row-item ${srsClass} ${isDue ? 'is-due-glow' : ''}`;
            row.dataset.id = c.id;
            row.dataset.index = index;
            row.draggable = true;

            row.innerHTML = `
                <div style="display:flex; align-items:center; gap:0.5rem; color:#64748b;">
                    <i class="fas fa-grip-vertical drag-handle"></i>
                    <input type="checkbox" class="card-checkbox card-item-checkbox" value="${c.id}" onclick="event.stopPropagation()">
                </div>
                <div class="card-row-front">
                    ${c.image_url ? '<i class="fas fa-image" style="color:#60a5fa; margin-right:8px;" title="Tiene imagen de contexto"></i>' : ''}
                    ${this.escapeHtml(c.front_content)}
                </div>
                <div class="card-row-back">${this.escapeHtml(c.back_content)}</div>
                <div class="card-row-actions">
                    <button class="deck-action-btn" title="Editar" onclick="event.stopPropagation(); window.repasoManager.onEditCardClick('${c.id}', \`${this.escapeHtml(c.front_content)}\`, \`${this.escapeHtml(c.back_content)}\`)">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button class="deck-action-btn deck-action-btn--delete" title="Eliminar" onclick="event.stopPropagation(); window.repasoManager.onDeleteCardClick('${c.id}', \`${this.escapeHtml(c.front_content)}\`)">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;

            // Row Events
            this._bindCardRowEvents(row);
            fragment.appendChild(row);
        });

        listContainer.appendChild(fragment);

        // UI Restore
        if (this._lastSearchQuery) {
            const input = document.getElementById('card-search-input');
            if (input) { input.value = this._lastSearchQuery; input.focus(); }
        }
    }

    _getSrsClass(c) {
        if (c.last_quality === 1) return 'srs-status-forgot';
        if (c.last_quality === 2) return 'srs-status-hard';
        if (c.last_quality === 3) return 'srs-status-good';
        if (c.last_quality === 4) return 'srs-status-easy';

        if (c.repetition_number === 0) return '';
        if (c.interval_days === 0) return 'srs-status-forgot';
        if (c.ease_factor < 2.0) return 'srs-status-hard';
        return c.interval_days > 10 ? 'srs-status-easy' : 'srs-status-good';
    }

    _bindCardRowEvents(row) {
        row.addEventListener('dragstart', (e) => this.handleDragStart(e, row));
        row.addEventListener('dragover', (e) => this.handleDragOver(e, row));
        row.addEventListener('drop', (e) => this.handleDrop(e, row));
        row.addEventListener('dragenter', () => row.style.borderTop = '2px solid #3b82f6');
        row.addEventListener('dragleave', () => row.style.borderTop = '');
        row.addEventListener('dragend', () => {
            row.style.opacity = '1';
            document.querySelectorAll('.card-row-item').forEach(r => r.style.borderTop = '');
        });

        // Checkbox change
        const cb = row.querySelector('.card-item-checkbox');
        cb.addEventListener('change', () => this.updateBulkDeleteButton());

        // Mobile Selection (Long Press)
        let pressTimer = null;
        let longPressed = false;

        row.addEventListener('touchstart', (e) => {
            if (e.target.closest('button, input, .drag-handle')) return;
            longPressed = false;
            pressTimer = setTimeout(() => {
                longPressed = true;
                cb.checked = !cb.checked;
                this.updateBulkDeleteButton();
                if (navigator.vibrate) navigator.vibrate(50);
            }, 500);
        }, { passive: true });

        row.addEventListener('touchend', () => clearTimeout(pressTimer));
        row.addEventListener('touchmove', () => clearTimeout(pressTimer));

        row.addEventListener('click', (e) => {
            if (e.target.closest('button, input, .drag-handle')) return;
            if (longPressed) { longPressed = false; return; }
            if (this.isSelectionMode) {
                cb.checked = !cb.checked;
                this.updateBulkDeleteButton();
            }
        });
    }

    onEditCardClick(id, front, back) {
        if (this.token) this.openEditCardModal(id, front, back);
        else window.uiManager.showAuthPromptModal();
    }

    onDeleteCardClick(id, front) {
        if (this.token) this.confirmDeleteCard(id, front);
        else window.uiManager.showAuthPromptModal();
    }


    // --- Search & Bulk Actions Helpers ---

    filterCards(query) {
        if (!this.currentCards) return;
        this._lastSearchQuery = query;
        const q = query.toLowerCase().trim();
        if (!q) {
            this.renderCards(this.currentCards);
            return;
        }
        const filtered = this.currentCards.filter(c =>
            c.front_content.toLowerCase().includes(q) ||
            c.back_content.toLowerCase().includes(q)
        );
        this.renderCards(filtered);
    }

    toggleSelectAllCards(isChecked) {
        document.querySelectorAll('.card-item-checkbox').forEach(cb => {
            cb.checked = isChecked;
        });
        this.updateBulkDeleteButton();
    }

    updateBulkDeleteButton() {
        const checked = document.querySelectorAll('.card-item-checkbox:checked');
        const btn = document.getElementById('btn-bulk-delete');

        this.isSelectionMode = checked.length > 0;

        if (btn) {
            if (checked.length > 0) {
                btn.style.display = 'inline-flex';
                btn.innerHTML = `<i class="fas fa-trash"></i> Eliminar (${checked.length})`;
            } else {
                btn.style.display = 'none';
            }
        }

        const total = document.querySelectorAll('.card-item-checkbox').length;
        const masterCb = document.getElementById('select-all-cards');
        if (masterCb) {
            masterCb.checked = (checked.length === total && total > 0);
            masterCb.indeterminate = (checked.length > 0 && checked.length < total);
        }

        // ✅ MANEJO DE HISTORIAL PARA MÓVILES (Descartar selección con botón atrás)
        if (this.isSelectionMode) {
            // Si acabamos de entrar en modo selección, empujamos un estado
            if (!this._lastSelectionState) {
                if (window.history && window.history.pushState) {
                    window.history.pushState({ selectionMode: true }, '', '');
                }
                this._lastSelectionState = true;
            }
        } else {
            // Si salimos del modo selección estando en la misma página
            if (this._lastSelectionState) {
                this._lastSelectionState = false;
            }
        }
    }

    // ✅ NUEVO: Interceptor de navegación y botón físico "Atrás"
    handlePopState(e) {
        // 1. Manejo de Selección (Mobile UI)
        if (this.isSelectionMode && (!e.state || !e.state.selectionMode)) {
            console.log('🔙 Deseleccionando tarjetas...');
            this.toggleSelectAllCards(false);
        } else {
            this._lastSelectionState = false;
        }

        // 2. Manejo de Navegación de URL (Refrescos / Back / Deep Links)
        const params = new URLSearchParams(window.location.search);
        const deckId = params.get('deckId');

        if (deckId) {
            if (!this.currentDeck || this.currentDeck.id !== deckId) {
                this.loadFolder(deckId, false); // false to avoid recursive pushState
            }
        } else {
            if (this.currentDeck) {
                this.loadDashboard(false); // false to avoid recursive pushState
            }
        }
    }

    confirmBulkDelete() {
        const checked = Array.from(document.querySelectorAll('.card-item-checkbox:checked')).map(cb => cb.value);
        if (checked.length === 0) return;

        const modal = document.getElementById('delete-confirm-modal');
        document.getElementById('delete-deck-name').textContent = `${checked.length} tarjetas seleccionadas`;
        document.querySelector('#delete-confirm-modal h2').textContent = 'Eliminar Múltiples Tarjetas';

        const closeModal = () => {
            modal.classList.remove('active');
            if (window.uiManager && typeof window.uiManager.popModalState === 'function') {
                window.uiManager.popModalState('delete-confirm-modal');
            }
        };

        document.getElementById('btn-confirm-delete').onclick = async () => {
            closeModal();
            await this.deleteBulkCards(checked);
        };
        document.getElementById('btn-cancel-delete').onclick = () => {
            closeModal();
            document.querySelector('#delete-confirm-modal h2').textContent = 'Eliminar Mazo'; // Reset
        };

        modal.classList.add('active');
        if (window.uiManager && typeof window.uiManager.pushModalState === 'function') {
            window.uiManager.pushModalState('delete-confirm-modal');
        }
    }

    async deleteBulkCards(cardIds) {
        try {
            const res = await fetch(`${window.AppConfig.API_URL}/api/cards/batch`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ cardIds })
            });

            if (res.ok) {
                if (this.currentDeck) this.loadFolder(this.currentDeck.id);
            } else {
                alert('No se pudieron eliminar las tarjetas masivamente.');
            }
        } catch (err) {
            console.error(err);
        }
    }

    // --- Drag & Drop Reordering ---
    handleDragStart(e, row) {
        this.draggedRowId = row.dataset.id;
        this.draggedRowIndex = parseInt(row.dataset.index);
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => row.style.opacity = '0.4', 0);
    }

    handleDragOver(e, row) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        return false;
    }

    async handleDrop(e, targetRow) {
        e.stopPropagation();
        targetRow.style.borderTop = '';

        const draggedId = this.draggedRowId;
        const targetId = targetRow.dataset.id;

        if (!draggedId || draggedId === targetId) return false;

        const draggedIndex = this.currentCards.findIndex(c => c.id === draggedId);
        const targetIndex = this.currentCards.findIndex(c => c.id === targetId);

        if (draggedIndex === -1 || targetIndex === -1) return false;

        const [movedCard] = this.currentCards.splice(draggedIndex, 1);
        this.currentCards.splice(targetIndex, 0, movedCard);

        this.renderCards(this.currentCards);
        await this.syncCardOrder();
        return false;
    }

    async syncCardOrder() {
        if (!this.currentDeck || !this.currentCards) return;
        const sortedIds = this.currentCards.map(c => c.id);

        try {
            await fetch(`${window.AppConfig.API_URL}/api/decks/${this.currentDeck.id}/cards/reorder`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ sortedIds })
            });
        } catch (err) {
            console.error("Failed to sync card order:", err);
        }
    }

    // --- Actions ---

    openAddCardModal() {
        document.getElementById('card-form').reset();
        document.getElementById('card-deck-id').value = this.currentDeck.id;
        document.getElementById('card-id').value = ''; // Clear ID for new
        document.getElementById('modal-title').innerText = 'Añadir Tarjeta';
        document.getElementById('card-modal').classList.add('active');
        if (window.uiManager && typeof window.uiManager.pushModalState === 'function') {
            window.uiManager.pushModalState('card-modal');
        }
    }

    closeCardModal() {
        document.getElementById('card-modal').classList.remove('active');
        if (window.uiManager && typeof window.uiManager.popModalState === 'function') {
            window.uiManager.popModalState('card-modal');
        }
    }

    async openAiModal() {
        const allowed = await this._checkUsageLimit();
        if (!allowed) return;

        document.getElementById('ai-modal').classList.add('active');
        if (window.uiManager && typeof window.uiManager.pushModalState === 'function') {
            window.uiManager.pushModalState('ai-modal');
        }
    }

    closeAiModal() {
        document.getElementById('ai-modal').classList.remove('active');
        if (window.uiManager && typeof window.uiManager.popModalState === 'function') {
            window.uiManager.popModalState('ai-modal');
        }
    }

    openStatsModal(total, mastered) {
        document.getElementById('modal-total').textContent = total;
        document.getElementById('modal-mastered').textContent = mastered;
        document.getElementById('stats-modal').classList.add('active');
        if (window.uiManager && typeof window.uiManager.pushModalState === 'function') {
            window.uiManager.pushModalState('stats-modal');
        }

        // Render Heatmap
        if (window.ActivityHeatmap) {
            const heatmap = new ActivityHeatmap('activity-heatmap');
            heatmap.render();
        }
    }

    closeStatsModal() {
        document.getElementById('stats-modal').classList.remove('active');
        if (window.uiManager && typeof window.uiManager.popModalState === 'function') {
            window.uiManager.popModalState('stats-modal');
        }
    }

    /**
     * Inicia el modo de estudio real para un mazo específico.
     * Solo para usuarios registrados con tarjetas.
     */
    async startStudy(deckId, deckNameParam = null, cardCount = null) {
        // Validar si el mazo tiene tarjetas antes de intentar estudiar (solo si conocemos el count)
        if (cardCount !== null && cardCount === 0) {
            if (window.uiManager && window.uiManager.showToast) {
                window.uiManager.showToast('Este mazo no tiene tarjetas. ¡Crea o genera algunas primero!', 'warning');
            } else {
                alert('Este mazo no tiene tarjetas para estudiar.');
            }
            return;
        }

        const deckName = deckNameParam || this.currentDeck?.name || document.querySelector('.deck-title')?.textContent || 'Mazo';
        window.location.href = `flashcards?deckId=${deckId}&deckName=${encodeURIComponent(deckName)}`;
    }

    // --- API Helpers ---

    async fetchDeck(id) {
        if (!this.token) {
            // Mock System Folder for Guest
            if (id === 'demo-system-1') {
                return {
                    id: 'demo-system-1',
                    name: 'Repaso Medicina',
                    icon: '🩺',
                    type: 'SYSTEM',
                    total_cards: 3,
                    due_cards: 3
                };
            }
            if (id === 'demo-user-1') {
                return {
                    id: 'demo-user-1',
                    name: 'Mis Tarjetas',
                    icon: '👶',
                    type: 'USER',
                    total_cards: 3,
                    due_cards: 3
                };
            }
        }

        const res = await fetch(`${window.AppConfig.API_URL}/api/decks/${id}`, {
            headers: { 'Authorization': `Bearer ${this.token}` },
            cache: 'no-cache'
        });

        if (!res.ok) {
            console.error(`Error fetching deck ${id}: ${res.status} ${res.statusText}`);
            return null;
        }

        const data = await res.json();
        return data.deck;
    }

    async fetchDecks(parentId) {
        if (!this.token) {
            if (parentId) return []; // No subdecks for demo root yet
            // Return root guest decks
            return [
                { id: 'demo-system-1', name: 'Repaso Medicina', icon: '🩺', type: 'SYSTEM', total_cards: 3, due_cards: 3, mastery_percentage: 10 },
                { id: 'demo-user-1', name: 'Mis Tarjetas', icon: '👶', type: 'USER', total_cards: 3, due_cards: 3, mastery_percentage: 0 }
            ];
        }

        let url = `${window.AppConfig.API_URL}/api/decks`;
        if (parentId) url += `?parentId=${parentId}`;
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${this.token}` },
            cache: 'no-cache'
        });
        const data = await res.json();
        return data.decks || [];
    }

    async fetchCards(deckId) {
        if (!this.token) {
            const demoDeck = [
                { id: 'demo-fc-1', front_content: '¿Cuál es la tríada de Charcot para la Colangitis Aguda?', back_content: '1. Fiebre\n2. Ictericia\n3. Dolor en hipocondrio derecho', next_review_at: new Date(Date.now() - 10000).toISOString(), interval_days: 0, last_quality: null, topic: 'Gastroenterología' },
                { id: 'demo-fc-2', front_content: 'Mujer de 30 años con exoftalmos, bocio y taquicardia. TSH disminuida y T4 libre elevada. Diagnóstico más probable.', back_content: 'Enfermedad de Graves-Basedow', next_review_at: new Date(Date.now() + 86400000).toISOString(), interval_days: 5, last_quality: 3, topic: 'Endocrinología' },
                { id: 'demo-fc-3', front_content: '¿Cuál es el signo clínico clásico de la apendicitis aguda caracterizado por dolor en fosa ilíaca derecha al presionar la fosa ilíaca izquierda?', back_content: 'Signo de Rovsing', next_review_at: new Date(Date.now() - 50000).toISOString(), interval_days: 1, last_quality: 1, topic: 'Cirugía General' }
            ];
            // Para huéspedes, siempre retornamos las 3 tarjetas de ejemplo sin importar el ID del mazo de demo
            return demoDeck;
        }


        const res = await fetch(`${window.AppConfig.API_URL}/api/decks/${deckId}/cards`, {
            headers: { 'Authorization': `Bearer ${this.token}` },
            cache: 'no-cache'
        });
        const data = await res.json();
        return data.cards || [];
    }

    // Create Deck
    async handleCreateDeck(e) {
        e.preventDefault();
        const deckId = document.getElementById('new-deck-id').value; // Hidden ID field for Edit
        const name = document.getElementById('new-deck-name').value;
        const parentId = document.getElementById('new-deck-parent').value || null;

        if (deckId) {
            // EDIT MODE
            try {
                const icon = document.getElementById('new-deck-icon') ? document.getElementById('new-deck-icon').value : null;
                const res = await fetch(`${window.AppConfig.API_URL}/api/decks/${deckId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                    body: JSON.stringify({ name, icon })
                });

                if (res.ok) {
                    DeckExplorer.closeCreateModal();
                    await this.explorer.loadTree();
                    this.loadDashboard(); // Refresh current view
                } else {
                    alert('Error al actualizar nombre');
                }
            } catch (err) { console.error(err); }
        } else {
            // CREATE MODE
            try {
                const icon = document.getElementById('new-deck-icon') ? document.getElementById('new-deck-icon').value : null;
                const res = await fetch(`${window.AppConfig.API_URL}/api/decks`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                    body: JSON.stringify({ name, icon, parentId })
                });

                if (res.ok) {
                    DeckExplorer.closeCreateModal();
                    await this.explorer.loadTree();
                    if (parentId) this.loadFolder(parentId);
                    else this.loadDashboard();
                } else {
                    alert('Error al crear mazo');
                }
            } catch (err) {
                console.error(err);
            }
        }
    }

    openEditDeckModal(id, currentName, currentIcon) {
        document.getElementById('create-deck-form').reset();
        document.getElementById('modal-deck-title').innerText = 'Editar Mazo';
        document.getElementById('new-deck-name').value = currentName;
        document.getElementById('new-deck-id').value = id;

        // Populate Icon Picker with current icon
        if (window.DeckExplorer) {
            window.DeckExplorer.renderIconPicker(currentIcon || 'fas fa-layer-group');
        }

        const submitBtn = document.getElementById('btn-save-deck');
        if (submitBtn) submitBtn.innerText = 'Guardar';
        document.getElementById('create-deck-modal').classList.add('active');
        if (window.uiManager && typeof window.uiManager.pushModalState === 'function') {
            window.uiManager.pushModalState('create-deck-modal');
        }
    }

    // Create/Edit Card (Consolidated)
    async handleSaveCard(e) {
        e.preventDefault();
        const deckId = document.getElementById('card-deck-id').value;
        const cardId = document.getElementById('card-id').value; // Check if editing
        const front = document.getElementById('card-front').value.trim();
        const back = document.getElementById('card-back').value.trim();

        if (!front || !back) {
            alert('Ambos campos son obligatorios.');
            return;
        }

        // Disable button during save
        const submitBtn = document.querySelector('#card-form button[type="submit"]');
        const originalText = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Guardando...';
        }

        try {
            let res;
            if (cardId) {
                // UPDATE: PUT /api/cards/:id
                res = await fetch(`${window.AppConfig.API_URL}/api/cards/${cardId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                    body: JSON.stringify({ front, back })
                });
            } else {
                // CREATE: POST /api/decks/:deckId/cards
                res = await fetch(`${window.AppConfig.API_URL}/api/decks/${deckId}/cards`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                    body: JSON.stringify({ front, back })
                });
            }

            if (res.ok) {
                this.closeCardModal();
                this.loadFolder(deckId); // Reload to update list
            } else {
                const errorData = await res.json().catch(() => ({}));
                console.error('Save card error:', res.status, errorData);
                alert(`Error al guardar tarjeta: ${errorData.error || res.statusText}`);
            }
        } catch (err) {
            console.error('Save card network error:', err);
            alert('Error de red al guardar tarjeta. Verifica tu conexión.');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        }
    }

    openEditCardModal(id, front, back) {
        document.getElementById('card-form').reset();
        document.getElementById('card-deck-id').value = this.currentDeck.id;
        document.getElementById('card-id').value = id;
        document.getElementById('card-front').value = front;
        document.getElementById('card-back').value = back;
        document.getElementById('modal-title').innerText = 'Editar Tarjeta';

        document.getElementById('card-modal').classList.add('active');
        if (window.uiManager && typeof window.uiManager.pushModalState === 'function') {
            window.uiManager.pushModalState('card-modal');
        }
    }

    // AI Generation
    async generateAiCards() {
        const topic = document.getElementById('ai-topic').value;
        if (!topic) return alert('Escribe un tema');

        document.getElementById('ai-loading').style.display = 'block';

        try {
            const res = await fetch(`${window.AppConfig.API_URL}/api/decks/${this.currentDeck.id}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                body: JSON.stringify({ topic, amount: 5 })
            });

            if (res.ok) {
                const data = await res.json().catch(() => ({ count: 5 }));
                this.closeAiModal();
                this.loadFolder(this.currentDeck.id);

                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'success',
                        title: '¡Tarjetas Generadas!',
                        text: `Se generaron ${data.count || 5} tarjetas sobre "${topic}".`,
                        background: 'rgba(20, 20, 20, 0.95)',
                        confirmButtonText: 'A estudiar'
                    });
                } else {
                    alert(`✨ ¡Éxito! Se generaron tarjetas sobre "${topic}".`);
                }
            } else if (res.status === 403) {
                // Interceptar Límites Agotados Visualmente
                const data = await res.json().catch(() => ({}));
                this.closeAiModal();
                this._showLimitModal(data.error || 'Has agotado tus tarjetas mensuales. Mejora tu plan.');
            } else {
                const errorData = await res.json().catch(() => ({}));
                this.closeAiModal();
                if (typeof Swal !== 'undefined') {
                    Swal.fire('Error del Servidor', errorData.error || 'Hubo un fallo generando las tarjetas. Intenta de nuevo.', 'error');
                } else {
                    alert('Error al generar tarjetas: ' + (errorData.error || 'Fallo desconocido'));
                }
            }
        } catch (err) {
            console.error('Network Error AI Cards:', err);
            this.closeAiModal();
            if (typeof Swal !== 'undefined') {
                Swal.fire('Error de Conexión', 'No se pudo contactar con el servidor. Revisa tu internet.', 'error');
            } else {
                alert('Error de conexión al generar la IA.');
            }
        } finally {
            document.getElementById('ai-loading').style.display = 'none';
        }
    }

    /**
     * Muestra alerta 100% nativa para los limites de uso
     */
    _showLimitModal(msg) {
        let modal = document.getElementById('custom-limit-modal');

        if (modal) {
            // Si ya existe, solo actualizamos el mensaje y lo activamos
            modal.querySelector('p').textContent = msg;
            modal.classList.add('active');
        } else {
            // Si no existe, lo creamos
            const modalHtml = `
                <div class="modal-overlay active" id="custom-limit-modal" style="z-index:9999; backdrop-filter:blur(8px);">
                    <div class="modal-content" style="background:var(--bg-card, #1f1f1f); padding:2rem; border-radius:12px; border:1px solid rgba(255,255,255,0.1); max-width:400px; text-align:center; box-shadow:0 20px 40px rgba(0,0,0,0.5);">
                        <div style="margin-bottom:1.5rem;">
                            <i class="fas fa-crown" style="font-size:3.5rem; color:#ffd700; filter: drop-shadow(0 0 10px rgba(255, 215, 0, 0.3));"></i>
                        </div>
                        <h2 style="margin-bottom:1rem; font-size:1.4rem; color:var(--text-main, #f8fafc);">Límite Alcanzado</h2>
                        <p style="color:var(--text-muted, #94a3b8); font-size:0.95rem; margin-bottom:2rem; padding:0 1rem;">${msg}</p>
                        <button class="btn-action" style="background:linear-gradient(90deg, #f59e0b, #d97706); color:white; font-weight:bold; padding:0.8rem 2rem; border-radius:8px; border:none; width:100%; cursor:pointer;" onclick="const m = document.getElementById('custom-limit-modal'); if(m){ m.classList.remove('active'); } if(window.uiManager && window.uiManager.popModalState) window.uiManager.popModalState('custom-limit-modal');">Entendido</button>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            modal = document.getElementById('custom-limit-modal');
        }

        // Registrar en historial
        if (window.uiManager && typeof window.uiManager.pushModalState === 'function') {
            window.uiManager.pushModalState('custom-limit-modal');
        }
    }

    /**
     * Verifica de forma pasiva (sin descontar nada) si el usuario es elegible
     * para generar tarjetas por IA usando su límite mensual o global.
     */
    async _checkUsageLimit() {
        try {
            const res = await fetch(`${window.AppConfig.API_URL}/api/usage/check-ai-limits`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await res.json().catch(() => ({}));

            if (res.ok) {
                return true;
            } else if (res.status === 403) {
                // Bifurcación Inteligente UI: Vida de Prueba vs Límite Básico/Avanzado
                if (data.reason === 'FREE_LIVES_EXHAUSTED') {
                    if (window.uiManager && typeof window.uiManager.showPaywallModal === 'function') {
                        window.uiManager.showPaywallModal();
                    } else {
                        alert(data.error || 'Has agotado tus vidas. Suscríbete para continuar.');
                    }
                } else {
                    this._showLimitModal(data.error || 'Has agotado tus tarjetas mensuales. Mejora tu plan.');
                }
                return false;
            } else {
                console.error('Error no tipificado evaluando AI limits:', data);
                return true; // Fail-open: ignorar error 500 para permitirle intentar real
            }
        } catch (err) {
            console.error('Error de red verificando uso:', err);
            return true; // Fail-open en caso de error de red
        }
    }



    confirmDeleteDeck(deckId, deckName) {
        // Show custom delete modal
        const modal = document.getElementById('delete-confirm-modal');
        document.getElementById('delete-deck-name').textContent = deckName;

        const closeModal = () => {
            modal.classList.remove('active');
            if (window.uiManager && typeof window.uiManager.popModalState === 'function') {
                window.uiManager.popModalState('delete-confirm-modal');
            }
        };

        document.getElementById('btn-confirm-delete').onclick = async () => {
            closeModal();
            await this.deleteDeck(deckId);
        };
        document.getElementById('btn-cancel-delete').onclick = () => {
            closeModal();
        };

        modal.classList.add('active');
        if (window.uiManager && typeof window.uiManager.pushModalState === 'function') {
            window.uiManager.pushModalState('delete-confirm-modal');
        }
    }

    async deleteDeck(deckId) {

        try {
            // DELETE /api/decks/:id
            const res = await fetch(`${window.AppConfig.API_URL}/api/decks/${deckId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${this.token}` } });

            if (res.ok) {
                // Refresh Tree and Dashboard
                await this.explorer.loadTree();

                // If we deleted the current folder, go up or home
                if (this.currentDeck && this.currentDeck.id === deckId) {
                    this.loadDashboard();
                } else if (this.currentDeck) {
                    // We deleted a subdeck, reload current folder
                    this.loadFolder(this.currentDeck.id);
                } else {
                    this.loadDashboard();
                }
            } else {
                alert('No se pudo eliminar el mazo');
            }
        } catch (err) {
            console.error(err);
        }
    }

    // --- Card Deletion ---
    confirmDeleteCard(cardId, frontContent) {
        const modal = document.getElementById('delete-confirm-modal');
        const preview = frontContent.length > 40 ? frontContent.substring(0, 40) + '…' : frontContent;
        document.getElementById('delete-deck-name').textContent = preview;
        document.querySelector('#delete-confirm-modal h2').textContent = 'Eliminar Tarjeta';

        const closeModal = () => {
            modal.classList.remove('active');
            if (window.uiManager && typeof window.uiManager.popModalState === 'function') {
                window.uiManager.popModalState('delete-confirm-modal');
            }
        };

        document.getElementById('btn-confirm-delete').onclick = async () => {
            closeModal();
            await this.deleteCard(cardId);
        };
        document.getElementById('btn-cancel-delete').onclick = () => {
            closeModal();
            // Reset title for next use
            document.querySelector('#delete-confirm-modal h2').textContent = 'Eliminar Mazo';
        };

        modal.classList.add('active');
        if (window.uiManager && typeof window.uiManager.pushModalState === 'function') {
            window.uiManager.pushModalState('delete-confirm-modal');
        }
    }

    async deleteCard(cardId) {
        try {
            const res = await fetch(`${window.AppConfig.API_URL}/api/cards/${cardId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (res.ok) {
                // Reload current folder to refresh card list
                if (this.currentDeck) {
                    this.loadFolder(this.currentDeck.id);
                }
            } else {
                alert('No se pudo eliminar la tarjeta');
            }
        } catch (err) {
            console.error(err);
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /**
     * Entry point for Visitors to see the study UI.
     * Uses dummy data and triggers the Join Modal at the end.
     */
    startStudyDemo(deckId) {
        if (typeof window.uiManager !== 'undefined' && window.uiManager.showToast) {
            window.uiManager.showToast('Iniciando modo demostración...', 'info');
        }
        // Redirect to flashcards study page with demo flag
        window.location.href = `flashcards?deckId=${deckId}&demo=true`;
    }

    renderGuestBanner() {
        const container = document.getElementById('main-content');
        if (!container) return; 
        
        // Prevención de duplicados
        if (document.getElementById('guest-mode-banner-repaso')) return;

        const banner = document.createElement('div');
        banner.id = 'guest-mode-banner-repaso';
        banner.style.cssText = 'background: linear-gradient(90deg, #1e293b, #0f172a); border: 1px solid #3b82f6; border-radius: 16px; padding: 1.5rem; margin-bottom: 2rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; box-shadow: 0 4px 20px rgba(59, 130, 246, 0.1); animation: fadeIn 0.8s ease-out;';
        banner.innerHTML = `
            <div style="display: flex; align-items: center; gap: 1rem;">
                <div style="width: 50px; height: 50px; background: rgba(59, 130, 246, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #60a5fa; font-size: 1.5rem;">
                    <i class="fas fa-user-astronaut"></i>
                </div>
                <div>
                    <h3 style="color: #f8fafc; margin: 0; font-size: 1.1rem;">Estás en Modo Invitado</h3>
                    <p style="color: #94a3b8; margin: 0.2rem 0 0 0; font-size: 0.9rem;">Regístrate para guardar tu progreso real y acceder a todas las funciones.</p>
                </div>
            </div>
            <button class="btn-action" style="background: #3b82f6; color: white; padding: 0.75rem 1.5rem; border-radius: 12px; font-weight: 700; border: none; cursor: pointer;" onclick="window.location.href='/register'">
                Crear Cuenta Gratis
            </button>
        `;
        container.prepend(banner);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.repasoManager = new RepasoManager();
    window.repasoManager.init();
});
