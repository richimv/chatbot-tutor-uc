/**
 * DeckExplorer
 * Handles the sidebar tree navigation and recursive structure.
 */
class DeckExplorer {
    constructor(manager) {
        this.manager = manager; // Reference to RepasoManager
        this.treeContainer = document.getElementById('deck-tree');
        this.expandedNodes = new Set(); // Store open folder IDs
        this.activeNodeId = null; // Current selection
        this.api = `${window.AppConfig.API_URL}/api/decks`;
        this.token = localStorage.getItem('authToken');
    }

    async init() {
        await this.loadTree();
    }

    async loadTree() {
        try {
            // We need a way to get the FULL tree or at least flat list to build it.
            // Current /api/decks returns filtered list.
            // Strategy: Fetch ALL roots, then lazily fetch children?
            // BETTER: Fetch ALL decks flat list and build tree client-side for "Explorer" feel (if not huge).
            // Let's assume /api/decks without parentId returns ROOTS. 
            // We might need to adjust API to return ALL or handle recursion.
            // For now, let's stick to "Fetch Roots + Fetch Context Children".
            // Actually, for a tree, we need to know if a node has children.
            // The `children_count` property helps.

            // Fetch Roots first
            await this.renderRootLevel();

        } catch (e) {
            console.error(e);
            this.treeContainer.innerHTML = '<div style="color:var(--accent-warning)">Error cargando árbol</div>';
        }
    }

