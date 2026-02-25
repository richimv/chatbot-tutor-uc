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
            window.location.href = '/repaso';
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
            const res = await fetch(`/api/decks/${currentDeckId}`, {
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
            const res = await fetch(`/api/decks/${currentDeckId}/cards`, {
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
        window.location.href = `/flashcards?deckId=${currentDeckId}&deckName=${encodeURIComponent(deckName)}`;
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
            const res = await fetch(`/api/cards/${cardId}`, {
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
                url = `/api/cards/${editingCardId}`;
                method = 'PUT';
            } else {
                // Create
                url = `/api/decks/${currentDeckId}/cards`;
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
    function openAiModal() {
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
            const res = await fetch(`/api/decks/${currentDeckId}/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ topic })
            });

            const data = await res.json();

            if (data.success) {
                document.getElementById('ai-modal').classList.remove('active');
                await loadCards(); // Refresh list associated with deck
                await loadDeckInfo(); // Refresh counts
                alert(`✨ ¡Éxito! Se generaron ${data.count} tarjetas sobre "${topic}".`);
            } else {
                alert('Error: ' + (data.error || 'No se pudo generar.'));
            }

        } catch (error) {
            console.error(error);
            alert('Error de conexión con la IA.');
        } finally {
            document.getElementById('ai-loading').style.display = 'none';
        }
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
