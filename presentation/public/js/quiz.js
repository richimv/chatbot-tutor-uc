/**
 * quiz.js
 * Lógica del Frontend para Hub Quiz Arena (Versión 5 Rondas + Premium Fix)
 */

class QuizGame {
    constructor() {
        this.questions = [];
        this.currentQuestionIndex = 0;
        this.currentRound = 1;
        this.maxRounds = 5;

        this.score = 0;
        this.lives = 3;
        this.streak = 0; // Combo System
        this.maxStreak = 0; // 🏆 Achievement Tracking
        this.timer = null;
        this.timeLeft = 0;

        this.isPremiumContext = false;

        // Power-Ups State (1 use per game)
        this.powerups = {
            '5050': true,
            'skip': true
        };

        // UI References
        this.views = {
            lobby: document.getElementById('view-lobby'),
            loading: document.getElementById('view-loading'),
            game: document.getElementById('view-game'),
            results: document.getElementById('view-results')
        };
        this.topicInput = document.getElementById('topic-input');

        this.init();
    }

    init() {
        if (window.sessionManager) {
            window.sessionManager.initialize();
            const currentUser = window.sessionManager.getUser();
            if (currentUser) {
                this.renderHeader(currentUser);
                this.applyPremiumLocks(currentUser); // 🔒 NEW
            }
            window.sessionManager.onStateChange((user) => {
                if (user) {
                    this.renderHeader(user);
                    this.applyPremiumLocks(user); // 🔒 NEW
                }
            });
        }
        this.fetchLobbyData();

        // Set initial topic input value if available
        if (this.currentTopic && this.topicInput) {
            this.topicInput.value = this.currentTopic;
        }

        // Safety: Ensure one difficulty is selected
        const selectedCard = document.querySelector('.difficulty-card.selected');
        if (!selectedCard) {
            const defaultCard = document.querySelector('.difficulty-card[data-level="Básico"]');
            if (defaultCard) defaultCard.classList.add('selected');
        }

        this.setupEventListeners();
    }

    applyPremiumLocks(user) {
        // Fix: Use camelCase logic verified in previous steps
        const isPremium = user.subscriptionStatus === 'active' || user.role === 'admin';
        const expertCard = document.querySelector('.difficulty-card[data-level="Experto"]');

        if (expertCard) {
            if (!isPremium) {
                expertCard.classList.add('locked');
                // visual lock icon
                if (!expertCard.querySelector('.lock-icon')) {
                    expertCard.innerHTML += `<div class="lock-icon" style="position:absolute; top:10px; right:10px; color: #f43f5e; font-size: 1.2rem;"><i class="fas fa-lock"></i></div>`;
                }
            } else {
                expertCard.classList.remove('locked');
                const lock = expertCard.querySelector('.lock-icon');
                if (lock) lock.remove();
            }
        }
    }

    renderHeader(user = null) {
        console.log("🔄 Quiz: Renderizando Header... Usuario:", user);

        const container = document.getElementById('header-user-section');
        if (!container) return;

        // Fallback robusto para obtener usuario si llega nulo
        if (!user && window.sessionManager) user = window.sessionManager.getUser();
        if (!user) {
            try {
                const stored = localStorage.getItem('user_data');
                if (stored) user = JSON.parse(stored);
            } catch (e) { console.error("Error leyendo user_data", e); }
        }

        // Datos del usuario (o defaults)
        // PRIORIDAD CRÍTICA: Name -> Full Name -> Names -> Email Part -> "Estudiante"
        const finalName = user?.name || user?.full_name || user?.names || (user?.email ? user.email.split('@')[0] : "Estudiante");
        const finalAvatar = user?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(finalName)}&background=random&color=fff&bold=true`;
        const isAdmin = user?.role === 'admin';
        const userEmail = user?.email || "";

        // HTML Completo (Recreando estructura limpia)
        container.innerHTML = `
            <div class="user-menu-container" style="position: relative;">
                <button id="quiz-user-btn" class="user-badge-btn" style="display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.05); padding: 5px 15px; border-radius: 50px; border: 1px solid rgba(255,255,255,0.1); color: white; cursor: pointer;">
                    <img src="${finalAvatar}" style="width: 32px; height: 32px; border-radius: 50%; border: 2px solid #3b82f6;">
                    <span style="font-weight: 500; font-size: 0.95rem;">${finalName}</span>
                    <i class="fas fa-chevron-down" style="font-size: 0.8rem; opacity: 0.7;"></i>
                </button>

