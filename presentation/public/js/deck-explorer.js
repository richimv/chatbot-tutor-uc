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
        this.api = '/api/decks';
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
        const rootItem = this.createTreeItem({ id: 'ROOT', name: 'Inicio', icon: '🏠', children_count: 0 }, 0, true);
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
        label.innerHTML = `<span style="margin-right:8px">${deck.icon || '📁'}</span> ${deck.name}`;

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
            this.openCreateModal(deck.id);
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
            // Expand
            if (!childrenDiv.hasChildNodes()) {
                // Lazy Load
                const kids = await this.fetchDecks(deckId);
                kids.forEach(k => {
                    // Level + 1? We need to pass level. 
                    // Hack: Calculate level from padding style? No. 
                    // Better: Pass level in toggle?
                    // Simplified: Just render children with simple padding relative to parent container?
                    // CSS handles level via recursive nesting padding?
                    // Let's pass level explicitly.
                    // To do this, createTreeItem must be robust or we re-fetch DOM.
                    // Easier: Just append. CSS padding is tricky recursively if not passed.

                    // Fix: Let's assume infinite nesting supported by recursive CSS or margin-left on container.
                    // Used: padding-left on content relative to root? 
                    // Actually, if we nest `div.tree-children` inside correct parent, we can just use `padding-left: 1.5rem` on the children container?
                    // Yes, hierarchical HTML structure.

                    const childNode = this.createTreeItem(k, 0); // Level 0 because padding is handled by CSS hierarchy?
                    // Let's verify CSS strategy.
                    // If we nest, we can use `.tree-children { padding-left: 1rem }`.
                    childrenDiv.appendChild(childNode);
                });
            }
            childrenDiv.style.display = 'block';
            if (toggleIcon) toggleIcon.className = 'fas fa-chevron-down';
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
    static openCreateModal(parentId = null) {
        document.getElementById('create-deck-form').reset();
        document.getElementById('new-deck-id').value = ''; // Ensure we are NOT editing
        document.getElementById('modal-deck-title').innerText = 'Crear Nuevo Mazo';

        document.getElementById('new-deck-parent').value = parentId || '';
        document.getElementById('new-deck-name').value = '';
        document.getElementById('create-deck-modal').classList.add('active');
    }

    static closeCreateModal() {
        document.getElementById('create-deck-modal').classList.remove('active');
    }
}

// Global Export for onclicks
window.DeckExplorer = DeckExplorer;
