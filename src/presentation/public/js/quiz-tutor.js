/**
 * QuizTutor Component (Simulador Edition)
 * Interactive AI tutor for quiz questions using Gemini 2.5 Flash Lite + RAG.
 */
class QuizTutor {
    constructor() {
        this.isOpen = false;
        this.messages = [];
        this.questionContext = null;
        this.isTyping = false;
        this.dom = {};
        this.history = [];
    }

    init() {
        if (this.initialized) return;
        this._renderPanel();
        this._bindEvents();
        this.initialized = true;
        console.log("🧠 QuizTutor IA Initialized (Gemini 2.5 Flash Lite + RAG Mode)");
    }

    _renderPanel() {
        // Prevent duplicate panels
        let panel = document.getElementById('quiz-tutor-panel');
        if (panel) {
            panel.remove();
        }

        panel = document.createElement('div');
        panel.id = 'quiz-tutor-panel';
        panel.className = 'tutor-chat-panel'; // Reutiliza la clase del panel lateral
        panel.innerHTML = `
            <div class="tutor-chat-header">
                <div class="tutor-header-title">
                    <img src="/assets/hubifrente.png" alt="Hubi" class="tutor-header-avatar-img">
                    <span>Tutor de Apoyo IA</span>
                </div>
                <div class="tutor-header-actions" style="display:flex; gap:0.5rem; align-items:center;">
                    <button id="quiz-tutor-expand" class="tutor-expand-btn" aria-label="Pantalla completa" title="Pantalla completa">
                        <i class="fas fa-expand"></i>
                    </button>
                    <button id="quiz-tutor-close" class="tutor-close-btn" aria-label="Cerrar">&times;</button>
                </div>
            </div>
            <div id="quiz-tutor-messages" class="tutor-messages-area">
                <!-- Mensajes inyectados dinámicamente -->
            </div>
            <div class="tutor-input-area">
                <textarea id="quiz-tutor-input" class="tutor-input-field" placeholder="Escribe tu duda aquí..." rows="1"></textarea>
                <button id="quiz-tutor-send" class="tutor-send-btn" aria-label="Enviar mensaje">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
            <div class="tutor-disclaimer-text">El Tutor IA puede cometer errores. Verifica información importante.</div>
        `;
        document.body.appendChild(panel);

        this.dom = {
            panel: panel,
            messages: document.getElementById('quiz-tutor-messages'),
            input: document.getElementById('quiz-tutor-input'),
            send: document.getElementById('quiz-tutor-send'),
            expand: document.getElementById('quiz-tutor-expand'),
            close: document.getElementById('quiz-tutor-close')
        };
    }

