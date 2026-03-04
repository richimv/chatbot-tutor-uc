/**
 * Arena Game Engine (Restored)
 */

const Arena = (() => {
    // STATE
    const state = {
        difficulty: 'Básico', // Default aligns with UI selected card
        questions: [],
        currIdx: 0,
        score: 0,
        lives: 3,
        timer: null,
        timeLeft: 20
    };

    // DOM ELEMENTS
    const ui = {
        screens: {
            lobby: document.getElementById('lobby'),
            game: document.getElementById('gameplay'),
            loading: document.getElementById('loading'),
            modal: document.getElementById('modalFeedback')
        },
        lobby: {
            topic: document.getElementById('topicInput')
        },
        game: {
            score: document.getElementById('gameScore'),
            lives: document.getElementById('livesBox'),
            bar: document.getElementById('timerBar'),
            meta: document.getElementById('q-meta'),
            text: document.getElementById('q-text'),
            grid: document.getElementById('opt-grid')
        },
        modal: {
            icon: document.getElementById('fb-icon'),
            title: document.getElementById('fb-title'),
            msg: document.getElementById('fb-msg'),
            card: document.querySelector('.feedback-card'),
            btn: document.getElementById('fb-btn-next')
        }
    };

    // --- LOBBY LOGIC ---
    function selectDiff(el, diff) {
        // UI
        document.querySelectorAll('.diff-card').forEach(c => c.classList.remove('selected'));
        el.classList.add('selected');
        state.difficulty = diff;
    }

    async function startMatch() {
        // ✅ Validar Autenticación PRIMERO
        const token = localStorage.getItem('authToken');
        if (!token) {
            ui.screens.loading.classList.add('hidden');
            if (window.uiManager) return window.uiManager.showAuthPromptModal();
            return window.location.href = '/login';
        }

        const topic = ui.lobby.topic.value.trim();

        // VALIDACIÓN STRICTA: El tema es obligatorio
        if (!topic) {
            // Usamos el modal de feedback para error simple
            ui.screens.modal.classList.remove('hidden');
            ui.modal.title.textContent = "⚠️ Falta el Tema";
            ui.modal.msg.textContent = "Por favor ingresa un tema para tu desafío (Ej: 'Historia', 'Ciencia', 'Cine').";
            ui.modal.icon.className = "fas fa-exclamation-triangle fb-icon";
            ui.modal.icon.style.color = "#eab308";

            // ✅ Botón "Entendido" en vez de Siguiente Pregunta
            ui.modal.btn.innerHTML = 'Entendido';
            ui.modal.btn.onclick = () => ui.screens.modal.classList.add('hidden');

            ui.lobby.topic.focus();
            return;
        }

        ui.screens.loading.classList.remove('hidden');

        try {
            // API CALL
            const res = await fetch(`${window.AppConfig.API_URL}/api/arena/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ topic, difficulty: state.difficulty })
            });

            const data = await res.json();

            if (data.success) {
                state.questions = data.questions.slice(0, 20); // Hardcap local preventivo a 20
                resetGame();
                ui.screens.lobby.classList.add('hidden');
                ui.screens.loading.classList.add('hidden');
                ui.screens.game.classList.remove('hidden');
                renderQuestion();
            } else {
                ui.screens.loading.classList.add('hidden');

                // Error de Límite Diario / Suscripción
                if (res.status === 403) {
                    if (typeof Swal !== 'undefined') {
                        // Detectar si el error es para Free (necesita upgrade) o de pago (solo debe esperar al día sgte)
                        const isUpgradeNeeded = data.error && (data.error.includes("Mejora tu plan") || data.error.toLowerCase().includes("free"));

                        if (isUpgradeNeeded && window.uiManager) {
                            // Si es una cuenta Free/Pending sin vidas globales, mostramos la gran modal de Paywall Oficial
                            window.uiManager.showPaywallModal();
                            return;
                        }

                        // Si es un límite diario normal, mostramos la alerta de que regrese mañana
                        Swal.fire({
                            title: '<span class="text-gradient-primary" style="font-size: 1.5rem; font-weight: 800;">Límite Alcanzado</span>',
                            html: `
                                <div style="font-size: 0.95rem; color: #cbd5e1; margin-top: 0.5rem; text-align: left;">
                                    <i class="fas fa-lock" style="color: #ef4444; margin-right: 5px;"></i> 
                                    ${data.error || 'Has agotado tus partidas de Arena Daily.'}<br><br>
                                    Intenta regresar mañana cuando tus vidas se hayan restablecido. Puedes seguir repasando en las demás herramientas.
                                </div>
                            `,
                            icon: 'warning',
                            iconColor: '#f59e0b',
                            background: 'rgba(20, 20, 20, 0.95)',
                            color: '#f8fafc',
                            backdrop: `rgba(10, 10, 10, 0.8) backdrop-filter: blur(8px);`,
                            customClass: {
                                popup: 'swal-glass-popup',
                                confirmButton: 'btn-neon'
                            },
                            buttonsStyling: false,
                            confirmButtonText: '<i class="fas fa-arrow-left" style="margin-right: 5px;"></i> Regresar a Quiz Arena',
                            allowOutsideClick: false
                        }).then(() => {
                            window.location.reload(); // Recarga la arena para reiniciar el estado gráfico
                        });
                        return; // Termina aquí para no lanzar el customModal alterno
                    }
                }

                // Errores Generales Fallback (Solo si no fue 403)
                showCustomModal('Error al Iniciar', data.error || 'No se pudo iniciar la partida o no hay preguntas.');
                // En error de fallback (ej: No hay stock o servidor caido) no pongamos botón de jugar
                ui.modal.btn.innerHTML = 'Regresar a la Lobby <i class="fas fa-undo"></i>';
                ui.modal.btn.onclick = () => { ui.screens.modal.classList.add('hidden'); window.location.reload(); };
            }

        } catch (e) {
            console.error(e);
            // alert('Error de conexión'); 
            showCustomModal('Error de Conexión', 'Verifica tu internet o intenta nuevamente.');
            ui.screens.loading.classList.add('hidden');
        }
    }

    function resetGame() {
        state.currIdx = 0;
        state.score = 0;
        state.lives = 3;
        updateHUD();
    }

    async function renderQuestion() {
        // ✅ SOLUCIÓN RACE CONDITION:
        // Si el usuario contestó más rápido que la generación IA, no abortamos; ESPERAMOS.
        if (state.currIdx >= state.questions.length) {
            if (isLoadingMore) {
                console.log("⏳ [Arena] IA trabajando en el backend. Pausando render para esperar el paquete...");
                ui.game.text.innerHTML = '<span class="loading-pulse"><i class="fas fa-brain fa-spin"></i> La IA está formulando nuevos desafíos...</span>';
                ui.game.grid.innerHTML = '';
                ui.game.meta.textContent = `NIVEL ${calculateLevel()} | CARGANDO...`;

                // Active Polling hasta que isLoadingMore sea false
                await new Promise(resolve => {
                    const checkInterval = setInterval(() => {
                        if (!isLoadingMore) {
                            clearInterval(checkInterval);
                            resolve();
                        }
                    }, 400);
                });

                // Doble chequeo: Si después de cargar fracasó en traer data, fin real de juego.
                if (state.currIdx >= state.questions.length) {
                    showCustomModal('⚠️ Reserva Agotada', 'Ni la base de datos ni la IA pudieron proporcionar más preguntas para este tema hoy.');
                    setTimeout(() => finishGame(), 2500);
                    return;
                }
            } else {
                return finishGame(); // Terminó las 20 sin recargas extra
            }
        }

        const q = state.questions[state.currIdx];

        // Timer Reset
        state.timeLeft = 20;
        startTimer();

        // UI
        const questionN = state.currIdx + 1;
        ui.game.meta.textContent = `NIVEL ${calculateLevel()} | PREGUNTA ${questionN} DE 20`;
        ui.game.text.textContent = q.question;
        ui.game.grid.innerHTML = '';

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

            if (pct < 30) ui.game.bar.style.background = '#ef4444'; // Red alert

            if (state.timeLeft <= 0) {
                clearInterval(state.timer);
                showFeedback(false, "¡Se acabó el tiempo!");
                state.lives--;
                updateHUD();
            }
        }, 100);
    }

    // --- INFINITE SCROLL LOGIC ---
    let isLoadingMore = false;
    async function preloadNextBatch() {
        if (isLoadingMore) return;
        isLoadingMore = true;
        console.log("🔄 [Arena] Preloading next batch started...");

        try {
            const token = localStorage.getItem('authToken');
            const res = await fetch(`${window.AppConfig.API_URL}/api/arena/questions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    topic: ui.lobby.topic.value,
                    difficulty: state.difficulty
                })
            });

            if (!res.ok) {
                console.error(`❌ [Arena] Server Error: ${res.status}`);
                throw new Error(`Server error: ${res.status}`);
            }

            const data = await res.json();

            if (data.success && data.questions.length > 0) {
                // Agregar preguntas manteniendo strict hard cap de 20 total.
                const remainingSlots = 20 - state.questions.length;
                if (remainingSlots > 0) {
                    const allowedToAdd = data.questions.slice(0, remainingSlots);
                    state.questions.push(...allowedToAdd);
                }
                console.log(`✅ [Arena] Batch loaded. New Total: ${state.questions.length}`);
                // Update HUD total immediately to reflect new length
                ui.game.meta.textContent = `NIVEL ${calculateLevel()} | PREGUNTA ${state.currIdx + 1} DE 20`;
            } else {
                console.warn("⚠️ [Arena] No questions returned from server.");
            }
        } catch (e) {
            console.error("❌ [Arena] BG Load Error:", e);
        } finally {
            isLoadingMore = false;
        }
    }

    function submitAnswer(idx) {
        clearInterval(state.timer);
        const q = state.questions[state.currIdx];
        const isCorrect = idx === q.correctAnswer;
        const feedbackMsg = q.explanation || `La respuesta era: ${q.options[q.correctAnswer]}`;

        if (isCorrect) {
            state.score += Math.ceil(100 * (state.timeLeft / 5)); // Bonus speed
            showFeedback(true, `¡Correcto! ${feedbackMsg}`);
        } else {
            state.lives--;
            showFeedback(false, `Incorrecto. ${feedbackMsg}`);
        }
        updateHUD();

        // ** TRIGGER PRELOAD TÁCTICO **
        // Se activa cuando quedan 4 preguntas en el cajón para darle a la IA al menos ~20 segs de margen.
        if (state.questions.length - state.currIdx <= 4) {
            preloadNextBatch();
        }
    }

    function calculateLevel() {
        return Math.floor(state.currIdx / 5) + 1;
    }

    function updateHUD() {
        ui.game.score.textContent = `${state.score} pts`;

        // Lives
        const hearts = ui.game.lives.children;
        for (let i = 0; i < 3; i++) {
            hearts[i].className = i < state.lives ? 'fas fa-heart' : 'far fa-heart'; // Filled vs Empty
            hearts[i].style.color = i < state.lives ? '#ef4444' : '#334155';
        }

        if (state.lives <= 0) finishGame();
    }

    // --- WILDCARDS (COMODINES) ---
    function useWildcard(type, btn) {
        if (btn.classList.contains('disabled')) return;

        // Mark as used
        btn.classList.add('disabled');
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
        const badge = btn.querySelector('.p-badge');
        if (badge) badge.style.display = 'none';

        if (type === '5050') {
            apply5050();
        } else if (type === 'skip') {
            applySkip();
        }
    }

    function apply5050() {
        const q = state.questions[state.currIdx];
        const correctIdx = q.correctAnswer;
        const buttons = ui.game.grid.children;
        let removed = 0;

        for (let i = 0; i < buttons.length; i++) {
            if (i !== correctIdx && removed < 2) {
                buttons[i].style.visibility = 'hidden';
                removed++;
            }
        }
        showCustomModal('Comodín activado', 'Se han eliminado 2 opciones incorrectas. 🍀');
    }

    function applySkip() {
        clearInterval(state.timer);
        showCustomModal('Comodín activado', 'Saltando pregunta... no pierdes vida. ⏩');
        setTimeout(() => {
            ui.screens.modal.classList.add('hidden'); // Close feedback logic
            // Hack: Reset modal specifically for nextQ
            const modal = document.getElementById('customModal');
            if (modal) modal.classList.add('hidden');

            nextQ();
        }, 1500);
    }

    // --- UTILS & MODALS ---
    function showCustomModal(title, msg) {
        // Re-use feedback modal structure or create a generic one?
        // Let's use the feedback modal structure but customized
        ui.screens.modal.classList.remove('hidden');
        ui.modal.title.textContent = title;
        ui.modal.msg.textContent = msg;
        ui.modal.icon.className = 'fas fa-info-circle fb-icon';
        ui.modal.icon.style.color = '#3b82f6';

        // Hide "Continuar" button automatically if it's just info? 
        // For now, user clicks outside or we add a close btn. 
        // But existing modal has a 'Siguiente' btn calling nextQ().
        // We might need a separate simpler alert modal or temporary overlay.

        // BETTER: Create a simple temporary toast/overlay for game events
        // Or hijack the modal but change the button action? 
        // For simplicity: auto-close for small info.

        if (title === 'Comodín activado') {
            // Auto close for comidin
            setTimeout(() => ui.screens.modal.classList.add('hidden'), 1500);
        }
    }

    function showFeedback(success, msg) {
        ui.screens.modal.classList.remove('hidden');
        ui.modal.title.textContent = success ? "¡Excelente!" : "¡Ups!";
        ui.modal.msg.textContent = msg;

        ui.modal.icon.className = success ? 'fas fa-check-circle fb-icon' : 'fas fa-times-circle fb-icon';
        ui.modal.icon.style.color = success ? '#22c55e' : '#ef4444';
    }

    function nextQ() {
        ui.screens.modal.classList.add('hidden');
        if (state.lives > 0) {
            state.currIdx++;

            // Hard Stop a las 20 victorias.
            if (state.currIdx >= 20) {
                showCustomModal('🏆 ¡VICTORIA ABSOLUTA!', 'Has derrotado las 20 rondas. Eres una leyenda.');
                setTimeout(() => finishGame(), 3000);
                return;
            }

            renderQuestion();
        }
    }

    // Se eliminó la duplicación de funciones de WILDCARD (useWildcard, apply5050, applySkip) aquí

    // --- UTILS & MODALS ---
    function showCustomModal(title, msg) {
        ui.screens.modal.classList.remove('hidden');
        ui.modal.title.textContent = title;
        ui.modal.msg.textContent = msg;
        ui.modal.icon.className = 'fas fa-info-circle fb-icon';
        ui.modal.icon.style.color = '#3b82f6';

        if (title === 'Comodín activado') {
            setTimeout(() => ui.screens.modal.classList.add('hidden'), 1500);
        }
    }

    function showFeedback(success, msg) {
        ui.screens.modal.classList.remove('hidden');
        ui.modal.title.textContent = success ? "¡Excelente!" : "¡Ups!";
        ui.modal.msg.textContent = msg;

        ui.modal.icon.className = success ? 'fas fa-check-circle fb-icon' : 'fas fa-times-circle fb-icon';
        ui.modal.icon.style.color = success ? '#22c55e' : '#ef4444';

        // ✅ Restaurar Botón de Siguiente Pregunta
        ui.modal.btn.innerHTML = 'Siguiente Pregunta <i class="fas fa-arrow-right"></i>';
        ui.modal.btn.onclick = Arena.nextQ;
    }
    async function fetchLeaderboard() {
        const tbody = document.querySelector('.lb-table tbody');
        if (!tbody) return;

        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:1.5rem; color:#94a3b8;"><i class="fas fa-lock" style="margin-bottom:0.5rem; display:block; font-size:1.5rem; color:#475569;"></i>Inicia sesión para ver el ranking global</td></tr>';
                return;
            }

            const res = await fetch(`${window.AppConfig.API_URL}/api/arena/ranking`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.success) {
                tbody.innerHTML = data.leaderboard.map((u, i) => `
                    <tr>
                        <td class="lb-rank">${i + 1}</td>
                        <td>${u.name}</td>
                        <td class="lb-score">${u.score}</td>
                        <td>${u.difficulty}</td> <!-- ✅ Mostrar Dificultad -->
                    </tr>
                `).join('');
            }
        } catch (e) {
            console.error("Error loading LB:", e);
            tbody.innerHTML = '<tr><td colspan="4">Error al cargar ranking</td></tr>';
        }
    }

    async function finishGame() {
        // Stop timer just in case
        clearInterval(state.timer);

        // ✅ Validación preventiva: Si el juego terminó pero el usuario no contestó al menos 1 pregunta bien o mal (score 0 en idx 0)
        // Significa que fue expulsado en el lobby preliminarmente (ej. límite de tiempo sin jugar, limite bug). No guardar score basura.
        if (state.currIdx === 0 && state.score === 0) {
            console.log("Juego anulado/aborte pre-partida. Evitando guardado nulo.");
            window.location.reload();
            return;
        }

        try {
            const token = localStorage.getItem('authToken');
            const res = await fetch(`${window.AppConfig.API_URL}/api/arena/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    score: state.score,
                    totalQuestions: state.questions.length,
                    topic: ui.lobby.topic.value,
                    difficulty: state.difficulty // ✅ Enviar Dificultad
                })
            });

            const data = await res.json();
            if (data.success) {
                alert(`Juego Terminado. Score: ${state.score}. ¡Guardado!`);
                window.location.reload();
            } else {
                alert('No se pudo guardar el puntaje: ' + data.error);
                window.location.reload();
            }

        } catch (e) {
            alert('Juego Terminado. Error de conexión guardando score.');
            window.location.reload();
        }
    }

    // --- UTILS ---
    async function fetchUser() {
        try {
            const token = localStorage.getItem('authToken');
            const nameDisplay = document.getElementById('userNameDisplay');

            if (!token) {
                if (nameDisplay) {
                    nameDisplay.innerHTML = '<a href="/login" style="color:#fbbf24; text-decoration:none;"><i class="fas fa-sign-in-alt"></i> Iniciar Sesión</a>';
                }
                return;
            }

            const res = await fetch(`${window.AppConfig.API_URL}/api/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.id || data.email) {
                const nameDisplay = document.getElementById('userNameDisplay');
                if (nameDisplay) nameDisplay.textContent = `Jugador: ${data.name || 'Anónimo'}`;
            } else {
                console.warn("User data incomplete:", data);
                const nameDisplay = document.getElementById('userNameDisplay');
                if (nameDisplay) nameDisplay.textContent = 'Jugador: Invitado';
            }

        } catch (e) {
            console.error("Error fetching user:", e);
            const nameDisplay = document.getElementById('userNameDisplay');
            if (nameDisplay) nameDisplay.textContent = 'Jugador: Offline';
        }
    }

    async function fetchUserStats() {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) return; // Do not fetch stats for guests

            const res = await fetch(`${window.AppConfig.API_URL}/api/arena/stats`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.success) {
                document.getElementById('userBestScore').textContent = data.stats.highScore;
                document.getElementById('userTotalGames').textContent = data.stats.totalGames;
            }
        } catch (e) {
            console.error("Error stats:", e);
        }
    }

    // --- INITIALIZATION ---
    function init() {
        fetchUser();
        fetchLeaderboard();
        fetchUserStats();
    }

    // Auto-init when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return { selectDiff, startMatch, nextQ, useWildcard };

})();
