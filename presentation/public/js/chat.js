class ChatComponent {
    constructor() {
    this.isOpen = false;
    this.isSending = false;
    this.currentConversationId = `conv-${Date.now()}`; // Generar un ID de conversación al inicio
    this.conversationHistory = []; // Almacenar historial de mensajes
    this.init();
}

init() {
    this.createChatInterface();
    this.setupEventListeners();
    this.loadChatHistory();
    this.addWelcomeMessage(); // Añadir mensaje de bienvenida después de cargar el historial
    
    // Escuchar cambios de sesión para mostrar/ocultar el chat
    window.sessionManager.onStateChange((user) => {
        const toggleBtn = document.getElementById('chatbot-toggle');
        // ✅ CORRECCIÓN: Asegurarse de que el botón exista antes de manipularlo
        if (toggleBtn) {
            if (user) {
            toggleBtn.style.display = 'block';
            } else {
                toggleBtn.style.display = 'none';
                if (this.isOpen) this.closeChat();
            }
        }
    });
    }

    createChatInterface() {
        const chatHTML = `
            <div id="chatbot-container" class="chatbot-container" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="chatbot-title-heading">
                <div class="chatbot-header">
                    <div class="chatbot-title">
                        <span class="chatbot-icon">🤖</span>
                        <h3 id="chatbot-title-heading">Tutor IA UC</h3>
                        <span class="chatbot-status">En línea</span>
                    </div>
                    <button id="chatbot-close" class="chatbot-close">×</button>
                </div>

                <div id="chatbot-messages" class="chatbot-messages">
                    <!-- Mensajes se cargarán aquí -->
                </div>

                <div class="chatbot-typing" id="chatbot-typing" style="display: none;">
                    <div class="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                    <span>El tutor está escribiendo...</span>
                </div>

                <div class="chatbot-input-container">
                    <div class="chatbot-input">
                        <input type="text" id="chatbot-input" placeholder="Escribe tu pregunta aquí..." maxlength="500">
                        <button id="chatbot-send" class="chatbot-send">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                            </svg>
                        </button>
                    </div>
                    <div class="chatbot-suggestions" id="chatbot-suggestions">
                        <button class="suggestion-btn" data-question="¿Dónde encuentro material de programación?">📚 Material programación</button>
                        <button class="suggestion-btn" data-question="¿A qué hora es la clase de matemáticas?">🕐 Horario matemáticas</button>
                        <button class="suggestion-btn" data-question="¿Qué es la inteligencia artificial?">💡 Explicar IA</button>
                    </div>
                </div>
            </div>

            <button id="chatbot-toggle" class="chatbot-toggle" aria-haspopup="true" aria-expanded="false" aria-controls="chatbot-container" aria-label="Abrir chat del Tutor IA">
                <span class="chatbot-toggle-icon">🤖</span>
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
        // Solo añadir el mensaje de bienvenida si el historial está vacío
        if (this.conversationHistory.length === 0) {
            const welcomeText = `**¡Hola! Soy tu tutor IA 🤖**
Puedo ayudarte con:
*   📚 Encontrar materiales de cursos
*   🕐 Consultar horarios y fechas
*   💡 Explicar conceptos teóricos
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
    if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('🎯 Botón toggle clickeado');
            this.toggleChat();
        });
    } else {
        console.error('❌ No se encontró el botón toggle');
    }

    // BOTÓN CERRAR
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('🎯 Botón cerrar clickeado');
            this.closeChat();
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
            document.getElementById('chatbot-input').focus();
            this.hideNotification();
            toggleBtn.setAttribute('aria-label', 'Cerrar chat del Tutor IA');
        } else {
            toggleBtn.setAttribute('aria-label', 'Abrir chat del Tutor IA');
        }
    }

    closeChat() {
        if (this.isOpen) this.toggleChat(); // Reutilizamos la lógica de toggle para cerrar
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

    // ✅ TIMEOUT de seguridad (15 segundos). Más realista para peticiones a una IA que pueden tener "cold starts".
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout: El servidor tardó demasiado en responder')), 15000);
    });

    try {
        // Agregar mensaje del usuario
        this.addMessage(message, 'user');
        input.value = '';

        // Mostrar indicador de typing
        this.showTypingIndicator();

        // --- INICIO: CÓDIGO REAL PARA CONECTAR CON LA API ---
        console.log('📡 Enviando solicitud al servidor...');

        const requestData = {
            message: message,
            conversationId: this.currentConversationId,
            conversationHistory: this.conversationHistory,
            // El token se añade en la cabecera
        };

        console.log('📦 Datos enviados:', requestData);

        const fetchPromise = fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}` // ✅ AÑADIR TOKEN
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

        this.addMessage(data.respuesta, 'bot', data);
        
        if (data.sugerencias && data.sugerencias.length > 0) {
            this.showFollowUpSuggestions(data.sugerencias);
        }
        // --- FIN: CÓDIGO REAL ---

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
        // No añadir el mensaje de bienvenida al historial persistente
        if (metadata.isWelcome) {
            const messagesContainer = document.getElementById('chatbot-messages');
            const messageDiv = document.createElement('div');
            messageDiv.className = `welcome-message`;
            messageDiv.innerHTML = `<div class="message bot">${this.formatMessage(text)}</div>`;
            messagesContainer.appendChild(messageDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            return;
        }

        const messagesContainer = document.getElementById('chatbot-messages');
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        
        let messageHTML = this.formatMessage(text);

        // Agregar información de metadata para mensajes del bot
        if (sender === 'bot' && metadata.intencion) {
            const confidencePercent = (metadata.confianza * 100).toFixed(1);
            messageHTML += `<div class="message-info">Intención: ${metadata.intencion} • Confianza: ${confidencePercent}%</div>`;
        }

        // ✅ AÑADIR BOTÓN DE REDIRECCIÓN SI EXISTE LA URL
        if (sender === 'bot' && metadata.redirectUrl) {
            messageHTML += `
                <div class="redirect-container" style="margin-top: 10px;">
                    <a href="${metadata.redirectUrl}" target="_blank" class="redirect-btn">Ver más detalles</a>
                </div>
            `;
        }

        messageDiv.innerHTML = messageHTML;
        messagesContainer.appendChild(messageDiv);
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // Añadir al historial de conversación, EXCLUYENDO el mensaje de bienvenida
        if (!metadata.isWelcome) {
            this.conversationHistory.push({ sender, text });
        }
        this.saveChatHistory(); // Guardar historial después de cada mensaje
    }

    formatMessage(text) {
        // Expresión regular para detectar URLs (absolutas y relativas que empiezan con /)
        const urlRegex = /(https?:\/\/[^\s]+)|(\B\/[^\s]+)/g;
        // ✅ SOLUCIÓN: La regex ahora captura el formato `* [ID] Texto` y `[ID] Texto`.
        const navRegex = /\*?\s*\[(\d+)\]\s*([^\n<]+)/g;

        return text
            // ✅ MEJORA: Convertir URLs en enlaces clickeables.
            // ✅ SOLUCIÓN: La regex de Markdown para enlaces es Texto.
            .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (match, linkText, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${linkText}</a>`)
            // ✅ NUEVO: Convertir enlaces de navegación internos en botones.
            .replace(navRegex, (match, id, text) => {
                const numericId = parseInt(id, 10);
                const trimmedText = text.trim();
                let functionCall = '';

                // Heurística simple: si el texto contiene palabras clave de carrera, es una carrera.
                const isCareer = /ingeniería|derecho|medicina|arquitectura|diseño|comunicac|contabilidad|economía|psicología|educación|marketing|administración|turismo|enfermería|nutrición/i.test(trimmedText);

                if (isCareer) {
                    functionCall = `
                        window.chatComponent.closeChat();
                        window.searchComponent.navigateTo(window.searchComponent.renderCoursesForCareer.bind(window.searchComponent), ${numericId});
                    `;
                } else {
                    // Por defecto, asumimos que es un curso.
                    functionCall = `
                        window.chatComponent.closeChat();
                        window.searchComponent.navigateTo(window.searchComponent.renderUnifiedCourseView.bind(window.searchComponent), ${numericId});
                    `;
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

    loadChatHistory() {
        // Cargar historial desde localStorage (para persistencia)
        const savedHistory = localStorage.getItem(`chatbotHistory_${this.currentConversationId}`);
        if (savedHistory && savedHistory !== '[]') { // Asegurarse de que no esté vacío
            try {
                const history = JSON.parse(savedHistory);
                this.conversationHistory = history;
                history.forEach(msg => {
                    this.addMessage(msg.text, msg.sender);
                });
                console.log('✅ Historial de chat cargado:', this.conversationHistory);
            } catch (error) {
                console.error('Error cargando historial del chat:', error);
                this.conversationHistory = []; // Resetear si hay error
            }
        }
    }

    saveChatHistory() {
        localStorage.setItem(`chatbotHistory_${this.currentConversationId}`, JSON.stringify(this.conversationHistory));
    }
}

// ✅ ELIMINADO: La inicialización ahora se centraliza en app.js para evitar duplicados y conflictos.