/**
 * Logic for Deck Details Management (Anki-style)
 */

const DeckDetails = (() => {
    // Current State
    let currentDeckId = null;
    let allCards = [];

    // --- Init ---
    async function init() {
        // Get Deck ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        currentDeckId = urlParams.get('id');

        if (!currentDeckId) {
            window.location.href = 'repaso';
            return;
        }

        await loadDeckInfo();
        await loadCards();
    }

    // --- Data Loading ---
    async function loadDeckInfo() {
        try {
            const token = localStorage.getItem('authToken');
            // We reuse the listDecks endpoint but we filter client-side or we implement a getDeck endpoint.
            // For now, let's assume we have to find it from the list (MVP) or impl a specific endpoint.
            // A better way: fetch /api/decks and find the one. 
            // In Phase 2, we created /api/decks (List).

            // Fetch specific deck by ID
            const res = await fetch(`${window.AppConfig.API_URL}/api/decks/${currentDeckId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error('Error cargando mazo');

            const response = await res.json();
            const deck = response.deck;

            if (!deck) throw new Error('Mazo no encontrado');

            // Render Info
            document.getElementById('deck-icon').textContent = deck.icon || '📚';
            document.getElementById('deck-title').textContent = deck.name;

            // These we might update from the cards list for precision
            document.getElementById('total-cards').textContent = deck.total_cards || 0;
            document.getElementById('due-cards').textContent = deck.due_cards || 0;

            // Reveal
            document.getElementById('deck-header-loading').style.display = 'none';
            document.getElementById('deck-header-content').style.display = 'flex';

        } catch (error) {
            console.error(error);
            alert('Error cargando información del mazo.');
        }
    }

    async function loadCards() {
        try {
            const token = localStorage.getItem('authToken');
            // Endpoint not yet created, we assume /api/decks/:id/cards
            const res = await fetch(`${window.AppConfig.API_URL}/api/decks/${currentDeckId}/cards`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error('Error cargando tarjetas');

            const data = await res.json();
            allCards = data.cards || [];

            renderCardsList(allCards);

            // Update stats client side just in case
            document.getElementById('total-cards').textContent = allCards.length;
            // update mastered count?
            const mastered = allCards.filter(c => c.repetition_number > 3 || c.interval_days > 21).length;
            document.getElementById('mastered-cards').textContent = mastered;

        } catch (error) {
            console.error(error);
            // alert('Error cargando tarjetas (Endpoint pendiente).');
        }
    }

    // --- Rendering ---
    function renderCardsList(cards) {
        const list = document.getElementById('cards-list');
        list.innerHTML = '';

        if (cards.length === 0) {
            document.getElementById('cards-empty').style.display = 'block';
            return;
        }
        document.getElementById('cards-empty').style.display = 'none';

        cards.forEach(card => {
            const row = document.createElement('div');
            row.className = 'flashcard-row';
            row.innerHTML = `
                <div class="card-front" title="${escapeHtml(card.front_content)}">${escapeHtml(card.front_content)}</div>
                <div class="card-back" title="${escapeHtml(card.back_content)}">${escapeHtml(card.back_content)}</div>
                <div class="card-actions">
                    <button class="btn-icon-small btn-edit" onclick="DeckDetails.editCard('${card.id}')"><i class="fas fa-pen"></i></button>
                    <button class="btn-icon-small btn-delete" onclick="DeckDetails.deleteCard('${card.id}')"><i class="fas fa-trash"></i></button>
                </div>
            `;
            list.appendChild(row);
        });
    }

    let editingCardId = null; // Track editing state

    // --- Actions ---
    function startStudy() {
        // Pass deck name for UI Context
        const deckName = document.getElementById('deck-title').textContent;
        window.location.href = `flashcards?deckId=${currentDeckId}&deckName=${encodeURIComponent(deckName)}`;
    }

    function openAddModal() {
        editingCardId = null; // Reset
        document.getElementById('modal-title').textContent = 'Nueva Tarjeta';
        document.getElementById('card-modal').classList.add('active');
        document.getElementById('card-form').reset();
    }

    function closeModal() {
        document.getElementById('card-modal').classList.remove('active');
        editingCardId = null;
    }

    function filterCards() {
        const term = document.getElementById('search-input').value.toLowerCase();
        const filtered = allCards.filter(c =>
            c.front_content.toLowerCase().includes(term) ||
            c.back_content.toLowerCase().includes(term)
        );
        renderCardsList(filtered);
    }

    // --- Actions ---
    async function deleteCard(cardId) {
        if (!confirm('¿Estás seguro de eliminar esta tarjeta?')) return;

        const token = localStorage.getItem('authToken');
        try {
            const res = await fetch(`${window.AppConfig.API_URL}/api/cards/${cardId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                loadCards(); // Refresh
                loadDeckInfo(); // Refresh stats
            } else {
                alert('Error al eliminar');
            }
        } catch (e) {
            console.error(e);
        }
    }

    function editCard(cardId) {
        const card = allCards.find(c => c.id === cardId);
        if (!card) return;

        editingCardId = cardId; // Set active edit

        // Populate Modal
        document.getElementById('modal-title').textContent = 'Editar Tarjeta';
        document.getElementById('card-front').value = card.front_content;
        document.getElementById('card-back').value = card.back_content;

        document.getElementById('card-modal').classList.add('active');
    }

    // --- CRUD ---
    async function handleSave(e) {
        e.preventDefault();
        const front = document.getElementById('card-front').value;
        const back = document.getElementById('card-back').value;
        const token = localStorage.getItem('authToken');

        try {
            let url, method;

            if (editingCardId) {
                // Update
                url = `${window.AppConfig.API_URL}/api/cards/${editingCardId}`;
                method = 'PUT';
            } else {
                // Create
                url = `${window.AppConfig.API_URL}/api/decks/${currentDeckId}/cards`;
                method = 'POST';
            }

            const res = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ front, back })
            });

            if (!res.ok) throw new Error('Error guardando');

            closeModal();
            loadCards(); // Refresh
            loadDeckInfo(); // Refresh stats
        } catch (error) {
            alert('Error al guardar tarjeta');
            console.error(error);
        }
    }

    // Helpers
    function escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Hook events
    document.getElementById('card-form').addEventListener('submit', handleSave);

    function showStats() {
        // Calculate fresh stats from local cards array
        const total = allCards.length;
        const mastered = allCards.filter(c => c.repetition_number > 3 || c.interval_days > 21).length;

        document.getElementById('modal-total').textContent = total;
        document.getElementById('modal-mastered').textContent = mastered;
        document.getElementById('stats-modal').classList.add('active');

        // Init Heatmap (Lazy Load)
        if (window.ActivityHeatmap) {
            const heatmap = new window.ActivityHeatmap('activity-heatmap');
            heatmap.init();
        }
    }

    // --- AI Generation ---
    // Función interna para chequear límite global o mensual sin gastarlos
    async function checkUsageLimit() {
        try {
            const token = localStorage.getItem('authToken');
            const res = await fetch(`${window.AppConfig.API_URL}/api/usage/check-ai-limits`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await res.json().catch(() => ({}));

            if (res.ok) {
                return true;
            } else if (res.status === 403) {
                if (data.reason === 'FREE_LIVES_EXHAUSTED') {
                    if (window.uiManager && typeof window.uiManager.showPaywallModal === 'function') {
                        window.uiManager.showPaywallModal();
                    } else {
                        alert(data.error || 'Has agotado tus vidas de Prueba.');
                    }
                } else {
                    showLimitModal(data.error || 'Has agotado tus tarjetas mensuales. Mejora tu plan.');
                }
                return false;
            } else {
                return true; // Fail open for other weird errors
            }
        } catch (err) {
            console.error('Error verificando límites globales (Red):', err);
            return true; // Fail open
        }
    }

    async function openAiModal() {
        const allowed = await checkUsageLimit();
        if (!allowed) return;

        document.getElementById('ai-topic').value = '';
        document.getElementById('ai-loading').style.display = 'none';
        document.getElementById('ai-modal').classList.add('active');
    }

    async function generateAiCards() {
        const topic = document.getElementById('ai-topic').value;
        if (!topic) return alert('Por favor escribe un tema.');

        // UI Loading
        document.getElementById('ai-loading').style.display = 'block';

        try {
            const token = localStorage.getItem('authToken');
            const res = await fetch(`${window.AppConfig.API_URL}/api/decks/${currentDeckId}/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ topic })
            });

            if (res.ok) {
                const data = await res.json();
                document.getElementById('ai-modal').classList.remove('active');
                await loadCards(); // Refresh list associated with deck
                await loadDeckInfo(); // Refresh counts

                // Mostrar alerta bonita de éxito en vez del window.alert si está disponible
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'success',
                        title: '¡Tarjetas Generadas!',
                        text: `Se generaron ${data.count} tarjetas sobre "${topic}".`,
                        background: 'rgba(20, 20, 20, 0.95)',
                        confirmButtonText: 'Genial'
                    });
                } else {
                    alert(`✨ ¡Éxito! Se generaron ${data.count} tarjetas sobre "${topic}".`);
                }
            } else if (res.status === 403) {
                const data = await res.json().catch(() => ({}));
                document.getElementById('ai-modal').classList.remove('active');
                showLimitModal(data.error || 'Has agotado tus tarjetas mensuales. Mejora tu plan.');
            } else {
                const errorData = await res.json().catch(() => ({}));
                document.getElementById('ai-modal').classList.remove('active');
                if (typeof Swal !== 'undefined') {
                    Swal.fire('Error del Servidor', errorData.error || 'Hubo un fallo generando las tarjetas. Intenta de nuevo.', 'error');
                } else {
                    alert('Error al generar tarjetas: ' + (errorData.error || 'Fallo desconocido'));
                }
            }

        } catch (error) {
            console.error('Network Error AI Cards:', error);
            document.getElementById('ai-modal').classList.remove('active');
            if (typeof Swal !== 'undefined') {
                Swal.fire('Error de Conexión', 'No se pudo contactar con el servidor. Revisa tu internet.', 'error');
            } else {
                alert('Error de conexión al generar la IA.');
            }
        } finally {
            document.getElementById('ai-loading').style.display = 'none';
        }
    }

    // Modal helpers genéricos
    function showLimitModal(msg) {
        if (document.getElementById('custom-limit-modal')) return;
        const modalHtml = `
            <div class="modal-overlay" id="custom-limit-modal" style="display:flex; position:fixed; top:0; left:0; width:100%; height:100%; justify-content:center; align-items:center; background:rgba(15,23,42,0.85); z-index:9999; opacity:1 !important; visibility:visible !important;">
                <div class="modal-content" style="background:#1e293b; padding:2rem; border-radius:12px; border:1px solid rgba(255,255,255,0.1); max-width:400px; text-align:center; box-shadow:0 20px 40px rgba(0,0,0,0.5);">
                    <div style="margin-bottom:1.5rem;">
                        <i class="fas fa-exclamation-circle" style="font-size:3rem; color:#f87171;"></i>
                    </div>
                    <h2 style="margin-bottom:1rem; font-size:1.4rem; color:var(--text-main);">Límite Alcanzado</h2>
                    <p style="color:var(--text-muted); font-size:0.95rem; margin-bottom:2rem; padding:0 1rem;">${msg}</p>
                    <button class="btn-action" style="background:#3b82f6; color:white; padding:0.8rem 2rem; border-radius:8px; border:none; width:100%; cursor:pointer;" onclick="document.getElementById('custom-limit-modal').remove()">Entendido</button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    return {
        init,
        startStudy,
        openAddModal,
        openAiModal,
        generateAiCards,
        closeModal,
        filterCards,
        deleteCard,
        editCard,
        showStats
    };

})();

document.addEventListener('DOMContentLoaded', DeckDetails.init);
