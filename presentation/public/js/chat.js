class ChatComponent {
    constructor() {
        this.isOpen = false;
        this.isSending = false;
        // ✅ FASE III: El ID de la conversación activa ahora se gestiona dinámicamente.
        this.activeConversationId = null;
        // ✅ FASE III: El historial de mensajes se carga desde la API, no de localStorage.
        this.messages = [];
        this.conversations = [];
        // ✅ NUEVO: Contador para generar IDs únicos de mensajes del bot para el feedback.
        this.messageIdCounter = 0;
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
                            <h3 id="chatbot-title-heading">Tutor IA</h3>
                            <span class="chatbot-status">En línea</span>
                        </div>
                        <button id="chatbot-close" class="chatbot-close"><i class="fas fa-times"></i></button>
                    </div>

                    <div id="chatbot-messages" class="chatbot-messages">
                        <!-- Mensajes se cargarán aquí -->
                    </div>
                    <!-- ✅ MEJORA RESPONSIVE: Overlay para cerrar el historial en móvil -->
                    <div id="chatbot-history-overlay" class="chatbot-history-overlay"></div>

                    <div class="chatbot-typing" id="chatbot-typing" style="display: none;">
                        <div class="typing-indicator"><span></span><span></span><span></span></div>
                        <span>El tutor está escribiendo...</span>
                    </div>

                    <div class="chatbot-input-container">
                        <div class="chatbot-input">
                            <input type="text" id="chatbot-input" placeholder="Escribe tu pregunta aquí..." maxlength="500">
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

            <button id="chatbot-toggle" class="chatbot-toggle" aria-haspopup="true" aria-expanded="false" aria-controls="chatbot-container" aria-label="Abrir chat del Tutor IA">
                <i class="fas fa-robot"></i>
                <span class="chatbot-notification" id="chatbot-notification" style="display: none;"></span>
            </button>
        `;

        document.body.insertAdjacentHTML('beforeend', chatHTML);
        this.loadChatStyles();
    }

    loadChatStyles() {
        // Esta función ya no es necesaria, los estilos están en styles.css
        // Se mantiene la función vacía para no romper la llamada en init()
        console.log('🎨 Estilos del chat cargados desde CSS centralizado.');
    }

    addWelcomeMessage() {
        // ✅ CORRECCIÓN: Solo añadir el mensaje de bienvenida si no hay una conversación activa.
        // Se usa `this.messages.length` en lugar del antiguo `this.conversationHistory.length`.
        // Esto evita que el mensaje aparezca al cambiar entre chats existentes.
        if (this.messages.length === 0) {
            const welcomeText = `**¡Hola! Soy tu tutor IA 🤖**
Puedo ayudarte con:
*   🎓 Orientación sobre Carreras y Cursos
*   📚 Búsqueda de Libros y Recursos
*   💡 Explicación de conceptos teóricos
¿En qué puedo ayudarte hoy?`;
            this.addMessage(welcomeText, 'bot', { isWelcome: true });
        }
    }
    setupEventListeners() {
        const toggleBtn = document.getElementById('chatbot-toggle');
        const closeBtn = document.getElementById('chatbot-close');

        console.log('🔄 Configurando event listeners...');
        console.log('Toggle button:', toggleBtn);
        console.log('Close button:', closeBtn);

        // BOTÓN FLOTANTE - Con delegación de eventos más robusta
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

        // BOTÓN CERRAR
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('🎯 Botón cerrar clickeado');
                this.closeChat();
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
        // ENVÍO DE MENSAJES
        const sendBtn = document.getElementById('chatbot-send');
        const input = document.getElementById('chatbot-input');

        if (sendBtn && input) {
            sendBtn.addEventListener('click', () => this.sendMessage());

            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.sendMessage();
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
                const feedbackBtn = e.target.closest('.feedback-btn');
                if (feedbackBtn && !feedbackBtn.disabled) {
                    const isHelpful = feedbackBtn.dataset.helpful === 'true';
                    const parentMessage = feedbackBtn.closest('.message');
                    const query = parentMessage.dataset.query;
                    const response = parentMessage.dataset.response;
                    const messageId = parentMessage.dataset.messageId; // Get the messageId

                    // 1. ✅ MEJORA: Enviar el messageId a la API.
                    AnalyticsApiService.recordFeedback(query, response, isHelpful, messageId);

                    // 2. ✅ SOLUCIÓN: Ya no guardamos en localStorage.
                    // La persistencia real la manejará el backend. La UI se actualizará
                    // al recibir la confirmación o al recargar la conversación.

                    // Deshabilitar botones y mostrar agradecimiento
                    const feedbackContainer = feedbackBtn.parentElement;
                    feedbackContainer.innerHTML = '<span class="feedback-thanks">¡Gracias por tu feedback!</span>';
                }
            });
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
            // ✅ CORRECCIÓN: Ocultar el botón flotante solo en vista móvil.
            if (window.innerWidth <= 750) {
                toggleBtn.style.display = 'none';
            }
            document.getElementById('chatbot-input').focus();
            this.hideNotification();
            toggleBtn.setAttribute('aria-label', 'Cerrar chat del Tutor IA');
        } else {
            // ✅ CORRECCIÓN: Devolver el foco al botón principal ANTES de hacer otros cambios.
            // Esto evita el error de accesibilidad al cerrar el chat.
            toggleBtn.focus();
            toggleBtn.style.display = 'block';
            toggleBtn.setAttribute('aria-label', 'Abrir chat del Tutor IA');
        }
    }

    closeChat() {
        if (!this.isOpen) return;

        // ✅ SOLUCIÓN DEFINITIVA DE ACCESIBILIDAD:
        // 1. Mover el foco explícitamente al botón de abrir. Esto es lo más importante.
        const toggleBtn = document.getElementById('chatbot-toggle');
        if (toggleBtn) toggleBtn.focus();

        // 2. Ocultar el contenedor del chat.
        this.isOpen = false;
        const container = document.getElementById('chatbot-container');
        container.classList.remove('open');
        container.setAttribute('aria-hidden', 'true');

        // 3. Asegurarse de que el botón de abrir esté visible y con el ARIA correcto.
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.setAttribute('aria-label', 'Abrir chat del Tutor IA');
        toggleBtn.style.display = 'block';
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

            if (!response.ok) {
                // Si el error es de autenticación, forzar logout
                if (response.status === 401) {
                    this.addMessage('Tu sesión ha expirado. Por favor, inicia sesión de nuevo.', 'bot');
                    window.sessionManager.logout();
                    return;
                }

                // ✅ NUEVO: Manejo de Soft Block (Límite alcanzado)
                if (response.status === 403) {
                    const errorData = await response.json().catch(() => ({}));
                    if (errorData.paywall) {
                        this.hideTypingIndicator();
                        window.uiManager.showPaywallModal();
                        this.addMessage('🔒 Límite de prueba alcanzado. Actualiza tu plan para continuar.', 'bot');
                        return; // El finally desbloqueará el input, pero el usuario no podrá enviar con éxito.
                    }
                }

                let errorDetails = `Error HTTP: ${response.status} ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    errorDetails += ` - ${JSON.stringify(errorData)}`;
                } catch (e) {
                    const textError = await response.text();
                    errorDetails += ` - ${textError}`;
                }
                throw new Error(errorDetails);
            }

            const data = await response.json();
            this.hideTypingIndicator();

            console.log('✅ Respuesta recibida del servidor:', data);

            // ✅ FASE III: Actualizar el ID de la conversación si era una nueva.
            const wasNewConversation = !this.activeConversationId;
            this.activeConversationId = data.conversationId;

            this.addMessage(data.respuesta, 'bot', { ...data, messageId: data.messageId });

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
            // ✅ MEJORA: Convertir URLs en enlaces clickeables.
            .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (match, linkText, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${linkText}</a>`)
            // ✅ NUEVO: Convertir enlaces de navegación internos en botones.
            .replace(navRegex, (match, type, id, text) => {
                const numericId = parseInt(id, 10);
                const trimmedText = text.trim();
                let functionCall = '';

                if (type === 'career') {
                    // ✅ FIX: Redirigir a la página real de carrera (MPA) para asegurar el diseño correcto.
                    functionCall = `window.location.href = 'career.html?id=${numericId}'`;
                } else if (type === 'course') {
                    // ✅ FIX: Redirigir a la página real de curso (MPA).
                    functionCall = `window.location.href = 'course.html?id=${numericId}'`;
                } else if (type === 'topic') {
                    // ✅ FIX: Como no hay página de tema, redirigimos a la búsqueda con el nombre del tema (o placeholder).
                    // Pero si el ID es válido, intentamos ir a búsqueda filtrada por tema si existiera, o search.
                    // Mejor: redirigir a search.html con query.
                    // Para simplificar, asumiremos que si hay ID, el usuario quiere ver "algo".
                    // Dado que el usuario dijo que "ya no tenemos paginas para temas", lo mejor es no navegar a una 404.
                    // Redirigiremos al HOME con una búsqueda pre-llenada o simplemente search.html
                    functionCall = `window.location.href = 'index.html?q=tema:${numericId}'`;
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
            button.addEventListener('click', () => {
                document.getElementById('chatbot-input').value = suggestion;
                this.sendMessage();
            });
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
        if (!await window.confirmationModal.show('¿Estás seguro de que quieres eliminar este chat? Esta acción no se puede deshacer.', 'Eliminar Chat', 'Eliminar', 'Cancelar')) {
            return;
        }

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