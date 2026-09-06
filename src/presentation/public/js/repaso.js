/**
 * RepasoManager (Premium UI Edition)
 * Orchestrates the Right Content Panel based on Sidebar Selection.
 */
class RepasoManager {
    constructor() {
        this.currentCards = [];
        this._isCreatingDeck = false;
        this.currentCardMode = 'individual'; // 'individual' o 'bulk'
        this._pendingFiles = { front: null, back: null };
        this._pendingBulkCards = [];

        // ✅ NUEVO: Caché para optimizar navegación
        this._cache = {
            decks: {}, // { parentId: [decks] }
            folderData: {}, // { deckId: { deck, children, cards } }
            cards: {}
        };

        this.explorer = new DeckExplorer(this);

        this.handlePopState = this.handlePopState.bind(this);
        window.addEventListener('popstate', this.handlePopState);

        this.subDecksCollapsed = localStorage.getItem('subDecksCollapsed') === 'true';

        // ✅ NUEVO: Prevención de peticiones duplicadas (Shared Promises)
        this._sharedRequests = {
            decks: {} // { parentId: Promise }
        };

        // ✅ NUEVO: Pestaña activa por defecto
        this.activeTab = localStorage.getItem('repaso_active_tab') || 'official';
    }

    // --- Auth Helpers ---
    get token() {
        return localStorage.getItem('authToken');
    }

