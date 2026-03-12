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
    }

    /**
     * Renders a deck icon correctly: maps emojis → FontAwesome, includes vibrant color.
     */
    static renderColoredIcon(icon, fallbackFA = 'fas fa-folder') {
        const { faClass, color, html } = RepasoManager._resolveIcon(icon, fallbackFA);
        if (html) return `<span style="color:${color}">${html}</span>`;
        return `<i class="${faClass}" style="color:${color}"></i>`;
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

    /**
     * Renders icon with its vibrant color applied. Used for card icons and headers.
     */
    static renderColoredIcon(icon, fallbackFA = 'fas fa-folder') {
        const resolved = RepasoManager._resolveIcon(icon, fallbackFA);
        const color = resolved.color;
        if (resolved.html) return `<span style="color:${color}">${resolved.html}</span>`;
        return `<i class="${resolved.faClass}" style="color:${color}"></i>`;
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

    loadDashboard() {
        document.getElementById('dashboard-view').style.display = 'block';
        document.getElementById('folder-view').style.display = 'none';
        this.currentDeck = null;

        this.renderRootDecks();
    }

    async loadFolder(deckId) {
        document.getElementById('dashboard-view').style.display = 'none';
        document.getElementById('folder-view').style.display = 'block';
        
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
        // Calculate mastered properly based on intervals (SM-2 standard > 21 days)
        const mastered = cards?.filter(c => c.interval_days > 21).length || 0;
        const pending = deck.due_cards || 0;

        // Premium Header with Inline Actions
        // Reduced inline padding/margin to allow CSS control on mobile
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 1rem; padding-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); margin-bottom: 1.5rem;">
                
                <div style="display: flex; gap: 1rem; align-items: flex-start;">
                    <!-- Icon -->
                    <div class="deck-icon-large" style="width:60px; height:60px; font-size:2rem; background:rgba(59,130,246,0.1); border-radius:16px; display:flex; align-items:center; justify-content:center; border:1px solid rgba(59,130,246,0.2); flex-shrink: 0;">
                        ${RepasoManager.renderColoredIcon(deck?.icon, 'fas fa-layer-group')}
                    </div>

                    <!-- Info Column -->
                    <div style="flex-grow: 1; min-width: 0;">
                        <h1 class="deck-title" style="font-size:1.75rem; font-weight:700; margin:0 0 0.5rem 0; color:#f8fafc; line-height:1.1;">
                            ${deck?.name || 'Mazo sin nombre'}
                        </h1>
                        
                        <!-- Stats Badges -->
                        <div style="display:flex; flex-wrap:wrap; gap:1rem; color:#94a3b8; font-size:0.85rem; align-items:center; margin-bottom: 1rem;">
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

                        <!-- Actions Row (Consolidated) -->
                        <div class="action-bar" style="display:flex; gap:0.8rem; align-items:center;">
                            
                            <!-- 1. Study (Primary - Standard Size) -->
                            ${total > 0 && this.token ? `
                            <button class="btn-action" style="background:#3b82f6; color:white; height:42px; padding:0 1.5rem; border-radius:12px; font-weight:600; font-size:0.95rem; border:none; display:flex; align-items:center; justify-content:center; gap:0.6rem; cursor:pointer; box-sizing:border-box; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3); transition: transform 0.2s; white-space:nowrap;" onclick="window.repasoManager.startStudy('${deck.id}', '${this.escapeHtml(deck.name)}', ${total})" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
                                <i class="fas fa-play"></i> <span class="btn-text">Estudiar Ahora</span>
                            </button>
                            ` : ''}

                            ${!this.token ? `
                            <button class="btn-action" style="background:#3b82f6; color:white; height:46px; padding:0 2rem; border-radius:14px; font-weight:800; font-size:1.05rem; border:none; display:flex; align-items:center; justify-content:center; gap:0.8rem; cursor:pointer; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);" onclick="window.repasoManager.startStudyDemo('${deck.id}')">
                                <i class="fas fa-play-circle" style="font-size:1.2rem;"></i> <span class="btn-text">¡PROBAR DEMO AHORA!</span>
                            </button>
                            ` : ''}

                            <!-- 2. Add Card -->
                            ${this.token ? `
                            <button class="btn-action" style="background:rgba(30, 41, 59, 0.6); border:1px solid rgba(255,255,255,0.1); color:#e2e8f0; height:42px; padding:0 1.5rem; border-radius:12px; font-weight:600; font-size:0.95rem; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:0.6rem; box-sizing:border-box; transition: background 0.2s; white-space:nowrap;" onclick="window.repasoManager.openAddCardModal()" onmouseover="this.style.background='rgba(51, 65, 85, 0.8)'" onmouseout="this.style.background='rgba(30, 41, 59, 0.6)'">
                                <i class="fas fa-plus"></i> <span class="btn-text">Añadir Tarjeta</span>
                            </button>
                            ` : ''}

                            <!-- 3. AI -->
                            ${this.token ? `
                            <button class="btn-action" style="background:rgba(139, 92, 246, 0.15); border:1px solid rgba(139, 92, 246, 0.3); color:#d8b4fe; height:42px; padding:0 1.5rem; border-radius:12px; font-weight:600; font-size:0.95rem; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:0.6rem; box-sizing:border-box; transition: background 0.2s; white-space:nowrap;" onclick="window.repasoManager.openAiModal()" onmouseover="this.style.background='rgba(139, 92, 246, 0.25)'" onmouseout="this.style.background='rgba(139, 92, 246, 0.15)'">
                                <i class="fas fa-magic"></i> <span class="btn-text">Generar con IA</span>
                            </button>
                            ` : ''}
                            
                            <!-- 4. Stats -->
                            <button class="btn-action" style="background:rgba(30, 41, 59, 0.6); border:1px solid rgba(255,255,255,0.1); color:#e2e8f0; height:42px; padding:0 1.5rem; border-radius:12px; font-weight:600; font-size:0.95rem; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:0.6rem; box-sizing:border-box; transition: background 0.2s; white-space:nowrap;" onclick="${this.token ? `window.repasoManager.openStatsModal(${total}, ${mastered})` : 'window.uiManager.showAuthPromptModal()'}" onmouseover="this.style.background='rgba(51, 65, 12, 0.8)'" onmouseout="this.style.background='rgba(30, 41, 59, 0.6)'">
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

        if (!decks || decks.length === 0) {
            container.style.display = 'none';
            return;
        }
        container.style.display = 'grid';
        this.renderDeckCards(decks, container, this.currentDeck?.id || null);
    }

    renderDeckCards(decks, container, parentId = null) {
        // Ensure smaller grid layout via inline style on container if not governed by CSS class
        container.style.display = 'grid';
        container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(180px, 1fr))';
        container.style.gap = '1rem';
        container.innerHTML = ''; // Clear previous content

        // --- 1. NEW: Add "Create Deck" Card (Only for Logged Users) ---
        if (this.token) {
            const addCard = document.createElement('div');
            addCard.className = 'deck-card';
            addCard.style.padding = '1rem';
            addCard.style.minHeight = '80px';
            addCard.style.border = '2px dashed rgba(255, 255, 255, 0.1)';
            addCard.style.background = 'transparent';
            addCard.style.display = 'flex';
            addCard.style.flexDirection = 'column';
            addCard.style.alignItems = 'center';
            addCard.style.justifyContent = 'center';
            addCard.style.cursor = 'pointer';
            addCard.style.transition = 'all 0.2s';

            addCard.onmouseover = () => {
                addCard.style.borderColor = '#3b82f6';
                addCard.style.background = 'rgba(59, 130, 246, 0.05)';
            };
            addCard.onmouseout = () => {
                addCard.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                addCard.style.background = 'transparent';
            };
            addCard.onclick = () => DeckExplorer.openCreateModal(parentId);

            addCard.innerHTML = `
                <div style="font-size: 2rem; color: #3b82f6; margin-bottom: 0.5rem;">
                    <i class="fas fa-plus"></i>
                </div>
                <div style="font-size: 0.95rem; font-weight: 600; color: #94a3b8;">Crear Mazo</div>
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

        // Build header with search and bulk actions
        let html = `
            <div style="display:flex; justify-content:space-between; margin-bottom:1rem; align-items:center; flex-wrap:wrap; gap:1rem;">
                <h3 style="margin:0; font-size:1.2rem; font-weight:600;">Tarjetas (${cards.length})</h3>
                <div style="position:relative; width:100%; max-width:250px;">
                    <i class="fas fa-search" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:#94a3b8; font-size:0.85rem;"></i>
                    <input type="text" id="card-search-input" placeholder="Buscar tarjetas..." style="width:100%; padding:0.6rem 1rem 0.6rem 2.2rem; border-radius:8px; border:1px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.2); color:white; font-size:0.9rem;" onkeyup="window.repasoManager.filterCards(this.value)">
                </div>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem; align-items:center; background:rgba(255,255,255,0.02); padding:0.5rem 1rem; border-radius:8px;">
                <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; margin:0;">
                    <input type="checkbox" id="select-all-cards" onchange="window.repasoManager.toggleSelectAllCards(this.checked)" style="accent-color:#3b82f6; width:16px; height:16px; cursor:pointer;">
                    <span style="font-size:0.85rem; color:#94a3b8; font-weight:500;">Seleccionar todo</span>
                </label>
                <button id="btn-bulk-delete" class="btn-action deck-action-btn--delete" style="display:none; padding:0.4rem 0.8rem; font-size:0.8rem; border-radius:6px; background:rgba(239, 68, 68, 0.1); color:#ef4444; border:1px solid rgba(239,68,68,0.3); font-weight:600;" onclick="${this.token ? 'window.repasoManager.confirmBulkDelete()' : 'window.uiManager.showAuthPromptModal()'}">
                    <i class="fas fa-trash"></i> Eliminar Selección
                </button>
            </div>
            <div id="cards-list-container"></div>
        `;
        container.innerHTML = html;

        const listContainer = document.getElementById('cards-list-container');

        if (cards.length === 0) {
            listContainer.innerHTML = '<div style="color:#94a3b8; padding:2rem; text-align:center; font-size:0.9rem;">No se encontraron tarjetas en esta búsqueda.</div>';
            return;
        }

        cards.forEach((c, index) => {
            // Evaluamos la métrica SRS de la tarjeta para pintarla en UI principal
            let colorClass = '';
            if (c.last_quality === 1) {
                colorClass = 'srs-status-forgot';
            } else if (c.last_quality === 2) {
                colorClass = 'srs-status-hard';
            } else if (c.last_quality === 3) {
                colorClass = 'srs-status-good';
            } else if (c.last_quality === 4) {
                colorClass = 'srs-status-easy';
            } else {
                // Fallback heurístico
                if (c.repetition_number === 0) {
                    colorClass = '';
                } else if (c.interval_days === 0 && c.repetition_number > 0) {
                    colorClass = 'srs-status-forgot';
                } else if (c.ease_factor < 2.0 && c.interval_days > 0) {
                    colorClass = 'srs-status-hard';
                } else if (c.ease_factor >= 2.0 && c.interval_days <= 10) {
                    colorClass = 'srs-status-good';
                } else if (c.interval_days > 10) {
                    colorClass = 'srs-status-easy';
                }
            }

            const isDue = new Date(c.next_review_at) <= new Date();
            const dueClass = isDue ? 'is-due-glow' : '';

            const row = document.createElement('div');
            row.className = `card-row-item ${colorClass} ${dueClass}`;
            row.dataset.id = c.id;
            row.dataset.index = index;
            row.draggable = true;
            row.style.cssText = `display:grid; grid-template-columns: 45px 1fr 1fr 80px; gap:1rem; padding:1rem; border-bottom:1px solid rgba(255,255,255,0.05); align-items:center; transition:background 0.2s; cursor:grab; background:${colorClass ? '' : 'transparent'}; -webkit-touch-callout:none; -webkit-user-select:none; user-select:none; border-radius: 8px; margin-bottom: 4px; border-left-width: 4px; border-left-style: solid; ${!colorClass ? 'border-left-color: transparent;' : ''}`;

            // Efecto Hover solo si no tiene color base, de lo contrario oscurecer levemente el color srs
            row.onmouseover = () => row.style.filter = 'brightness(1.5)';
            row.onmouseout = () => row.style.filter = '';

            // Drag Events
            row.addEventListener('dragstart', (e) => this.handleDragStart(e, row));
            row.addEventListener('dragover', (e) => this.handleDragOver(e, row));
            row.addEventListener('drop', (e) => this.handleDrop(e, row));
            row.addEventListener('dragenter', (e) => row.style.borderTop = '2px solid #3b82f6');
            row.addEventListener('dragleave', (e) => row.style.borderTop = '');
            row.addEventListener('dragend', (e) => {
                row.style.opacity = '1';
                document.querySelectorAll('.card-row-item').forEach(r => r.style.borderTop = '');
            });

            // Column 1: Drag Handle & Checkbox
            const checkDiv = document.createElement('div');
            checkDiv.style.cssText = 'display:flex; align-items:center; gap:0.5rem; color:#64748b;';
            checkDiv.innerHTML = `
                <i class="fas fa-grip-vertical" style="cursor:grab; font-size:1rem; padding:10px 10px 10px 0; touch-action:none;"></i>
                <input type="checkbox" class="card-checkbox" value="${c.id}" onchange="window.repasoManager.updateBulkDeleteButton()" style="accent-color:#3b82f6; width:16px; height:16px; cursor:pointer; margin-left:2px;" onclick="event.stopPropagation()">
            `;

            // Column 2: Front
            const frontDiv = document.createElement('div');
            frontDiv.style.cssText = 'color:#cbd5e1; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
            frontDiv.textContent = c.front_content;

            // Column 3: Back
            const backDiv = document.createElement('div');
            backDiv.style.cssText = 'color:#94a3b8; font-size:0.95rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
            backDiv.textContent = c.back_content;

            // Column 4: Actions
            const actionsDiv = document.createElement('div');
            actionsDiv.style.cssText = 'display:flex; gap:0.5rem; justify-content:flex-end;';

            const editBtn = document.createElement('button');
            editBtn.className = 'deck-action-btn';
            editBtn.title = 'Editar';
            editBtn.style.cssText = 'width:32px; height:32px; display:flex; align-items:center; justify-content:center; font-size:0.8rem;';
            editBtn.innerHTML = '<i class="fas fa-pen"></i>';
            editBtn.onclick = (e) => {
                e.stopPropagation();
                if (this.token) {
                    window.repasoManager.openEditCardModal(c.id, c.front_content, c.back_content);
                } else {
                    window.uiManager.showAuthPromptModal();
                }
            };

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'deck-action-btn deck-action-btn--delete';
            deleteBtn.title = 'Eliminar';
            deleteBtn.style.cssText = 'width:32px; height:32px; display:flex; align-items:center; justify-content:center; font-size:0.8rem;';
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                if (this.token) {
                    window.repasoManager.confirmDeleteCard(c.id, c.front_content);
                } else {
                    window.uiManager.showAuthPromptModal();
                }
            };

            actionsDiv.appendChild(editBtn);
            actionsDiv.appendChild(deleteBtn);

            row.appendChild(checkDiv);
            row.appendChild(frontDiv);
            row.appendChild(backDiv);
            row.appendChild(actionsDiv);

            listContainer.appendChild(row);

            // Setup mobile touch-to-select (Long Press) via pure JS timeout
            // Also allow standard click on the row to toggle selection
            let pressTimer = null;
            let longPressed = false;

            row.addEventListener('touchstart', (e) => {
                const targetTag = e.target.tagName.toLowerCase();
                // 🚫 IGNORAR COMPONENTES ACCIONABLES: botones, inputs y especfícamente THE DRAG HANDLE (fa-grip-vertical)
                if (targetTag === 'button' || targetTag === 'input' || e.target.classList.contains('fa-grip-vertical')) {
                    return;
                }

                longPressed = false;
                pressTimer = setTimeout(() => {
                    longPressed = true;
                    const cb = row.querySelector('.card-checkbox');
                    if (cb) {
                        cb.checked = !cb.checked;
                        window.repasoManager.updateBulkDeleteButton();
                        if (navigator.vibrate) navigator.vibrate(50);
                    }
                }, 500);
            }, { passive: true });

            row.addEventListener('touchend', () => clearTimeout(pressTimer));
            row.addEventListener('touchmove', () => clearTimeout(pressTimer));

            row.addEventListener('click', (e) => {
                const targetTag = e.target.tagName.toLowerCase();
                // 🚫 IGNORAR COMPONENTES ACCIONABLES: botones, inputs y especfícamente THE DRAG HANDLE
                if (targetTag === 'button' || targetTag === 'input' || e.target.classList.contains('fa-grip-vertical')) {
                    return;
                }

                // Si fue long press, ya se seleccionó, no hacemos el toggle de nuevo.
                if (longPressed) {
                    longPressed = false;
                    return;
                }

                // Sólo seleccionar automáticamente si YA ESTAMOS en modo de selección
                if (window.repasoManager.isSelectionMode) {
                    const cb = row.querySelector('.card-checkbox');
                    if (cb) {
                        cb.checked = !cb.checked;
                        window.repasoManager.updateBulkDeleteButton();
                    }
                }
            });

            listContainer.appendChild(row);
        });

        // Ensure input holds focus if it had it
        const searchInput = document.getElementById('card-search-input');
        if (this._lastSearchQuery && searchInput) {
            searchInput.value = this._lastSearchQuery;
            searchInput.focus();
        }
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
        document.querySelectorAll('.card-checkbox').forEach(cb => {
            cb.checked = isChecked;
        });
        this.updateBulkDeleteButton();
    }

    updateBulkDeleteButton() {
        const checked = document.querySelectorAll('.card-checkbox:checked');
        const btn = document.getElementById('btn-bulk-delete');

        this.isSelectionMode = checked.length > 0;

        if (checked.length > 0) {
            btn.style.display = 'inline-flex';
            btn.innerHTML = `<i class="fas fa-trash"></i> Eliminar (${checked.length})`;
        } else {
            btn.style.display = 'none';
        }

        const total = document.querySelectorAll('.card-checkbox').length;
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

    // ✅ NUEVO: Interceptor del botón físico "Atrás" en móviles
    handlePopState(e) {
        if (this.isSelectionMode && (!e.state || !e.state.selectionMode)) {
            console.log('🔙 Botón Atrás detectado. Deseleccionando tarjetas para prevenir salida...');
            this.toggleSelectAllCards(false);
        } else {
            this._lastSelectionState = false;
        }
    }

    confirmBulkDelete() {
        const checked = Array.from(document.querySelectorAll('.card-checkbox:checked')).map(cb => cb.value);
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
        if (document.getElementById('custom-limit-modal')) return;
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

        // Registrar en historial para que el botón "Atrás" solo cierre el modal y no retroceda de página
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
}

document.addEventListener('DOMContentLoaded', () => {
    window.repasoManager = new RepasoManager();
    window.repasoManager.init();
});
