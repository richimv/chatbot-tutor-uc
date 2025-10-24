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
    }

    createChatInterface() {
        const chatHTML = `
            <div id="chatbot-container" class="chatbot-container">
                <div class="chatbot-header">
                    <div class="chatbot-title">
                        <span class="chatbot-icon">🤖</span>
                        <h3>Tutor IA UC</h3>
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

            <button id="chatbot-toggle" class="chatbot-toggle">
                <span class="chatbot-toggle-icon">🤖</span>
                <span class="chatbot-notification" id="chatbot-notification" style="display: none;"></span>
            </button>
        `;

        document.body.insertAdjacentHTML('beforeend', chatHTML);
        this.loadChatStyles();
    }

    loadChatStyles() {
        const styles = `
            <style>
                .chatbot-container {
                    position: fixed;
                    bottom: 80px;
                    right: 20px;
                    width: 380px;
                    height: 600px;
                    background: white;
                    border-radius: 16px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.15);
                    display: none;
                    flex-direction: column;
                    z-index: 10000;
                    border: 1px solid #e1e5e9;
                    font-family: 'Segoe UI', system-ui, sans-serif;
                }

                .chatbot-container.open {
                    display: flex;
                    animation: chatSlideIn 0.3s ease;
                }

                @keyframes chatSlideIn {
                    from { 
                        opacity: 0; 
                        transform: translateY(20px) scale(0.95);
                    }
                    to { 
                        opacity: 1; 
                        transform: translateY(0) scale(1);
                    }
                }

                .chatbot-header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 1.25rem;
                    border-radius: 16px 16px 0 0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .chatbot-title {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }

                .chatbot-title h3 {
                    margin: 0;
                    font-size: 1.1rem;
                    font-weight: 600;
                }

                .chatbot-icon {
                    font-size: 1.5rem;
                }

                .chatbot-status {
                    font-size: 0.75rem;
                    opacity: 0.9;
                    background: rgba(255,255,255,0.2);
                    padding: 0.25rem 0.5rem;
                    border-radius: 12px;
                }

                .chatbot-close {
                    background: rgba(255,255,255,0.2);
                    border: none;
                    color: white;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.25rem;
                    transition: background 0.2s ease;
                }

                .chatbot-close:hover {
                    background: rgba(255,255,255,0.3);
                }

                .chatbot-messages {
                    flex: 1;
                    padding: 1.25rem;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    background: #f8fafc;
                }

                .message {
                    padding: 0.875rem 1rem;
                    border-radius: 18px;
                    max-width: 85%;
                    word-wrap: break-word;
                    line-height: 1.4;
                    animation: messageSlideIn 0.2s ease;
                }

                @keyframes messageSlideIn {
                    from { 
                        opacity: 0; 
                        transform: translateY(10px);
                    }
                    to { 
                        opacity: 1; 
                        transform: translateY(0);
                    }
                }

                .message.user {
                    background: #2563eb;
                    color: white;
                    align-self: flex-end;
                    border-bottom-right-radius: 6px;
                }

                .message.bot {
                    background: white;
                    color: #1f2937;
                    align-self: flex-start;
                    border: 1px solid #e5e7eb;
                    border-bottom-left-radius: 6px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                }

                .message-info {
                    font-size: 0.75rem;
                    opacity: 0.7;
                    margin-top: 0.5rem;
                    padding-top: 0.25rem;
                    border-top: 1px solid rgba(255,255,255,0.2);
                }

                .message.bot .message-info {
                    border-top: 1px solid #f1f5f9;
                    color: #6b7280;
                }

                .welcome-message .message {
                    max-width: 100%;
                }

                .welcome-message ul {
                    margin: 0.5rem 0;
                    padding-left: 1.25rem;
                }

                .welcome-message li {
                    margin: 0.25rem 0;
                }

                .chatbot-typing {
                    padding: 1rem 1.25rem;
                    background: white;
                    border-top: 1px solid #e5e7eb;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    color: #6b7280;
                    font-size: 0.875rem;
                }

                .typing-indicator {
                    display: flex;
                    gap: 0.25rem;
                }

                .typing-indicator span {
                    width: 8px;
                    height: 8px;
                    background: #9ca3af;
                    border-radius: 50%;
                    animation: typingBounce 1.4s ease-in-out infinite both;
                }

                .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
                .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

                @keyframes typingBounce {
                    0%, 80%, 100% { 
                        transform: scale(0.8);
                        opacity: 0.5;
                    }
                    40% { 
                        transform: scale(1);
                        opacity: 1;
                    }
                }

                .chatbot-input-container {
                    border-top: 1px solid #e5e7eb;
                    background: white;
                    border-radius: 0 0 16px 16px;
                }

                .chatbot-input {
                    display: flex;
                    padding: 1rem;
                    gap: 0.75rem;
                }

                .chatbot-input input {
                    flex: 1;
                    padding: 0.875rem 1rem;
                    border: 1px solid #d1d5db;
                    border-radius: 12px;
                    font-size: 0.875rem;
                    outline: none;
                    transition: border-color 0.2s ease;
                }

                .chatbot-input input:focus {
                    border-color: #2563eb;
                    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
                }

                .chatbot-send {
                    background: #2563eb;
                    color: white;
                    border: none;
                    border-radius: 12px;
                    padding: 0.875rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background 0.2s ease;
                }

                .chatbot-send:hover {
                    background: #1d4ed8;
                }

                .chatbot-send:disabled {
                    background: #9ca3af;
                    cursor: not-allowed;
                }

                .chatbot-suggestions {
                    padding: 0 1rem 1rem;
                    display: flex;
                    gap: 0.5rem;
                    overflow-x: auto;
                }

                .suggestion-btn {
                    background: #f8fafc;
                    border: 1px solid #e5e7eb;
                    border-radius: 20px;
                    padding: 0.5rem 0.875rem;
                    font-size: 0.75rem;
                    cursor: pointer;
                    white-space: nowrap;
                    transition: all 0.2s ease;
                }

                .suggestion-btn:hover {
                    background: #eef2ff;
                    border-color: #2563eb;
                    color: #2563eb;
                }

                .chatbot-toggle {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    width: 64px;
                    height: 64px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    border-radius: 50%;
                    cursor: pointer;
                    box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
                    z-index: 9999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.75rem;
                    transition: all 0.3s ease;
                }

                .chatbot-toggle:hover {
                    transform: scale(1.1);
                    box-shadow: 0 12px 30px rgba(102, 126, 234, 0.5);
                }

                .chatbot-notification {
                    position: absolute;
                    top: -5px;
                    right: -5px;
                    background: #ef4444;
                    color: white;
                    border-radius: 50%;
                    width: 20px;
                    height: 20px;
                    font-size: 0.75rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    animation: pulse 2s infinite;
                }

                @keyframes pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                    100% { transform: scale(1); }
                }

                /* Scrollbar personalizado */
                .chatbot-messages::-webkit-scrollbar {
                    width: 6px;
                }

                .chatbot-messages::-webkit-scrollbar-track {
                    background: #f1f5f9;
                    border-radius: 3px;
                }

                .chatbot-messages::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 3px;
                }

                .chatbot-messages::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                }

                /* Responsive */
                @media (max-width: 480px) {
                    .chatbot-container {
                        width: calc(100vw - 40px);
                        height: 70vh;
                        right: 20px;
                        bottom: 80px;
                    }
                }
            </style>
        `;
        document.head.insertAdjacentHTML('beforeend', styles);
    }

    addWelcomeMessage() {
        // Solo añadir el mensaje de bienvenida si el historial está vacío
        if (this.conversationHistory.length === 0) {
            const welcomeText = `**¡Hola! Soy tu tutor IA 🤖**
Puedo ayudarte con:
*   📚 Encontrar materiales de cursos
*   🕐 Consultar horarios y fechas
*   💡 Explicar conceptos teóricos
*   📊 Información de evaluaciones
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

    // SUGERENCIAS RÁPIDAS - Con verificación
    const suggestionBtns = document.querySelectorAll('.suggestion-btn');
    console.log(`🎯 Encontradas ${suggestionBtns.length} sugerencias`);
    
    suggestionBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const question = e.target.dataset.question;
            console.log('🎯 Sugerencia seleccionada:', question);
            if (input) {
                input.value = question;
                this.sendMessage();
            }
        });
    });
}

    toggleChat() {
        this.isOpen = !this.isOpen;
        const container = document.getElementById('chatbot-container');
        container.classList.toggle('open', this.isOpen);
        
        if (this.isOpen) {
            document.getElementById('chatbot-input').focus();
            this.hideNotification();
        }
    }

    closeChat() {
        this.isOpen = false;
        document.getElementById('chatbot-container').classList.remove('open');
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

    // ✅ TIMEOUT de seguridad (8 segundos)
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout: El servidor tardó demasiado en responder')), 8000);
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
            conversationHistory: this.conversationHistory
        };

        console.log('📦 Datos enviados:', requestData);

        const fetchPromise = fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
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
        // Formatear texto con Markdown (negritas, listas, saltos de línea)
        return text
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