    get userTier() {
        const user = window.sessionManager?.getUser();
        return (user?.subscriptionTier || user?.subscription_tier || 'free').toLowerCase();
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
     * Renders icon inheriting color for clean, unsaturated sidebar hierarchy.
     */
    static renderWhiteIcon(icon, fallbackFA = 'fas fa-folder') {
        const resolved = RepasoManager._resolveIcon(icon, fallbackFA);
        if (resolved.html) return `<span style="color:inherit;">${resolved.html}</span>`;
        return `<i class="${resolved.faClass || fallbackFA}" style="color:inherit;"></i>`;
    }

    /**
     * Returns both the FA class and a vibrant color for the icon.
     */
    static _resolveIcon(icon, fallbackFA = 'fas fa-folder') {
        // Default fallback
        if (!icon) return { faClass: fallbackFA, color: '#60a5fa' };
        const iconValue = String(icon).trim();
        // FontAwesome class string limitada a clases conocidas; nunca se acepta HTML persistido.
        if (/^(?:fas|far|fab|fal|fad|fa-solid|fa-regular)(?:\s+fa-[a-z0-9-]+)+$/i.test(iconValue)) {
            return { faClass: iconValue, color: RepasoManager._iconColor(iconValue) };
        }

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
        if (emojiMap[iconValue]) {
            return { faClass: emojiMap[iconValue].fa, color: emojiMap[iconValue].color };
        }
        // Símbolos desconocidos se muestran únicamente como texto neutralizado.
        return { faClass: null, html: window.escapeHtml(iconValue), color: '#94a3b8' };
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

    static renderDeckIconHtml(deck, fallbackFA = 'fas fa-folder') {
        const resolved = RepasoManager._resolveIcon(deck.icon, fallbackFA);
        const finalColor = resolved.color;
        if (resolved.html) return `<span style="color:${finalColor}">${resolved.html}</span>`;
        return `<i class="${resolved.faClass}" style="color:${finalColor}"></i>`;
    }


    async init() {
        if (window.sessionManager) {
            try {
                await window.sessionManager.initialize();
            } catch (_) {}
        }

        // Init Components
        await this.explorer.init();

        // Load Default View or Deep Link (Contextual por estado de sesión)
        const urlParams = new URLSearchParams(window.location.search);
        const deckId = urlParams.get('deckId');
        const viewParam = urlParams.get('view');
        const categoryParam = urlParams.get('category');
        const isGuest = !this.token;

        if (deckId) {
            this.loadFolder(deckId, false); // Deep link
        } else if (viewParam === 'community' || categoryParam) {
            this.loadCommunity(false, categoryParam);
        } else if (viewParam === 'dashboard') {
            this.loadDashboard(false);
        } else {
            // Visitante sin sesión -> Comunidad primero para explorar mazos públicos.
            // Usuario autenticado -> Mis Mazos por defecto (o su última vista guardada).
            if (isGuest) {
                this.loadCommunity(false, categoryParam);
            } else {
                const savedView = localStorage.getItem('repaso_active_view');
                if (savedView === 'community') {
                    this.loadCommunity(false, categoryParam);
                } else {
                    this.loadDashboard(false);
                }
            }
        }

        // --- NUEVO: Sincronización de Sesión Reactiva ---
        if (window.sessionManager) {
            window.sessionManager.onStateChange(() => {
                this.updateGuestBanner();
                // Si la vista actual es el Dashboard, lo refrescamos para mostrar/ocultar botones de creación
                if (!this.currentDeck) {
                    this.renderRootDecks();
                } else {
                    this.loadFolder(this.currentDeck.id, false);
                }
            });
        }

        // --- Banner de Invitado ---
        this.updateGuestBanner();

        document.getElementById('loading').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';

        this.bindEvents();

        // Sugerir guía interactiva para usuarios nuevos
        setTimeout(() => {
            if (window.tooltipManager && !localStorage.getItem('hasSeenRepasoTour_v1')) {
                window.tooltipManager.startRepasoTour(false);
            }
        }, 800);
    }

    /**
     * ✅ SHARED FETCH: Evita que Sidebar y Dashboard pidan lo mismo a la vez.
     */
    async fetchDecksShared(parentId = null) {
        const key = parentId || 'ROOT';
        if (this._sharedRequests.decks[key]) {
            return this._sharedRequests.decks[key];
        }

        const promise = (async () => {
            try {
                const url = parentId ? `${window.AppConfig.API_URL}/api/decks?parentId=${parentId}` : `${window.AppConfig.API_URL}/api/decks`;

                const res = await window.NetworkService.fetch(url);
                const data = await res.json();
                return data.decks || [];
            } finally {
                // Limpiar inmediatamente la promesa en curso al completarse para evitar retención de datos desfasados
                delete this._sharedRequests.decks[key];
            }
        })();

        this._sharedRequests.decks[key] = promise;
        return promise;
    }

    bindEvents() {
        document.getElementById('create-deck-form').addEventListener('submit', (e) => {
            if (!localStorage.getItem('authToken') && window.uiManager) {
                e.preventDefault();
                window.uiManager.showAuthPromptModal();
                return;
            }
            this.handleCreateDeck(e);
        });
        document.getElementById('card-form').addEventListener('submit', (e) => this.handleSaveCard(e));

        // Force refresh when returning from flashcard study via browser back button
        window.addEventListener('pageshow', async (event) => {
            // event.persisted is true if coming from BFCache
            if (event.persisted && this.currentDeck) {
                console.log('🔄 [RepasoManager] Volviendo del estudio (BFCache). Aplicando delay resiliente de red...');
                
                // 1. Limpiar caché local para forzar actualización de progreso (dominadas/pendientes)
                this.invalidateCache(this.currentDeck.id);

                // 2. NETWORK WAKE-UP DELAY (Crítico para iOS/Android)
                // Damos 400ms a la antena del móvil para reconectar antes de pedir red
                await new Promise(resolve => setTimeout(resolve, 400));
                
                this.loadFolder(this.currentDeck.id, false);
            }
        });

        // Sincronizar selectores de idioma dinámicos según el estado del checkbox
        const ttsFront = document.getElementById('card-tts-front');
        const ttsBack = document.getElementById('card-tts-back');
        const bulkTtsFront = document.getElementById('bulk-tts-front');
        const bulkTtsBack = document.getElementById('bulk-tts-back');

        if (ttsFront) ttsFront.addEventListener('change', () => this.syncTtsLanguageSelectors());
        if (ttsBack) ttsBack.addEventListener('change', () => this.syncTtsLanguageSelectors());
        if (bulkTtsFront) bulkTtsFront.addEventListener('change', () => this.syncTtsLanguageSelectors());
        if (bulkTtsBack) bulkTtsBack.addEventListener('change', () => this.syncTtsLanguageSelectors());
    }

    syncTtsLanguageSelectors() {
        const isAdvanced = ['advanced', 'admin'].includes(this.userTier);

        const ttsFront = document.getElementById('card-tts-front');
        const langFront = document.getElementById('card-tts-lang-front');
        if (ttsFront && langFront) {
            if (ttsFront.checked && !isAdvanced) {
                ttsFront.checked = false;
                if (window.uiManager?.showPaywallModal) {
                    window.uiManager.showPaywallModal('La generación de audio TTS es exclusiva del Plan Avanzado. ¡Mejora tu plan para activarla!', 'flashcards');
                } else {
                    window.uiManager.showToast('⚠️ Audio TTS es exclusivo del Plan Avanzado.', 'warning');
                }
            }
            const container = langFront.closest('.settings-lang-select-container');
            if (ttsFront.checked) {
                langFront.disabled = false;
                if (container) container.classList.add('enabled');
            } else {
                langFront.disabled = true;
                if (container) container.classList.remove('enabled');
            }
        }

        const ttsBack = document.getElementById('card-tts-back');
        const langBack = document.getElementById('card-tts-lang-back');
        if (ttsBack && langBack) {
            if (ttsBack.checked && !isAdvanced) {
                ttsBack.checked = false;
                if (window.uiManager?.showPaywallModal) {
                    window.uiManager.showPaywallModal('La generación de audio TTS es exclusiva del Plan Avanzado. ¡Mejora tu plan para activarla!', 'flashcards');
                } else {
                    window.uiManager.showToast('⚠️ Audio TTS es exclusivo del Plan Avanzado.', 'warning');
                }
            }
            const container = langBack.closest('.settings-lang-select-container');
            if (ttsBack.checked) {
                langBack.disabled = false;
                if (container) container.classList.add('enabled');
            } else {
                langBack.disabled = true;
                if (container) container.classList.remove('enabled');
            }
        }

        const bulkTtsFront = document.getElementById('bulk-tts-front');
        if (bulkTtsFront && bulkTtsFront.checked && !isAdvanced) {
            bulkTtsFront.checked = false;
            if (window.uiManager?.showPaywallModal) {
                window.uiManager.showPaywallModal('La generación de audio TTS en carga masiva es exclusiva del Plan Avanzado. ¡Mejora tu plan para activarla!', 'flashcards');
            }
        }

        const bulkTtsBack = document.getElementById('bulk-tts-back');
        if (bulkTtsBack && bulkTtsBack.checked && !isAdvanced) {
            bulkTtsBack.checked = false;
            if (window.uiManager?.showPaywallModal) {
                window.uiManager.showPaywallModal('La generación de audio TTS en carga masiva es exclusiva del Plan Avanzado. ¡Mejora tu plan para activarla!', 'flashcards');
            }
        }
    }

    // --- Views ---

    loadDashboard(pushState = true) {
        document.getElementById('dashboard-view').style.display = 'block';
        document.getElementById('folder-view').style.display = 'none';
        const commView = document.getElementById('community-view');
        if (commView) commView.style.display = 'none';
        this.currentDeck = null;
        this.activeTab = 'mis-mazos';
        this.explorer.setActive('ROOT');
        localStorage.setItem('repaso_active_view', 'dashboard');

        // Sync URL: If we go to Dashboard, clear deckId
        if (pushState && window.history.pushState) {
            const url = new URL(window.location.href);
            url.searchParams.set('view', 'dashboard');
            url.searchParams.delete('deckId');
            window.history.pushState({ view: 'dashboard' }, 'Centro de Repaso', url.toString());
        }

        this.renderRootDecks();

        if (!localStorage.getItem('authToken')) {
            this.renderGuestBanner();
        }
    }

    async loadFolder(deckId, pushState = true) {
        document.getElementById('dashboard-view').style.display = 'none';
        document.getElementById('folder-view').style.display = 'block';
        const commView = document.getElementById('community-view');
        if (commView) commView.style.display = 'none';
        this.activeTab = 'folder';
        this.explorer.setActive(deckId);
        localStorage.setItem('repaso_active_view', 'folder');

        // --- 1. INTENTAR CARGAR DESDE CACHÉ (INSTANTÁNEO) ---
        if (this._cache.folderData[deckId]) {
            const cached = this._cache.folderData[deckId];
            this.currentDeck = cached.deck;
            this.currentCards = cached.cards;
            this.renderDeckHeader(cached.deck, cached.cards);
            this.renderSubDecks(cached.children);
            this.renderCards(cached.cards);
        }

        // Show loading state SOLO si no hay caché y NO estamos viendo ya este mazo
        const container = document.getElementById('folder-header');
        const isCurrentlyViewing = this.currentDeck && String(this.currentDeck.id) === String(deckId);

        if (container && !this._cache.folderData[deckId] && !isCurrentlyViewing) {
            container.innerHTML = '<div style="text-align:center; padding:2rem;"><i class="fas fa-circle-notch fa-spin fa-2x"></i></div>';
        }

        try {
            const previousDeck = this.currentDeck;

            // 🚀 OPTIMIZACIÓN: Usar Shared Fetch para evitar colisiones con el Explorer
            const [deck, children, cards] = await Promise.all([
                this.getDeckById(deckId),
                this.fetchDecksShared(deckId),
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

            // --- 2. ACTUALIZAR CACHÉ ---
            this._cache.folderData[deckId] = { deck, children, cards };

            // --- SMART HISTORY NAVIGATION ---
            if (pushState && window.history.pushState) {
                const url = new URL(window.location.href);
                url.searchParams.set('deckId', deckId);
                let navigationType = 'push';
                if (previousDeck) {
                    if (String(deck.parent_id) === String(previousDeck.parent_id)) {
                        navigationType = 'replace';
                    } else if (String(deck.id) === String(previousDeck.parent_id)) {
                        navigationType = 'replace';
                    }
                }
                if (navigationType === 'replace') {
                    window.history.replaceState({ view: 'folder', deckId }, `Mazo ${deck.name}`, url.toString());
                } else {
                    window.history.pushState({ view: 'folder', deckId }, `Mazo ${deck.name}`, url.toString());
                }
            }

            this.currentDeck = deck;
            this.currentCards = cards || [];
            this.renderDeckHeader(deck, cards);
            this.renderSubDecks(children);
            this.renderCards(this.currentCards);

        } catch (e) {
            console.error('Error in loadFolder:', e);
            if (!this._cache.folderData[deckId]) this.loadDashboard();
        }
    }

    invalidateCache(deckId = null) {
        // Clear all memory caches and shared request pools to guarantee real-time updates on any CRUD operation
        this._cache = { decks: {}, folderData: {}, cards: {} };
        this._sharedRequests.decks = {};
    }

    /**
     * Helper to refresh the current view (Dashboard or Folder)
     */
    async refreshView() {
        if (this.currentDeck) {
            await this.loadFolder(this.currentDeck.id);
        } else {
            this.loadDashboard();
        }
    }

    loadCommunity(pushState = true, category = null) {
        document.getElementById('dashboard-view').style.display = 'none';
        document.getElementById('folder-view').style.display = 'none';
        const commView = document.getElementById('community-view');
        if (commView) commView.style.display = 'block';

        this.currentDeck = null;
        this.activeTab = 'comunidad';
        this.explorer.setActive('COMMUNITY');
        localStorage.setItem('repaso_active_view', 'community');

        const targetCat = category || this.currentCommunityCategory || localStorage.getItem('repaso_community_category') || 'ALL';

        if (pushState && window.history.pushState) {
            const url = new URL(window.location.href);
            url.searchParams.set('view', 'community');
            url.searchParams.delete('deckId');
            if (targetCat && targetCat !== 'ALL') {
                url.searchParams.set('category', targetCat);
            } else {
                url.searchParams.delete('category');
            }
            window.history.pushState({ view: 'community', category: targetCat }, 'Comunidad', url.toString());
        }

        this.renderCommunityDecks(1, targetCat);
    }

    // --- Renderers ---

    async renderRootDecks() {
        const container = document.getElementById('dashboard-view');
        if (!container) return;

        const existingGrid = document.getElementById('root-decks-grid');
        const hasLoadedDecks = existingGrid && existingGrid.children.length > 0 && !existingGrid.querySelector('.deck-skeleton-card');

        // Solo inyectar esqueletos si es la primera carga y no hay tarjetas renderizadas
        if (!hasLoadedDecks) {
            container.innerHTML = `
                <div class="repaso-dashboard-header">
                    <div class="repaso-header-top-row">
                        <h2 class="repaso-header-title">Centro de Repaso</h2>
                        <button id="btn-repaso-guide" class="btn-guide-hero" data-tooltip="Ver guía rápida de repaso" aria-label="Guía rápida">
                            <i class="fas fa-circle-question"></i>
                            <span>Guía</span>
                        </button>
                    </div>
                    <p class="repaso-header-subtitle">Gestiona y repasa tus mazos personales de flashcards con repetición espaciada.</p>
                </div>
                <div id="root-decks-grid" class="decks-grid">
                    <div class="deck-skeleton-card"></div>
                    <div class="deck-skeleton-card"></div>
                    <div class="deck-skeleton-card"></div>
                </div>
            `;

            const btnGuide = container.querySelector('#btn-repaso-guide');
            if (btnGuide) {
                btnGuide.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (window.tooltipManager) {
                        window.tooltipManager.startRepasoTour(true);
                    }
                };
            }
        }

        if (!this.token) {
            this.renderGuestMisMazosBanner();
            return;
        }

        try {
            const decks = await this.fetchDecksShared(null);
            const grid = document.getElementById('root-decks-grid');
            if (grid) {
                grid.innerHTML = '';
                
                // Solo mostrar mazos personales
                const filteredDecks = decks.filter(d => d.type !== 'SYSTEM');
                
                this.renderDeckCards(filteredDecks, grid, null);
            }
        } catch (e) {
            console.error('[renderRootDecks] Error:', e);
            const grid = document.getElementById('root-decks-grid');
            if (grid) grid.innerHTML = '<p style="color:var(--accent-warning)">Error al cargar mazos</p>';
        }
    }

    renderGuestMisMazosBanner() {
        const grid = document.getElementById('root-decks-grid');
        if (!grid) return;

        grid.innerHTML = `
            <div style="grid-column: 1 / -1; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 24px; padding: 2.5rem 2rem; text-align: center; max-width: 680px; margin: 1rem auto; box-shadow: var(--shadow-md); position: relative; overflow: hidden;">
                <div style="position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #f97316, #fbbf24);"></div>
                <div style="width: 64px; height: 64px; background: rgba(249, 115, 22, 0.12); border: 1px solid rgba(249, 115, 22, 0.3); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem auto; color: #f97316; font-size: 1.8rem; box-shadow: 0 4px 15px rgba(249, 115, 22, 0.2);">
                    <i class="fas fa-folder-plus"></i>
                </div>
                <h3 style="font-size: 1.4rem; font-weight: 800; color: var(--text-main); margin-bottom: 0.75rem;">¡Crea y Personaliza tus Propios Mazos!</h3>
                <p style="color: var(--text-secondary); font-size: 0.95rem; line-height: 1.6; margin-bottom: 1.5rem; max-width: 540px; margin-left: auto; margin-right: auto;">
                    Únete a Hub Academia para organizar tus temas de estudio, crear carpetas de repaso, crear tus tarjetas y comenzar a estudiar con la ayuda de un tutor inteligente.
                </p>
                <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                    <button class="btn-premium btn-premium-primary" style="padding: 0.75rem 1.75rem; font-size: 0.95rem; font-weight: 700; display: inline-flex; align-items: center; gap: 0.6rem; background: linear-gradient(135deg, #f97316, #ea580c); border: none; border-radius: 12px; color: #ffffff !important; cursor: pointer; box-shadow: 0 6px 20px rgba(249, 115, 22, 0.35);" onclick="window.uiManager.showAuthPromptModal()">
                        <i class="fas fa-user-plus"></i> Crear Cuenta Gratis
                    </button>
                    <button class="btn-premium btn-premium-secondary" style="padding: 0.75rem 1.5rem; font-size: 0.95rem; font-weight: 600; display: inline-flex; align-items: center; gap: 0.6rem; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 12px; color: var(--text-main) !important; cursor: pointer;" onclick="window.repasoManager.loadCommunity()">
                        <i class="fas fa-globe"></i> Explorar Comunidad
                    </button>
                </div>
            </div>
        `;
    }


    async renderCommunityDecks(page = 1, category = null) {
        if (category !== null && category !== undefined) {
            this.currentCommunityCategory = category;
        } else if (!this.currentCommunityCategory) {
            this.currentCommunityCategory = localStorage.getItem('repaso_community_category') || 'ALL';
        }

        if (this.currentCommunityCategory) {
            localStorage.setItem('repaso_community_category', this.currentCommunityCategory);
            if (window.history && window.history.replaceState) {
                const url = new URL(window.location.href);
                url.searchParams.set('view', 'community');
                if (this.currentCommunityCategory !== 'ALL') {
                    url.searchParams.set('category', this.currentCommunityCategory);
                } else {
                    url.searchParams.delete('category');
                }
                window.history.replaceState({ view: 'community', category: this.currentCommunityCategory }, '', url.toString());
            }
        }
        const container = document.getElementById('community-view');
        if (!container) return;

        const CATEGORIES = [
            { id: 'ALL', name: 'Todas', icon: 'fas fa-border-all' },
            { id: 'Medicina', name: 'Medicina', icon: 'fas fa-user-md' },
            { id: 'Educación', name: 'Educación', icon: 'fas fa-graduation-cap' },
            { id: 'Idiomas', name: 'Idiomas', icon: 'fas fa-language' },
            { id: 'Matemáticas', name: 'Matemáticas', icon: 'fas fa-calculator' },
            { id: 'Historia', name: 'Historia', icon: 'fas fa-landmark' },
            { id: 'Derecho', name: 'Derecho', icon: 'fas fa-balance-scale' },
            { id: 'Ciencia', name: 'Ciencia', icon: 'fas fa-flask' },
            { id: 'Tecnología', name: 'Tecnología', icon: 'fas fa-laptop-code' },
            { id: 'General', name: 'General', icon: 'fas fa-book' }
        ];

        let categoryBar = container.querySelector('.community-category-bar');
        const grid = document.getElementById('community-decks-grid');

        // Si la barra y el grid no existen en el DOM, los creamos
        if (!categoryBar || !grid) {
            const categoryPillsHtml = CATEGORIES.map(cat => `
                <button type="button" class="category-pill ${cat.id === this.currentCommunityCategory ? 'active' : ''}" 
                    data-category="${cat.id}">
                    <i class="${cat.icon}"></i> ${cat.name}
                </button>
            `).join('');

            container.innerHTML = `
                <div class="community-banner">
                    <h1 style="font-size: 1.6rem; font-weight: 800; margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.8rem; color: var(--text-main);">
                        <i class="fas fa-globe" style="color: #f97316;"></i> Comunidad de Repaso
                    </h1>
                    <p style="color: var(--text-secondary); font-size: 0.9rem; line-height: 1.5; margin: 0;">
                        Explora mazos públicos clasificados por áreas temáticas. Clónalos a tu biblioteca personal para estudiarlos cuando quieras.
                    </p>
                </div>

                <!-- Barra de Filtros por Categoría / Temática -->
                <div class="community-category-bar">
                    ${categoryPillsHtml}
                </div>

                <div id="community-decks-grid" class="decks-grid">
                    <div style="text-align:center; padding:2rem; grid-column: 1 / -1;"><i class="fas fa-circle-notch fa-spin fa-2x" style="color:#f97316"></i></div>
                </div>
            `;

            categoryBar = container.querySelector('.community-category-bar');
            this.enableCategoryBarDrag();
        } else {
            // Actualización reactiva sin destruir el DOM ni reiniciar el scroll horizontal
            categoryBar.querySelectorAll('.category-pill').forEach(pill => {
                if (pill.dataset.category === this.currentCommunityCategory) {
                    pill.classList.add('active');
                } else {
                    pill.classList.remove('active');
                }
            });

            if (grid.children.length === 0 || grid.querySelector('.fa-spin')) {
                grid.innerHTML = '<div style="text-align:center; padding:2rem; grid-column: 1 / -1;"><i class="fas fa-circle-notch fa-spin fa-2x" style="color:#f97316"></i></div>';
            }
        }

        // Mantener a la vista la píldora seleccionada con animación suave
        const activePill = categoryBar?.querySelector(`.category-pill[data-category="${this.currentCommunityCategory}"]`);
        if (activePill) {
            activePill.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }

        try {
            const res = await window.NetworkService.fetch(`${window.AppConfig.API_URL}/api/decks/public?page=${page}&limit=20&category=${encodeURIComponent(this.currentCommunityCategory)}`);
            const data = await res.json();

            const grid = document.getElementById('community-decks-grid');
            grid.innerHTML = '';

            if (!data.decks || data.decks.length === 0) {
                grid.innerHTML = '<div style="color:#94a3b8; padding:3rem 2rem; text-align:center; background:rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.08); border-radius:16px; grid-column: 1 / -1;"><i class="fas fa-folder-open" style="font-size:2rem; color:#64748b; margin-bottom:0.75rem; display:block;"></i>No se encontraron mazos públicos en esta categoría.</div>';
                return;
            }

            const fragment = document.createDocumentFragment();

            data.decks.forEach(deck => {
                const card = document.createElement('div');
                card.className = 'deck-card';
                card.style.cursor = 'pointer';

                const iconHtml = RepasoManager.renderColoredIcon(deck.icon, 'fas fa-folder');
                const catObj = CATEGORIES.find(c => c.id === deck.category) || { name: deck.category || 'General', icon: 'fas fa-tag' };

                card.innerHTML = `
                    <!-- Desktop layout -->
                    <div class="deck-card-desktop">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.6rem;">
                            <span class="deck-category-tag"><i class="${catObj.icon}"></i> ${escapeHtml(catObj.name)}</span>
                            <div style="color: #94a3b8; font-size: 0.75rem;"><i class="fas fa-download"></i> ${Math.max(0, Number(deck.saves_count) || 0)}</div>
                        </div>
                        <div style="font-size:1.6rem; margin-bottom:0.4rem;">${iconHtml}</div>
                        <h3 style="font-size:1.05rem; font-weight:700; color:var(--text-main); margin-bottom:0.3rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(deck.name)}">${escapeHtml(deck.name)}</h3>
                        <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.4rem;">
                            ${Math.max(0, Number(deck.total_cards) || 0)} tarjetas
                        </div>
                        <div style="font-size:0.75rem; color:#f97316; font-weight:600; margin-bottom:1rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                            &gt; Por: <span style="color:var(--text-secondary)">${escapeHtml(deck.author_name || 'Estudiante')}</span>
                        </div>
                        <div style="margin-top:auto; width:100%;">
                            <button type="button" class="btn-clone-deck btn-clone-desktop">
                                <i class="fas fa-clone"></i> Clonar Mazo
                            </button>
                        </div>
                    </div>

                    <!-- Mobile layout -->
                    <div class="deck-card-mobile">
                        <div style="font-size:1.3rem; flex-shrink:0;">${iconHtml}</div>
                        <div style="flex:1; min-width:0;">
                            <div style="font-size:0.9rem; font-weight:700; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(deck.name)}</div>
                            <div style="font-size:0.75rem; color:var(--text-muted);">
                                ${Math.max(0, Number(deck.total_cards) || 0)} tarj. • <i class="fas fa-download"></i> ${Math.max(0, Number(deck.saves_count) || 0)}
                            </div>
                        </div>
                        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.4rem; flex-shrink:0;">
                             <button type="button" class="deck-action-btn btn-clone-mobile" style="background:rgba(249, 115, 22, 0.2); color:#ffedd5; border: 1px solid rgba(249, 115, 22, 0.4); width:34px; height:34px; padding:0; display:flex; align-items:center; justify-content:center;" 
                                title="Clonar Mazo">
                                <i class="fas fa-clone"></i>
                            </button>
                            <span class="deck-category-tag"><i class="${catObj.icon}"></i> ${escapeHtml(catObj.name)}</span>
                        </div>
                    </div>
                `;

                // Asignar click a la tarjeta para abrir el modal de previsualización
                card.onclick = () => {
                    this.previewPublicDeck(deck.id, deck.name);
                };

                // Asignar manejadores a los botones de clonar deteniendo la propagación al modal
                const cloneDesktop = card.querySelector('.btn-clone-desktop');
                if (cloneDesktop) {
                    cloneDesktop.onclick = (e) => {
                        e.stopPropagation();
                        this.cloneDeck(deck.id);
                    };
                }

                const cloneMobile = card.querySelector('.btn-clone-mobile');
                if (cloneMobile) {
                    cloneMobile.onclick = (e) => {
                        e.stopPropagation();
                        this.cloneDeck(deck.id);
                    };
                }

                fragment.appendChild(card);
            });

            grid.appendChild(fragment);
        } catch (e) {
            console.error('Error loading community decks:', e);
            document.getElementById('community-decks-grid').innerHTML = '<div style="color:#ef4444; padding:2rem; text-align:center; grid-column: 1 / -1;">Error al cargar la comunidad.</div>';
        }
    }

    enableCategoryBarDrag() {
        const slider = document.querySelector('.community-category-bar');
        if (!slider) return;

        let isDown = false;
        let startX = 0;
        let scrollLeft = 0;
        let isDragging = false;

        // --- 1. Mouse Dragging (PC) ---
        slider.onmousedown = (e) => {
            isDown = true;
            isDragging = false;
            slider.classList.add('dragging');
            startX = e.pageX - slider.offsetLeft;
            scrollLeft = slider.scrollLeft;
        };

        slider.onmouseleave = () => {
            isDown = false;
            slider.classList.remove('dragging');
        };

        slider.onmouseup = () => {
            isDown = false;
            setTimeout(() => {
                isDragging = false;
                slider.classList.remove('dragging');
            }, 50);
        };

        slider.onmousemove = (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - slider.offsetLeft;
            const walk = (x - startX) * 1.6;
            if (Math.abs(walk) > 5) isDragging = true;
            slider.scrollLeft = scrollLeft - walk;
        };

        // --- 2. Mouse Wheel Scroll (PC) ---
        slider.addEventListener('wheel', (e) => {
            if (e.deltaY !== 0) {
                e.preventDefault();
                slider.scrollLeft += e.deltaY * 1.2;
            }
        }, { passive: false });

        // --- 3. Delegación y manejo de click en las píldoras de categoría ---
        slider.querySelectorAll('.category-pill').forEach(btn => {
            btn.onclick = (e) => {
                if (isDragging) {
                    e.stopImmediatePropagation();
                    e.preventDefault();
                    return;
                }
                const catId = btn.dataset.category || 'ALL';
                this.renderCommunityDecks(1, catId);
            };
        });
    }

    async previewPublicDeck(deckId, deckName) {
        const modal = document.getElementById('preview-deck-modal');
        const content = document.getElementById('preview-deck-content');
        document.getElementById('preview-deck-title').textContent = deckName;

        // Asignar acción al botón de clonar
        const cloneBtn = document.getElementById('btn-preview-clone');
        cloneBtn.onclick = () => {
            if (!this.token) {
                window.uiManager.showAuthPromptModal();
                return;
            }
            this.closePreviewModal();
            this.cloneDeck(deckId);
        };

        // ✅ REGISTRAR ESTADO DEL MODAL (Bloquear scroll)
        if (window.uiManager && typeof window.uiManager.pushModalState === 'function') {
            window.uiManager.pushModalState('preview-deck-modal');
        }

        modal.classList.add('active');
        content.innerHTML = '<div style="text-align:center; padding:2rem;"><i class="fas fa-circle-notch fa-spin fa-2x" style="color:#f97316"></i></div>';

        try {
            const res = await window.NetworkService.fetch(`${window.AppConfig.API_URL}/api/decks/${deckId}/cards`);
            const data = await res.json();

            if (!data.success || !data.cards || data.cards.length === 0) {
                content.innerHTML = '<div style="color:#94a3b8; padding:2rem; text-align:center;">Este mazo no tiene tarjetas o no se pudieron cargar.</div>';
                return;
            }

            let html = `<div style="display:flex; flex-direction:column; gap:1rem;">`;
            data.cards.forEach((c, index) => {
                let imageHtml = c.image_url ? `<div style="margin-top: 0.5rem; text-align: center;"><img src="${window.resolveImageUrl ? window.resolveImageUrl(c.image_url) : c.image_url}" style="max-height: 150px; border-radius: 8px; max-width: 100%; border: 1px solid rgba(255,255,255,0.1);"></div>` : '';
                let expImageHtml = c.explanation_image_url ? `<div style="margin-top: 0.5rem; text-align: center;"><img src="${window.resolveImageUrl ? window.resolveImageUrl(c.explanation_image_url) : c.explanation_image_url}" style="max-height: 150px; border-radius: 8px; max-width: 100%; border: 1px solid rgba(255,255,255,0.1);"></div>` : '';

                const hasAudio = c.audio_url_frente || c.audio_url_dorso;
                const audioBadge = hasAudio ? `<span style="font-size: 0.6rem; background: rgba(249, 115, 22, 0.12); color: #ff9f43; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(249, 115, 22, 0.25);"><i class="fas fa-volume-up"></i> Audio Premium</span>` : '';

                html += `
                    <div style="background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 12px; padding: 1rem; box-shadow: var(--shadow-sm);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.5rem;">
                            <div style="color: #f97316; font-size: 0.75rem; font-weight: 700; text-transform: uppercase;">Tarjeta ${index + 1}</div>
                            ${audioBadge}
                        </div>
                        <div style="color: var(--text-main); font-size: 0.95rem; margin-bottom: 0.5rem; line-height: 1.4;">
                            ${window.MarkdownRenderer.render(c.front_content || '')}
                            ${imageHtml}
                        </div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem; padding-top: 0.5rem; border-top: 1px dashed var(--border-color); line-height: 1.4;">
                            ${window.MarkdownRenderer.render(c.back_content || '')}
                            ${expImageHtml}
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
            content.innerHTML = html;
        } catch (e) {
            console.error('Error previewing deck:', e);
            content.innerHTML = '<div style="color:#ef4444; padding:2rem; text-align:center;">Error al cargar las tarjetas.</div>';
        }
    }

    async cloneDeck(deckId) {
        if (!this.token) {
            window.uiManager.showAuthPromptModal();
            return;
        }

        try {
            window.uiManager.showToast('Clonando mazo a tu biblioteca...', 'info');
            const res = await window.NetworkService.fetch(`${window.AppConfig.API_URL}/api/decks/${deckId}/clone`, {
                method: 'POST'
            });

            if (res.status === 403) {
                const err = await res.json().catch(() => ({}));
                if (window.uiManager) window.uiManager.showPaywallModal(err.error, 'flashcards');
                return;
            }

            if (res.ok) {
                window.uiManager.showToast('¡Mazo clonado con éxito!', 'success');
                // 1. Invalidar caché en memoria y pools de peticiones compartidas de inmediato
                this.invalidateCache();
                // 2. Sincronizar árbol del explorador lateral con await
                await this.explorer.loadTree();
                if (window.sessionManager) {
                    // Sincronización gestionada por NetworkService
                }
            } else {
                const err = await res.json().catch(() => ({}));
                window.uiManager.showToast(err.error || 'Error al clonar el mazo', 'error');
            }
        } catch (e) {
            console.error('Error cloning deck', e);
            window.uiManager.showToast('Error de conexión', 'error');
        }
    }

    renderDeckHeader(deck, cards = []) {
        if (!deck) return;

        const user = window.sessionManager ? window.sessionManager.getUser() : null;
        const userTier = (user?.subscriptionTier || user?.subscription_tier || 'free').toLowerCase();
        const isAdvancedOrAdmin = ['advanced', 'admin'].includes(userTier);

        const container = document.getElementById('folder-header');
        const total = cards?.length || 0;
        const mastered = cards?.filter(c => c.interval_days > 21).length || 0;
        const pending = deck.due_cards || 0;

        container.innerHTML = `
            <div class="deck-header-info">
                <div class="deck-header-top">
                    <div class="deck-title-group">
                        <h1 class="deck-title">${escapeHtml(deck?.name || 'Mazo sin nombre')}</h1>
                    </div>
                    <button id="btn-deck-tour" class="btn-guide-hero btn-guide-deck" data-tooltip="Ver guía rápida de este mazo" aria-label="Guía rápida">
                        <i class="fas fa-circle-question"></i>
                        <span>Guía</span>
                    </button>
                </div>

                <div class="deck-meta">
                    <span class="deck-meta-pill pill-deck-icon" title="Icono del mazo">${RepasoManager.renderDeckIconHtml(deck, 'fas fa-layer-group')}</span>
                    <span class="deck-meta-pill"><strong class="meta-num">${total}</strong> tarjetas</span>
                    <span class="deck-meta-pill ${pending > 0 ? 'pill-pending' : ''}"><strong class="meta-num">${pending}</strong> pendientes</span>
                    <span class="deck-meta-pill pill-mastered"><strong class="meta-num">${mastered}</strong> dominadas</span>
                </div>

                <div class="action-bar" id="deck-action-bar">
                    ${total > 0 && localStorage.getItem('authToken') ? `
                    <button type="button" class="btn-premium btn-premium-primary btn-fh-study">
                        <i class="fas fa-play"></i> <span class="btn-text">Estudiar Ahora</span>
                    </button>
                    ` : ''}

                    ${!localStorage.getItem('authToken') ? `
                    <button type="button" class="btn-premium btn-premium-primary btn-fh-demo">
                        <i class="fas fa-play-circle"></i> <span class="btn-text">¡PROBAR DEMO!</span>
                    </button>
                    ` : ''}

                    ${localStorage.getItem('authToken') ? `
                    <button type="button" class="btn-premium btn-premium-secondary btn-fh-add">
                        <i class="fas fa-plus"></i> <span class="btn-text">Añadir Tarjeta</span>
                    </button>
                    ${isAdvancedOrAdmin ? `
                    <button type="button" class="btn-premium btn-premium-ia btn-fh-ai">
                        <svg class="ai-sparkles-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block; vertical-align:-0.2em; flex-shrink:0;"><path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z"/></svg><span class="btn-text">Crear con IA</span>
                    </button>
                    ` : ''}
                    ` : ''}
                    
                    <button type="button" class="btn-premium btn-premium-secondary btn-fh-stats">
                        <i class="fas fa-chart-pie"></i> <span class="btn-text">Estadísticas</span>
                    </button>

                    ${this.token && deck.type !== 'SYSTEM' ? `
                    <button type="button" class="btn-premium btn-premium-secondary btn-fh-guide">
                        <i class="fas fa-book-open"></i> <span class="btn-text">Guía</span>
                    </button>
                    ` : ''}

                    ${this.token && deck.type !== 'SYSTEM' ? `
                    <button type="button" class="btn-premium ${deck.is_public ? 'btn-premium-primary' : 'btn-premium-secondary'} btn-fh-visibility">
                        <i class="fas ${deck.is_public ? 'fa-globe' : 'fa-lock'}"></i> <span class="btn-text">${deck.is_public ? 'Hacer Privado' : 'Hacer Público'}</span>
                    </button>
                    ` : ''}
                </div>
            </div>
        `;

        // Direct Event Bindings for folder header
        const btnDeckTour = container.querySelector('#btn-deck-tour');
        if (btnDeckTour) {
            btnDeckTour.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (window.tooltipManager) {
                    window.tooltipManager.startDeckViewTour(true);
                }
            };
        }

        const btnStudy = container.querySelector('.btn-fh-study');
        if (btnStudy) btnStudy.onclick = () => this.startStudy(deck.id, deck.name, total);

        const btnDemo = container.querySelector('.btn-fh-demo');
        if (btnDemo) btnDemo.onclick = () => this.startStudyDemo(deck.id);

        const btnAdd = container.querySelector('.btn-fh-add');
        if (btnAdd) btnAdd.onclick = () => this.openAddCardModal();

        const btnAi = container.querySelector('.btn-fh-ai');
        if (btnAi) btnAi.onclick = () => this.openAiModal();

        const btnStats = container.querySelector('.btn-fh-stats');
        if (btnStats) btnStats.onclick = () => this.token ? this.openStatsModal(total, mastered, pending) : window.uiManager.showAuthPromptModal();

        const btnGuide = container.querySelector('.btn-fh-guide');
        if (btnGuide) btnGuide.onclick = () => window.DeckExplorer.openGuideModal(deck.id, deck.name);

        const btnVisibility = container.querySelector('.btn-fh-visibility');
        if (btnVisibility) btnVisibility.onclick = () => this.toggleDeckVisibility(deck.id, !deck.is_public);
    }

    async toggleDeckVisibility(deckId, makePublic) {
        if (!this.token) return;

        if (makePublic) {
            const currentCat = (this.currentDeck && this.currentDeck.category) ? this.currentDeck.category : 'General';
            const modalHtml = `
            <div id="confirm-publish-modal" class="modal-overlay active" style="opacity:0; transition:opacity 0.25s ease;">
                <div class="modal-content" style="max-width:440px; padding:1.75rem; text-align:center; transform:scale(0.95); transition:transform 0.25s ease; background:var(--modal-bg) !important; border:1px solid var(--border-color) !important; border-radius:20px !important; box-shadow:var(--shadow-xl) !important;">
                    <div style="width:64px; height:64px; margin:0 auto 1.2rem auto; background:rgba(249, 115, 22, 0.12); border-radius:50%; display:flex; align-items:center; justify-content:center; border:1px solid rgba(249, 115, 22, 0.3); box-shadow: 0 0 15px rgba(249, 115, 22, 0.15);">
                        <i class="fas fa-globe" style="font-size:1.8rem; color:#f97316;"></i>
                    </div>
                    <h3 style="color:var(--text-main); font-size:1.25rem; margin:0 0 0.5rem 0; font-weight:700;">¿Publicar Mazo en Comunidad?</h3>
                    <p style="color:var(--text-secondary); font-size:0.88rem; line-height:1.5; margin-bottom:1.25rem;">
                        Se publicará este mazo, su guía y sus tarjetas directas para que otros estudiantes puedan explorarlo y clonarlo.
                    </p>
                    
                    <div style="margin-bottom:1.5rem; text-align:left;">
                        <label style="font-size:0.82rem; color:var(--text-secondary); font-weight:600; display:block; margin-bottom:0.45rem;">Categoría / Área Temática</label>
                        <select id="publish-deck-category" class="form-input-premium" style="width:100%; background:var(--input-bg); color:var(--input-text); border:1px solid var(--border-color); padding:0.65rem; border-radius:8px;">
                            <option value="General" ${currentCat === 'General' ? 'selected' : ''}>General</option>
                            <option value="Medicina" ${currentCat === 'Medicina' ? 'selected' : ''}>Medicina</option>
                            <option value="Educación" ${currentCat === 'Educación' ? 'selected' : ''}>Educación</option>
                            <option value="Matemáticas" ${currentCat === 'Matemáticas' ? 'selected' : ''}>Matemáticas</option>
                            <option value="Historia" ${currentCat === 'Historia' ? 'selected' : ''}>Historia</option>
                            <option value="Derecho" ${currentCat === 'Derecho' ? 'selected' : ''}>Derecho</option>
                            <option value="Ciencia" ${currentCat === 'Ciencia' ? 'selected' : ''}>Ciencia</option>
                            <option value="Tecnología" ${currentCat === 'Tecnología' ? 'selected' : ''}>Tecnología</option>
                            <option value="Idiomas" ${currentCat === 'Idiomas' ? 'selected' : ''}>Idiomas</option>
                        </select>
                    </div>

                    <div class="modal-footer" style="display:flex; gap:0.8rem; justify-content:center; padding:0; border-top:none; background:transparent;">
                        <button id="btn-cancel-publish" class="btn-action btn-secondary-action" style="flex:1; justify-content:center; padding:0.7rem; border-radius:12px;">Cancelar</button>
                        <button id="btn-confirm-publish" class="btn-action" style="flex:1; justify-content:center; padding:0.7rem; border-radius:12px;">Publicar</button>
                    </div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', modalHtml);

            const modal = document.getElementById('confirm-publish-modal');
            const content = modal.querySelector('div');

            requestAnimationFrame(() => {
                modal.style.opacity = '1';
                content.style.transform = 'scale(1)';
            });

            const closeModal = (confirmed) => {
                const selectedCat = document.getElementById('publish-deck-category') ? document.getElementById('publish-deck-category').value : 'General';
                modal.style.opacity = '0';
                content.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    modal.remove();
                    if (confirmed) this._executeToggleVisibility(deckId, true, selectedCat);
                }, 200);
            };

            document.getElementById('btn-cancel-publish').onclick = () => closeModal(false);
            document.getElementById('btn-confirm-publish').onclick = () => closeModal(true);
            return;
        }

        return this._executeToggleVisibility(deckId, makePublic);
    }

    async _executeToggleVisibility(deckId, makePublic, category = null) {
        try {
            const res = await window.NetworkService.fetch(`${window.AppConfig.API_URL}/api/decks/${deckId}/visibility`, {
                method: 'PUT',
                body: JSON.stringify({ is_public: makePublic, category })
            });

            if (res.ok) {
                window.uiManager.showToast(makePublic ? 'Mazo publicado en la comunidad' : 'Mazo hecho privado', 'success');
                this.invalidateCache(deckId);
                this.loadFolder(deckId, false);
            } else {
                const data = await res.json();
                window.uiManager.showToast(data.error || 'Error al cambiar visibilidad', 'error');
            }
        } catch (e) {
            console.error('Error toggling visibility:', e);
            window.uiManager.showToast('Error de red', 'error');
        }
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

        container.style.display = 'block';

        const count = decks.length;
        const title = `SUB-MAZOS (${count})`;
        const icon = this.subDecksCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-down';

        container.innerHTML = `
            <div class="deck-section-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; padding-bottom:0.6rem; border-bottom:1px solid var(--border-color);">
                <div style="display:flex; align-items:center; gap:0.6rem; cursor:pointer;" onclick="window.repasoManager.toggleSubDecks()">
                    <i class="${icon} toggle-icon" style="color:var(--text-muted); font-size:0.9rem; transition:transform 0.2s;"></i>
                    <h3 style="margin:0; font-size:0.95rem; font-weight:700; color:var(--text-main); letter-spacing:0.5px;">${title}</h3>
                </div>
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
        const icon = document.querySelector('.deck-section-header .toggle-icon');

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

    toggleCardsSection() {
        this.cardsCollapsed = !this.cardsCollapsed;
        localStorage.setItem('cardsCollapsed', this.cardsCollapsed);

        const body = document.getElementById('cards-section-body');
        const icon = document.querySelector('.toggle-icon-cards');

        if (this.cardsCollapsed) {
            body?.classList.add('collapsed');
            if (icon) {
                icon.classList.remove('fa-chevron-down');
                icon.classList.add('fa-chevron-right');
            }
        } else {
            body?.classList.remove('collapsed');
            if (icon) {
                icon.classList.remove('fa-chevron-right');
                icon.classList.add('fa-chevron-down');
            }
        }
    }

    renderDeckCards(decks, container, parentId = null) {
        container.innerHTML = '';
        const fragment = document.createDocumentFragment();

        // --- 1. NEW: Add "Create Deck" Card (Only for Logged Users) ---
        let showCreateCard = false;
        if (this.token) {
            showCreateCard = true;
        }

        if (showCreateCard) {
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
            fragment.appendChild(addCard);
        }

        // --- 2. Render Decks ---
        decks.forEach(deck => {
            const card = document.createElement('div');
            card.className = 'deck-card';
            card.style.cursor = 'pointer';

            const mastery = Math.max(0, Math.min(100, Number(deck.mastery_percentage) || 0));
            const iconHtml = RepasoManager.renderDeckIconHtml(deck, 'fas fa-folder-open');
            const hasDue = parseInt(deck.due_cards) > 0;
            const categoryText = escapeHtml(deck.category || 'General');

            // --- Dynamic Actions Logic ---
            let actionBtns = '';
            if (this.token) {
                actionBtns = `
                    <div class="deck-card-actions">
                        <button type="button" class="deck-action-btn btn-act-play" title="Estudiar">
                            <i class="fas fa-play"></i>
                        </button>
                        <button type="button" class="deck-action-btn btn-act-edit" title="Editar mazo">
                            <i class="fas fa-pen"></i>
                        </button>
                        <button type="button" class="deck-action-btn deck-action-btn--delete btn-act-delete" title="Eliminar mazo">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>`;
            } else {
                // Guest User: Only Demo Play
                actionBtns = `
                    <div class="deck-card-actions">
                        <button type="button" class="deck-action-btn btn-act-play" title="Probar Demo">
                            <i class="fas fa-play"></i>
                        </button>
                    </div>`;
            }

            card.innerHTML = `
                <!-- Desktop layout -->
                <div class="deck-card-desktop">
                    <div class="deck-card-top-row">
                        <span class="deck-badge badge-user" title="Categoría: ${categoryText}">${categoryText}</span>
                        ${actionBtns}
                    </div>
                    <div class="deck-card-icon-center">${iconHtml}</div>
                    <h3 class="deck-card-title-text" title="${escapeHtml(deck.name)}">${escapeHtml(deck.name)}</h3>
                    <div class="deck-card-meta-text">
                        <span>${Math.max(0, Number(deck.total_cards) || 0)} tarjetas</span>
                        ${hasDue ? `<span class="deck-due-tag">${Math.max(0, Number(deck.due_cards) || 0)} pend.</span>` : ''}
                    </div>
                    <div class="deck-card-footer-box">
                        <div class="deck-mastery-header">
                            <span>Dominio</span><span>${mastery}%</span>
                        </div>
                        <div class="deck-mastery-track">
                            <div class="deck-mastery-fill" style="width:${mastery}%;"></div>
                        </div>
                    </div>
                </div>

                <!-- Mobile layout -->
                <div class="deck-card-mobile">
                    <div class="deck-card-mob-icon">${iconHtml}</div>
                    <div class="deck-card-mob-info">
                        <div class="deck-card-mob-title">${escapeHtml(deck.name)}</div>
                        <div class="deck-card-mob-meta">
                            <span>${Math.max(0, Number(deck.total_cards) || 0)} tarj.</span>
                            ${hasDue ? `<span class="deck-due-tag">${Math.max(0, Number(deck.due_cards) || 0)} pend.</span>` : ''}
                        </div>
                    </div>
                    <div class="deck-card-mob-side">
                        <span class="deck-badge badge-user" title="Categoría: ${categoryText}">${categoryText}</span>
                        ${actionBtns}
                    </div>
                </div>
            `;

            card.onclick = (e) => {
                const btn = e.target.closest('button');
                if (btn) {
                    e.stopPropagation();
                    if (btn.classList.contains('btn-act-play')) {
                        const count = Number(deck.total_cards ?? deck.cards_count ?? deck.total ?? 0);
                        this.startStudy(deck.id, deck.name, count);
                    } else if (btn.classList.contains('btn-act-demo')) {
                        this.startStudyDemo(deck.id);
                    } else if (btn.classList.contains('btn-act-edit')) {
                        this.openEditDeckModal(deck.id, deck.name, deck.icon, deck.description, deck.color, deck.category);
                    } else if (btn.classList.contains('btn-act-delete')) {
                        this.confirmDeleteDeck(deck.id, deck.name);
                    }
                    return;
                }

                const node = document.querySelector(`.tree-node[data-id="${deck.id}"]`);
                if (node) {
                    this.explorer.toggleNode(deck.id, node);
                    this.explorer.setActive(deck.id);
                }
                this.loadFolder(deck.id);
            }
            fragment.appendChild(card);
        });

        container.appendChild(fragment);
    }

    renderCards(cards = this.currentCards) {
        const container = document.getElementById('cards-container');
        if (!container) return;

        container.style.display = 'block';
        const cardCount = cards ? cards.length : 0;
        const icon = this.cardsCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-down';

        this.isSelectionMode = false;

        container.innerHTML = `
            <div class="deck-section-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; padding-bottom:0.6rem; border-bottom:1px solid var(--border-color);">
                <div style="display:flex; align-items:center; gap:0.6rem; cursor:pointer;" onclick="window.repasoManager.toggleCardsSection()">
                    <i class="${icon} toggle-icon-cards" style="color:var(--text-muted); font-size:0.9rem; transition:transform 0.2s;"></i>
                    <h3 style="margin:0; font-size:0.95rem; font-weight:700; color:var(--text-main); letter-spacing:0.5px;">TARJETAS (${cardCount})</h3>
                </div>
                ${this.token ? `
                <button type="button" class="btn-action-sm btn-card-create" onclick="event.stopPropagation(); window.repasoManager.openAddCardModal()" style="background:var(--primary); border:none; color:#ffffff !important; padding:0.45rem 1rem; border-radius:10px; font-size:0.85rem; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:0.45rem; box-shadow: 0 2px 8px var(--primary-glow); transition:all 0.2s;">
                    <i class="fas fa-plus"></i> Crear Tarjeta
                </button>
                ` : ''}
            </div>

            <div id="cards-section-body" class="${this.cardsCollapsed ? 'collapsed' : ''}" style="transition: all 0.3s ease;">
                ${cardCount === 0 ? `
                    <div style="color:var(--text-muted); padding:2.5rem; text-align:center; background:var(--card-bg); border-radius:16px; border:1px solid var(--border-color); box-shadow:var(--shadow-sm);">
                        <i class="fas fa-layer-group" style="font-size:2rem; color:var(--text-muted); margin-bottom:0.75rem; display:block;"></i>
                        No hay tarjetas en este mazo. ¡Haz clic en <b>"+ Crear Tarjeta"</b> para agregar la primera!
                    </div>
                ` : `
                    <div style="display:flex; justify-content:space-between; margin-bottom:1rem; align-items:center; flex-wrap:wrap; gap:1rem;">
                        <div style="position:relative; width:100%; max-width:260px;">
                            <i class="fas fa-search" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-muted); font-size:0.85rem;"></i>
                            <input type="text" id="card-search-input" placeholder="Buscar tarjetas..." style="width:100%; padding:0.6rem 1rem 0.6rem 2.2rem; border-radius:10px; border:1px solid var(--border-color); background:var(--input-bg); color:var(--input-text); font-size:0.9rem; outline:none; transition:border-color 0.2s;" onkeyup="window.repasoManager.filterCards(this.value)">
                        </div>
                        <div style="display:flex; align-items:center; gap:1rem;">
                            <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; margin:0;">
                                <input type="checkbox" id="select-all-cards" onchange="window.repasoManager.toggleSelectAllCards(this.checked)" class="card-checkbox">
                                <span style="font-size:0.85rem; color:var(--text-secondary); font-weight:500;">Seleccionar todo</span>
                            </label>
                            <button id="btn-bulk-delete" class="btn-action deck-action-btn--delete" style="display:none; padding:0.4rem 0.8rem; font-size:0.8rem; border-radius:8px; background:rgba(239, 68, 68, 0.1); color:#ef4444; border:1px solid rgba(239,68,68,0.3); font-weight:600;" onclick="${this.token ? 'window.repasoManager.confirmBulkDelete()' : 'window.uiManager.showAuthPromptModal()'}">
                                <i class="fas fa-trash"></i> Eliminar Selección
                            </button>
                        </div>
                    </div>
                    <div id="cards-list-container"></div>
                `}
            </div>
        `;

        if (cardCount === 0) return;

        const listContainer = document.getElementById('cards-list-container');
        const fragment = document.createDocumentFragment();

        // ✅ EVENT DELEGATION: Una sola escucha para todo el contenedor
        if (!listContainer.dataset.delegated) {
            listContainer.dataset.delegated = "true";
            listContainer.addEventListener('click', (e) => this._handleCardListClick(e));
        }

        // Limit initial render to 50 for performance, then could add Load More
        const limit = 50;
        const toRender = cards.slice(0, limit);

        toRender.forEach((c, index) => {
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
                    <input type="checkbox" class="card-checkbox card-item-checkbox" value="${c.id}" data-id="${c.id}">
                </div>
                <div class="card-row-front">
                    ${c.image_url ? `<img src="${window.resolveImageUrl(c.image_url)}" style="width:24px; height:24px; object-fit:cover; border-radius:4px; margin-right:8px; vertical-align:middle;" loading="lazy">` : ''}
                    ${escapeHtml(c.front_content)}
                    ${c.interval_days > 21 ? `<span class="badge-mastered" title="Tarjeta Dominada"><i class="fas fa-star"></i> Dominada</span>` : ''}
                </div>
                <div class="card-row-back">
                    ${c.explanation_image_url ? '<i class="fas fa-image" style="color:#94a3b8; margin-right:4px;"></i>' : ''}
                    ${escapeHtml(c.back_content)}
                </div>
                <div class="card-row-actions">
                    <button class="deck-action-btn deck-action-btn--play" title="Estudiar" data-action="play">
                        <i class="fas fa-play" style="color: #f97316;"></i>
                    </button>
                    ${this.token ? `
                    <button class="deck-action-btn" title="Editar" data-action="edit">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button class="deck-action-btn deck-action-btn--delete" title="Eliminar" data-action="delete">
                        <i class="fas fa-trash"></i>
                    </button>
                    ` : ''}
                </div>
            `;

            this._bindCardRowDragEvents(row);
            fragment.appendChild(row);
        });

        listContainer.appendChild(fragment);

        if (cards.length > limit) {
            const moreBtn = document.createElement('button');
            moreBtn.className = 'btn-action';
            moreBtn.style.cssText = 'width:100%; margin-top:1rem; justify-content:center; background:rgba(255,255,255,0.05); color:#94a3b8; border:1px dashed rgba(255,255,255,0.1);';
            moreBtn.innerHTML = `<i class="fas fa-plus"></i> Ver todas las tarjetas (${cards.length - limit} más)`;
            moreBtn.onclick = () => {
                moreBtn.remove();
                this._renderRemainingCards(cards.slice(limit));
            };
            listContainer.appendChild(moreBtn);
        }

        // UI Restore Search
        if (this._lastSearchQuery) {
            const input = document.getElementById('card-search-input');
            if (input) { input.value = this._lastSearchQuery; }
        }
    }

    _renderRemainingCards(remainingCards) {
        const listContainer = document.getElementById('cards-list-container');
        const fragment = document.createDocumentFragment();
        remainingCards.forEach((c, index) => {
            const srsClass = this._getSrsClass(c);
            const isDue = new Date(c.next_review_at) <= new Date();
            const row = document.createElement('div');
            row.className = `card-row-item ${srsClass} ${isDue ? 'is-due-glow' : ''}`;
            row.dataset.id = c.id;
            row.dataset.index = index + 50;
            row.draggable = true;
            row.innerHTML = `
                <div style="display:flex; align-items:center; gap:0.5rem; color:#64748b;">
                    <i class="fas fa-grip-vertical drag-handle"></i>
                    <input type="checkbox" class="card-checkbox card-item-checkbox" value="${c.id}" data-id="${c.id}">
                </div>
                <div class="card-row-front">${c.image_url ? `<img src="${window.resolveImageUrl(c.image_url)}" style="width:24px; height:24px; object-fit:cover; border-radius:4px; margin-right:8px; vertical-align:middle;" loading="lazy">` : ''}${escapeHtml(c.front_content)}</div>
                <div class="card-row-back">${c.explanation_image_url ? '<i class="fas fa-image" style="color:#94a3b8; margin-right:4px;"></i>' : ''}${escapeHtml(c.back_content)}</div>
                <div class="card-row-actions">
                    <button class="deck-action-btn deck-action-btn--play" data-action="play"><i class="fas fa-play" style="color:#f97316;"></i></button>
                    ${this.token ? `<button class="deck-action-btn" data-action="edit"><i class="fas fa-pen"></i></button><button class="deck-action-btn deck-action-btn--delete" data-action="delete"><i class="fas fa-trash"></i></button>` : ''}
                </div>
            `;
            this._bindCardRowDragEvents(row);
            fragment.appendChild(row);
        });
        listContainer.appendChild(fragment);
    }

    _handleCardListClick(e) {
        const row = e.target.closest('.card-row-item');
        if (!row) return;
        const id = row.dataset.id;
        const card = this.currentCards.find(c => c.id === id);
        if (!card) return;

        const actionBtn = e.target.closest('button[data-action]');
        if (actionBtn) {
            e.stopPropagation();
            const action = actionBtn.dataset.action; // ✅ RESTAURADO
            if (action === 'play') {
                // ✅ VALIDACIÓN UNIFICADA: Sin latencia y con diseño estándar
                if (window.uiManager && window.uiManager.isResourceLocked(true)) {
                    window.uiManager.showPaywallModal(null, 'flashcards');
                    return;
                }

                if (this.token) {
                    const deckName = this.currentDeck?.name ? encodeURIComponent(this.currentDeck.name) : '';
                    const category = this.currentDeck?.category ? encodeURIComponent(this.currentDeck.category) : '';
                    window.location.href = `/flashcards?deckId=${card.deck_id}&cardId=${card.id}&deckName=${deckName}&category=${category}`;
                } else window.uiManager.showAuthPromptModal();
            } else if (action === 'edit') {
                this.onEditCardClick(card.id, card.front_content, card.back_content, card.image_url, card.explanation_image_url, card.audio_url_frente, card.audio_url_dorso, card.tts_lang_frente, card.tts_lang_dorso, card.hide_text_frente, card.hide_text_dorso);
            } else if (action === 'delete') {
                this.onDeleteCardClick(card.id, card.front_content);
            }
            return;
        }

        const checkbox = e.target.closest('.card-item-checkbox');
        if (checkbox) {
            e.stopPropagation();
            this.updateBulkDeleteButton();
            return;
        }

        // Row click logic (Selection Mode)
        if (this.isSelectionMode) {
            const cb = row.querySelector('.card-item-checkbox');
            if (cb) {
                cb.checked = !cb.checked;
                this.updateBulkDeleteButton();
            }
        }
    }

    _bindCardRowDragEvents(row) {
        row.addEventListener('dragstart', (e) => this.handleDragStart(e, row));
        row.addEventListener('dragover', (e) => this.handleDragOver(e, row));
        row.addEventListener('drop', (e) => this.handleDrop(e, row));
        row.addEventListener('dragenter', () => row.style.borderTop = '2px solid #f97316');
        row.addEventListener('dragleave', () => row.style.borderTop = '');
        row.addEventListener('dragend', () => {
            row.style.opacity = '1';
            document.querySelectorAll('.card-row-item').forEach(r => r.style.borderTop = '');
        });
    }

    _getSrsClass(c) {
        if (c.last_quality === 1) return 'srs-status-forgot';
        if (c.last_quality === 2) return 'srs-status-hard';
        if (c.last_quality === 3) return 'srs-status-good';
        if (c.last_quality === 4) return 'srs-status-easy';

        if (c.repetition_number === 0) return '';
        if (c.interval_days === 0) return 'srs-status-forgot';
        if (c.ease_factor < 2.0) return 'srs-status-hard';
        return c.interval_days > 21 ? 'srs-status-easy' : 'srs-status-good';
    }

    onEditCardClick(id, front, back, imageUrl = '', backImageUrl = '', audioUrlFront = '', audioUrlBack = '', ttsLangFront = 'es-ES', ttsLangBack = 'es-ES', hideTextFront = false, hideTextBack = false) {
        if (this.token) {
            this.openEditCardModal(id, front, back, imageUrl, backImageUrl, audioUrlFront, audioUrlBack, ttsLangFront, ttsLangBack, hideTextFront, hideTextBack);
        } else {
            window.uiManager.showAuthPromptModal();
        }
    }

    onDeleteCardClick(id, front) {
        if (this.token) this.confirmDeleteCard(id, front);
        else window.uiManager.showAuthPromptModal();
    }


    // --- Search & Bulk Actions Helpers ---

    filterCards(query) {
        if (!this.currentCards) return;
        this._lastSearchQuery = query;

        // ✅ OPTIMIZACIÓN: Debounce simple para evitar re-renders excesivos
        clearTimeout(this._filterTimeout);
        this._filterTimeout = setTimeout(() => {
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
        }, 250); // 250ms de calma
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
    }

    switchMode(mode) {
        // 🛡️ PROTECCIÓN PREMIUM: Carga masiva bloqueada para Free
        if (mode === 'bulk' && this.userTier === 'free') {
            if (window.uiManager && window.uiManager.showAuthPromptModal) {
                window.uiManager.showAuthPromptModal('La Carga Masiva (Excel) es una función exclusiva para usuarios Premium. ¡Ahorra tiempo mejorando tu plan!');
            } else {
                if (window.uiManager) window.uiManager.showToast('La Carga Masiva es una función Premium.', 'warning');
                else alert('La Carga Masiva es una función Premium.');
            }
            return;
        }

        const tabs = document.querySelectorAll('.card-mode-tab');
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

    /**
     * Interceptor for browser navigation (Back/Forward) and selection mode.
     */
    handlePopState(e) {
        // 🛡️ Si hay algún modal abierto o cerrándose en uiManager, omitir recarga para no parpadear
        if (window.uiManager && ((window.uiManager.openModals && window.uiManager.openModals.size > 0) || window.uiManager.isClosingModalState)) {
            return;
        }

        // 1. UI Selection Overrides
        if (this.isSelectionMode && (!e.state || !e.state.selectionMode)) {
            this.toggleSelectAllCards(false);
        } else {
            this._lastSelectionState = false;
        }

        // 2. State-Based Routing
        const params = new URLSearchParams(window.location.search);
        const deckId = params.get('deckId');
        const view = params.get('view');

        if (deckId) {
            // Avoid reloading same folder if already active
            if (!this.currentDeck || String(this.currentDeck.id) !== String(deckId)) {
                this.loadFolder(deckId, false);
            }
        } else if (view === 'community' || (!view && this.activeTab === 'comunidad')) {
            const grid = document.getElementById('community-decks-grid');
            if (grid && grid.children.length > 0 && this.activeTab === 'comunidad' && !grid.querySelector('.fa-spin')) {
                return; // Preservar la grilla de comunidad sin parpadear
            }
            this.loadCommunity(false);
        } else {
            const grid = document.getElementById('root-decks-grid');
            if (grid && grid.children.length > 0 && this.activeTab === 'mis-mazos' && !grid.querySelector('.deck-skeleton-card')) {
                return; // Preservar la grilla cargada sin parpadear
            }
            this.loadDashboard(false);
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
            const res = await window.NetworkService.fetch(`${window.AppConfig.API_URL}/api/cards/batch`, {
                method: 'DELETE',
                body: JSON.stringify({ cardIds })
            });

            if (res.ok) {
                this.invalidateCache(this.currentDeck?.id);
                if (this.currentDeck) this.loadFolder(this.currentDeck.id, false);
            } else {
                window.uiManager.showToast('No se pudieron eliminar las tarjetas masivamente.');
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
            await window.uiManager.safeFetch(`${window.AppConfig.API_URL}/api/decks/${this.currentDeck.id}/cards/reorder`, {
                method: 'PUT',
                isRetryable: true,
                body: JSON.stringify({ sortedIds })
            });
        } catch (err) {
            console.error("Failed to sync card order:", err);
        }
    }

    // --- Actions ---

    _clearCardModal() {
        const form = document.getElementById('card-form');
        if (form) form.reset();

        // Reset IDs y estados internos
        document.getElementById('card-id').value = '';
        this._pendingFiles = { front: null, back: null };
        this._pendingBulkCards = [];

        // Reset Previsualizaciones de Imágenes
        this._updateImagePreview('front', '');
        this._updateImagePreview('back', '');

        // Reset URLs ocultas de imágenes
        const imgUrlFront = document.getElementById('card-image-url-front');
        const imgUrlBack = document.getElementById('card-image-url-back');
        if (imgUrlFront) imgUrlFront.value = '';
        if (imgUrlBack) imgUrlBack.value = '';

        // Reset Audio UI
        const ttsFrontLabel = document.querySelector('label[for="card-tts-front"]');
        const ttsBackLabel = document.querySelector('label[for="card-tts-back"]');
        if (ttsFrontLabel) ttsFrontLabel.innerText = 'Generar audio TTS';
        if (ttsBackLabel) ttsBackLabel.innerText = 'Generar audio TTS';

        const statusFront = document.getElementById('audio-status-front');
        const statusBack = document.getElementById('audio-status-back');
        if (statusFront) statusFront.style.display = 'none';
        if (statusBack) statusBack.style.display = 'none';

        document.getElementById('card-delete-audio-front').value = 'false';
        document.getElementById('card-delete-audio-back').value = 'false';

        // Reset Checkboxes de visibilidad e idioma
        const langFront = document.getElementById('card-tts-lang-front');
        const langBack = document.getElementById('card-tts-lang-back');
        if (langFront) langFront.value = 'es-ES';
        if (langBack) langBack.value = 'es-ES';

        const hideFront = document.getElementById('card-hide-text-front');
        const hideBack = document.getElementById('card-hide-text-back');
        if (hideFront) hideFront.checked = false;
        if (hideBack) hideBack.checked = false;

        // Reset Bulk UI si existe
        const preview = document.getElementById('bulk-upload-preview');
        if (preview) preview.style.display = 'none';
        const fileInput = document.getElementById('bulk-flashcard-input');
        if (fileInput) fileInput.value = '';
        const fileLabel = document.getElementById('bulk-file-label');
        if (fileLabel) fileLabel.textContent = 'Seleccionar Archivo';
        const bulkCountText = document.getElementById('bulk-count-text');
        if (bulkCountText) bulkCountText.textContent = '0 tarjetas detectadas';
        const bulkTtsFront = document.getElementById('bulk-tts-front');
        if (bulkTtsFront) bulkTtsFront.checked = false;
        const bulkTtsBack = document.getElementById('bulk-tts-back');
        if (bulkTtsBack) bulkTtsBack.checked = false;

        // Sincronizar el estado visual de selectores de idioma
        this.syncTtsLanguageSelectors();
    }

    openAddCardModal() {
        if (window.uiManager && !window.uiManager.validateFreemiumAction(null, 'flashcards')) return;

        this._clearCardModal(); // 🧹 Limpieza atómica

        document.getElementById('card-deck-id').value = this.currentDeck.id;
        document.getElementById('modal-title').innerText = 'Añadir Tarjeta';

        // Mostrar pestañas y resetear a modo individual
        const tabs = document.getElementById('card-modal-tabs');
        if (tabs) tabs.style.display = 'flex';
        this.switchCardMode('individual');

        document.getElementById('card-modal').classList.add('active');

        if (window.uiManager && typeof window.uiManager.pushModalState === 'function') {
            window.uiManager.pushModalState('card-modal');
        }
    }

    closeCardModal() {
        this._clearCardModal(); // 🧹 Limpieza al cerrar
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

    openStatsModal(total, mastered, pending = 0) {
        document.getElementById('modal-total').textContent = total;
        document.getElementById('modal-mastered').textContent = mastered;
        document.getElementById('stats-modal').classList.add('active');
        if (window.uiManager && typeof window.uiManager.pushModalState === 'function') {
            window.uiManager.pushModalState('stats-modal');
        }

        // Render Deck Chart (Doughnut)
        const learning = Math.max(0, total - mastered - pending);
        this.renderDeckChart(learning, pending, mastered);

        // Render Heatmap (Fixed init instead of empty render)
        if (window.ActivityHeatmap) {
            const heatmap = new ActivityHeatmap('activity-heatmap', this.currentDeck?.id);
            heatmap.init();
        }
    }

    renderDeckChart(learning, pending, mastered) {
        const ctx = document.getElementById('deck-stats-chart');
        if (!ctx) return;

        // Destroy previous instance if it exists to avoid overlapping charts
        if (this.deckChartInstance) {
            this.deckChartInstance.destroy();
        }

        // If no cards, don't show chart
        if (learning === 0 && pending === 0 && mastered === 0) {
            ctx.style.display = 'none';
            return;
        } else {
            ctx.style.display = 'block';
        }

        this.deckChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Nuevas / Aprendiendo', 'Por Repasar (Due)', 'Dominadas'],
                datasets: [{
                    data: [learning, pending, mastered],
                    backgroundColor: [
                        '#60a5fa', // Blue for learning
                        '#f87171', // Red for pending/due
                        '#34d399'  // Green for mastered
                    ],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%',
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: '#141416',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        padding: 10
                    }
                }
            }
        });
    }

    closeStatsModal() {
        document.getElementById('stats-modal').classList.remove('active');
        if (window.uiManager && typeof window.uiManager.popModalState === 'function') {
            window.uiManager.popModalState('stats-modal');
        }
    }

    /**
     * Inicia el modo de estudio real para un mazo específico.
     * Orden de verificación estricto:
     * 1. Vidas del usuario (Paywall Modal si 0 vidas).
     * 2. Tarjetas del mazo (Alerta de advertencia si 0 tarjetas).
     */
    async startStudy(deckId, deckNameParam = null, cardCount = null) {
        // 1️⃣ VERIFICACIÓN 1: Vidas del Usuario (Zero Latency Paywall Guard)
        if (window.uiManager && typeof window.uiManager.isResourceLocked === 'function') {
            if (window.uiManager.isResourceLocked(true)) {
                console.warn('[RepasoManager] Acceso a estudio bloqueado: 0 vidas disponibles.');
                window.uiManager.showPaywallModal(null, 'flashcards');
                return; // Bloquea la navegación a flashcards al instante
            }
        }

        // 2️⃣ VERIFICACIÓN 2: Conteo de Tarjetas del Mazo
        let totalCards = (cardCount !== null && cardCount !== undefined) ? Number(cardCount) : null;

        if (totalCards === null || isNaN(totalCards)) {
            let deckToVerify = this.currentDeck;
            if (!deckToVerify || String(deckToVerify.id) !== String(deckId)) {
                deckToVerify = this.userDecks?.find(d => String(d.id) === String(deckId));
            }
            if (deckToVerify) {
                totalCards = Number(deckToVerify.total_cards ?? deckToVerify.cards_count ?? deckToVerify.total ?? 0);
            }
        }

        if (totalCards !== null && totalCards === 0) {
            const msg = 'Este mazo no tiene tarjetas para repasar. ¡Crea o agrega tarjetas primero!';
            if (window.uiManager && typeof window.uiManager.showToast === 'function') {
                window.uiManager.showToast(msg, 'warning');
            } else {
                alert(msg);
            }
            return; // Bloquea la navegación porque el mazo está vacío
        }

        const deckName = deckNameParam || this.currentDeck?.name || 'Mazo';
        const deckCategory = this.currentDeck?.category || (this.userDecks && this.userDecks.find(d => String(d.id) === String(deckId))?.category) || 'General';

        // 3️⃣ NAVEGACIÓN: Transferir a flashcards.html con metadatos completos
        const studyUrl = `flashcards?deckId=${deckId}&deckName=${encodeURIComponent(deckName)}&category=${encodeURIComponent(deckCategory)}`;
        window.location.href = studyUrl;
    }

    // --- API Helpers ---

    /**
     * ✅ FETCH DECK BY ID: Centralizado y limpio.
     */
    async getDeckById(id) {
        const res = await window.NetworkService.fetch(`${window.AppConfig.API_URL}/api/decks/${id}`, {
            cache: 'no-cache'
        });

        if (!res.ok) return null;
        const data = await res.json();
        return data.deck;
    }

    async fetchCards(deckId) {
        if (!this.token) {
            const demoDeck = [
                { id: 'demo-fc-1', front_content: '¿Cuál es la tríada de Charcot para la Colangitis Aguda?', back_content: '1. Fiebre\n2. Ictericia\n3. Dolor en hipocondrio derecho', next_review_at: new Date(Date.now() - 10000).toISOString(), interval_days: 0, last_quality: null, topic: 'Gastroenterología' },
                { id: 'demo-fc-2', front_content: 'Mujer de 30 años con exoftalmos, bocio y taquicardia. TSH disminuida y T4 libre elevada. Diagnóstico más probable.', back_content: 'Enfermedad de Graves-Basedow', next_review_at: new Date(Date.now() + 86400000).toISOString(), interval_days: 5, last_quality: 3, topic: 'Endocrinología' },
                { id: 'demo-fc-3', front_content: '¿Cuál es el signo clínico clásico de la apendicitis aguda caracterizado por dolor en fosa ilíaca derecha al presionar la fosa ilíaca izquierda?', back_content: 'Signo de Rovsing', next_review_at: new Date(Date.now() - 50000).toISOString(), interval_days: 1, last_quality: 1, topic: 'Cirugía General' },
                { id: 'demo-fc-4', front_content: '¿Cuál es el tratamiento de elección para la fibrilación auricular en un paciente inestable hemodinámicamente?', back_content: 'Cardioversión eléctrica sincronizada', next_review_at: new Date(Date.now() - 10000).toISOString(), interval_days: 0, last_quality: null, topic: 'Cardiología' },
                { id: 'demo-fc-5', front_content: '¿Cuál es la causa más común de hipertiroidismo a nivel mundial?', back_content: 'Enfermedad de Graves', next_review_at: new Date(Date.now() - 10000).toISOString(), interval_days: 0, last_quality: null, topic: 'Endocrinología' },
                { id: 'demo-fc-6', front_content: 'Signo característico de la colecistitis aguda que consiste en el cese de la inspiración profunda al palpar el hipocondrio derecho.', back_content: 'Signo de Murphy', next_review_at: new Date(Date.now() - 10000).toISOString(), interval_days: 0, last_quality: null, topic: 'Cirugía General' },
                { id: 'demo-fc-7', front_content: '¿Cuál es el agente etiológico más frecuente de la neumonía adquirida en la comunidad?', back_content: 'Streptococcus pneumoniae (Neumococo)', next_review_at: new Date(Date.now() - 10000).toISOString(), interval_days: 0, last_quality: null, topic: 'Neumología' }
            ];
            return demoDeck;
        }


        const res = await window.NetworkService.fetch(`${window.AppConfig.API_URL}/api/decks/${deckId}/cards`, {
            cache: 'no-cache'
        });
        const data = await res.json();
        return data.cards || [];
    }

    // Create Deck (Protected against double-submission)
    async handleCreateDeck(e) {
        e.preventDefault();

        // ✅ GUARD: Prevent double-click / rapid re-submission
        if (this._isCreatingDeck) return;
        this._isCreatingDeck = true;

        const submitBtn = document.getElementById('btn-save-deck');
        const originalBtnText = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Guardando...';
        }

        const deckId = document.getElementById('new-deck-id').value; // Hidden ID field for Edit
        const name = document.getElementById('new-deck-name').value;
        const parentId = document.getElementById('new-deck-parent').value || null;
        const description = document.getElementById('new-deck-description') ? document.getElementById('new-deck-description').value : null;
        const categorySelect = document.getElementById('new-deck-category');
        const category = categorySelect ? categorySelect.value : 'General';

        try {
            if (deckId) {
                // EDIT MODE
                const icon = document.getElementById('new-deck-icon') ? document.getElementById('new-deck-icon').value : null;
                const colorInput = document.getElementById('new-deck-color');
                const color = colorInput ? colorInput.value : null;
                const res = await window.NetworkService.fetch(`${window.AppConfig.API_URL}/api/decks/${deckId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ name, icon, description, color, category })
                });

                if (res.status === 403) {
                    if (window.uiManager) window.uiManager.showPaywallModal(null, 'flashcards');
                    return;
                }

                if (res.ok) {
                    DeckExplorer.closeCreateModal();
                    await this.explorer.loadTree();
                    this.invalidateCache(deckId);
                    if (this.currentDeck && this.currentDeck.id === deckId) {
                        await this.loadFolder(deckId, false);
                    } else {
                        await this.refreshView();
                    }
                    // Sincronización gestionada por NetworkService
                } else {
                    window.uiManager.showToast('❌ Error al actualizar mazo');
                }
            } else {
                // CREATE MODE
                const icon = document.getElementById('new-deck-icon') ? document.getElementById('new-deck-icon').value : null;
                const colorInput = document.getElementById('new-deck-color');
                const color = colorInput ? colorInput.value : null;
                const res = await window.NetworkService.fetch(`${window.AppConfig.API_URL}/api/decks`, {
                    method: 'POST',
                    body: JSON.stringify({ name, icon, parentId, description, color, category })
                });

                if (res.status === 403) {
                    if (window.uiManager) window.uiManager.showPaywallModal(null, 'flashcards');
                    return;
                }

                if (res.ok) {
                    DeckExplorer.closeCreateModal();
                    this.invalidateCache(parentId);
                    await this.explorer.loadTree();
                    if (parentId) await this.loadFolder(parentId, false);
                    else await this.loadDashboard(false);
                    // Sincronización gestionada por NetworkService
                } else {
                    window.uiManager.showToast('❌ Error al crear mazo');
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            this._isCreatingDeck = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
        }
    }

    openEditDeckModal(id, currentName, currentIcon, currentDescription = '', currentColor = '', currentCategory = 'General') {
        // Redundant reset removed, handled by explorer
        DeckExplorer.openCreateModal(null); // Pass null for parent to indicate edit/root

        document.getElementById('modal-deck-title').innerText = 'Editar Mazo';
        document.getElementById('new-deck-name').value = currentName;
        document.getElementById('new-deck-id').value = id;

        const catSelect = document.getElementById('new-deck-category');
        if (catSelect) catSelect.value = currentCategory || 'General';

        const descInput = document.getElementById('new-deck-description');
        if (descInput) {
            // Un-escape HTML to display correctly in textarea
            const temp = document.createElement('textarea');
            temp.innerHTML = currentDescription;
            descInput.value = temp.value;
        }

        if (window.DeckExplorer) {
            window.DeckExplorer.renderIconPicker(currentIcon || 'fas fa-layer-group');
        }

        const submitBtn = document.getElementById('btn-save-deck');
        if (submitBtn) submitBtn.innerText = 'Guardar';
    }

    // Create/Edit Card (Consolidated)
    async handleSaveCard(e) {
        e.preventDefault();
        const deckId = document.getElementById('card-deck-id').value;
        const cardId = document.getElementById('card-id').value;
        const front = document.getElementById('card-front').value.trim();
        const back = document.getElementById('card-back').value.trim();

        const imageUrl = document.getElementById('card-image-url-front').value || null;
        const backImageUrl = document.getElementById('card-image-url-back').value || null;

        // ✅ NUEVO: Capturar preferencias de Audio TTS
        const generateTtsFront = (document.getElementById('card-tts-front')?.checked && front.length >= 2) || false;
        const generateTtsBack = (document.getElementById('card-tts-back')?.checked && back.length >= 2) || false;

        const isAdvanced = ['advanced', 'admin'].includes(this.userTier);
        const hasMedia = imageUrl || backImageUrl || this._pendingFiles.front || this._pendingFiles.back || generateTtsFront || generateTtsBack;

        if (hasMedia && !isAdvanced) {
            if (window.uiManager?.showPaywallModal) {
                window.uiManager.showPaywallModal('La generación de audio TTS y la asignación de imágenes son exclusivas del Plan Avanzado. ¡Mejora tu plan para desbloquearlas!', 'flashcards');
            } else {
                window.uiManager.showToast('⚠️ Audio e imágenes son exclusivos del Plan Avanzado.', 'warning');
            }
            return;
        }

        // 🛡️ VALIDACIÓN DE SEGURIDAD CONDICIONAL (500 con TTS / 1000 texto estándar)
        if (generateTtsFront && front.length > 500) {
            window.uiManager.showToast('⚠️ Al activar audio TTS en el frente, el texto no puede superar 500 caracteres.', 'warning');
            return;
        }
        if (generateTtsBack && back.length > 500) {
            window.uiManager.showToast('⚠️ Al activar audio TTS en el dorso, el texto no puede superar 500 caracteres.', 'warning');
            return;
        }
        if (front.length > 1000 || back.length > 1000) {
            window.uiManager.showToast('⚠️ El texto de la tarjeta no puede superar los 1000 caracteres por cara.', 'warning');
            return;
        }

        if (document.getElementById('card-tts-front')?.checked && front.length < 2) {
            window.uiManager.showToast('El frente debe tener texto para generar audio.', 'warning');
            return;
        }
        if (document.getElementById('card-tts-back')?.checked && back.length < 2) {
            window.uiManager.showToast('El dorso debe tener texto para generar audio.', 'warning');
            return;
        }
        const ttsLangFront = document.getElementById('card-tts-lang-front')?.value || 'es-ES';
        const ttsLangBack = document.getElementById('card-tts-lang-back')?.value || 'es-ES';
        const hideTextFront = document.getElementById('card-hide-text-front')?.checked || false;
        const hideTextBack = document.getElementById('card-hide-text-back')?.checked || false;

        const deleteAudioFront = document.getElementById('card-delete-audio-front')?.value === 'true';
        const deleteAudioBack = document.getElementById('card-delete-audio-back')?.value === 'true';

        // ✅ NUEVO: Manejo según el Modo Activo
        if (this.currentCardMode === 'bulk') {
            if (!this._pendingBulkCards || this._pendingBulkCards.length === 0) {
                window.uiManager.showToast('⚠️ Primero selecciona un archivo Excel válido.', 'warning');
                return;
            }
            await this._saveBulkCards(deckId);
            return;
        }

        // VALIDACIÓN INDIVIDUAL
        if (!front && !imageUrl) {
            window.uiManager.showToast('⚠️ El frente de la tarjeta no puede estar vacío.');
            return;
        }
        if (!back && !backImageUrl) {
            window.uiManager.showToast('⚠️ El dorso de la tarjeta no puede estar vacío.');
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
            // 1. ✅ CARGA INTELIGENTE: Subir archivos pendientes antes de guardar la tarjeta
            let finalImageUrl = imageUrl;
            let finalBackImageUrl = backImageUrl;

            const spinner = document.getElementById('card-upload-spinner');
            if (this._pendingFiles.front || this._pendingFiles.back) {
                if (spinner) spinner.style.display = 'block';
                if (submitBtn) submitBtn.disabled = true;
            }

            if (this._pendingFiles.front) {
                finalImageUrl = await this._uploadFileToGCS(this._pendingFiles.front, 'flashcards');
            }
            if (this._pendingFiles.back) {
                finalBackImageUrl = await this._uploadFileToGCS(this._pendingFiles.back, 'flashcards');
            }

            const payload = {
                front,
                back,
                imageUrl: finalImageUrl,
                backImageUrl: finalBackImageUrl,
                generateTtsFront,
                generateTtsBack,
                ttsLangFront,
                ttsLangBack,
                hideTextFront,
                hideTextBack,
                deleteAudioFront,
                deleteAudioBack
            };
            let res;

            if (cardId) {
                res = await window.NetworkService.fetch(`${window.AppConfig.API_URL}/api/cards/${cardId}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
            } else {
                res = await window.NetworkService.fetch(`${window.AppConfig.API_URL}/api/decks/${deckId}/cards`, {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
            }

            if (res.status === 403) {
                const errorData = await res.json().catch(() => ({}));
                if (window.uiManager) window.uiManager.showPaywallModal(errorData.error, 'flashcards');
                return;
            }

            if (res.ok) {
                this.invalidateCache(deckId);
                this.closeCardModal();
                this.loadFolder(deckId, false);
                this._pendingBulkCards = [];
                // Sincronización gestionada por NetworkService
            } else {
                const errorData = await res.json().catch(() => ({}));
                window.uiManager.showToast(`❌ Error al guardar tarjeta: ${errorData.error || res.statusText}`);
            }
        } catch (err) {
            console.error('Save card error:', err);
            if (!err.isPaywall) {
                window.uiManager.showToast(`❌ ${err.message || 'Error de red al guardar tarjeta.'}`);
            }
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        }
    }

    /**
     * Helper interno para subir archivos a GCS
     */
    async _uploadFileToGCS(file, folder) {
        const formData = new FormData();
        formData.append('file', file);

        const res = await window.NetworkService.fetch(`${window.AppConfig.API_URL}/api/cards/upload-image`, {
            method: 'POST',
            body: formData
        });

        let data;
        try {
            const text = await res.text();
            data = JSON.parse(text);
        } catch (e) {
            throw new Error(`Error del servidor (${res.status}). Es posible que la imagen sea demasiado pesada.`);
        }

        if (res.status === 403) {
            const errMsg = data?.error || 'La subida de imágenes para tarjetas es una función exclusiva del Plan Avanzado.';
            if (window.uiManager) window.uiManager.showPaywallModal(errMsg, 'flashcards');
            const paywallErr = new Error(errMsg);
            paywallErr.isPaywall = true;
            throw paywallErr;
        }

        if (res.ok && data.imageUrl) {
            return data.imageUrl;
        } else {
            throw new Error(data.error || 'Error al subir imagen');
        }
    }

    openEditCardModal(id, front, back, imageUrl = '', backImageUrl = '', audioUrlFront = '', audioUrlBack = '', ttsLangFront = 'es-ES', ttsLangBack = 'es-ES', hideTextFront = false, hideTextBack = false) {
        this._clearCardModal(); // 🧹 Limpieza atómica antes de cargar datos nuevos

        document.getElementById('card-deck-id').value = this.currentDeck.id;
        document.getElementById('card-id').value = id;
        document.getElementById('card-front').value = front;
        document.getElementById('card-back').value = back;
        document.getElementById('modal-title').innerText = 'Editar Tarjeta';

        // ✅ Cargar configuración TTS y visibilidad
        const langFront = document.getElementById('card-tts-lang-front');
        const langBack = document.getElementById('card-tts-lang-back');
        if (langFront) langFront.value = ttsLangFront || 'es-ES';
        if (langBack) langBack.value = ttsLangBack || 'es-ES';

        const hideFront = document.getElementById('card-hide-text-front');
        const hideBack = document.getElementById('card-hide-text-back');
        if (hideFront) hideFront.checked = hideTextFront || false;
        if (hideBack) hideBack.checked = hideTextBack || false;

        // ✅ UI Dinámica para Audio
        const ttsFrontLabel = document.querySelector('label[for="card-tts-front"]');
        const ttsBackLabel = document.querySelector('label[for="card-tts-back"]');

        if (ttsFrontLabel) ttsFrontLabel.innerText = audioUrlFront ? 'Actualizar/Regenerar audio' : 'Generar audio TTS';
        if (ttsBackLabel) ttsBackLabel.innerText = audioUrlBack ? 'Actualizar/Regenerar audio' : 'Generar audio TTS';

        const statusFront = document.getElementById('audio-status-front');
        const statusBack = document.getElementById('audio-status-back');
        if (statusFront) statusFront.style.display = audioUrlFront ? 'flex' : 'none';
        if (statusBack) statusBack.style.display = audioUrlBack ? 'flex' : 'none';

        // Previews Anverso
        this._updateImagePreview('front', imageUrl);
        const imgUrlFront = document.getElementById('card-image-url-front');
        if (imgUrlFront) imgUrlFront.value = imageUrl || '';

        // Previews Reverso
        this._updateImagePreview('back', backImageUrl);
        const imgUrlBack = document.getElementById('card-image-url-back');
        if (imgUrlBack) imgUrlBack.value = backImageUrl || '';

        document.getElementById('card-modal').classList.add('active');

        // Ocultar pestañas al editar y forzar modo individual
        const tabs = document.getElementById('card-modal-tabs');
        if (tabs) tabs.style.display = 'none';
        this.switchCardMode('individual');

        // Sincronizar selectores de idioma
        this.syncTtsLanguageSelectors();

        if (window.uiManager && typeof window.uiManager.pushModalState === 'function') {
            window.uiManager.pushModalState('card-modal');
        }
    }

    switchCardMode(mode) {
        if (mode === 'bulk' && this.userTier === 'free') {
            if (window.uiManager?.showPaywallModal) {
                window.uiManager.showPaywallModal('La Carga Masiva (Excel) es una función para usuarios con plan Basic o Advanced. ¡Ahorra tiempo mejorando tu plan!', 'flashcards');
            } else {
                window.uiManager.showToast('⚠️ La Carga Masiva requiere plan Basic o Advanced.', 'warning');
            }
            return;
        }

        this.currentCardMode = mode;

        // UI Tabs
        document.getElementById('tab-card-individual').classList.toggle('active', mode === 'individual');
        document.getElementById('tab-card-bulk').classList.toggle('active', mode === 'bulk');

        // UI Sections
        document.getElementById('section-card-individual').style.display = mode === 'individual' ? 'block' : 'none';
        document.getElementById('section-card-bulk').style.display = mode === 'bulk' ? 'block' : 'none';
    }

    _updateImagePreview(side, url) {
        const previewBox = document.getElementById(`preview-${side}`);
        const img = document.getElementById(`img-${side}`);
        const urlInput = document.getElementById(`card-image-url-${side}`);
        const trigger = document.getElementById(`btn-trigger-${side}`);

        if (url) {
            urlInput.value = url;
            // Si es un Blob local (previsualización inteligente), no resolver por GCS
            img.src = url.startsWith('blob:') ? url : window.resolveImageUrl(url);
            previewBox.style.display = 'block';
            trigger.style.display = 'none';
        } else {
            urlInput.value = '';
            previewBox.style.display = 'none';
            trigger.style.display = 'flex';
        }
    }

    /**
     * ✅ CARGA INTELIGENTE: Solo genera previsualización local.
     */
    async handleImageUpload(input, side) {
        const isAdvanced = ['advanced', 'admin'].includes(this.userTier);
        if (!isAdvanced) {
            input.value = '';
            if (window.uiManager?.showPaywallModal) {
                window.uiManager.showPaywallModal('La asignación de imágenes a flashcards es una función exclusiva del Plan Avanzado. ¡Mejora tu plan para activarla!', 'flashcards');
            } else {
                window.uiManager.showToast('⚠️ Asignar imágenes es exclusivo del Plan Avanzado.', 'warning');
            }
            return;
        }

        const file = input.files[0];
        if (!file) return;

        // Validar tamaño (ej: 5MB)
        if (file.size > 5 * 1024 * 1024) {
            window.uiManager.showToast('⚠️ La imagen es demasiado grande (máx 5MB)');
            input.value = '';
            return;
        }

        this._pendingFiles[side] = file;
        const localUrl = URL.createObjectURL(file);
        this._updateImagePreview(side, localUrl);
        input.value = '';
    }

    removeAudio(side) {
        const status = document.getElementById(`audio-status-${side}`);
        if (status) status.style.display = 'none';
        const deleteInput = document.getElementById(`card-delete-audio-${side}`);
        if (deleteInput) deleteInput.value = 'true';
    }

    removeImage(side) {
        // Si había un blob local, liberamos memoria
        const currentUrl = document.getElementById(`card-image-url-${side}`).value;
        if (currentUrl.startsWith('blob:')) {
            URL.revokeObjectURL(currentUrl);
        }

        this._pendingFiles[side] = null;
        this._updateImagePreview(side, '');
    }

    // --- CARGA MASIVA EXCEL (NUEVO) ---

    downloadFlashcardTemplate() {
        if (typeof window.XLSX === 'undefined') return window.uiManager.showToast('Error: Cargando motor de Excel...');

        const ws_data = [
            ["Frente", "Dorso"],
            ["¿Cuál es la capital de Perú?", "Lima"],
            ["Nombre del neurotransmisor principal de la placa motora", "Acetilcolina (ACh)"],
            ["Triada de Virchow", "1. Estasis venosa\n2. Daño endotelial\n3. Hipercoagulabilidad"]
        ];

        const ws = window.XLSX.utils.aoa_to_sheet(ws_data);
        const wb = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(wb, ws, "Flashcards");
        window.XLSX.writeFile(wb, "HubAcademia_Plantilla_Flashcards.xlsx");
    }

    async handleBulkFlashcardUpload(input) {
        const file = input.files[0];
        if (!file) return;

        if (typeof window.XLSX === 'undefined') {
            window.uiManager.showToast('⏳ El procesador de Excel no está listo. Reintenta en breve.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = window.XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const rows = window.XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                // Procesar filas (omitir encabezado)
                const newCards = [];
                const headers = rows[0] || [];

                // Validación estricta de encabezados
                const frontIdx = headers.findIndex(h => h && h.toString().toLowerCase().includes('frente'));
                const backIdx = headers.findIndex(h => h && h.toString().toLowerCase().includes('dorso'));

                if (frontIdx === -1 || backIdx === -1) {
                    window.uiManager.showToast('❌ El Excel no tiene las columnas "Frente" y "Dorso".', 'error');
                    input.value = '';
                    return;
                }

                for (let i = 1; i < rows.length; i++) {
                    const front = rows[i][frontIdx]?.toString().trim();
                    const back = rows[i][backIdx]?.toString().trim();
                    if (front && back) {
                        // 🛡️ VALIDACIÓN DE LONGITUD (FRONTEND - 1000 caracteres estándar)
                        if (front.length > 1000 || back.length > 1000) {
                            window.uiManager.showToast(`⚠️ Fila ${i + 1} ignorada: Máximo 1000 caracteres permitidos.`, 'warning');
                            continue;
                        }
                        newCards.push({ front, back });
                    }
                }

                // LÍMITE: 100 tarjetas por Excel
                if (newCards.length > 100) {
                    window.uiManager.showToast(`⚠️ Máximo 100 tarjetas por carga (Detectadas: ${newCards.length}). Por favor, reduce el archivo.`);
                    input.value = '';
                    return;
                }

                if (newCards.length === 0) {
                    window.uiManager.showToast('⚠️ No se detectaron tarjetas válidas en el archivo.', 'warning');
                    input.value = '';
                    return;
                }

                this._pendingBulkCards = newCards;

                // UI Feedback
                const preview = document.getElementById('bulk-upload-preview');
                const text = document.getElementById('bulk-count-text');
                const fileLabel = document.getElementById('bulk-file-label');

                if (fileLabel) fileLabel.textContent = file.name;

                if (preview && text) {
                    text.textContent = `${newCards.length} tarjetas detectadas listas para guardar.`;
                    preview.style.display = 'block';
                }

            } catch (err) {
                console.error(err);
                window.uiManager.showToast('❌ Error al leer el archivo Excel.');
            }
        };
        reader.readAsArrayBuffer(file);
    }

    async _saveBulkCards(deckId) {
        const isAdvanced = ['advanced', 'admin'].includes(this.userTier);
        const generateTtsFront = document.getElementById('bulk-tts-front')?.checked || false;
        const generateTtsBack = document.getElementById('bulk-tts-back')?.checked || false;

        if ((generateTtsFront || generateTtsBack) && !isAdvanced) {
            if (window.uiManager?.showPaywallModal) {
                window.uiManager.showPaywallModal('La generación de audio TTS en carga masiva es una función exclusiva del Plan Avanzado. ¡Mejora tu plan para activarla!', 'flashcards');
            } else {
                window.uiManager.showToast('⚠️ Audio TTS masivo es exclusivo del Plan Avanzado.', 'warning');
            }
            return;
        }

        // 🛡️ VALIDACIÓN DE LONGITUD CONDICIONAL (500 chars si se activa Audio TTS)
        if (generateTtsFront || generateTtsBack) {
            const hasOverlength = this._pendingBulkCards.some(c =>
                (generateTtsFront && c.front && c.front.length > 500) ||
                (generateTtsBack && c.back && c.back.length > 500)
            );
            if (hasOverlength) {
                window.uiManager.showToast('⚠️ Al activar audio TTS, ninguna tarjeta en el Excel puede superar los 500 caracteres por cara.', 'warning');
                return;
            }
        }

        const submitBtn = document.querySelector('#card-form button[type="submit"]');
        const originalText = submitBtn ? submitBtn.innerHTML : '';

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Subiendo mazo...';
        }

        try {
            const res = await window.uiManager.safeFetch(`${window.AppConfig.API_URL}/api/decks/${deckId}/cards/batch`, {
                method: 'POST',
                isRetryable: true,
                body: JSON.stringify({
                    cards: this._pendingBulkCards,
                    generateTtsFront,
                    generateTtsBack,
                    ttsLang: document.getElementById('bulk-tts-lang')?.value || 'es-ES'
                })
            });

            if (res.ok) {
                this.invalidateCache(deckId);
                this._pendingBulkCards = [];
                this.closeCardModal();
                this.loadFolder(deckId);
                // Sincronización gestionada por NetworkService
                if (window.uiManager.showToast) window.uiManager.showToast('¡Carga masiva completada con éxito!', 'success');
            } else {
                const data = await res.json();
                window.uiManager.showToast('❌ Error en carga masiva: ' + (data.error || 'Fallo desconocido'));
            }
        } catch (err) {
            console.error(err);
            window.uiManager.showToast('❌ Error de red en la carga masiva.');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        }
    }

    // AI Generation
    async generateAiCards() {
        const topic = document.getElementById('ai-topic')?.value;
        const amount = document.getElementById('ai-amount')?.value || 5;
        if (!topic) return window.uiManager.showToast('✍️ Escribe un tema para la IA');

        document.getElementById('ai-loading').style.display = 'block';

        try {
            const res = await window.uiManager.safeFetch(`${window.AppConfig.API_URL}/api/decks/${this.currentDeck.id}/generate`, {
                method: 'POST',
                isRetryable: true,
                body: JSON.stringify({
                    topic,
                    amount,
                    generateTtsFront: document.getElementById('ai-tts-front')?.checked || false,
                    generateTtsBack: document.getElementById('ai-tts-back')?.checked || false,
                    ttsLang: document.getElementById('ai-tts-lang')?.value || 'es-ES'
                })
            });

            if (res.status === 403) {
                const errorData = await res.json().catch(() => ({}));
                if (window.uiManager) window.uiManager.showPaywallModal(errorData.error, 'flashcards');
                document.getElementById('ai-loading').style.display = 'none';
                return;
            }

            if (res.ok) {
                const data = await res.json().catch(() => ({ count: 5 }));
                this.closeAiModal();
                this.loadFolder(this.currentDeck.id);
                // Sincronización gestionada por NetworkService

                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'success',
                        title: '¡Tarjetas Generadas!',
                        text: `Se generaron ${data.count || 5} tarjetas sobre "${topic}".`,
                        background: 'rgba(20, 20, 20, 0.95)',
                        confirmButtonText: 'A estudiar'
                    });
                } else {
                    window.uiManager.showToast(`✅ ¡Éxito! Se generaron tarjetas sobre "${topic}".`);
                }
            } else {
                const errorData = await res.json().catch(() => ({}));
                this.closeAiModal();
                if (typeof Swal !== 'undefined') {
                    Swal.fire('Error del Servidor', errorData.error || 'Hubo un fallo generando las tarjetas. Intenta de nuevo.', 'error');
                } else {
                    window.uiManager.showToast('❌ Error al generar tarjetas: ' + (errorData.error || 'Fallo desconocido'));
                }
            }
        } catch (err) {
            console.error('Network Error AI Cards:', err);
            this.closeAiModal();
            if (typeof Swal !== 'undefined') {
                Swal.fire('Error de Conexión', 'No se pudo contactar con el servidor. Revisa tu internet.', 'error');
            } else {
                window.uiManager.showToast('❌ Error de conexión al generar con IA.');
            }
        } finally {
            document.getElementById('ai-loading').style.display = 'none';
        }
    }


    /**
     * Verifica de forma pasiva (sin descontar nada) si el usuario es elegible
     * para generar tarjetas por IA usando su límite mensual o global.
     */
    async _checkUsageLimit() {
        try {
            const res = await window.uiManager.safeFetch(`${window.AppConfig.API_URL}/api/usage/check-ai-limits`, {
                method: 'GET'
            });

            const data = await res.json().catch(() => ({}));

            if (res.ok) {
                return true;
            } else if (res.status === 403) {
                // Bifurcación Inteligente UI: Vida de Prueba vs Límite Básico/Avanzado
                if (window.uiManager && window.uiManager.showPaywallModal) {
                    window.uiManager.showPaywallModal(null, 'flashcards');
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
            const res = await window.NetworkService.fetch(`${window.AppConfig.API_URL}/api/decks/${deckId}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                this.invalidateCache(deckId);
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
                // Sincronización gestionada por NetworkService
            } else {
                window.uiManager.showToast('❌ No se pudo eliminar el mazo');
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
            const res = await window.NetworkService.fetch(`${window.AppConfig.API_URL}/api/cards/${cardId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                if (this.currentDeck) {
                    this.invalidateCache(this.currentDeck.id);
                    this.loadFolder(this.currentDeck.id, false);
                }
            } else {
                window.uiManager.showToast('❌ No se pudo eliminar la tarjeta');
            }
        } catch (err) {
            console.error(err);
        }

    }

    /**
     * Entry point for Visitors to see the study UI.
     * Uses dummy data and triggers the Join Modal at the end.
     */
    startStudyDemo(deckId) {
        // ✅ GUARD: Si ya completó la demo, bloqueamos antes de salir de la página
        if (localStorage.getItem('hasCompletedDemo') === 'true') {
            if (window.uiManager) {
                window.uiManager.showAuthPromptModal();
            }
            return;
        }

        if (typeof window.uiManager !== 'undefined' && window.uiManager.showToast) {
            window.uiManager.showToast('Iniciando modo demostración...', 'info');
        }
        // Redirect to flashcards study page with demo flag
        window.location.href = `flashcards?deckId=${deckId}&demo=true`;
    }

    renderGuestBanner() {
        // Desactivado a solicitud del usuario
    }

    updateGuestBanner() {
        const banner = document.getElementById('guest-mode-banner-premium');
        if (banner) banner.remove();
    }

    closePreviewModal() {
        const modal = document.getElementById('preview-deck-modal');
        if (modal) {
            modal.classList.remove('active');
            if (window.uiManager && typeof window.uiManager.popModalState === 'function') {
                window.uiManager.popModalState('preview-deck-modal');
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.repasoManager = new RepasoManager();
    window.repasoManager.init();
});
