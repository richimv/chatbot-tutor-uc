
const Arena = (function () {
    const state = {
        questions: [],
        currIdx: 0,
        score: 0,
        lives: 3,
        timer: null,
        timeLeft: 20,
        timeLeft: 20
    };

    const ui = {
        lobby: {
            screen: document.getElementById('lobby'),
            topic: document.getElementById('topicInput'),
            btnStart: document.querySelector('.btn-start')
        },
        game: {
            screen: document.getElementById('gameplay'),
            text: document.getElementById('q-text'),
            grid: document.getElementById('opt-grid'),
            meta: document.getElementById('q-meta'),
            bar: document.getElementById('timerBar'),
            lives: document.getElementById('livesBox'),
            score: document.getElementById('gameScore'),
            imageContainer: document.getElementById('q-image-container')
        },
        screens: {
            loading: document.getElementById('loading'),
            modal: document.getElementById('modalFeedback')
        },
        modal: {
            title: document.getElementById('fb-title'),
            msg: document.getElementById('fb-msg'),
            icon: document.getElementById('fb-icon'),
            btn: document.getElementById('fb-btn-next')
        }
    };


    async function startMatch() {
        const token = localStorage.getItem('authToken');
        
        // 1. Visitante Detection (Client-side)
        if (!token) {
            if (window.uiManager) window.uiManager.showAuthPromptModal();
            else alert("Inicia sesión para jugar");
            return;
        }

        const topic = ui.lobby.topic.value.trim() || 'Cultura General';
        ui.screens.loading.classList.remove('hidden');

        try {
            // ✅ NUEVO: Usar safeFetch para inicio resiliente
            const res = await window.uiManager.safeFetch(`${window.AppConfig.API_URL}/api/arena/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ topic })
            });

            const data = await res.json();

            // 2. Auth/Limit Error Handling
            if (res.status === 401) {
                ui.screens.loading.classList.add('hidden');
                if (window.uiManager) window.uiManager.showAuthPromptModal();
                return;
            }

            if (res.status === 403) {
                ui.screens.loading.classList.add('hidden');
                if (data.errorCode === 'BANK_EXHAUSTED') {
                    if (window.uiManager && typeof window.uiManager.showBankExhaustedModal === 'function') {
                        window.uiManager.showBankExhaustedModal();
                    } else {
                        showCustomModal('Agotado', data.error || 'Banco agotado. Pásate a Advanced.');
                    }
                } else if (window.uiManager && typeof window.uiManager.showPaywallModal === 'function') {
                    // Si es un límite diario de la Arena
                    window.uiManager.showPaywallModal(data.error);
                } else {
                    showCustomModal('Límite', data.error || 'Has alcanzado tu límite diario.');
                }
                return;
            }

            if (!data.success) throw new Error(data.error || 'No se pudo iniciar');

            state.questions = data.questions;
            resetGame();
            ui.lobby.screen.classList.add('hidden');
            ui.game.screen.classList.remove('hidden');
            ui.screens.loading.classList.add('hidden');
            renderQuestion();

        } catch (e) {
            console.error(e);
            ui.screens.loading.classList.add('hidden');
            // If the error message implies auth or limiting, we handle it gracefully
            if (e.message.includes('sesión') || e.message.includes('expirada')) {
                if (window.uiManager) window.uiManager.showAuthPromptModal();
            } else {
                showCustomModal('Error', e.message || 'Verifica tu conexión');
            }
        }
    }

    function resetGame() {
        state.currIdx = 0;
        state.score = 0;
        state.lives = 3;
        updateHUD();
    }

    async function renderQuestion() {
        if (state.currIdx >= state.questions.length) {
            if (isLoadingMore) {
                ui.game.text.innerHTML = '<span class="loading-pulse"><i class="fas fa-brain fa-spin"></i> La IA está formulando nuevos desafíos...</span>';
                ui.game.grid.innerHTML = '';
                await new Promise(r => {
                    const check = setInterval(() => {
                        if (!isLoadingMore) { clearInterval(check); r(); }
                    }, 400);
                });
                if (state.currIdx >= state.questions.length) return finishGame();
            } else {
                return finishGame();
            }
        }

        const q = state.questions[state.currIdx];
        state.timeLeft = 20;
        startTimer();

        ui.game.meta.textContent = `NIVEL ${calculateLevel()} | PREGUNTA ${state.currIdx + 1} DE 20`;
        ui.game.text.textContent = q.question;
        ui.game.grid.innerHTML = '';

        // --- Render Image if exists ---
        const layout = document.getElementById('arenaQuestionLayout');
        if (ui.game.imageContainer) {
            ui.game.imageContainer.innerHTML = '';
            ui.game.imageContainer.classList.remove('visible');
            if (q.image_url) {
                const img = document.createElement('img');
                img.src = window.resolveImageUrl(q.image_url);
                img.className = 'q-image';
                img.loading = 'lazy'; // ✅ NUEVO
                img.onerror = () => {
                    ui.game.imageContainer.classList.remove('visible');
                    if (layout) layout.classList.remove('has-image');
                };
                ui.game.imageContainer.appendChild(img);
                ui.game.imageContainer.classList.add('visible');
                if (layout) layout.classList.add('has-image');
            } else {
                if (layout) layout.classList.remove('has-image');
            }
        }

        q.options.forEach((opt, idx) => {
            const btn = document.createElement('button');
            btn.className = 'opt-btn';
            btn.textContent = opt;
            btn.onclick = () => submitAnswer(idx);
            ui.game.grid.appendChild(btn);
        });
    }

    function startTimer() {
        clearInterval(state.timer);
        ui.game.bar.style.width = '100%';
        ui.game.bar.style.background = 'linear-gradient(90deg, #22c55e, #eab308)';
        state.timer = setInterval(() => {
            state.timeLeft -= 0.1;
            const pct = (state.timeLeft / 20) * 100;
            ui.game.bar.style.width = `${pct}%`;
            if (pct < 30) ui.game.bar.style.background = '#ef4444';
            if (state.timeLeft <= 0) {
                clearInterval(state.timer);
                showFeedback(false, "¡Se acabó el tiempo!");
                state.lives--;
                updateHUD();
            }
        }, 100);
    }

    let isLoadingMore = false;
    async function preloadNextBatch() {
        if (isLoadingMore) return;
        isLoadingMore = true;
        try {
            const token = localStorage.getItem('authToken');
            // ✅ NUEVO: Preload resiliente
            const res = await window.uiManager.safeFetch(`${window.AppConfig.API_URL}/api/arena/questions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ topic: ui.lobby.topic.value })
            });
            const data = await res.json();
            if (data.success && data.questions.length > 0) {
                const remainingSlots = 20 - state.questions.length;
                if (remainingSlots > 0) state.questions.push(...data.questions.slice(0, remainingSlots));
            }
        } catch (e) { console.error("BG Load Error:", e); }
        finally { isLoadingMore = false; }
    }

    function submitAnswer(idx) {
        clearInterval(state.timer);
        const q = state.questions[state.currIdx];
        const isCorrect = idx === Number(q.correctAnswer);
        const feedbackMsg = q.explanation || `La respuesta era: ${q.options[q.correctAnswer]}`;

        if (isCorrect) {
            state.score += Math.ceil(100 * (state.timeLeft / 5));
            showFeedback(true, `¡Correcto! ${feedbackMsg}`);
        } else {
            state.lives--;
            showFeedback(false, `Incorrecto. ${feedbackMsg}`);
        }
        updateHUD();
        if (state.questions.length - state.currIdx <= 4) preloadNextBatch();
    }

    function calculateLevel() { return Math.floor(state.currIdx / 5) + 1; }

    function updateHUD() {
        ui.game.score.textContent = `${state.score} pts`;
        const hearts = ui.game.lives.children;
        for (let i = 0; i < 3; i++) {
            hearts[i].style.color = i < state.lives ? '#ef4444' : '#475569';
        }
        if (state.lives <= 0) setTimeout(() => finishGame(), 1500);
    }

    function useWildcard(type, btn) {
        if (btn.classList.contains('disabled')) return;
        btn.classList.add('disabled');
        btn.style.opacity = '0.5';
        if (type === '5050') apply5050();
        else if (type === 'skip') applySkip();
    }

    function apply5050() {
        const q = state.questions[state.currIdx];
        const correctIdx = Number(q.correctAnswer);
        const buttons = ui.game.grid.children;
        const indices = [0, 1, 2, 3].filter(i => i !== correctIdx).sort(() => Math.random() - 0.5);
        for (let i = 0; i < 2; i++) {
            if (buttons[indices[i]]) {
                buttons[indices[i]].style.opacity = '0';
                buttons[indices[i]].style.pointerEvents = 'none';
            }
        }
        showCustomModal('Comodín activado', 'Se han eliminado 2 opciones incorrectas. 🍀');
    }

    function applySkip() {
        clearInterval(state.timer);
        showCustomModal('Comodín activado', 'Saltando pregunta... no pierdes vida. ⏩');
        setTimeout(() => nextQ(), 1500);
    }

    function showCustomModal(title, msg, btnText = null) {
        ui.screens.modal.classList.remove('hidden');
        ui.modal.title.textContent = title;
        ui.modal.msg.textContent = msg;
        ui.modal.icon.className = 'fas fa-info-circle fb-icon';
        ui.modal.icon.style.color = '#3b82f6';
        
        // --- BUTTON LOGIC ---
        if (title === 'Error' || btnText) {
            ui.modal.btn.style.display = 'block';
            ui.modal.btn.innerHTML = btnText || 'Entendido <i class="fas fa-check"></i>';
            ui.modal.btn.onclick = () => ui.screens.modal.classList.add('hidden');
        } else {
            ui.modal.btn.style.display = 'none';
        }

        if (title === 'Comodín activado') setTimeout(() => ui.screens.modal.classList.add('hidden'), 1500);
    }

    function showFeedback(success, msg) {
        ui.screens.modal.classList.remove('hidden');
        ui.modal.title.textContent = success ? "¡Excelente!" : "¡Ups!";
        ui.modal.msg.textContent = msg;
        ui.modal.icon.className = success ? 'fas fa-check-circle fb-icon' : 'fas fa-times-circle fb-icon';
        ui.modal.icon.style.color = success ? '#22c55e' : '#ef4444';
        ui.modal.btn.style.display = 'block';
        ui.modal.btn.innerHTML = 'Siguiente Pregunta <i class="fas fa-arrow-right"></i>';
        ui.modal.btn.onclick = Arena.nextQ;
    }

    function nextQ() {
        ui.screens.modal.classList.add('hidden');
        if (state.lives > 0) {
            state.currIdx++;
            if (state.currIdx >= 20) {
                showCustomModal('🏆 ¡VICTORIA ABSOLUTA!', 'Has derrotado las 20 rondas. Eres una leyenda.');
                setTimeout(() => finishGame(), 3000);
                return;
            }
            renderQuestion();
        }
    }

    async function fetchLeaderboard() {
        const tbody = document.getElementById('lb-body');
        if (!tbody) return;
        try {
            const token = localStorage.getItem('authToken');
            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`${window.AppConfig.API_URL}/api/arena/ranking`, { headers });
            const data = await res.json();
            
            if (data.success && data.leaderboard.length > 0) {
                tbody.innerHTML = data.leaderboard.map((u, i) => `
                    <tr><td>${i + 1}</td><td>${u.name}</td><td>${u.score}</td><td>Profesional</td></tr>
                `).join('');
            } else {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 20px; color: #94a3b8;">¡Sé el primero en calificar!</td></tr>`;
            }
        } catch (e) { 
            console.error("LB Error:", e);
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color: #ef4444;">No se pudo cargar el ranking</td></tr>`;
        }
    }

    async function finishGame() {
        clearInterval(state.timer);
        if (state.currIdx === 0 && state.score === 0) { window.location.reload(); return; }
        try {
            const token = localStorage.getItem('authToken');
            // ✅ NUEVO: Envío de puntaje resiliente
            await window.uiManager.safeFetch(`${window.AppConfig.API_URL}/api/arena/submit`, {
                method: 'POST',
                isRetryable: true, // Idempotente para el score de esta partida
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ score: state.score, totalQuestions: state.questions.length, topic: ui.lobby.topic.value })
            });
        } catch (e) { 
            console.error("Submit Error:", e);
            // Avisar sutilmente que se intentará sincronizar o que falló definitivamente
        }
        alert(`Juego Terminado. Score: ${state.score}`);
        window.location.reload();
    }

    function selectQuickTag(btn, topic) {
        ui.lobby.topic.value = topic;
        document.querySelectorAll('.quick-tag').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
    }

    /**
     * ✅ NUEVO: Desplazamiento por flechas para Escritorio
     */
    function scrollTopics(direction) {
        const slider = document.getElementById('topics-slider');
        if (!slider) return;
        const scrollAmount = 300; // Desplazar aprox 2 tarjetas
        slider.scrollBy({
            left: direction * scrollAmount,
            behavior: 'smooth'
        });
    }

    async function fetchUser() {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) return;
            const res = await fetch(`${window.AppConfig.API_URL}/api/auth/me`, { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();
            if (data.id) document.getElementById('userNameDisplay').textContent = `Jugador: ${data.name || 'Anónimo'}`;
        } catch (e) {}
    }

    async function fetchUserStats() {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) return;
            const res = await fetch(`${window.AppConfig.API_URL}/api/arena/stats`, { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();
            if (data.success) {
                document.getElementById('userBestScore').textContent = data.stats.highScore;
                document.getElementById('userTotalGames').textContent = data.stats.totalGames;
            }
        } catch (e) {}
    }

    function init() { 
        fetchUser(); 
        fetchLeaderboard(); 
        fetchUserStats(); 
        
        // --- MOUSE DRAG SCROLL HELPER ---
        const slider = document.getElementById('topics-slider');
        if (slider) {
            // ✅ NUEVO: Efecto "Scroll Peek" REAL para celulares (Hint de desplazamiento)
            if (window.innerWidth <= 768) {
                setTimeout(() => {
                    // Desplazamiento inicial suave hacia la derecha
                    slider.scrollTo({ left: 80, behavior: 'smooth' });
                    
                    // Regreso suave tras la pequeña pausa para que el usuario capte el "peek"
                    setTimeout(() => {
                        slider.scrollTo({ left: 0, behavior: 'smooth' });
                    }, 800);
                }, 1000);
            }
            
            let isDown = false;
            let startX;
            let scrollLeft;

            slider.addEventListener('mousedown', (e) => {
                isDown = true;
                slider.classList.add('active-drag');
                startX = e.pageX - slider.offsetLeft;
                scrollLeft = slider.scrollLeft;
            });
            slider.addEventListener('mouseleave', () => {
                isDown = false;
                slider.classList.remove('active-drag');
            });
            slider.addEventListener('mouseup', () => {
                isDown = false;
                slider.classList.remove('active-drag');
            });
            slider.addEventListener('mousemove', (e) => {
                if(!isDown) return;
                e.preventDefault();
                const x = e.pageX - slider.offsetLeft;
                const walk = (x - startX) * 2; // scroll-fast
                slider.scrollLeft = scrollLeft - walk;
            });
        }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { console.log("Arena JS v1.1 Loaded"); init(); });
    else { console.log("Arena JS v1.1 Loaded"); init(); }

    return { startMatch, nextQ, useWildcard, selectQuickTag, scrollTopics };
})();
