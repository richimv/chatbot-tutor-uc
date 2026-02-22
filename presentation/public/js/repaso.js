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

    async init() {
        if (!this.token) {
            window.location.href = '/login.html';
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
                    <div class="deck-icon-large" style="width:60px; height:60px; font-size:2rem; background:rgba(59,130,246,0.1); border-radius:16px; display:flex; align-items:center; justify-content:center; border:1px solid rgba(59,130,246,0.2); color: #60a5fa; flex-shrink: 0;">
                        ${deck.icon || '📚'}
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
        container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(220px, 1fr))'; // Smaller cards
        container.style.gap = '1rem';
        container.innerHTML = ''; // Clear previous content

        // --- 1. NEW: Add "Create Deck" Card ---
        const addCard = document.createElement('div');
        addCard.className = 'deck-card';
        addCard.style.padding = '1rem';
        addCard.style.minHeight = '120px';
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
            // Override padding/size for "smaller" look
            card.style.padding = '1.2rem';
            card.style.minHeight = '160px';

            const isSystem = deck.type === 'SYSTEM';
            // Real mastery from backend
            const mastery = deck.mastery_percentage || 0;

            card.innerHTML = `
                <!-- Top Actions: Badge + Edit/Delete -->
                <div style="display:flex; justify-content:space-between; margin-bottom:0.8rem; align-items: flex-start;">
                    <span class="deck-badge ${isSystem ? 'badge-system' : 'badge-user'}" style="font-size:0.7rem; padding:0.2rem 0.6rem;">
                        ${isSystem ? 'AUTOMÁTICO' : 'PERSONAL'} 
                    </span>
                    
                    ${!isSystem ? `
                    <div style="display:flex; gap:0.5rem;">
                        <button onclick="event.stopPropagation(); window.repasoManager.openEditDeckModal('${deck.id}', '${this.escapeHtml(deck.name)}')" 
                            title="Editar Nombre"
                            style="background:transparent; border:none; color:#94a3b8; cursor:pointer; font-size:0.85rem; transition:color 0.2s;">
                            <i class="fas fa-pen"></i>
                        </button>
                        <button onclick="event.stopPropagation(); window.repasoManager.deleteDeck('${deck.id}')" 
                            title="Eliminar Mazo"
                            style="background:transparent; border:none; color:#94a3b8; cursor:pointer; font-size:0.85rem; transition:color 0.2s;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                    ` : ''}
                </div>

                <div class="deck-icon" style="font-size:1.8rem; margin-bottom:0.8rem;">${deck.icon || '📁'}</div>
                
                <h3 class="deck-title" style="font-size:1rem; margin-bottom:0.25rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${this.escapeHtml(deck.name)}">${deck.name}</h3>
                
                <div class="deck-meta" style="margin-bottom:1rem; justify-content:space-between; width:100%; font-size:0.8rem;">
                    <span>${deck.total_cards || 0} tarjetas</span>
                    ${parseInt(deck.due_cards) > 0 ? `<span style="color:#ef4444; font-weight:600;">${deck.due_cards} pendientes</span>` : ''}
                </div>

                <!-- Mastery Progress -->
                <div style="margin-top:auto; width:100%;">
                    <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:#cbd5e1; margin-bottom:4px;">
                        <span>Dominio</span>
                        <span>${mastery}%</span>
                    </div>
                    <div class="progress-bar-bg" style="height:4px; background:rgba(255,255,255,0.05);">
                        <div class="progress-bar-fill" style="width: ${mastery}%; background:#3b82f6;"></div>
                    </div>
                </div>

                <!-- Details Button -->
                <div style="margin-top:1rem; display:grid;">
                    <button style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05); padding:0.5rem; border-radius:8px; color:#94a3b8; cursor:pointer; font-size:0.8rem; font-weight:500;" onclick="event.stopPropagation(); window.repasoManager.loadFolder('${deck.id}')">
                        Ver Detalles
                    </button>
                </div>
            `;

            // Card Click -> Navigate
            card.onclick = (e) => {
                if (e.target.closest('button')) return; // Ignore button clicks
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
            // Premium Row Style
            row.style.cssText = 'display:grid; grid-template-columns: 1fr 1fr 80px; gap:1rem; padding:1rem; border-bottom:1px solid rgba(255,255,255,0.05); align-items:center; transition:background 0.2s;';
            row.onmouseover = () => row.style.background = 'rgba(255,255,255,0.02)';
            row.onmouseout = () => row.style.background = 'transparent';

            row.innerHTML = `
                <div style="color:#cbd5e1; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${this.escapeHtml(c.front_content)}</div>
                <div style="color:#94a3b8; font-size:0.95rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${this.escapeHtml(c.back_content)}</div>
                
                <div style="display:flex; gap:0.5rem; justify-content:flex-end;">
                    <button class="btn-icon-small" title="Editar" style="width:32px; height:32px; border-radius:8px; border:none; background:rgba(255,255,255,0.1); color:#94a3b8; cursor:pointer;" onclick="window.repasoManager.openEditCardModal('${c.id}', '${this.escapeHtml(c.front_content)}', '${this.escapeHtml(c.back_content)}')">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button class="btn-icon-small" title="Eliminar" style="width:32px; height:32px; border-radius:8px; border:none; background:rgba(255,255,255,0.1); color:#94a3b8; cursor:pointer;" onclick="window.repasoManager.deleteCard('${c.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
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

    startStudy(deckId) {
        window.location.href = `flashcards.html?deckId=${deckId}&deckName=${encodeURIComponent(this.currentDeck.name)}`;
    }

    // --- API Helpers ---

    async fetchDeck(id) {
        const res = await fetch(`/api/decks/${id}`, { headers: { 'Authorization': `Bearer ${this.token}` } });
        const data = await res.json();
        return data.deck;
    }

    async fetchDecks(parentId) {
        let url = `/api/decks`;
        if (parentId) url += `?parentId=${parentId}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${this.token}` } });
        const data = await res.json();
        return data.decks || [];
    }

    async fetchCards(deckId) {
        const res = await fetch(`/api/decks/${deckId}/cards`, { headers: { 'Authorization': `Bearer ${this.token}` } });
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
                const res = await fetch(`/api/decks/${deckId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                    body: JSON.stringify({ name })
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
                const res = await fetch('/api/decks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                    body: JSON.stringify({ name, parentId })
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

    openEditDeckModal(id, currentName) {
        document.getElementById('create-deck-form').reset();
        document.getElementById('modal-deck-title').innerText = 'Editar Mazo';
        document.getElementById('new-deck-name').value = currentName;
        document.getElementById('new-deck-id').value = id;
        // document.getElementById('new-deck-parent-group').style.display = 'none'; // Removed: Element no longer exists
        document.getElementById('create-deck-modal').classList.add('active');
    }

    // Create/Edit Card (Consolidated)
    async handleSaveCard(e) {
        e.preventDefault();
        const deckId = document.getElementById('card-deck-id').value;
        const cardId = document.getElementById('card-id').value; // Check if editing
        const front = document.getElementById('card-front').value;
        const back = document.getElementById('card-back').value;

        try {
            let res;
            if (cardId) {
                // UPDATE: PUT /api/cards/:id
                res = await fetch(`/api/cards/${cardId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                    body: JSON.stringify({ front, back })
                });
            } else {
                // CREATE: POST /api/decks/:deckId/cards
                res = await fetch(`/api/decks/${deckId}/cards`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                    body: JSON.stringify({ front, back })
                });
            }

            if (res.ok) {
                this.closeCardModal();
                this.loadFolder(deckId); // Reload to update list
            } else {
                alert('Error al guardar tarjeta');
            }
        } catch (err) {
            console.error(err);
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

        document.getElementById('ai-loading').style.display = 'block';

        try {
            const res = await fetch('/api/ai/generate-flashcards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                body: JSON.stringify({ deckId: this.currentDeck.id, topic, amount: 5 })
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

    async deleteCard(cardId) {
        if (!confirm('¿Eliminar tarjeta?')) return;
        try {
            // DELETE /api/cards/:id
            const res = await fetch(`/api/cards/${cardId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${this.token}` } });
            if (res.ok) {
                this.loadFolder(this.currentDeck.id);
            } else {
                alert('No se pudo eliminar');
            }
        } catch (e) { console.error(e); }
    }

    async deleteDeck(deckId) {
        if (!confirm('¿Estás seguro de eliminar este mazo y todo su contenido?')) return;

        try {
            // DELETE /api/decks/:id
            const res = await fetch(`/api/decks/${deckId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${this.token}` } });

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

    escapeHtml(text) {
        if (!text) return '';
        return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.repasoManager = new RepasoManager();
    window.repasoManager.init();
});
