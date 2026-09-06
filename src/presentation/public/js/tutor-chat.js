/**
 * FlashcardTutor Component (Senior Edition)
 * Exclusive chat for study sessions using Gemini 2.5 Flash Lite.
 */
class FlashcardTutor {
    constructor() {
        this.isOpen = false;
        this.messages = [];
        this.cardContext = null;
        this.isTyping = false;
        this.dom = {};
    }

    init() {
        if (this.initialized) return;
        this._renderPanel();
        this._bindEvents();
        this.initialized = true;
        console.log("🧠 Tutor IA Initialized (Gemini 2.5 Flash Lite Mode)");
    }

    _renderPanel() {
        const panel = document.createElement('div');
        panel.id = 'tutor-chat-panel';
        panel.className = 'tutor-chat-panel';
        panel.innerHTML = `
            <div class="tutor-chat-header">
                <div class="tutor-header-title">
                    <img src="/assets/hubifrente.png" alt="Hubi" class="tutor-header-avatar-img">
                    <span>Tutor de Apoyo IA</span>
                </div>
                <div class="tutor-header-actions" style="display:flex; gap:0.5rem; align-items:center;">
                    <button id="tutor-expand" class="tutor-expand-btn" aria-label="Pantalla completa" title="Pantalla completa">
                        <i class="fas fa-expand"></i>
                    </button>
                    <button id="tutor-close" class="tutor-close-btn" aria-label="Cerrar">&times;</button>
                </div>
            </div>
            <div id="tutor-messages" class="tutor-messages-area">
                <div class="tutor-message tutor-message-bot">Hola, soy tu tutor de apoyo. ¿Hay algo en esta tarjeta que no te haya quedado claro?</div>
            </div>
            <div class="tutor-input-area">
                <textarea id="tutor-input" class="tutor-input-field" placeholder="Escribe tu duda aquí..." rows="1"></textarea>
                <button id="tutor-send" class="tutor-send-btn" aria-label="Enviar mensaje">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
            <div class="tutor-disclaimer-text">El Tutor IA puede cometer errores. Verifica información importante.</div>
        `;
        document.body.appendChild(panel);

        this.dom = {
            panel: panel,
            messages: document.getElementById('tutor-messages'),
            input: document.getElementById('tutor-input'),
            send: document.getElementById('tutor-send'),
            expand: document.getElementById('tutor-expand'),
            close: document.getElementById('tutor-close')
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
        
        // ✅ MEJORA: Soporte para multi-línea (Solo Shift + Enter)
        this.dom.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
                this.dom.input.style.height = 'auto';
            }
        });

        // ✅ MEJORA: Auto-resize del textarea
        this.dom.input.addEventListener('input', () => {
            this.dom.input.style.height = 'auto';
            this.dom.input.style.height = (this.dom.input.scrollHeight) + 'px';
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

    toggle(forceState, context = null) {
        // ✅ GUARD: Si el panel aún no se ha renderizado, intentamos inicializar
        if (!this.dom.panel) {
            this.init();
        }
        
        // Si después de init sigue sin haber panel (ej. error en DOM), abortamos suavemente
        if (!this.dom.panel) return;

        this.isOpen = forceState !== undefined ? forceState : !this.isOpen;
        this.dom.panel.classList.toggle('active', this.isOpen);

        // Actualizar contexto si se provee, pero NO limpiar chat aquí
        if (context) {
            this.cardContext = context;
        }

        if (this.isOpen) {
            setTimeout(() => this.dom.input.focus(), 300);
        }
    }

    clearChat() {
        if (!this.dom.messages) {
            this.init();
        }
        if (!this.dom.messages) return;

        this.messages = [];
        this.history = []; // Limpiar historial interno para el backend
        this.dom.messages.innerHTML = `
            <div class="tutor-message tutor-message-bot">Hola, soy tu tutor de apoyo. ¿Hay algo en esta tarjeta que no te haya quedado claro?</div>
        `;
    }

    async sendMessage() {
        const text = this.dom.input.value.trim();
        if (!text || this.isTyping) return;

        // ✅ Prevenir envío proactivo si ya no tiene vidas de prueba (Paywall solo cuando realmente está en cero)
        if (window.uiManager && typeof window.uiManager.isResourceLocked === 'function' && window.uiManager.isResourceLocked(true)) {
            if (typeof window.uiManager.showPaywallModal === 'function') {
                window.uiManager.showPaywallModal('Has agotado tus vidas de prueba semanal. ¡Mejora tu plan para mantener acceso ilimitado!', 'flashcards');
            }
            return;
        }

        this.dom.input.value = '';
        this._addMessage(text, 'user');
        this._setTyping(true);

        try {
            // ✅ Mantenemos historial local para que la IA tenga memoria de la conversación actual
            if (!this.history) this.history = [];
            
            const payload = {
                message: text,
                specialization: 'flashcard_tutor', // 🚀 Personalidad exclusiva de Tutor Académico Multidisciplinario
                history: this.history, // 🧠 Memoria de la sesión
                context: {
                    type: 'flashcard_tutor',
                    front: this.cardContext?.front || 'Imagen o sin texto',
                    back: this.cardContext?.back || 'Imagen o sin texto',
                    topic: this.cardContext?.topic || 'General',
                    deckId: this.cardContext?.deckId || null,
                    deckName: this.cardContext?.deckName || 'Mazo de Estudio',
                    deckCategory: this.cardContext?.deckCategory || 'General',
                    imageUrl: this.cardContext?.imageUrl || null,
                    explanationImageUrl: this.cardContext?.explanationImageUrl || null,
                    audioUrlFront: this.cardContext?.audioUrlFront || null,
                    audioUrlBack: this.cardContext?.audioUrlBack || null,
                    hideTextFront: !!this.cardContext?.hideTextFront,
                    hideTextBack: !!this.cardContext?.hideTextBack
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
                        window.uiManager.showPaywallModal(data.error || null, 'chat_standard');
                    }
                    this._addMessage(`⚠️ ${data.error || 'Límite de consultas diarias alcanzado.'}`, 'bot');
                    return;
                }
                throw new Error(data.error || "Error en la red");
            }

            if (data.respuesta) {
                this._addMessage(data.respuesta, 'bot');
                
                // ✅ Guardamos en el historial para la próxima pregunta (usando 'sender' para match con backend)
                this.history.push({ sender: 'user', content: text });
                this.history.push({ sender: 'bot', content: data.respuesta });
                
                // Limitar historial para no saturar el contexto (ej. últimos 10 mensajes)
                if (this.history.length > 10) this.history.shift(); 

                // ✅ Refrescar vidas en el header sin interrumpir al usuario con modales si consumió su última vida
                if (window.sessionManager && typeof window.sessionManager.refreshUser === 'function') {
                    window.sessionManager.refreshUser().catch(() => {});
                }
            } else {
                throw new Error("Sin respuesta del tutor");
            }

        } catch (error) {
            if (error.message === 'Unauthorized') return;
            console.error("Tutor Error:", error);
            this._addMessage("Lo siento, tuve un problema de conexión. Inténtalo de nuevo.", 'bot');
        } finally {
            this._setTyping(false);
        }
    }

    _addMessage(text, role) {
        const msgContainer = document.createElement('div');
        msgContainer.className = `tutor-message-wrapper ${role}`;

        const msg = document.createElement('div');
        msg.className = `tutor-message tutor-message-${role} markdown-content`;
        
        // ✅ SAFETY NET: Extraer respuesta pura y desescapar si el texto contiene JSON crudo o bloques de código
        let cleanText = text;
        if (window.MarkdownRenderer && typeof window.MarkdownRenderer._extractCleanResponse === 'function') {
            cleanText = window.MarkdownRenderer._extractCleanResponse(text);
        } else if (typeof text === 'string' && text.trimStart().startsWith('{')) {
            try { const p = JSON.parse(text); if (p && p.respuesta) cleanText = p.respuesta; } catch(e) {}
        }

        // ✅ MEJORA: Formateador Markdown Unificado
        let formattedText = window.MarkdownRenderer ? window.MarkdownRenderer.render(cleanText) : cleanText.replace(/\n/g, '<br>');
        msg.innerHTML = formattedText;
        msgContainer.appendChild(msg);

        // ✅ AGREGAR BOTÓN DE GUARDADO SOLO PARA EL BOT
        if (role === 'bot') {
            const actions = document.createElement('div');
            actions.className = 'tutor-message-actions';
            
            const saveBtn = document.createElement('button');
            saveBtn.className = 'tutor-save-note-btn';
            saveBtn.innerHTML = '<i class="far fa-bookmark"></i> Guardar nota';
            saveBtn.title = 'Guardar como nota de estudio';
            saveBtn.onclick = () => this.saveAsNote(cleanText, saveBtn);

            const copyBtn = document.createElement('button');
            copyBtn.className = 'tutor-save-note-btn'; // Reutilizamos clase para consistencia
            copyBtn.innerHTML = '<i class="far fa-copy"></i> Copiar';
            copyBtn.title = 'Copiar respuesta';
            copyBtn.onclick = () => this.copyToClipboard(cleanText, copyBtn);
            
            actions.appendChild(saveBtn);
            actions.appendChild(copyBtn);
            msgContainer.appendChild(actions);
        } else if (role === 'user') {
            // ✅ Botón de copiado para el usuario (útil en móvil)
            const actions = document.createElement('div');
            actions.className = 'tutor-message-actions user-actions';
            
            const copyBtn = document.createElement('button');
            copyBtn.className = 'tutor-save-note-btn';
            copyBtn.innerHTML = '<i class="far fa-copy"></i> Copiar';
            copyBtn.onclick = () => this.copyToClipboard(text, copyBtn);
            
            actions.appendChild(copyBtn);
            msgContainer.appendChild(actions);
        }

        this.dom.messages.appendChild(msgContainer);
        this.dom.messages.scrollTop = this.dom.messages.scrollHeight;
    }

    async copyToClipboard(text, btn) {
        try {
            await navigator.clipboard.writeText(text);
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i> ¡Copiado!';
            setTimeout(() => {
                btn.innerHTML = originalHTML;
            }, 2000);
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
            
            const title = `Nota de Repaso: ${this.cardContext?.topic || 'Flashcard'}`;
            
            const response = await window.NetworkService.fetch(`${window.AppConfig.API_URL}/api/library/notes`, {
                method: 'POST',
                body: JSON.stringify({
                    title: title,
                    content: content,
                    sourceType: 'flashcard'
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
            console.error("Error saving tutor note:", error);
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
            loader.id = 'tutor-loader';
            loader.className = 'tutor-message tutor-message-bot';
            loader.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Pensando...';
            this.dom.messages.appendChild(loader);
            this.dom.messages.scrollTop = this.dom.messages.scrollHeight;
        } else {
            const loader = document.getElementById('tutor-loader');
            if (loader) loader.remove();
        }
    }
}

// Global instance
window.flashcardTutor = new FlashcardTutor();
document.addEventListener('DOMContentLoaded', () => window.flashcardTutor.init());
