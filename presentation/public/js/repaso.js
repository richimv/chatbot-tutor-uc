/**
 * RepasoManager (Premium UI Edition)
 * Orchestrates the Right Content Panel based on Sidebar Selection.
 */
class RepasoManager {
    constructor() {
        this.explorer = new DeckExplorer(this);
        this.token = localStorage.getItem('authToken');
        this.currentDeck = null;
    }

    /**
     * Renders a deck icon correctly: emojis as text, FA classes as <i>, HTML as-is.
     * @param {string|null} icon - The icon value from DB
     * @param {string} fallbackFA - Fallback FontAwesome class (e.g. 'fas fa-folder')
     * @returns {string} Safe HTML string
     */
    /**
     * Renders a deck icon correctly: maps emojis → FontAwesome, includes vibrant color.
     * @param {string|null} icon - The icon value from DB
     * @param {string} fallbackFA - Fallback FontAwesome class
     * @returns {string} Safe HTML string
     */
    static renderIcon(icon, fallbackFA = 'fas fa-folder') {
        const { faClass } = RepasoManager._resolveIcon(icon, fallbackFA);
        return `<i class="${faClass}"></i>`;
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
        if (!this.token) {
            window.location.href = '/login';
            return;
        }

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
        document.getElementById('create-deck-form').addEventListener('submit', (e) => this.handleCreateDeck(e));
        document.getElementById('card-form').addEventListener('submit', (e) => this.handleSaveCard(e));
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

        try {
            const [deck, children, cards] = await Promise.all([
                this.fetchDeck(deckId),
                this.fetchDecks(deckId),
                this.fetchCards(deckId)
            ]);

            this.currentDeck = deck;
            this.renderDeckHeader(deck, cards);
            this.renderSubDecks(children);
            this.renderCards(cards);

        } catch (e) {
            console.error(e);
            alert('Error cargando contenido');
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

    renderDeckHeader(deck, cards) {
        const container = document.getElementById('folder-header');
        const total = cards.length;
        const mastered = 0; // Placeholder until backend support
        const pending = deck.due_cards || 0;

        // Premium Header with Inline Actions
        // Reduced inline padding/margin to allow CSS control on mobile
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 1rem; padding-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); margin-bottom: 1.5rem;">
                
                <div style="display: flex; gap: 1rem; align-items: flex-start;">
                    <!-- Icon -->
                    <div class="deck-icon-large" style="width:60px; height:60px; font-size:2rem; background:rgba(59,130,246,0.1); border-radius:16px; display:flex; align-items:center; justify-content:center; border:1px solid rgba(59,130,246,0.2); flex-shrink: 0;">
                        ${RepasoManager.renderColoredIcon(deck.icon, 'fas fa-layer-group')}
                    </div>

                    <!-- Info Column -->
                    <div style="flex-grow: 1; min-width: 0;">
                        <h1 class="deck-title" style="font-size:1.75rem; font-weight:700; margin:0 0 0.5rem 0; color:#f8fafc; line-height:1.1;">
                            ${deck.name}
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
                            ${total > 0 ? `
                            <button class="btn-action" style="background:#3b82f6; color:white; padding:0.7rem 1.5rem; border-radius:12px; font-weight:600; font-size:0.95rem; border:none; display:flex; align-items:center; gap:0.6rem; cursor:pointer; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3); transition: transform 0.2s;" onclick="window.repasoManager.startStudy('${deck.id}')" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
                                <i class="fas fa-play"></i> <span class="btn-text">Estudiar Ahora</span>
                            </button>
                            ` : ''}

                            <!-- 2. Add Card -->
                            <button class="btn-action" style="background:rgba(30, 41, 59, 0.6); border:1px solid rgba(255,255,255,0.1); color:#e2e8f0; padding:0.7rem 1.2rem; border-radius:12px; font-weight:500; font-size:0.95rem; cursor:pointer; display:flex; align-items:center; gap:0.6rem; transition: background 0.2s;" onclick="window.repasoManager.openAddCardModal()" onmouseover="this.style.background='rgba(51, 65, 85, 0.8)'" onmouseout="this.style.background='rgba(30, 41, 59, 0.6)'">
                                <i class="fas fa-plus"></i> <span class="btn-text">Añadir Tarjeta</span>
                            </button>

                            <!-- 3. AI -->
                            <button class="btn-action" style="background:rgba(139, 92, 246, 0.15); border:1px solid rgba(139, 92, 246, 0.3); color:#d8b4fe; padding:0.7rem 1.2rem; border-radius:12px; font-weight:500; font-size:0.95rem; cursor:pointer; display:flex; align-items:center; gap:0.6rem; transition: background 0.2s;" onclick="window.repasoManager.openAiModal()" onmouseover="this.style.background='rgba(139, 92, 246, 0.25)'" onmouseout="this.style.background='rgba(139, 92, 246, 0.15)'">
                                <i class="fas fa-magic"></i> <span class="btn-text">Generar con IA</span>
                            </button>
                            
                            <!-- 4. Stats -->
                            <button class="btn-action" style="background:rgba(30, 41, 59, 0.6); border:1px solid rgba(255,255,255,0.1); color:#e2e8f0; padding:0.7rem 1.2rem; border-radius:12px; font-weight:500; font-size:0.95rem; cursor:pointer; display:flex; align-items:center; gap:0.6rem; transition: background 0.2s;" onclick="window.repasoManager.openStatsModal(${total}, ${mastered})" onmouseover="this.style.background='rgba(51, 65, 85, 0.8)'" onmouseout="this.style.background='rgba(30, 41, 59, 0.6)'">
                                <i class="fas fa-chart-pie"></i> <span class="btn-text">Estadísticas</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderSubDecks(decks) {
        const container = document.getElementById('subdecks-container');
        container.innerHTML = '';
        // Always render, even if empty, to show "Add Deck" button
        this.renderDeckCards(decks, container, this.currentDeck.id);
    }

    renderDeckCards(decks, container, parentId = null) {
        // Ensure smaller grid layout via inline style on container if not governed by CSS class
        container.style.display = 'grid';
        container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(180px, 1fr))';
        container.style.gap = '1rem';
        container.innerHTML = ''; // Clear previous content

        // --- 1. NEW: Add "Create Deck" Card ---
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

            // Edit/Delete buttons HTML (only for user decks)
            const editDeleteBtns = !isSystem ? `
                <div style="display:flex; gap:0.3rem;">
                    <button class="deck-action-btn" onclick="event.stopPropagation(); window.repasoManager.openEditDeckModal('${deck.id}', '${this.escapeHtml(deck.name)}', '${deck.icon || ''}')" 
                        title="Editar">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button class="deck-action-btn deck-action-btn--delete" onclick="event.stopPropagation(); window.repasoManager.confirmDeleteDeck('${deck.id}', '${this.escapeHtml(deck.name)}')" 
                        title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>` : '';

            card.innerHTML = `
                <!-- Desktop layout -->
                <div class="deck-card-desktop">
                    <div style="display:flex; justify-content:${!isSystem ? 'space-between' : 'flex-end'}; align-items:center; margin-bottom:0.5rem;">
                        ${editDeleteBtns}
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
                    <div style="display:flex; align-items:center; gap:0.4rem; flex-shrink:0;">
                        ${editDeleteBtns}
                        <span class="deck-badge ${badgeClass}" style="font-size:0.55rem; padding:0.1rem 0.4rem;">${isSystem ? 'AUTO' : 'PERS.'}</span>
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

    renderCards(cards) {
        const container = document.getElementById('cards-container');

        if (cards.length === 0) {
            container.innerHTML = '<div style="color:#94a3b8; padding:2rem; text-align:center; background:rgba(255,255,255,0.02); border-radius:16px;">No hay tarjetas en este mazo. ¡Crea la primera!</div>';
            return;
        }

        container.innerHTML = '<h3 style="margin-bottom:1rem; font-size:1.2rem; font-weight:600;">Tarjetas</h3>';

        cards.forEach(c => {
            const row = document.createElement('div');
            row.style.cssText = 'display:grid; grid-template-columns: 1fr 1fr 80px; gap:1rem; padding:1rem; border-bottom:1px solid rgba(255,255,255,0.05); align-items:center; transition:background 0.2s;';
            row.onmouseover = () => row.style.background = 'rgba(255,255,255,0.02)';
            row.onmouseout = () => row.style.background = 'transparent';

            const frontDiv = document.createElement('div');
            frontDiv.style.cssText = 'color:#cbd5e1; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
            frontDiv.textContent = c.front_content;

            const backDiv = document.createElement('div');
            backDiv.style.cssText = 'color:#94a3b8; font-size:0.95rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
            backDiv.textContent = c.back_content;

            const actionsDiv = document.createElement('div');
            actionsDiv.style.cssText = 'display:flex; gap:0.5rem; justify-content:flex-end;';

            // Edit Button with hover effect
            const editBtn = document.createElement('button');
            editBtn.className = 'deck-action-btn';
            editBtn.title = 'Editar';
            editBtn.style.cssText = 'width:32px; height:32px; display:flex; align-items:center; justify-content:center; font-size:0.8rem;';
            editBtn.innerHTML = '<i class="fas fa-pen"></i>';
            editBtn.onclick = () => window.repasoManager.openEditCardModal(c.id, c.front_content, c.back_content);

            // Delete Button with hover effect
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'deck-action-btn deck-action-btn--delete';
            deleteBtn.title = 'Eliminar';
            deleteBtn.style.cssText = 'width:32px; height:32px; display:flex; align-items:center; justify-content:center; font-size:0.8rem;';
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
            deleteBtn.onclick = () => window.repasoManager.confirmDeleteCard(c.id, c.front_content);

            actionsDiv.appendChild(editBtn);
            actionsDiv.appendChild(deleteBtn);

            row.appendChild(frontDiv);
            row.appendChild(backDiv);
            row.appendChild(actionsDiv);

            container.appendChild(row);
        });
    }

    // --- Actions ---

    openAddCardModal() {
        document.getElementById('card-form').reset();
        document.getElementById('card-deck-id').value = this.currentDeck.id;
        document.getElementById('card-id').value = ''; // Clear ID for new
        document.getElementById('modal-title').innerText = 'Añadir Tarjeta';
        document.getElementById('card-modal').classList.add('active');
    }

    closeCardModal() {
        document.getElementById('card-modal').classList.remove('active');
    }

    openAiModal() {
        document.getElementById('ai-modal').classList.add('active');
    }

    closeAiModal() {
        document.getElementById('ai-modal').classList.remove('active');
    }

    openStatsModal(total, mastered) {
        document.getElementById('modal-total').textContent = total;
        document.getElementById('modal-mastered').textContent = mastered;
        document.getElementById('stats-modal').classList.add('active');

        // Render Heatmap
        if (window.ActivityHeatmap) {
            const heatmap = new ActivityHeatmap('activity-heatmap');
            heatmap.render();
        }
    }

    closeStatsModal() {
        document.getElementById('stats-modal').classList.remove('active');
    }

    async startStudy(deckId) {
        // Verificar límite de vidas antes de iniciar sesión de estudio
        const allowed = await this._checkUsageLimit();
        if (!allowed) return;

        const deckName = this.currentDeck?.name || document.querySelector('.deck-title')?.textContent || '';
        window.location.href = `flashcards?deckId=${deckId}&deckName=${encodeURIComponent(deckName)}`;
    }

    // --- API Helpers ---

    async fetchDeck(id) {
        const res = await fetch(`${window.AppConfig.API_URL}/api/decks/${id}`, {
            headers: { 'Authorization': `Bearer ${this.token}` },
            cache: 'no-cache'
        });
        const data = await res.json();
        return data.deck;
    }

    async fetchDecks(parentId) {
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
    }

    // AI Generation
    async generateAiCards() {
        const topic = document.getElementById('ai-topic').value;
        if (!topic) return alert('Escribe un tema');

        // Verificar límite de vidas antes de generar con IA
        const allowed = await this._checkUsageLimit();
        if (!allowed) return;

        document.getElementById('ai-loading').style.display = 'block';

        try {
            const res = await fetch(`${window.AppConfig.API_URL}/api/decks/${this.currentDeck.id}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                body: JSON.stringify({ topic, amount: 5 })
            });