                <!-- Menú Desplegable -->
                <div id="quiz-user-dropdown" class="quiz-dropdown hidden" style="position: absolute; right: 0; top: 110%; width: 220px; background: #0f172a; border: 1px solid #1e293b; border-radius: 10px; padding: 5px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); z-index: 1000; display: none;">
                    <div style="padding: 10px; border-bottom: 1px solid #1e293b; margin-bottom: 5px;">
                        <div style="color: #94a3b8; font-size: 0.8rem; overflow: hidden; text-overflow: ellipsis;">${userEmail}</div>
                        ${isAdmin ? '<span style="background: #3b82f6; color: white; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px;">ADMIN</span>' : ''}
                    </div>
                    <button class="dropdown-item" onclick="window.location.href='/'" style="width: 100%; text-align: left; padding: 8px 10px; background: none; border: none; color: #e2e8f0; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-home"></i> Volver al Inicio
                    </button>
                    ${isAdmin ? `
                    <button class="dropdown-item" onclick="window.location.href='/admin.html'" style="width: 100%; text-align: left; padding: 8px 10px; background: none; border: none; color: #e2e8f0; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-shield-alt"></i> Panel Admin
                    </button>` : ''}
                    <button id="quiz-logout-btn" style="width: 100%; text-align: left; padding: 8px 10px; background: none; border: none; color: #f43f5e; cursor: pointer; display: flex; align-items: center; gap: 8px; border-top: 1px solid #1e293b; margin-top: 5px;">
                        <i class="fas fa-sign-out-alt"></i> Cerrar Sesión
                    </button>
                </div>
            </div>
            
