/**
 * Flashcard Manager (Senior Version)
 * Handles State, API Communication, and UI Transitions responsibly.
 */

const FlashcardManager = (() => {
    // --- Config & State ---
    const API_URL = `${window.AppConfig.API_URL}/api/training/flashcards`;
    let queue = [];
    let currentCard = null;
    let isFlipped = false;

    // --- DOM Elements ---
    const views = {
        loading: document.getElementById('view-loading'),
        empty: document.getElementById('view-empty'),
        card: document.getElementById('view-card')
    };

    const ui = {
        card: document.getElementById('flashcard'),
        frontText: document.getElementById('front-text'),
        backText: document.getElementById('back-text'),
        topic: document.getElementById('card-topic'),
        controls: document.getElementById('controls'),
        pendingCount: document.getElementById('pending-count')
    };

    // --- State Machine ---
    function setView(viewName) {
        // Ocultar todo
        Object.values(views).forEach(el => el.classList.remove('active'));
        // Mostrar target
        if (views[viewName]) {
            views[viewName].classList.add('active');
            console.log(`State changed to: ${viewName}`); // Debug
        }
    }

    // --- Initialization ---
    async function init() {
        setView('loading');

        const token = localStorage.getItem('authToken');
        if (!token) {
            window.location.href = '/login';
            return;
        }

        try {
            await loadCards(token);
        } catch (error) {
            console.error("Critical Error:", error);
            // Fallback: mostrar empty o error
            setView('empty');
        }
    }

    // --- Logic ---
    // --- Logic ---
    async function loadCards(token) {
        const urlParams = new URLSearchParams(window.location.search);
        const deckId = urlParams.get('deckId');

        // Modificar el botón de "Progreso/Salir" según el contexto
        const progressBtn = document.getElementById('btn-progress');
        if (progressBtn) {
            if (deckId) {
                progressBtn.href = `/repaso?deckId=${deckId}`;
                progressBtn.innerHTML = '<i class="fas fa-arrow-left"></i> Volver al Mazo';
            } else {
                progressBtn.href = '/simulators';
                progressBtn.innerHTML = '<i class="fas fa-home"></i> Ir al Hub';
            }
        }

        // Also update the 'Todo al día' modal button
        const backDeckBtn = document.getElementById('btn-back-deck');
        if (backDeckBtn && deckId) {
            backDeckBtn.href = `/repaso?deckId=${deckId}`;
        }

        // 2. Build URL based on context (Deck vs Global)
        let endpoint = `${API_URL}/due`; // Default Legacy Global
        if (deckId) {
            endpoint = `${window.AppConfig.API_URL}/api/decks/${deckId}/cards/due`;
        }

        const res = await fetch(endpoint, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('API Failed');

        const data = await res.json();

        if (data.cards && data.cards.length > 0) {
            queue = data.cards;
            updatePendingCount();
            renderCard(queue[0]);
            setView('card');
        } else {
            setView('empty');
        }
    }

    function renderCard(card) {
        currentCard = card;
        isFlipped = false;

        // Reset UI
        ui.card.classList.remove('is-flipped');
        ui.controls.classList.remove('visible');

        // Content (Prevent XSS safely via textContent)
        // Logic: Use card topic if available (system decks), otherwise use Deck Name from URL, otherwise 'GENERAL'
        const urlParams = new URLSearchParams(window.location.search);
        const deckName = urlParams.get('deckName');

        ui.topic.textContent = card.topic || deckName || 'GENERAL';
        ui.frontText.textContent = card.front_content;
        ui.backText.textContent = card.back_content;

        // 🟢 FIX: Adjust Font Size to fit container (Prevent Overflow)
        // We use a timeout to let the DOM render the content first (even if microseconds)
        // actually not needed if synchronous, but better for layout reflow calc.
        requestAnimationFrame(() => {
            adjustFontSize(ui.frontText);
            adjustFontSize(ui.backText);
        });
    }

    /**
     * Dynamically adjusts font size based on text length and container size.
     */
    function adjustFontSize(element) {
        element.classList.remove('sized');
        element.style.overflow = 'hidden';

        const isMobile = window.innerWidth <= 768;
        const textLength = element.textContent.length;

        // Base sizing heuristics based on character count
        let size = isMobile ? 1.2 : 2.0;

        if (textLength > 50) size = isMobile ? 1.1 : 1.6;
        if (textLength > 150) size = isMobile ? 1.0 : 1.4;
        if (textLength > 300) size = isMobile ? 0.9 : 1.1;

        const minSize = 0.7;
        const step = 0.05;

        element.style.fontSize = `${size}rem`;

        // Reduce font incrementally if it STILL overflows vertically
        while (element.scrollHeight > element.clientHeight && size > minSize) {
            size -= step;
            element.style.fontSize = `${size}rem`;
        }

        // If it still overflows after max shrinkage, enable scrollbar
        element.style.overflow = '';
        if (element.scrollHeight > element.clientHeight) {
            element.classList.add('sized');
        }
    }

    function toggleFlip() {
        isFlipped = !isFlipped;
        if (isFlipped) {
            ui.card.classList.add('is-flipped');
            ui.controls.classList.add('visible'); // Show controls when answer is revealed
        } else {
            ui.card.classList.remove('is-flipped');
            ui.controls.classList.remove('visible');
        }
    }

    async function rate(quality) {
        if (!currentCard) return;

        const token = localStorage.getItem('authToken');
        if (!token) return;

        // 1. Remove card from local queue
        const processedCard = queue.shift();
        updatePendingCount();

        // 2. Submit review to server FIRST (required before checking for more due cards)
        try {
            await fetch(`${API_URL}/review`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    cardId: processedCard.id,
                    quality: quality,
                    currentInterval: processedCard.interval_days,
                    currentEf: processedCard.easiness_factor,
                    currentReps: processedCard.repetition_number
                })
            });
        } catch (e) {
            console.error("Sync Failed for card", processedCard.id, e);
        }

        // 3. Show next card or check server for more
        if (queue.length > 0) {
            renderCard(queue[0]);
        } else {
            // Queue empty — server now has the updated review, safe to check
            await loadCards(token);
        }
    }

    function updatePendingCount() {
        ui.pendingCount.textContent = queue.length;
    }

    // --- Event Listeners ---
    ui.card.addEventListener('click', toggleFlip);

    // --- Public API ---
    return {
        init,
        rate
    };

})();

// Start
document.addEventListener('DOMContentLoaded', FlashcardManager.init);