            if (res.ok) {
                this.closeAiModal();
                this.loadFolder(this.currentDeck.id);
            } else {
                alert('Error al generar tarjetas');
            }
        } catch (err) {
            console.error(err);
            alert('Error de conexión');
        } finally {
            document.getElementById('ai-loading').style.display = 'none';
        }
    }

    /**
     * Verifica límite de vidas globales llamando al backend.
     * Retorna true si puede proceder, false si está bloqueado.
     */
    async _checkUsageLimit() {
        try {
            const res = await fetch(`${window.AppConfig.API_URL}/api/usage/verify`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await res.json();

            if (res.ok && data.allowed) {
                // Sincronizar estado local
                if (data.plan === 'free' && window.sessionManager) {
                    const user = window.sessionManager.getUser();
                    if (user) {
                        user.usageCount = data.usage;
                        window.sessionManager.notifyStateChange();
                    }
                }
                return true;
            } else if (res.status === 403) {
                // Mostrar paywall
                if (window.uiManager && typeof window.uiManager.showPaywallModal === 'function') {
                    window.uiManager.showPaywallModal();
                } else {
                    alert('Has alcanzado tu límite de acciones gratuitas. Suscríbete para continuar.');
                }
                return false;
            } else {
                console.error('Error verificando acceso:', data);
                return true; // Fail-open: dejar pasar si hay error inesperado
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
        document.getElementById('btn-confirm-delete').onclick = async () => {
            modal.classList.remove('active');
            await this.deleteDeck(deckId);
        };
        document.getElementById('btn-cancel-delete').onclick = () => {
            modal.classList.remove('active');
        };
        modal.classList.add('active');
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
        document.getElementById('btn-confirm-delete').onclick = async () => {
            modal.classList.remove('active');
            await this.deleteCard(cardId);
        };
        document.getElementById('btn-cancel-delete').onclick = () => {
            modal.classList.remove('active');
            // Reset title for next use
            document.querySelector('#delete-confirm-modal h2').textContent = 'Eliminar Mazo';
        };
        modal.classList.add('active');
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
        return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.repasoManager = new RepasoManager();
    window.repasoManager.init();
});
