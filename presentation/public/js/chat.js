class ChatComponent {
    constructor(options = {}) {
        this.isOpen = false;
        this.isSending = false;
        this.activeConversationId = null;
        this.messages = [];
        this.conversations = [];
        this.messageIdCounter = 0;
        
        // Fase IV: Opciones de Modularidad
        this.targetSelector = options.targetSelector || 'body'; // Dónde se inyecta
        this.isFullScreen = false;

        // Callback binding
        this.handlePopState = this.handlePopState.bind(this);
        this.toggleFullScreen = this.toggleFullScreen.bind(this);

        this.init();
    }

    async init() {
        this.createChatInterface();
        this.setupEventListeners();
        // ✅ FASE III: Cargar el historial de conversaciones desde la API al iniciar.
        await this.loadConversations();

        // Escuchar cambios de sesión para mostrar/ocultar el chat
        window.sessionManager.onStateChange(async (user) => {
            const toggleBtn = document.getElementById('chatbot-toggle');
            if (toggleBtn) {
                // ✅ CAMBIO SOFT BLOCK: Siempre mostrar el botón, incluso desconectado.
                toggleBtn.style.display = 'block';

                if (user) {
                    // Si el usuario inicia sesión, cargar sus conversaciones.
                    await this.loadConversations();
                } else {
                    // Si cierra sesión, cerrar el chat si estaba abierto
                    if (this.isOpen) this.closeChat();
                }
            }
        });
    }

    createChatInterface() {
        const chatHTML = `
            <!-- ✅ FASE III: Nueva estructura del chat con historial -->
            <div id="chatbot-container" class="chatbot-container" role="dialog" aria-modal="true" aria-hidden="true">
                <div class="chatbot-history-panel">
                    <div class="history-header">
                        <button id="new-chat-btn" class="new-chat-btn">
                            <i class="fas fa-plus"></i> Nuevo Chat
                        </button>
                    </div>
                    <div id="conversation-list" class="conversation-list">
                        <!-- La lista de conversaciones se renderizará aquí -->
                    </div>
                </div>
                <div class="chatbot-main-panel">
                    <div class="chatbot-header">
                        <!-- ✅ MEJORA RESPONSIVE: Botón para mostrar/ocultar historial en móvil -->
                        <button id="chatbot-history-toggle" class="chatbot-history-toggle">
                            <i class="fas fa-bars"></i>
                        </button>
                        <div class="chatbot-title">
                            <i class="fas fa-robot chatbot-icon-svg"></i>
                            <h3 id="chatbot-title-heading">Asistente Hub</h3>
                            <span class="chatbot-status">En línea</span>
                        </div>
                        <div class="chatbot-header-actions" style="display:flex; gap:0.5rem; align-items:center;">
                            <!-- Botón Pantalla Completa (Mejorado) -->
                            <button id="chatbot-expand" class="chatbot-expand" aria-label="Pantalla completa" title="Pantalla completa">
                                <i class="fas fa-expand"></i>
                            </button>
                            <button id="chatbot-close" class="chatbot-close" aria-label="Cerrar chat" title="Cerrar">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>

                    <div id="chatbot-messages" class="chatbot-messages">
                        <!-- Mensajes se cargarán aquí -->
                    </div>
                    <!-- ✅ MEJORA RESPONSIVE: Overlay para cerrar el historial en móvil -->
                    <div id="chatbot-history-overlay" class="chatbot-history-overlay"></div>

                    <div class="chatbot-typing" id="chatbot-typing" style="display: none;">
                        <div class="typing-indicator"><span></span><span></span><span></span></div>
                        <span>El asistente está escribiendo...</span>
                    </div>

                    <div class="chatbot-input-container">
                        <div class="chatbot-input">
                            <textarea id="chatbot-input" placeholder="Escribe tu pregunta aquí... (Usa Shift + Enter para salto de línea)" maxlength="5000" rows="1"></textarea>
                            <button id="chatbot-send" class="chatbot-send">
                                <i class="fas fa-paper-plane"></i>
                            </button>
                        </div>
                        <div class="chatbot-suggestions" id="chatbot-suggestions">
                            <!-- Sugerencias se cargarán dinámicamente -->
                        </div>
                    </div>
                </div>
            </div>

            <button id="chatbot-toggle" class="chatbot-toggle" aria-haspopup="true" aria-expanded="false" aria-controls="chatbot-container" aria-label="Abrir chat del Asistente">
                <i class="fas fa-robot"></i>
                <span class="chatbot-notification" id="chatbot-notification" style="display: none;"></span>
            </button>
        `;

        const targetEl = document.querySelector(this.targetSelector);
        if (targetEl) {
            targetEl.insertAdjacentHTML('beforeend', chatHTML);
        } else {
            console.error(`Target selector ${this.targetSelector} no encontrado para inyectar el Chat.`);
        }
        
        this.loadChatStyles();
    }

    loadChatStyles() {
        // Esta función ya no es necesaria, los estilos están en styles.css
        // Se mantiene la función vacía para no romper la llamada en init()
        console.log('🎨 Estilos del chat cargados desde CSS centralizado.');
    }

    addWelcomeMessage() {
        // ✅ CORRECCIÓN: Solo añadir el mensaje de bienvenida si no hay una conversación activa.
        if (this.messages.length === 0) {
            const welcomeText = `**¡Hola! Soy tu asistente tutorial.**
¿En qué te puedo ayudar hoy?`;
            this.addMessage(welcomeText, 'bot', { isWelcome: true });

            // ✅ RESTAURADO: Solo 2 preguntas puntuales que la IA entienda bien.
            const defaultSuggestions = [
                "Explícame de forma resumida todo lo que puedes hacer como mi Tutor Educativo.",
                "¿Qué tipo de normativas, guías y conocimientos médicos dominas?"
            ];
            this.showFollowUpSuggestions(defaultSuggestions);
        }
    }
    setupEventListeners() {
        const toggleBtn = document.getElementById('chatbot-toggle');
        const closeBtn = document.getElementById('chatbot-close');

        console.log('🔄 Configurando event listeners...');
        console.log('Toggle button:', toggleBtn);
        console.log('Close button:', closeBtn);

        // BOTÓN FLOTANTE - Con delegación de eventos más robusta
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                // ✅ NUEVO: Soft block para el chat
                window.uiManager.checkAuthAndExecute(() => {
                    console.log('🎯 Botón toggle clickeado');
                    this.toggleChat();
                });
            });
        }

        // ✅ MEJORA UI/UX MÓVIL: Listener para el botón hardware 'Atrás'
        window.addEventListener('popstate', this.handlePopState);

        // BOTÓN CERRAR
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('🎯 Botón cerrar clickeado');
                this.closeChat();
            });
        }

        // ✅ FASE IV: Botón Expandir
        const expandBtn = document.getElementById('chatbot-expand');
        if (expandBtn) {
            expandBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleFullScreen();
            });
        }

        // ✅ FASE III: Botón de "Nuevo Chat"
        const newChatBtn = document.getElementById('new-chat-btn');
        if (newChatBtn) {
            newChatBtn.addEventListener('click', () => this.startNewConversation());
        }

        // ✅ MEJORA RESPONSIVE: Botón para abrir el historial en móvil
        const historyToggleBtn = document.getElementById('chatbot-history-toggle');
        if (historyToggleBtn) {
            historyToggleBtn.addEventListener('click', () => {
                document.getElementById('chatbot-container').classList.toggle('history-open');
            });
        }

        // ✅ MEJORA RESPONSIVE: Listener para el overlay que cierra el historial.
        const historyOverlay = document.getElementById('chatbot-history-overlay');
        if (historyOverlay) {
            historyOverlay.addEventListener('click', () => {
                document.getElementById('chatbot-container').classList.remove('history-open');
            });
        }
        // ENVÍO DE MENSAJES Y AUTORESIZE TEXTAREA
        const sendBtn = document.getElementById('chatbot-send');
        const input = document.getElementById('chatbot-input');

        if (sendBtn && input) {
            sendBtn.addEventListener('click', () => {
                this.sendMessage();
                // Resetear textarea size
                input.style.height = 'auto';
            });

            // Auto-resize textarea
            input.addEventListener('input', function() {
                this.style.height = 'auto';
                // Calculamos max-height basado en aprox 5 líneas (120px)
                const newHeight = Math.min(this.scrollHeight, 120);
                this.style.height = newHeight + 'px';
                if (this.value === '') this.style.height = 'auto';
            });

            // Shift+Enter soporte
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                    input.style.height = 'auto'; // Resetear
                }
            });
        }

        // SUGERENCIAS RÁPIDAS - Usando delegación de eventos para mayor eficiencia
        const suggestionsContainer = document.getElementById('chatbot-suggestions');
        if (suggestionsContainer) {
            suggestionsContainer.addEventListener('click', (e) => {
                e.preventDefault();
                // Asegurarse de que el click fue en un botón de sugerencia
                if (e.target && e.target.classList.contains('suggestion-btn')) {
                    const question = e.target.dataset.question || e.target.textContent;
                    console.log('🎯 Sugerencia seleccionada:', question);
                    if (input) {
                        input.value = question;
                        this.sendMessage();
                    }
                }
            });

            // ✅ MEJORA UI/UX: Permitir scroll horizontal con la rueda del mouse (Shift opcional)
            suggestionsContainer.addEventListener('wheel', (e) => {
                if (e.deltaY !== 0) {
                    // Si el usuario mueve la rueda verticalmente, lo traducimos a horizontal
                    e.preventDefault();
                    suggestionsContainer.scrollLeft += e.deltaY;
                }
            }, { passive: false });
        }

        // ✅ FASE III: Delegación de eventos para la lista de conversaciones
        const conversationList = document.getElementById('conversation-list');
        if (conversationList) {
            conversationList.addEventListener('click', (e) => {
                const conversationItem = e.target.closest('.conversation-item');
                if (conversationItem) {
                    // ✅ MEJORA: Manejar clic en el botón de editar.
                    if (e.target.closest('.edit-conversation-btn')) {
                        e.stopPropagation(); // Evitar que se cambie de conversación.
                        this.enableTitleEditing(conversationItem);
                        return;
                    }

                    // ✅ MEJORA: Manejar clic en el botón de eliminar.
                    if (e.target.closest('.delete-conversation-btn')) {
                        e.stopPropagation();
                        this.handleDeleteConversation(conversationItem.dataset.id);
                        return;
                    }

                    // En móvil, cerrar el panel de historial después de seleccionar un chat.
                    if (window.innerWidth <= 750) {
                        document.getElementById('chatbot-container').classList.remove('history-open');
                    }
                    this.switchConversation(conversationItem.dataset.id);
                }
            });

            // ✅ NUEVO: Listener para los botones de feedback.
            const messagesContainer = document.getElementById('chatbot-messages');
            messagesContainer.addEventListener('click', (e) => {
                // 1. Manejo de Feedback (Ya existente)
                const feedbackBtn = e.target.closest('.feedback-btn');
                if (feedbackBtn && !feedbackBtn.disabled) {
                    const isHelpful = feedbackBtn.dataset.helpful === 'true';
                    const parentMessage = feedbackBtn.closest('.message');
                    const query = parentMessage.dataset.query;
                    const response = parentMessage.dataset.response;
                    const messageId = parentMessage.dataset.messageId;

                    AnalyticsApiService.recordFeedback(query, response, isHelpful, messageId);

                    const feedbackContainer = feedbackBtn.parentElement;
                    feedbackContainer.innerHTML = '<span class="feedback-thanks">¡Gracias por tu feedback!</span>';
                    return;
                }

                // 2. ✅ INTERCEPTOR DE CLICS DE SEGURIDAD (Freemium Bypass Fix)
                const link = e.target.closest('a');
                if (link && messagesContainer.contains(link)) {
                    // Si el link es interno (botón simulado) o algo del sistema, ignorar o manejar diferente.
                    // Pero aquí nos preocupan los recursos externos (href http...).

                    if (window.sessionManager && window.sessionManager.getUser()) {
                        const user = window.sessionManager.getUser();
                        // Validar campos camelCase o snake_case
                        const status = user.subscriptionStatus || user.subscription_status;
                        const usage = user.usageCount !== undefined ? user.usageCount : (user.usage_count || 0);
                        const limit = user.maxFreeLimit !== undefined ? user.maxFreeLimit : (user.max_free_limit || 50);

                        // Lógica de Bloqueo
                        if (status === 'pending' && usage >= limit) {
                            e.preventDefault();
                            e.stopPropagation();
                            console.warn('⛔ Acceso a recurso bloqueado por límite Freemium en Chat.');
                            window.uiManager.showPaywallModal();
                            return;
                        }

                        // ✅ OPCIONAL: Tracking de consumo si es un recurso.
                        // Si el link tiene estructura de recurso conocido, podríamos llamar a verify.
                        // Por ahora, permitimos el paso si tiene vidas.
                        console.log('✅ Acceso permitido a recurso desde Chat.');
                    }
                }
            });
        }
    }

    // ✅ NUEVO: Lógica para manejar el botón físico "Atrás" en móviles
    handlePopState(e) {
        // Obtenemos el estado. Si NO existe el estado chatbotOpen pero ESTÁ abierto internamente, lo cerramos
        if (this.isOpen && (!e.state || !e.state.chatbotOpen)) {
            console.log('🔙 Botón hardware "Atrás" detectado. Cerrando chat para prevenir salida...');

            // Llamamos al cierre pero le decimos explícitamente que NO toque la API history
            // ya que el navegador y el `popstate` acaban de retroceder por sí solos.
            this.forceCloseChatFromBack();
        }
    }

    toggleChat() {
        this.isOpen = !this.isOpen;
        const container = document.getElementById('chatbot-container');
        const toggleBtn = document.getElementById('chatbot-toggle');

        container.classList.toggle('open', this.isOpen);
        // Actualizar atributos ARIA para accesibilidad
        container.setAttribute('aria-hidden', !this.isOpen);
        toggleBtn.setAttribute('aria-expanded', this.isOpen);

        if (this.isOpen) {
            // ✅ Fix OVERSCROLL: Si el usuario usa móvil, bloquear scroll de body siempre por precaución
            if (window.innerWidth <= 750 || this.isFullScreen) {
                document.body.style.overflow = 'hidden';
            }

            // ✅ UX: Modificamos el historial al ABRIR para crear un "checkpoint" falso
            // que nos permita atrapar el botón de "Atrás"
            if (window.history && window.history.pushState) {
                window.history.pushState({ chatbotOpen: true }, '', '');
            }

            // ✅ CORRECCIÓN: Ocultar el botón flotante solo en vista móvil.
            if (window.innerWidth <= 750) {
                toggleBtn.style.display = 'none';
            }
            document.getElementById('chatbot-input').focus();
            this.hideNotification();
            toggleBtn.setAttribute('aria-label', 'Cerrar chat del Asistente');
        } else {
            // ✅ CORRECCIÓN: Devolver el foco al botón principal ANTES de hacer otros cambios.
            // Esto evita el error de accesibilidad al cerrar el chat.
            toggleBtn.focus();
            toggleBtn.style.display = 'block';
            toggleBtn.setAttribute('aria-label', 'Abrir chat del Asistente');
        }
    }

    closeChat() {
        if (!this.isOpen) return;

        // ✅ LÓGICA DE HISTORIAL: Cierre manual
        // El usuario hizo click visualmente en la "X" o el toggle, no usó el botón back del celular.
        // Si hay estado historial de chat, lo intentamos purgar retrocediendo el navegador
        // Ojo que al retroceder el navegador se disparará `handlePopState`, 
        // pero como ya entraremos al flujo normal no es un problema.
        const state = window.history.state;
        if (state && state.chatbotOpen) {
            window.history.back(); // Esto eventualmente dispara popstate y limpia
        } else {
            // Si por algún motivo no estaba en history, lo cerramos manual directo.
            this.forceCloseChatFromBack();
        }
    }

    // Función helper para cerrar visualmente sin alterar history (usado cuando history ya disparó popstate)
    forceCloseChatFromBack() {
        if (!this.isOpen) return;

        // 1. Mostrar el botón de nuevo (si estamos en móvil se ocultó)
        // ✅ DEBE hacerse ANTES de enfocar para que el focus funcione
        const toggleBtn = document.getElementById('chatbot-toggle');
        if (toggleBtn) {
            toggleBtn.style.display = 'block';
            toggleBtn.focus();
            toggleBtn.setAttribute('aria-expanded', 'false');
            toggleBtn.setAttribute('aria-label', 'Abrir chat del Asistente');
        }

        // 2. Ocultar el contenedor del chat.
        this.isOpen = false;
        const container = document.getElementById('chatbot-container');
        container.classList.remove('open');
        container.setAttribute('aria-hidden', 'true');
        
        // Liberar el scroll del body
        document.body.style.overflow = '';
    }

    toggleFullScreen() {
        this.isFullScreen = !this.isFullScreen;
        const container = document.getElementById('chatbot-container');
        const expandBtn = document.getElementById('chatbot-expand');
        const icon = expandBtn.querySelector('i');

        if (this.isFullScreen) {
            container.classList.add('chat-fullscreen');
            icon.classList.remove('fa-expand');
            icon.classList.add('fa-compress');
            // Bloquear scroll trasero agresivamente en PC y móvil
            document.body.style.overflow = 'hidden';
            expandBtn.setAttribute('aria-label', 'Salir de pantalla completa');
            expandBtn.setAttribute('title', 'Restaurar ventana');
        } else {
            container.classList.remove('chat-fullscreen');
            icon.classList.remove('fa-compress');
            icon.classList.add('fa-expand');
            // Restaurar scroll si es PC y no está en modo normal
            if (window.innerWidth > 750) {
                document.body.style.overflow = '';
            }
            expandBtn.setAttribute('aria-label', 'Pantalla completa');
            expandBtn.setAttribute('title', 'Pantalla completa');
            
            // Reparar UI si hay overflow en base a resize
            const input = document.getElementById('chatbot-input');
            if (input) input.style.height = 'auto';
        }
    }

    async sendMessage() {
        const input = document.getElementById('chatbot-input');
        const message = input.value.trim();

        if (!message) return;

        console.log('💬 Enviando mensaje:', message);

        if (this.isSending) {
            console.log('⚠️ Mensaje ya en proceso, ignorando...');
            return;
        }

        this.isSending = true;
        input.disabled = true;
        document.getElementById('chatbot-send').disabled = true;

        // ✅ TIMEOUT de seguridad (60 segundos). Aumentado para permitir operaciones complejas del LLM (múltiples tool calls).
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout: El servidor tardó demasiado en responder')), 60000);
        });

        try {
            // Agregar mensaje del usuario
            this.addMessage(message, 'user');
            input.value = '';

            // Mostrar indicador de typing
            this.showTypingIndicator();

            console.log('📡 Enviando solicitud al servidor...');

            // ✅ FASE III: El historial ya no se envía, solo el ID de la conversación activa.
            const requestData = {
                message: message,
                conversationId: this.activeConversationId
            };

            console.log('📦 Datos enviados:', requestData);

            const fetchPromise = fetch(`${window.AppConfig.API_URL}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify(requestData)
            });

            const response = await Promise.race([fetchPromise, timeoutPromise]);

            console.log('📡 Respuesta HTTP recibida:', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok
            });

            let data;

            // ✅ MEJORA: Leer el cuerpo UNA sola vez para evitar "Body stream already read"
            // Intentamos parsear JSON, si falla usamos texto, pero guardamos el resultado.
            const responseClone = response.clone(); // Clonamos por seguridad si necesitamos leer texto plano después
            try {
                data = await response.json();
            } catch (e) {
                data = null; // No es JSON
            }

            if (!response.ok) {
                // Si el error es de autenticación, forzar logout
                if (response.status === 401) {
                    this.addMessage('Tu sesión ha expirado. Por favor, inicia sesión de nuevo.', 'bot');
                    window.sessionManager.logout();
                    return;
                }

                // ✅ NUEVO: Manejo de Soft Block (Límite alcanzado)
                if (response.status === 403) {
                    // Verificamos si es un error de Paywall (Limit Reached para Nativos/Trials)
                    if (data && data.paywall) {
                        this.hideTypingIndicator();
                        window.uiManager.showPaywallModal();
                        this.addMessage('🔒 Límite de prueba alcanzado. Actualiza tu plan para continuar.', 'bot');
                        return;
                    }

                    // ✅ EXCEPCIÓN ELEGANTE PARA LÍMITES DIARIOS (Basic/Advanced)
                    // Si el backend mandó un mensaje de error limpio por agotamiento, lo lanzamos
                    // con un identificador especial para que el catch no le ponga "Error HTTP".
                    if (data && data.error) {
                        const limitError = new Error(data.error);
                        limitError.isLimitReached = true;
                        throw limitError;
                    }
                }

                let errorDetails = `Error HTTP: ${response.status} ${response.statusText}`;
                if (data && data.error) {
                    errorDetails += ` - ${data.error}`;
                } else {
                    // Si no pudimos leer JSON, leemos texto del clon
                    const textError = await responseClone.text();
                    errorDetails += ` - ${textError}`;
                }
                throw new Error(errorDetails);
            }

            this.hideTypingIndicator();

            console.log('✅ Respuesta recibida del servidor:', data);

            // ✅ FASE III: Actualizar el ID de la conversación si era una nueva.
            const wasNewConversation = !this.activeConversationId;
            this.activeConversationId = data.conversationId;

            this.addMessage(data.respuesta, 'bot', { ...data, messageId: data.messageId });

            // ✅ CRÍTICO: Actualizar sesión para reflejar el consumo de vidas (usageCount)
            // Envolvemos en try/catch independiente para que un fallo aquí NO muestre error de chat
            if (window.sessionManager) {
                try {
                    // Forzamos actualización silenciosa del usuario
                    await window.sessionManager.refreshUser();

                    // Si existe un componente de header que muestre las vidas, intentar actualizarlo
                    const headerEvent = new CustomEvent('session-updated', { detail: window.sessionManager.getUser() });
                    window.dispatchEvent(headerEvent);
                } catch (sessionError) {
                    console.warn('⚠️ No se pudo refrescar la sesión post-chat (No crítico):', sessionError);
                }
            }

            if (data.sugerencias && data.sugerencias.length > 0) {
                this.showFollowUpSuggestions(data.sugerencias);
            }

            // Si era una conversación nueva, recargar la lista para que aparezca.
            if (wasNewConversation) {
                await this.loadConversations();
            }

        } catch (error) {
            console.error('❌ Error en sendMessage:', error);
            this.hideTypingIndicator();

            // ✅ MENSAJE DE ERROR ESPECÍFICO
            if (error.isLimitReached) {
                // Mensaje limpio y elegante del Tutor
                this.addMessage(`⚠️ ${error.message}`, 'bot');
            } else {
                let errorMessage = '❌ ';

                if (error.message.includes('Timeout')) {
                    errorMessage += 'El servidor tardó demasiado en responder. ';
                } else if (error.message.includes('400')) {
                    errorMessage += 'Error en la solicitud al servidor. ';
                } else if (error.message.includes('HTTP')) {
                    errorMessage += `Error del servidor: ${error.message}. `;
                } else {
                    errorMessage += 'Error de conexión. ';
                }

                errorMessage += 'Por favor, intenta nuevamente.';
                this.addMessage(errorMessage, 'bot');
            }
        } finally {
            // ✅ RESTABLECER ESTADO
            this.isSending = false;
            input.disabled = false;
            document.getElementById('chatbot-send').disabled = false;
            input.focus();

            console.log('🔄 Estado restablecido, listo para nueva consulta');
        }
    }

    // MÉTODO AÑADIDO: Para abrir el chat y hacer una pregunta desde otros componentes
    openAndAsk(question) {
        if (!this.isOpen) {
            this.toggleChat();
        }
        const input = document.getElementById('chatbot-input');
        if (input) {
            input.value = question;
            // Pequeño delay para asegurar que la UI está lista antes de enviar
            setTimeout(() => this.sendMessage(), 300);
        }
    }

    addMessage(text, sender, metadata = {}) {
        const messagesContainer = document.getElementById('chatbot-messages');

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender} ${metadata.isWelcome ? 'welcome-message' : ''}`;

        let currentMessageId = null;

        // ✅ SOLUCIÓN: unificar la asignación del ID.
        // Los mensajes del historial vienen con `id`, los nuevos con `messageId`.
        if (sender === 'bot' && !metadata.isWelcome) {
            currentMessageId = metadata.id || metadata.messageId;
            if (currentMessageId) {
                messageDiv.dataset.messageId = currentMessageId;
            } else {
                // Fallback para mensajes de error locales que no tienen ID de la BD.
                const conversationIdentifier = this.activeConversationId || 'temp';
                this.messageIdCounter++;
                currentMessageId = `${conversationIdentifier}_${this.messageIdCounter}`;
                messageDiv.dataset.messageId = currentMessageId;
            }
        }

        // ✅ NUEVO: Guardar la consulta y la respuesta en el elemento para el feedback.
        if (sender === 'bot' && !metadata.isWelcome) {
            messageDiv.dataset.query = this.messages.find(m => m.sender === 'user')?.content || 'N/A';
            messageDiv.dataset.response = text;
        }
        let messageHTML = this.formatMessage(text);

        // Agregar información de metadata para mensajes del bot
        // Intención/Confianza removed from UI as per user request.
        /*
        if (sender === 'bot' && metadata.intencion) {
            const confidencePercent = (metadata.confianza * 100).toFixed(1);
            messageHTML += `<div class="message-info">Intención: ${metadata.intencion} • Confianza: ${confidencePercent}%</div>`;
        }
        */

        // ✅ AÑADIR BOTÓN DE REDIRECCIÓN SI EXISTE LA URL
        if (sender === 'bot' && metadata.redirectUrl) {
            messageHTML += `
                <div class="redirect-container" style="margin-top: 10px;">
                    <a href="${metadata.redirectUrl}" target="_blank" class="redirect-btn">Ver más detalles</a>
                </div>
            `;
        }

        // ✅ NUEVO: Añadir botones de feedback a los mensajes del bot (excepto el de bienvenida).
        // ✅ SOLUCIÓN DEFINITIVA: La decisión ahora se basa en la propiedad `feedbackGiven`
        // que debería venir del servidor en el objeto `metadata`.
        if (sender === 'bot' && !metadata.isWelcome && currentMessageId) {
            // ✅ SOLUCIÓN: La decisión ahora se basa en la propiedad `is_helpful` que viene del servidor.
            // Esta puede ser true, false, o null.
            if (metadata.is_helpful !== null && metadata.is_helpful !== undefined) { // Si el feedback ya fue dado (no es null/undefined)
                messageHTML += `<div class="feedback-container"><span class="feedback-thanks">¡Gracias por tu feedback!</span></div>`;
            } else {
                messageHTML += `
                    <div class="feedback-container" data-message-id="${currentMessageId}">
                        <button class="feedback-btn" data-helpful="true" title="Respuesta útil">👍</button>
                        <button class="feedback-btn" data-helpful="false" title="Respuesta no útil">👎</button>
                    </div>`;
            }
        }

        messageDiv.innerHTML = messageHTML;
        messagesContainer.appendChild(messageDiv);

        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // ✅ FASE III: Añadir al historial local de mensajes.
        if (!metadata.isWelcome) {
            const messageObject = { sender, content: text, ...metadata };
            if (currentMessageId) {
                messageObject.messageId = currentMessageId;
            }
            this.messages.push(messageObject);
        }
    }

    formatMessage(text) {
        // Expresión regular para detectar URLs (absolutas y relativas que empiezan con /)
        const urlRegex = /(https?:\/\/[^\s]+)|(\B\/[^\s]+)/g;
        // ✅ SOLUCIÓN: La regex ahora captura el formato `* [type:ID] Texto` y `[type:ID] Texto`.
        // Soporta: [career:1], [course:2], [topic:3]
        const navRegex = /\*?\s*\[(career|course|topic):(\d+)\]\s*([^\n<]+)/g;

        return text
            // ✅ MEJORA: Convertir URLs en enlaces clickeables (Soporta absolutas y relativas).
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${linkText}</a>`)
            // ✅ NUEVO: Convertir enlaces de navegación internos en botones.
            .replace(navRegex, (match, type, id, text) => {
                const numericId = parseInt(id, 10);
                const trimmedText = text.trim();
                let functionCall = '';

                if (type === 'career') {
                    // ✅ FIX: Redirigir a la página real de carrera (MPA) para asegurar el diseño correcto.
                    functionCall = `window.location.href = 'career?id=${numericId}'`;
                } else if (type === 'course') {
                    // ✅ FIX: Redirigir a la página real de curso (MPA).
                    functionCall = `window.location.href = 'course?id=${numericId}'`;
                } else if (type === 'topic') {
                    // ✅ FIX: Como no hay página de tema, redirigimos a la búsqueda con el nombre del tema (o placeholder).
                    // Pero si el ID es válido, intentamos ir a búsqueda filtrada por tema si existiera, o search.
                    // Mejor: redirigir a search.html con query.
                    // Para simplificar, asumiremos que si hay ID, el usuario quiere ver "algo".
                    // Dado que el usuario dijo que "ya no tenemos paginas para temas", lo mejor es no navegar a una 404.
                    // Redirigiremos al HOME con una búsqueda pre-llenada o simplemente search.html
                    functionCall = `window.location.href = '/?q=tema:${numericId}'`;
                }

                return `<button class="chat-nav-button" onclick="${functionCall}">${trimmedText}</button>`;
            })
            .replace(/^- (.*)$/gm, '<li>$1</li>') // Listas
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');
    }

    showTypingIndicator() {
        const typingIndicator = document.getElementById('chatbot-typing');
        typingIndicator.style.display = 'flex';

        const messagesContainer = document.getElementById('chatbot-messages');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    hideTypingIndicator() {
        const typingIndicator = document.getElementById('chatbot-typing');
        typingIndicator.style.display = 'none';
    }

    showFollowUpSuggestions(suggestions) {
        const suggestionsContainer = document.getElementById('chatbot-suggestions');
        suggestionsContainer.innerHTML = '';

        suggestions.forEach(suggestion => {
            const button = document.createElement('button');
            button.className = 'suggestion-btn';
            button.textContent = suggestion;
            // ✅ ELIMINADO: Se quita el eventListener directo porque causaba conflicto 
            // con el listener delegado de 'suggestionsContainer' en setupEventListeners,
            // dejando el texto atorado en el input.
            suggestionsContainer.appendChild(button);
        });
    }

    showNotification() {
        const notification = document.getElementById('chatbot-notification');
        notification.style.display = 'flex';
    }

    hideNotification() {
        const notification = document.getElementById('chatbot-notification');
        notification.style.display = 'none';
    }

    // --- ✅ FASE III: NUEVOS MÉTODOS PARA GESTIONAR EL HISTORIAL ---

    async loadConversations() {
        if (!window.sessionManager.isLoggedIn()) return;

        try {
            const response = await fetch(`${window.AppConfig.API_URL}/api/chat/conversations`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
            });
            if (!response.ok) throw new Error('No se pudo cargar el historial.');

            this.conversations = await response.json();
            this.renderConversationList();

            // Si no hay una conversación activa, iniciar una nueva o seleccionar la más reciente.
            if (!this.activeConversationId && this.conversations.length > 0) {
                this.switchConversation(this.conversations[0].id);
            } else if (!this.activeConversationId) {
                this.startNewConversation();
            }

        } catch (error) {
            console.error("Error cargando conversaciones:", error);
        }
    }

    renderConversationList() {
        const listContainer = document.getElementById('conversation-list');
        if (!listContainer) return;

        if (this.conversations.length === 0) {
            listContainer.innerHTML = '<p class="no-history">No hay chats guardados.</p>';
            return;
        }

        listContainer.innerHTML = this.conversations.map(conv => `
            <div class="conversation-item ${conv.id == this.activeConversationId ? 'active' : ''}" data-id="${conv.id}">
                <i class="fas fa-comment-dots"></i>
                <span class="conversation-title">${this.escapeHTML(conv.title)}</span>
                <div class="conversation-actions">
                    <button class="edit-conversation-btn" aria-label="Editar título"><i class="fas fa-pen"></i></button>
                    <button class="delete-conversation-btn" aria-label="Eliminar chat"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `).join('');
    }

    enableTitleEditing(conversationItem) {
        const conversationId = conversationItem.dataset.id;
        const titleSpan = conversationItem.querySelector('.conversation-title');
        const currentTitle = titleSpan.textContent;

        // Reemplazar el span con un input
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentTitle;
        input.className = 'conversation-title-input';

        titleSpan.replaceWith(input);
        input.focus();
        input.select();

        const saveChanges = async () => {
            const newTitle = input.value.trim();
            // Revertir a un span, incluso si no hay cambios.
            const newTitleSpan = document.createElement('span');
            newTitleSpan.className = 'conversation-title';

            if (newTitle && newTitle !== currentTitle) {
                newTitleSpan.textContent = newTitle; // Vista optimista
                input.replaceWith(newTitleSpan);
                await this.updateConversationTitle(conversationId, newTitle);
            } else {
                // Si no hay cambios o el título está vacío, restaurar el original.
                newTitleSpan.textContent = currentTitle;
                input.replaceWith(newTitleSpan);
            }
        };

        input.addEventListener('blur', saveChanges);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                input.blur(); // Dispara el evento blur para guardar.
            }
        });
    }

    async updateConversationTitle(conversationId, newTitle) {
        try {
            const response = await fetch(`${window.AppConfig.API_URL}/api/chat/conversations/${conversationId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({ title: newTitle })
            });

            if (!response.ok) throw new Error('No se pudo actualizar el título.');

            // Actualizar el estado local
            const convIndex = this.conversations.findIndex(c => c.id == conversationId);
            if (convIndex !== -1) {
                this.conversations[convIndex].title = newTitle;
            }
            // No es necesario re-renderizar toda la lista, ya que lo hicimos de forma optimista.
        } catch (error) {
            console.error("Error actualizando título:", error);
            // Opcional: Revertir el cambio en la UI si falla la API.
            this.renderConversationList(); // Re-renderizar para mostrar el título antiguo.
        }
    }

    async handleDeleteConversation(conversationId) {
        // Fallback robusto nativo si confirmationModal no está disponible
        let isConfirmed = false;
        if (window.confirmationModal && typeof window.confirmationModal.show === 'function') {
            isConfirmed = await window.confirmationModal.show('¿Estás seguro de que quieres eliminar este chat? Esta acción no se puede deshacer.', 'Eliminar Chat', 'Eliminar', 'Cancelar');
        } else {
            isConfirmed = confirm('¿Estás seguro de que quieres eliminar este chat?');
        }

        if (!isConfirmed) return;

        try {
            const response = await fetch(`${window.AppConfig.API_URL}/api/chat/conversations/${conversationId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
            });

            if (!response.ok) throw new Error('No se pudo eliminar la conversación.');

            // Eliminar la conversación del estado local
            this.conversations = this.conversations.filter(c => c.id != conversationId);

            // Si la conversación eliminada era la activa, iniciar una nueva.
            if (this.activeConversationId == conversationId) {
                this.startNewConversation();
            } else {
                // Si no, simplemente re-renderizar la lista.
                this.renderConversationList();
            }

        } catch (error) {
            console.error("Error eliminando conversación:", error);
            alert('Hubo un error al intentar eliminar el chat.');
        }
    }

    escapeHTML(str) {
        return str.replace(/[&<>"']/g, (match) => {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[match];
        });
    }

    async switchConversation(conversationId) {
        if (this.activeConversationId == conversationId) return;

        this.activeConversationId = conversationId;
        this.messageIdCounter = 0; // Reset counter for new conversation
        const messagesContainer = document.getElementById('chatbot-messages');
        messagesContainer.innerHTML = '<div class="loading-state">Cargando chat...</div>';

        try {
            const response = await fetch(`${window.AppConfig.API_URL}/api/chat/conversations/${conversationId}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
            });
            if (!response.ok) throw new Error('No se pudo cargar la conversación.');

            this.messages = await response.json();
            messagesContainer.innerHTML = '';
            this.messages.forEach(msg => this.addMessage(msg.content, msg.sender, msg));
            this.renderConversationList(); // Re-renderizar para marcar la activa

        } catch (error) {
            console.error("Error cambiando de conversación:", error);
            messagesContainer.innerHTML = '<p class="error-state">Error al cargar el chat.</p>';
        }
    }

    startNewConversation() {
        this.activeConversationId = null;
        this.messages = [];
        this.messageIdCounter = 0; // Reset counter for new conversation
        const messagesContainer = document.getElementById('chatbot-messages');
        messagesContainer.innerHTML = '';
        this.addWelcomeMessage();
        this.renderConversationList(); // Re-renderizar para desmarcar la activa
        document.getElementById('chatbot-input').focus();
    }
}

// ✅ ELIMINADO: La inicialización ahora se centraliza en app.js para evitar duplicados y conflictos.