    async fetchDecks(parentId = null) {
        let url = this.api;
        if (parentId) url += `?parentId=${parentId}`;
        // else url += `?parentId=ROOT`; // REMOVED: Backend expects null/undefined for Root 
        // Wait, backend logic: if parentId provided -> filter eq parentId. 
        // If NOT provided -> filter IS NULL (Root).
        // So default call is OK for root.

        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${this.token}` } });
        const data = await res.json();
        return data.decks || [];
    }

    async renderRootLevel() {
        this.treeContainer.innerHTML = '';

        // 1. "Inicio" / All
        const rootItem = this.createTreeItem({ id: 'ROOT', name: 'Inicio', icon: 'fas fa-home', children_count: 0 }, 0, true);
        this.treeContainer.appendChild(rootItem);

        // 2. Fetch API Roots
        const decks = await this.fetchDecks(null);

        // Render System Decks first
        const systems = decks.filter(d => d.type === 'SYSTEM');
        const users = decks.filter(d => d.type !== 'SYSTEM');

        // Render standard nodes
        [...systems, ...users].forEach(deck => {
            const el = this.createTreeItem(deck, 0);
            this.treeContainer.appendChild(el);
        });
    }

    createTreeItem(deck, level, isRootLink = false) {
        const hasChildren = parseInt(deck.children_count || 0) > 0;
        const container = document.createElement('div');
        container.className = 'tree-node';
        container.dataset.id = deck.id;
        container.dataset.level = level; // Store level for child reference

        // Indentation
        const paddingLeft = level * 1.5;

        // Content
        const content = document.createElement('div');
        content.className = `tree-content ${this.activeNodeId === deck.id ? 'active' : ''}`;
        content.style.paddingLeft = `${paddingLeft}rem`;

        // Toggle Icon
        const toggle = document.createElement('span');
        toggle.className = 'tree-toggle';
        toggle.innerHTML = hasChildren ? '<i class="fas fa-chevron-right"></i>' : '<span style="width:12px; display:inline-block"></span>';

        if (hasChildren && !isRootLink) {
            toggle.onclick = (e) => {
                e.stopPropagation();
                this.toggleNode(deck.id, container);
            };
        }

        // Icon + Name
        const label = document.createElement('span');
        label.className = 'tree-label';
        const displayIcon = RepasoManager.renderColoredIcon(deck.icon, 'fas fa-folder');
        label.innerHTML = `<span style="margin-right:8px; width:20px; text-align:center; display:inline-block;">${displayIcon}</span> <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${deck.name}</span>`;

        // Click Action -> Set Active & Load View
        content.onclick = () => {
            this.setActive(deck.id);
            if (isRootLink) this.manager.loadDashboard();
            else this.manager.loadFolder(deck.id);
        };

        // Quick Add Button (Hover)
        const addBtn = document.createElement('button');
        addBtn.className = 'tree-add-btn';
        addBtn.innerHTML = '<i class="fas fa-plus"></i>';
        addBtn.title = 'Crear Sub-mazo';
        addBtn.onclick = (e) => {
            e.stopPropagation();
            DeckExplorer.openCreateModal(deck.id);
        };

        content.appendChild(toggle);
        content.appendChild(label);
        if (!isRootLink && deck.type !== 'SYSTEM') content.appendChild(addBtn);

        container.appendChild(content);

        // Children Container (Hidden by default)
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'tree-children';
        childrenContainer.style.display = 'none';
        childrenContainer.id = `children-${deck.id}`;
        container.appendChild(childrenContainer);

        return container;
    }

    async toggleNode(deckId, nodeElement) {
        if (!nodeElement) return; // Prevention
        const childrenDiv = nodeElement.querySelector('.tree-children');
        const toggleIcon = nodeElement.querySelector('.tree-toggle i');

        if (this.expandedNodes.has(deckId)) {
            // Collapse
            childrenDiv.style.display = 'none';
            if (toggleIcon) toggleIcon.className = 'fas fa-chevron-right';
            this.expandedNodes.delete(deckId);
        } else {
            // Expand — show container FIRST so spinner is visible
            childrenDiv.style.display = 'block';
            if (toggleIcon) toggleIcon.className = 'fas fa-chevron-down';

            if (!childrenDiv.hasChildNodes()) {
                // Lazy Load with Visual Feedback
                const currentLevel = parseInt(nodeElement.dataset.level || 0);
                const loadingIndicator = document.createElement('div');
                loadingIndicator.style.cssText = `padding: 0.5rem 1.5rem; padding-left: ${(currentLevel + 1) * 1.5 + 1.5}rem; color: #64748b; font-size: 0.85rem; display: flex; align-items: center; gap: 0.5rem;`;
                loadingIndicator.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Cargando...';
                childrenDiv.appendChild(loadingIndicator);

                try {
                    const kids = await this.fetchDecks(deckId);
                    childrenDiv.innerHTML = ''; // Clear loading

                    if (kids.length === 0) {
                        const emptyState = document.createElement('div');
                        emptyState.style.cssText = `padding: 0.5rem 1.5rem; padding-left: ${(currentLevel + 1) * 1.5 + 1.5}rem; color: #475569; font-size: 0.85rem; font-style: italic;`;
                        emptyState.innerHTML = 'Sin sub-mazos';
                        childrenDiv.appendChild(emptyState);
                    } else {
                        kids.forEach(k => {
                            const childNode = this.createTreeItem(k, currentLevel + 1);
                            childrenDiv.appendChild(childNode);
                        });
                    }
                } catch (err) {
                    childrenDiv.innerHTML = `<div style="padding: 0.5rem 1.5rem; padding-left: ${(currentLevel + 1) * 1.5 + 1.5}rem; color: #ef4444; font-size: 0.85rem;">Error al cargar</div>`;
                }
            }
            this.expandedNodes.add(deckId);
        }
    }

    setActive(id) {
        // UI Update
        if (this.activeNodeId) {
            const prev = document.querySelector(`.tree-node[data-id="${this.activeNodeId}"] > .tree-content`);
            if (prev) prev.classList.remove('active');
        }

        this.activeNodeId = id;
        const curr = document.querySelector(`.tree-node[data-id="${id}"] > .tree-content`);
        if (curr) curr.classList.add('active');
    }

    // --- Modals ---
    static ICON_OPTIONS = [
        { fa: 'fas fa-layer-group', color: '#60a5fa', label: 'Capas' },
        { fa: 'fas fa-folder', color: '#fbbf24', label: 'Carpeta' },
        { fa: 'fas fa-book-open', color: '#2dd4bf', label: 'Libro' },
        { fa: 'fas fa-brain', color: '#f472b6', label: 'Cerebro' },
        { fa: 'fas fa-stethoscope', color: '#22d3ee', label: 'Medicina' },
        { fa: 'fas fa-comments', color: '#a78bfa', label: 'Idiomas' },
        { fa: 'fas fa-lightbulb', color: '#fbbf24', label: 'Idea' },
        { fa: 'fas fa-graduation-cap', color: '#818cf8', label: 'Estudio' },
        { fa: 'fas fa-microscope', color: '#c084fc', label: 'Ciencia' },
        { fa: 'fas fa-pills', color: '#f87171', label: 'Farmacia' },
        { fa: 'fas fa-heartbeat', color: '#f87171', label: 'Cardio' },
        { fa: 'fas fa-dna', color: '#34d399', label: 'Genética' },
        { fa: 'fas fa-star', color: '#fbbf24', label: 'Favorito' },
        { fa: 'fas fa-pen-alt', color: '#fb923c', label: 'Escritura' },
    ];

    static renderIconPicker(selectedIcon = 'fas fa-layer-group') {
        const iconInput = document.getElementById('new-deck-icon');
        const grid = document.getElementById('icon-picker-grid');
        if (!grid || !iconInput) return;

        iconInput.value = selectedIcon;
        grid.innerHTML = '';

        DeckExplorer.ICON_OPTIONS.forEach(opt => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.title = opt.label;
            btn.dataset.icon = opt.fa;
            const isSelected = opt.fa === iconInput.value;
            btn.style.cssText = `width:40px; height:40px; border-radius:10px; border:2px solid ${isSelected ? opt.color : 'rgba(255,255,255,0.1)'}; background:${isSelected ? opt.color + '22' : 'rgba(255,255,255,0.05)'}; color:${opt.color}; font-size:1.1rem; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.2s;`;
            btn.innerHTML = `<i class="${opt.fa}"></i>`;

            btn.onclick = () => {
                iconInput.value = opt.fa;
                // Update selection visuals
                grid.querySelectorAll('button').forEach(b => {
                    const bOpt = DeckExplorer.ICON_OPTIONS.find(o => o.fa === b.dataset.icon);
                    const sel = b.dataset.icon === opt.fa;
                    b.style.borderColor = sel ? bOpt.color : 'rgba(255,255,255,0.1)';
                    b.style.background = sel ? bOpt.color + '22' : 'rgba(255,255,255,0.05)';
                });
            };
            grid.appendChild(btn);
        });
    }

    static openCreateModal(parentId = null) {
        document.getElementById('create-deck-form').reset();
        document.getElementById('new-deck-id').value = '';
        document.getElementById('modal-deck-title').innerText = 'Crear Nuevo Mazo';
        document.getElementById('new-deck-parent').value = parentId || '';
        document.getElementById('new-deck-name').value = '';
        const submitBtn = document.getElementById('btn-save-deck');
        if (submitBtn) submitBtn.innerText = 'Crear';

        // Populate Icon Picker
        DeckExplorer.renderIconPicker('fas fa-layer-group');

        document.getElementById('create-deck-modal').classList.add('active');
    }

    static closeCreateModal() {
        document.getElementById('create-deck-modal').classList.remove('active');
    }
}

// Global Export for onclicks
window.DeckExplorer = DeckExplorer;