            <button id="btn-quick-exit" class="btn-exit" title="Salir Rápido" style="margin-left: 10px; background: transparent; border: 1px solid #f43f5e; color: #f43f5e; border-radius: 50px; padding: 5px 15px; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                <i class="fas fa-door-open"></i> <span>Salir</span>
            </button>
        `;

        // Lógica de Eventos (Dropdown Toggle)
        const btn = document.getElementById('quiz-user-btn');
        const dropdown = document.getElementById('quiz-user-dropdown');
        const logoutBtn = document.getElementById('quiz-logout-btn');
        const quickExit = document.getElementById('btn-quick-exit');

        if (btn && dropdown) {
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const isHidden = dropdown.style.display === 'none' || dropdown.classList.contains('hidden');
                dropdown.style.display = isHidden ? 'block' : 'none';
                dropdown.classList.toggle('hidden', !isHidden);
            };

            // Cerrar al hacer click fuera
            document.addEventListener('click', (e) => {
                if (!container.contains(e.target)) {
                    dropdown.style.display = 'none';
                    dropdown.classList.add('hidden');
                }
            });
        }

        if (logoutBtn) {
            logoutBtn.onclick = () => {
                if (confirm("¿Estás seguro de cerrar sesión?")) {
                    if (window.handleLogout) window.handleLogout();
                    else {
                        localStorage.clear();
                        window.location.href = '/login.html';
                    }
                }
            };
        }

        if (quickExit) {
            quickExit.onclick = () => {
                if (confirm('⚠️ ¿Salir de la Arena? Se perderá el progreso actual.')) {
                    window.location.href = '/';
                }
            };
        }
    }

    setupEventListeners() {
        // Selector Dificultad (Visual only - Logic handled by Backend Round System)
        document.querySelectorAll('.difficulty-card').forEach(card => {
            card.addEventListener('click', () => {
                // 🔒 Premium Lock Check
                if (card.classList.contains('locked')) {
                    // Show custom lock modal reused from showFeedback but avoiding conflicts
                    const htmlContent = `
                        <div style="text-align: center;">
                            <i class="fas fa-lock" style="font-size: 3rem; color: #f43f5e; margin-bottom: 15px; filter: drop-shadow(0 0 10px rgba(244,63,94,0.5));"></i>
                            <h3 style="color: #fff; margin-bottom: 10px; font-family: 'Outfit', sans-serif;">Nivel Experto Bloqueado</h3>
                            <p style="color: #cbd5e1; font-size: 0.95rem; margin-bottom: 20px;">
                                Solo los usuarios Premium pueden acceder a la dificultad máxima.
                            </p>
                            <button onclick="window.location.href='pricing.html'" class="btn-primary" style="width: 100%; justify-content: center; background: linear-gradient(135deg, #FFD700 0%, #FDB931 100%); color: #000; font-weight: bold; border: none;">
                                <i class="fas fa-crown"></i> Desbloquear Ahora
                            </button>
                        </div>
                    `;

                    // We use the existing feedback overlay for simplicity
                    const overlay = document.getElementById('feedback-overlay');
                    if (overlay) {
                        overlay.classList.remove('hidden');
                        const body = overlay.querySelector('.feedback-body');
                        const title = overlay.querySelector('.feedback-header h2');
                        const icon = overlay.querySelector('.feedback-header i');
                        const btn = document.getElementById('btn-next-question');

                        if (body) body.innerHTML = htmlContent;
                        if (title) title.textContent = "Acceso Restringido";
                        if (icon) icon.className = "fas fa-user-lock";
                        if (btn) btn.style.display = 'none'; // Hide next button

                        // Restore on close
                        overlay.onclick = (e) => {
                            if (e.target === overlay) {
                                overlay.classList.add('hidden');
                                if (btn) btn.style.display = 'block';
                            }
                        }
                    }
                    return;
                }

                document.querySelectorAll('.difficulty-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                // Nota: El backend decidirá la dificultad real basada en la ronda
            });
        });

        document.getElementById('btn-start-game').addEventListener('click', () => this.startGame(1));

        // Manejo "Siguiente Pregunta"
        document.getElementById('btn-next-question').addEventListener('click', () => this.nextQuestion());

        document.getElementById('btn-retry').addEventListener('click', () => window.location.reload());

        // btn-exit-game es dinámico y se maneja en renderHeader()

        // Power-Ups Listeners
        const btn5050 = document.getElementById('btn-powerup-5050');
        const btnSkip = document.getElementById('btn-powerup-skip');

        if (btn5050) btn5050.addEventListener('click', () => this.usePowerUp5050());
        if (btnSkip) btnSkip.addEventListener('click', () => this.usePowerUpSkip());
    }

    usePowerUp5050() {
        if (!this.powerups['5050']) return;

        const question = this.questions[this.currentQuestionIndex];
        const correctIdx = question.correctAnswerIndex !== undefined ? question.correctAnswerIndex : question.correctIndex;

        // Identify wrong indices
        const wrongIndices = [];
        question.options.forEach((_, idx) => {
            if (idx !== correctIdx) wrongIndices.push(idx);
        });

        // Shuffle and take 2
        wrongIndices.sort(() => Math.random() - 0.5);
        const toRemove = wrongIndices.slice(0, 2);

        // Visual remove
        const opts = document.querySelectorAll('.option-btn');
        toRemove.forEach(idx => {
            opts[idx].style.opacity = '0.2';
            opts[idx].disabled = true;
        });

        // Disable PowerUp
        this.powerups['5050'] = false;
        const btn = document.getElementById('btn-powerup-5050');
        if (btn) {
            btn.disabled = true;
            btn.querySelector('.powerup-badge').style.display = 'none';
        }
    }

    usePowerUpSkip() {
        if (!this.powerups['skip']) return;

        // Disable PowerUp
        this.powerups['skip'] = false;
        const btn = document.getElementById('btn-powerup-skip');
        if (btn) {
            btn.disabled = true;
            btn.querySelector('.powerup-badge').style.display = 'none';
        }

        // Show Feedback Modal (High-End UI) instead of alert
        const htmlContent = `
            <p style="font-size: 1.1rem; color: #cbd5e1;">
                Has utilizado el comodín de salto. 
                <span style="color: #60a5fa; font-weight: bold;">No ganas puntos</span>, 
                pero conservas tus vidas.
            </p>
        `;

        // Treat it as a "Correct" outcome visually (Green Check) but explain it's a skip
        this.showFeedback(true, htmlContent, "¡Pregunta Saltada!");

        // Update Title via DOM directly since showFeedback sets it to "Excelente!"
        const overlay = document.getElementById('feedback-overlay');
        if (overlay) {
            const title = overlay.querySelector('.feedback-header h2');
            const icon = overlay.querySelector('.feedback-header i');
            if (title) title.textContent = "¡Salto Temporal!";
            if (icon) icon.className = "fas fa-forward";
        }
    }

    async fetchLobbyData() {
        try {
            const token = localStorage.getItem('authToken');
            // Stats
            const resStats = await fetch(`${window.AppConfig.API_URL}/api/quiz/stats`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const stats = await resStats.json();
            if (stats.success) {
                document.getElementById('lobby-high-score').textContent = stats.highScore;
                document.getElementById('lobby-games-played').textContent = stats.totalGames;
            }

            // Leaderboard
            const resLead = await fetch(`${window.AppConfig.API_URL}/api/quiz/leaderboard`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const dataLead = await resLead.json();
            if (dataLead.success) this.renderLeaderboard(dataLead.leaderboard);

        } catch (e) { console.warn("Error lobby", e); }
    }

    renderLeaderboard(users) {
        const tbody = document.getElementById('leaderboard-body');
        tbody.innerHTML = '';
        if (!users?.length) {
            tbody.innerHTML = `<tr><td colspan="4">Sé el primero en el ranking!</td></tr>`;
            return;
        }
        users.forEach((u, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `<td>${index + 1}</td><td>${u.name}</td><td>${u.score} pts</td><td>${u.difficulty}</td>`;
            tbody.appendChild(row);
        });
    }

    showView(viewName) {
        Object.values(this.views).forEach(v => v.classList.remove('active'));
        this.views[viewName].classList.add('active');
    }

    async startGame(roundNumber = 1) {
        const topic = this.topicInput.value.trim();
        if (!topic && roundNumber === 1) {
            this.topicInput.focus();
            this.topicInput.style.borderColor = 'var(--neon-rose)';
            return;
        }

        this.showView('loading');

        let loadingMsg = "";
        // Persist difficulty
        if (roundNumber === 1) {
            this.currentDifficulty = this.getSelectedDifficulty() || 'Básico';
        }

        const diffLabel = this.currentDifficulty;
        loadingMsg = `Generando Ronda ${roundNumber} (Dificultad: ${diffLabel})...`;
        if (roundNumber >= 5) loadingMsg += " ¡Desafío Final!";

        document.getElementById('loading-text').innerHTML = `
            <span style="font-size: 1.2rem; color: #cbd5e1;">${loadingMsg}</span>
        `;

        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${window.AppConfig.API_URL}/api/quiz/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    topic: topic || this.currentTopic,
                    round: roundNumber,
                    difficulty: this.currentDifficulty // Send Actual Difficulty
                })
            });

            const data = await response.json();

            // Check 403 (Limit Reached)
            if (response.status === 403 && data.error) {
                this.showView('lobby'); // Return to lobby

                // Show Premium Wall Modal
                let titleText = "Límite Diario Alcanzado";
                let mainMessage = data.error;
                let subMessage = "Los usuarios Free tienen un límite de 3 partidas cada 24 horas.";
                let iconClass = "fas fa-clock"; // Default (Limit)

                // 🔒 Premium Lock specific content
                if (data.premiumLock) {
                    titleText = "Nivel Bloqueado";
                    subMessage = "Los niveles Profesional y Experto (Rondas 3-5) son exclusivos de Premium.";
                    iconClass = "fas fa-lock";

                    // 🚨 CRITICAL: Save progress to count this as a played game!
                    // Even if locked, the user played 2 rounds, so we must track it.
                    this.submitScore(this.currentRound - 1);
                }

                const htmlContent = `
                    <div style="text-align: center; color: #cbd5e1;">
                        <p style="font-size: 1.1rem; margin-bottom: 20px;">
                            ${mainMessage}
                        </p>
                        <p style="font-size: 0.95rem; opacity: 0.8;">
                            ${subMessage}
                        </p>
                        <div style="margin-top: 25px; display: flex; gap: 10px; justify-content: center;">
                            <button onclick="window.location.href='/'" class="btn-secondary" style="padding: 10px 20px; border-radius: 8px;">
                                Volver al Inicio
                            </button>
                            <button onclick="window.location.href='pricing.html'" class="btn-primary" style="padding: 10px 20px; border-radius: 8px; background: linear-gradient(135deg, #FFD700 0%, #FDB931 100%); color: #000; font-weight: bold; border: none;">
                                <i class="fas fa-crown"></i> Ser Premium
                            </button>
                        </div>
                    </div>
                `;

                this.showFeedback(false, htmlContent, titleText);

                // Customize Modal Appearance for "Limit Reached" or "Locked"
                const overlay = document.getElementById('feedback-overlay');
                if (overlay) {
                    const title = overlay.querySelector('.feedback-header h2');
                    const icon = overlay.querySelector('.feedback-header i');
                    const nextBtn = document.getElementById('btn-next-question'); // Changed from feedback-next-btn to btn-next-question

                    if (title) {
                        title.textContent = titleText === "Nivel Bloqueado" ? "¡Nivel Superior!" : "¡Vuelve Mañana!";
                        title.style.color = "var(--neon-rose)";
                    }
                    if (icon) {
                        icon.className = iconClass;
                        icon.style.color = "var(--neon-rose)";
                    }
                    // Hide the default "Next" button since we provided custom actions
                    if (nextBtn) nextBtn.style.display = 'none';

                    // Restore button when modal closes (optional cleanup)
                    overlay.onclick = (e) => {
                        if (e.target === overlay) {
                            if (nextBtn) nextBtn.style.display = 'block'; // Reset for next game
                        }
                    }
                }
                return;
            }

            if (!data.success) throw new Error(data.error);

            // Init Game State
            this.questions = data.questions;
            this.currentTopic = data.topic;
            this.isPremiumContext = data.isPremium; // CRÍTICO: Usar flag del backend
            this.currentRound = data.round || roundNumber;
            this.currentQuestionIndex = 0;

            if (roundNumber === 1) {
                this.score = 0;
                this.lives = 3;
            }

            this.updateHUD();
            this.showView('game');
            this.loadRound(); // Carga la primera pregunta

        } catch (error) {
            console.error(error);
            alert('Error iniciando ronda. Intenta de nuevo.');
            this.showView('lobby');
        }
    }

    loadRound() {
        console.log("⚡ Quiz: Cargando ronda...", this.currentRound, "Pregunta:", this.currentQuestionIndex);
        const question = this.questions[this.currentQuestionIndex];

        // Defensive DOM updates
        const badge = document.querySelector('.badged-question');
        if (badge) badge.innerHTML = `Nivel ${this.currentRound} | Pregunta ${this.currentQuestionIndex + 1} de 10`;

        const qText = document.getElementById('question-text');
        if (qText) qText.textContent = question.question;
        else console.error("Elemento faltante: question-text");

        const optionsContainer = document.getElementById('options-container');
        if (optionsContainer) {
            optionsContainer.innerHTML = '';
            question.options.forEach((opt, index) => {
                const btn = document.createElement('button');
                btn.className = 'option-btn';
                btn.textContent = opt;
                btn.onclick = () => this.handleAnswer(index);
                optionsContainer.appendChild(btn);
            });
        }

        // Hide Feedback (Support both old and new structures to avoid crashes)
        const overlay = document.getElementById('feedback-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
            const content = overlay.querySelector('.modal-content');
            if (content) content.classList.remove('correct', 'wrong');
        } else {
            // Fallback safety
            const oldPanel = document.getElementById('feedback-panel');
            if (oldPanel) {
                oldPanel.classList.add('hidden');
                oldPanel.classList.remove('correct', 'wrong');
            } else {
                console.warn("⚠️ No se encontró panel de feedback (Overlay ni Panel viejo)");
            }
        }

        // Start Timer
        this.startTimer(question.timeLimit || 45);
    }

    handleAnswer(selectedIndex) {
        if (this.timer) clearInterval(this.timer);

        const question = this.questions[this.currentQuestionIndex];
        const correctIdx = question.correctAnswerIndex !== undefined ? question.correctAnswerIndex : question.correctIndex;
        const isCorrect = selectedIndex === correctIdx;

        // Disable buttons
        const opts = document.querySelectorAll('.option-btn');
        opts.forEach((btn, idx) => {
            btn.disabled = true;
            if (idx === correctIdx) btn.classList.add('correct');
            else if (idx === selectedIndex) btn.classList.add('wrong');
        });

        if (isCorrect) {
            // Streak Logic
            this.streak++;
            if (this.streak > this.maxStreak) this.maxStreak = this.streak; // 🏆 Track Max

            let multiplier = 1;
            if (this.streak > 2) multiplier = 1.5;

            // Score Calc
            const timeBonus = Math.ceil(this.timeLeft * 10);
            const gained = Math.ceil((100 + timeBonus) * multiplier);
            this.score += gained;

            this.updateHUD();

            // Show Combo Visual
            if (this.streak > 2) this.showComboEffect(multiplier);

        } else {
            this.streak = 0; // Reset streak
            this.lives--;
            this.updateHUD();
            this.triggerShakeEffect();
        }

        // Prepare Feedback
        let feedbackContent = question.educationalFeedback || question.feedback || "Sin explicación disponible.";
        let feedbackHtml = "";

        if (isCorrect) {
            feedbackHtml = `<p><strong>¡Correcto!</strong> ${feedbackContent}</p>`;
        } else {
            const correctText = question.options[correctIdx];
            feedbackHtml = `<p><strong>Respuesta Correcta:</strong> ${correctText}</p>
                            <p>${feedbackContent}</p>`;
        }

        this.showFeedback(isCorrect, feedbackHtml, feedbackContent);
    }

    startTimer(seconds) {
        this.timeLeft = seconds;
        const infoTimer = document.getElementById('timer-info'); // Optional text countdown
        const timerBar = document.getElementById('timer-bar');

        if (timerBar) {
            timerBar.style.width = '100%';
            timerBar.style.transition = 'none';
            void timerBar.offsetWidth; // Force reflow
            timerBar.style.transition = `width ${seconds}s linear`;
            timerBar.style.width = '0%';
        }

        if (this.timer) clearInterval(this.timer);

        this.timer = setInterval(() => {
            this.timeLeft--;
            if (infoTimer) infoTimer.textContent = this.timeLeft;

            if (this.timeLeft <= 0) {
                clearInterval(this.timer);
                this.handleAnswer(-1); // Timeout
            }
        }, 1000);
    }

    showFeedback(isCorrect, htmlContent, plainText) {
        const overlay = document.getElementById('feedback-overlay');
        /* 
           Si existe el overlay (High-End UI), lo usamos. 
           Si no, fallback al panel antiguo o alert.
        */
        if (overlay) {
            overlay.classList.remove('hidden');
            const content = overlay.querySelector('.modal-content');
            const icon = overlay.querySelector('.feedback-header i');
            const title = overlay.querySelector('.feedback-header h2');
            const body = overlay.querySelector('.feedback-body');
            const btnNext = document.getElementById('btn-next-question');

            if (content) {
                content.classList.remove('correct', 'wrong');
                content.classList.add(isCorrect ? 'correct' : 'wrong');
            }

            if (icon) {
                icon.className = isCorrect ? 'fas fa-check-circle' : 'fas fa-times-circle';
            }

            // Textos y Estados del Botón
            const isGameOver = this.lives <= 0;
            const isRoundEnd = this.currentQuestionIndex >= this.questions.length - 1;

            if (title) {
                title.textContent = isCorrect ? '¡Excelente!' : (isGameOver ? '¡Fin del Juego!' : '¡Incorrecto!');
            }

            if (body) {
                body.innerHTML = htmlContent;
            }

            if (btnNext) {
                btnNext.disabled = false; // CRITICAL: Always re-enable button when showing feedback

                if (isGameOver) {
                    btnNext.innerHTML = 'Ver Resultados <i class="fas fa-flag-checkered"></i>';
                    btnNext.className = 'btn-glow game-over-btn'; // Optional styling
                } else if (isRoundEnd && this.currentRound < this.maxRounds) {
                    // 🔒 Premium Lock Visual
                    if (this.currentRound === 2 && !this.isPremiumContext) {
                        btnNext.innerHTML = 'Desbloquear Nivel 3 <i class="fas fa-lock" style="margin-left: 8px;"></i>';
                        btnNext.className = 'btn-premium-unlock'; // Custom Premium Style
                    } else {
                        btnNext.innerHTML = 'Siguiente Nivel <i class="fas fa-level-up-alt"></i>';
                    }
                } else if (isRoundEnd && this.currentRound >= this.maxRounds) {
                    btnNext.innerHTML = 'Finalizar Desafío <i class="fas fa-trophy"></i>';
                } else {
                    btnNext.innerHTML = 'Siguiente Pregunta <i class="fas fa-arrow-right"></i>';
                }
            }

        } else {
            // Fallback Legacy
            alert(plainText);
        }
    }

    showComboEffect(multiplier) {
        const scoreDisplay = document.querySelector('.score-display');
        const comboEl = document.createElement('div');
        comboEl.className = 'combo-text';
        comboEl.innerHTML = `🔥 COMBO x${multiplier}!`;
        if (scoreDisplay) {
            scoreDisplay.appendChild(comboEl);
            setTimeout(() => comboEl.remove(), 1500);
        }
    }

    nextQuestion() {
        // Prevent double clicking
        const btnNext = document.getElementById('btn-next-question');
        if (btnNext && btnNext.disabled) return;
        if (btnNext) btnNext.disabled = true;

        // CRITICAL: Always hide overlay when moving forward
        const overlay = document.getElementById('feedback-overlay');
        if (overlay) overlay.classList.add('hidden');

        if (this.lives === 0) {
            this.endGame(false);
            return;
        }

        // Si hay más preguntas en la ronda actual
        if (this.currentQuestionIndex < this.questions.length - 1) {
            this.currentQuestionIndex++;
            this.loadRound();
        } else {
            // Fin de la ronda actual
            if (this.currentRound < this.maxRounds) {
                // Siguiente Ronda

                // Show loading state with explicit Level Up message
                this.showView('loading');
                const nextLevel = this.currentRound + 1;
                document.getElementById('loading-text').innerHTML = `
                    <span style="font-size: 1.5rem; color: #facc15;">¡Nivel ${this.currentRound} Completado!</span><br>
                    <span style="font-size: 1.1rem; color: #94a3b8;">Preparando Nivel ${nextLevel}...</span>
                `;

                // Bonus Vida Logic (Silent)
                if (this.lives < 3) this.lives++;

                // Delay to allow user to see the transition
                setTimeout(() => {
                    this.startGame(nextLevel);
                }, 2000);
            } else {
                // Fin del Juego (Ganado)
                this.endGame(true);
            }
        }
    }

    async submitScore(roundsOverride = null) {
        try {
            const token = localStorage.getItem('authToken');

            // Use the persisted difficulty (or fallback if undefined)
            let finalDiff = this.currentDifficulty || 'Básico';

            // Determine rounds count
            const finalRounds = roundsOverride || this.currentRound;

            const res = await fetch(`${window.AppConfig.API_URL}/api/quiz/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    topic: this.currentTopic,
                    difficulty: finalDiff,
                    score: this.score,
                    correct_answers_count: Math.floor(this.score / 100),
                    total_questions: finalRounds * 10,
                    rounds_completed: finalRounds
                })
            });
            const data = await res.json();

            // Return data mainly for endGame to update stats
            return data;

        } catch (e) {
            console.error("Error guardando puntaje", e);
            return null;
        }
    }

    async endGame(isWin = false) {
        // Hide Overlay if open
        const overlay = document.getElementById('feedback-overlay');
        if (overlay) overlay.classList.add('hidden');

        this.showView('results');

        document.getElementById('final-score-val').textContent = this.score;
        document.getElementById('final-correct').textContent = Math.round(this.score / 120); // Aproximación
        document.getElementById('final-rounds').textContent = `${this.currentRound}`;

        // Uses extracted method
        const data = await this.submitScore();

        if (data && data.isNewRecord) {
            document.getElementById('new-record-badge').classList.remove('hidden');
        } else {
            document.getElementById('new-record-badge').classList.add('hidden');
        }

        // 🏆 GAMIFICATIONS CHECK
        // Using a rough accuracy estimate or just score/lives
        const possibleScore = this.currentRound * 10 * 100; // 10 questions per round, 100 pts each base
        const accuracy = Math.min(100, Math.round((this.score / possibleScore) * 100));
        this.checkAchievements(isWin, accuracy);
    }

    // 🏆 NEW: Achievement System
    checkAchievements(isWin, accuracy) {
        const achievements = [];

        // 1. "Primera Sangre" (First Win)
        // Logic: Trigger if they won at least 1 round (isWin) OR if they submitted a score > 0 (even if lost later)
        if (isWin || this.score > 0) {
            achievements.push({ title: 'Primer Paso', desc: 'Completaste una sesión de estudio.', icon: '🎯' });
        }

        // 2. "Perfeccionista" (High Accuracy)
        if (accuracy >= 90) {
            achievements.push({ title: 'Mente Brillante', desc: 'Precisión superior al 90%.', icon: '🧠' });
        }

        // 3. "Racha de Fuego" (Use MAX Streak, not current)
        if (this.maxStreak >= 5) {
            achievements.push({ title: 'En Llamas', desc: 'Racha de 5+ respuestas correctas.', icon: '🔥' });
        }

        // 4. "Sobreviviente" (Win with exactly 1 life)
        if (isWin && this.lives === 1) {
            achievements.push({ title: 'Sobreviviente', desc: 'Ganaste con solo 1 vida restante.', icon: '🚑' });
        }

        // Show them sequentially
        achievements.forEach((ach, index) => {
            setTimeout(() => {
                this.triggerAchievement(ach.title, ach.desc, ach.icon);
            }, index * 1500 + 1000); // Delay to let results screen settle
        });
    }

    triggerAchievement(title, desc, icon) {
        // Create Toast Element
        const toast = document.createElement('div');
        toast.className = 'achievement-toast';
        toast.innerHTML = `
            <div class="ach-icon">${icon}</div>
            <div class="ach-content">
                <div class="ach-title">¡Logro Desbloqueado!</div>
                <div class="ach-name">${title}</div>
                <div class="ach-desc">${desc}</div>
            </div>
        `;

        // Style injected dynamically (saving a CSS file edit)
        if (!document.getElementById('ach-styles')) {
            const style = document.createElement('style');
            style.id = 'ach-styles';
            style.innerHTML = `
                .achievement-toast {
                    position: fixed;
                    top: 20px;
                    left: 50%;
                    transform: translateX(-50%) translateY(-100px);
                    background: rgba(15, 23, 42, 0.95);
                    border: 1px solid rgba(139, 92, 246, 0.5);
                    border-left: 4px solid #8B5CF6;
                    padding: 1rem 1.5rem;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.5);
                    z-index: 10000;
                    opacity: 0;
                    transition: all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
                    min-width: 300px;
                }
                .achievement-toast.show {
                    transform: translateX(-50%) translateY(0);
                    opacity: 1;
                }
                .ach-icon { font-size: 2rem; }
                .ach-content { text-align: left; }
                .ach-title { font-size: 0.75rem; color: #cbd5e1; text-transform: uppercase; letter-spacing: 1px; }
                .ach-name { font-size: 1.1rem; font-weight: bold; color: #fff; margin: 2px 0; }
                .ach-desc { font-size: 0.85rem; color: #94a3b8; }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(toast);

        // Animate In
        requestAnimationFrame(() => toast.classList.add('show'));

        // Animate Out & Remove
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 500);
        }, 4000);
    }

    updateHUD() {
        document.getElementById('score-display').textContent = this.score;
        const livesContainer = document.getElementById('lives-display');
        livesContainer.innerHTML = '';

        for (let i = 0; i < 3; i++) {
            const heart = document.createElement('i');
            heart.className = 'fas fa-heart';
            if (i < this.lives) heart.classList.add('active-heart');
            else heart.classList.add('lost');
            livesContainer.appendChild(heart);
        }
    }

    getSelectedDifficulty() {
        const selected = document.querySelector('.difficulty-card.selected');
        return selected ? selected.dataset.level : null;
    }

    triggerShakeEffect() {
        const hud = document.querySelector('.game-hud');
        if (hud) {
            hud.classList.add('shake-effect');
            setTimeout(() => hud.classList.remove('shake-effect'), 500);
        }
    }
}



document.addEventListener('DOMContentLoaded', () => {
    new QuizGame();
});