    _bindEvents() {
        this.dom.close.onclick = () => this.toggle(false);
        this.dom.send.onclick = () => this.sendMessage();

        if (this.dom.expand) {
            this.dom.expand.onclick = () => this.toggleFullScreen();
        }

        // Delegación de clic en imágenes para visor inmersivo
        if (this.dom.messages) {
            this.dom.messages.addEventListener('click', (e) => {
                const img = e.target.closest('img');
                if (img && this.dom.messages.contains(img)) {
                    const ui = window.uiManager || (window.parent && window.parent.uiManager);
                    if (ui && typeof ui.showMediaViewer === 'function') {
                        ui.showMediaViewer(img.src, img.alt || 'Visualizando imagen del tutor');
                    }
                }
            });
        }

        // Soporte para enviar con Enter (Shift + Enter para nueva línea)
        this.dom.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
                this.dom.input.style.height = 'auto';
            }
        });

        // Auto-resize del input de texto (Garantiza altura exacta de 48px si no hay multilinea)
        this.dom.input.addEventListener('input', () => {
            this.dom.input.style.height = '48px';
            if (this.dom.input.scrollHeight > 48) {
                const newHeight = Math.min(this.dom.input.scrollHeight, 120);
                this.dom.input.style.height = newHeight + 'px';
            }
        });
    }

    toggleFullScreen() {
        this.isFullScreen = !this.isFullScreen;
        const panel = this.dom.panel;
        const expandBtn = this.dom.expand;
        if (!panel || !expandBtn) return;
        const icon = expandBtn.querySelector('i');

        if (this.isFullScreen) {
            panel.classList.add('chat-fullscreen');
            if (icon) {
                icon.classList.remove('fa-expand');
                icon.classList.add('fa-compress');
            }
            document.body.style.overflow = 'hidden';
            expandBtn.setAttribute('title', 'Restaurar ventana');
        } else {
            panel.classList.remove('chat-fullscreen');
            if (icon) {
                icon.classList.remove('fa-compress');
                icon.classList.add('fa-expand');
            }
            document.body.style.overflow = '';
            expandBtn.setAttribute('title', 'Pantalla completa');
        }
    }

    getSpecialization() {
        const context = this.questionContext?.examContext || window.__quizState?.context || 'MEDICINA';
        const ctxUpper = String(context).toUpperCase();
        if (ctxUpper === 'EDUCACION') return 'education';
        return 'medicine';
    }

    toggle(forceState, questionContext = null) {
        if (!this.dom.panel) {
            this.init();
        }

        if (!this.dom.panel) return;

        this.isOpen = forceState !== undefined ? forceState : !this.isOpen;
        this.dom.panel.classList.toggle('active', this.isOpen);

        if (this.isOpen) {
            // Actualizar siempre el contexto si se provee uno nuevo
            if (questionContext) {
                const isDifferentQuestion = !this.questionContext || this.questionContext.id !== questionContext.id;
                this.questionContext = questionContext;
                if (isDifferentQuestion) {
                    this.clearChat();
                    this._addWelcomeMessage();
                }
            }
            setTimeout(() => {
                if (this.dom.input) this.dom.input.focus();
            }, 300);
        }
    }

    clearChat() {
        if (!this.dom.messages) return;
        this.messages = [];
        this.history = [];
        this.dom.messages.innerHTML = '';
    }

    _addWelcomeMessage() {
        let welcomeText = "Hola, soy tu tutor de apoyo IA. ¿Tienes alguna duda sobre esta pregunta o sobre el sustento técnico? Con gusto te lo explico en detalle.";
        const spec = this.getSpecialization();
        if (spec === 'medicine') {
            welcomeText = "Hola, soy tu tutor clínico. ¿Hay algún concepto de esta pregunta, norma técnica o guía oficial que desees profundizar?";
        } else if (spec === 'education') {
            welcomeText = "Hola, soy tu tutor pedagógico. ¿Tienes alguna duda sobre la casuística de esta pregunta o sobre el Currículo Nacional (CNEB)?";
        }

        this._addMessage(welcomeText, 'bot');
    }

    async sendMessage(overrideText = null) {
        const text = (overrideText || this.dom.input.value).trim();
        if (!text || this.isTyping) return;

        // ✅ Prevenir envío proactivo si ya no tiene vidas de prueba (Paywall solo cuando realmente está en cero)
        if (window.uiManager && typeof window.uiManager.isResourceLocked === 'function' && window.uiManager.isResourceLocked(true)) {
            if (typeof window.uiManager.showPaywallModal === 'function') {
                window.uiManager.showPaywallModal('Has agotado tus vidas de prueba semanal. ¡Mejora tu plan para mantener acceso ilimitado!', 'quiz_tutor');
            }
            return;
        }

        if (!overrideText) {
            this.dom.input.value = '';
            this.dom.input.style.height = 'auto';
        }

        this._addMessage(text, 'user');
        this._setTyping(true);

        // Asegurar token de autenticación vigente para evitar degradación a visitante por inactividad
        if (window.AuthApiService && typeof window.AuthApiService.getValidToken === 'function') {
            try {
                await window.AuthApiService.getValidToken();
            } catch (_) {}
        }

        try {
            const spec = this.getSpecialization();
            const targetExam = this.questionContext?.target || window.__quizState?.targetExam || (spec === 'education' ? 'ASCENSO' : 'SERUMS');
            
            // Garantizar array de opciones limpio
            let rawOptions = this.questionContext?.options || [];
            if (typeof rawOptions === 'string') {
                try { rawOptions = JSON.parse(rawOptions); } catch (e) { rawOptions = [rawOptions]; }
            }
            const safeOptions = Array.isArray(rawOptions) ? rawOptions : [];

            const payload = {
                message: text,
                specialization: spec,
                target: targetExam,
                history: this.history,
                ephemeral: true,
                context: {
                    type: 'quiz_tutor',
                    id: this.questionContext?.id,
                    questionText: this.questionContext?.questionText || this.questionContext?.question || '',
                    options: safeOptions,
                    correctOptionIndex: this.questionContext?.correctOptionIndex !== undefined ? this.questionContext.correctOptionIndex : null,
                    correctOptionText: this.questionContext?.correctOptionText || '',
                    userOptionIndex: this.questionContext?.userOptionIndex !== undefined ? this.questionContext.userOptionIndex : null,
                    userOptionText: this.questionContext?.userOptionText || '',
                    isUserCorrect: Boolean(this.questionContext?.isUserCorrect),
                    explanation: this.questionContext?.explanation || '',
                    topic: this.questionContext?.topic || 'General',
                    target: targetExam,
                    career: this.questionContext?.career || window.__quizState?.career || '',
                    examContext: this.questionContext?.examContext || window.__quizState?.context || 'MEDICINA',
                    difficulty: this.questionContext?.difficulty || window.__quizState?.difficulty || 'Senior',
                    areas: this.questionContext?.areas || window.__quizState?.areas || [],
                    mode: this.questionContext?.mode || window.__quizState?.mode || '',
                    imageUrl: this.questionContext?.imageUrl || null,
                    explanationImageUrl: this.questionContext?.explanationImageUrl || null,
                    audioText: this.questionContext?.audioText || null,
                    caseId: this.questionContext?.caseId || null,
                    caseCode: this.questionContext?.caseCode || null,
                    caseTitle: this.questionContext?.caseTitle || '',
                    caseDescription: this.questionContext?.caseDescription || '',
                    caseImageUrl: this.questionContext?.caseImageUrl || null,
                    caseTableHtml: this.questionContext?.caseTableHtml || null,
                    caseOrder: this.questionContext?.caseOrder || null
                }
            };

            const response = await window.NetworkService.fetch(`${window.AppConfig.API_URL}/api/chat`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 403) {
                    if (window.uiManager) {
                        window.uiManager.showPaywallModal(data.error || null, 'quiz_tutor');
                    }
                    this._addMessage(`⚠️ ${data.error || 'Límite de consultas diarias alcanzado.'}`, 'bot');
                    return;
                }
                throw new Error(data.error || "Error en la red");
            }

            if (data.respuesta) {
                this._addMessage(data.respuesta, 'bot');
                
                // Agregar al historial de la sesión
                this.history.push({ sender: 'user', content: text });
                this.history.push({ sender: 'bot', content: data.respuesta });

                // Mantener límite de historial de la sesión para evitar payloads gigantes
                if (this.history.length > 10) {
                    this.history.splice(0, 2);
                }

                // ✅ Refrescar vidas en el header sin interrumpir al usuario con modales
                if (window.sessionManager && typeof window.sessionManager.refreshUser === 'function') {
                    window.sessionManager.refreshUser().catch(() => {});
                }
            } else {
                throw new Error("Sin respuesta del tutor");
            }
        } catch (error) {
            console.error("QuizTutor Error:", error);
            this._addMessage("Lo siento, tuve un problema de conexión al procesar tu consulta. Inténtalo de nuevo.", 'bot');
        } finally {
            this._setTyping(false);
        }
    }

    _addMessage(text, role, suggestions = null) {
        const msgWrapper = document.createElement('div');
        msgWrapper.className = `tutor-message-wrapper ${role}`;

        const msg = document.createElement('div');
        msg.className = `tutor-message tutor-message-${role} markdown-content`;

        // JSON Safety Net
        if (typeof text === 'string' && text.trimStart().startsWith('{')) {
            try {
                const p = JSON.parse(text);
                if (p && p.respuesta) text = p.respuesta;
            } catch (e) {}
        }

        // Formatear Markdown
        let formattedText = window.MarkdownRenderer ? window.MarkdownRenderer.render(text) : text.replace(/\n/g, '<br>');
        msg.innerHTML = formattedText;
        msgWrapper.appendChild(msg);

        // Agregar acciones
        if (role === 'bot') {
            const actions = document.createElement('div');
            actions.className = 'tutor-message-actions';

            const saveBtn = document.createElement('button');
            saveBtn.className = 'tutor-save-note-btn';
            saveBtn.innerHTML = '<i class="far fa-bookmark"></i> Guardar nota';
            saveBtn.title = 'Guardar nota de estudio';
            saveBtn.onclick = () => this.saveAsNote(text, saveBtn);

            const copyBtn = document.createElement('button');
            copyBtn.className = 'tutor-save-note-btn';
            copyBtn.innerHTML = '<i class="far fa-copy"></i> Copiar';
            copyBtn.title = 'Copiar al portapapeles';
            copyBtn.onclick = () => this.copyToClipboard(text, copyBtn);

            actions.appendChild(saveBtn);
            actions.appendChild(copyBtn);
            msgWrapper.appendChild(actions);
        } else if (role === 'user') {
            const actions = document.createElement('div');
            actions.className = 'tutor-message-actions user-actions';

            const copyBtn = document.createElement('button');
            copyBtn.className = 'tutor-save-note-btn';
            copyBtn.innerHTML = '<i class="far fa-copy"></i> Copiar';
            copyBtn.onclick = () => this.copyToClipboard(text, copyBtn);

            actions.appendChild(copyBtn);
            msgWrapper.appendChild(actions);
        }

        this.dom.messages.appendChild(msgWrapper);
        this.dom.messages.scrollTop = this.dom.messages.scrollHeight;
    }

    async copyToClipboard(text, btn) {
        try {
            await navigator.clipboard.writeText(text);
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i> ¡Copiado!';
            setTimeout(() => { btn.innerHTML = originalHTML; }, 2000);
        } catch (err) {
            console.error('Error al copiar:', err);
        }
    }

    async saveAsNote(content, btn) {
        if (btn.classList.contains('saved') || btn.disabled) return;
        const originalHTML = btn.innerHTML;

        try {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

            const title = `Nota del Simulador: ${this.questionContext?.topic || 'General'}`;

            const response = await window.NetworkService.fetch(`${window.AppConfig.API_URL}/api/library/notes`, {
                method: 'POST',
                body: JSON.stringify({
                    title: title,
                    content: content,
                    sourceType: 'quiz'
                })
            });

            if (!response.ok) throw new Error("Error al guardar nota");

            // Feedback visual exitoso con animación y estado "Nota Guardada"
            btn.innerHTML = '<i class="fas fa-check"></i> Nota Guardada';
            btn.style.color = '#f59e0b'; // Amarillo dorado
            btn.classList.add('saved');

            if (window.libraryService && typeof window.libraryService.loadFullLibrary === 'function') {
                window.libraryService.loadFullLibrary();
            }
        } catch (error) {
            console.error("Error saving note:", error);
            btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error al guardar';
            btn.style.color = '#ef4444';
            setTimeout(() => {
                btn.disabled = false;
                btn.innerHTML = originalHTML;
                btn.style.color = '';
            }, 2500);
        }
    }

    _setTyping(state) {
        this.isTyping = state;
        this.dom.send.disabled = state;
        if (state) {
            const loader = document.createElement('div');
            loader.id = 'quiz-tutor-loader';
            loader.className = 'tutor-message tutor-message-bot';
            loader.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Pensando...';
            this.dom.messages.appendChild(loader);
            this.dom.messages.scrollTop = this.dom.messages.scrollHeight;
        } else {
            const loader = document.getElementById('quiz-tutor-loader');
            if (loader) loader.remove();
        }
    }
}

// Export single global instance
window.quizTutor = new QuizTutor();
