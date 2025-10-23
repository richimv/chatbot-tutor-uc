class ChatModule {
    constructor() {
        this.chatHistory = [];
        this.isOpen = false;
        this.init();
    }

    init() {
        this.createChatInterface();
        this.setupEventListeners();
    }

    createChatInterface() {
        const chatHTML = `
            <div id="chatbot-container" class="chatbot-container">
                <div class="chatbot-header">
                    <h3>🤖 Tutor IA</h3>
                    <button id="chatbot-close" class="chatbot-close">×</button>
                </div>
                <div id="chatbot-messages" class="chatbot-messages"></div>
                <div class="chatbot-input">
                    <input type="text" id="chatbot-input" placeholder="Escribe tu pregunta...">
                    <button id="chatbot-send">➤</button>
                </div>
            </div>
            <button id="chatbot-toggle" class="chatbot-toggle">🤖</button>
        `;

        document.body.insertAdjacentHTML('beforeend', chatHTML);
        this.loadStyles();
    }

    loadStyles() {
        const styles = `
            <style>
                .chatbot-container {
                    position: fixed;
                    bottom: 80px;
                    right: 20px;
                    width: 350px;
                    height: 500px;
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                    display: none;
                    flex-direction: column;
                    z-index: 1000;
                    border: 2px solid #2563eb;
                }

                .chatbot-container.open {
                    display: flex;
                }

                .chatbot-header {
                    background: #2563eb;
                    color: white;
                    padding: 1rem;
                    border-radius: 12px 12px 0 0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .chatbot-close {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 1.5rem;
                    cursor: pointer;
                }

                .chatbot-messages {
                    flex: 1;
                    padding: 1rem;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .message {
                    padding: 0.75rem;
                    border-radius: 12px;
                    max-width: 80%;
                    word-wrap: break-word;
                }

                .message.user {
                    background: #2563eb;
                    color: white;
                    align-self: flex-end;
                }

                .message.bot {
                    background: #f1f5f9;
                    color: #1e293b;
                    align-self: flex-start;
                }

                .message-info {
                    font-size: 0.75rem;
                    opacity: 0.7;
                    margin-top: 0.25rem;
                }

                .chatbot-input {
                    display: flex;
                    padding: 1rem;
                    border-top: 1px solid #e2e8f0;
                }

                .chatbot-input input {
                    flex: 1;
                    padding: 0.75rem;
                    border: 1px solid #d1d5db;
                    border-radius: 8px;
                    margin-right: 0.5rem;
                }

                .chatbot-input button {
                    background: #2563eb;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    padding: 0.75rem 1rem;
                    cursor: pointer;
                }

                .chatbot-toggle {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    width: 60px;
                    height: 60px;
                    background: #2563eb;
                    color: white;
                    border: none;
                    border-radius: 50%;
                    font-size: 1.5rem;
                    cursor: pointer;
                    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
                    z-index: 999;
                }
            </style>
        `;
        document.head.insertAdjacentHTML('beforeend', styles);
    }

    setupEventListeners() {
        document.getElementById('chatbot-toggle').addEventListener('click', () => this.toggleChat());
        document.getElementById('chatbot-close').addEventListener('click', () => this.closeChat());
        document.getElementById('chatbot-send').addEventListener('click', () => this.sendMessage());
        document.getElementById('chatbot-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
    }

    toggleChat() {
        this.isOpen = !this.isOpen;
        const container = document.getElementById('chatbot-container');
        container.classList.toggle('open', this.isOpen);
        
        if (this.isOpen) {
            document.getElementById('chatbot-input').focus();
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

        // Agregar mensaje del usuario
        this.addMessage(message, 'user');
        input.value = '';

        // Mostrar typing indicator
        this.showTypingIndicator();

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message })
            });

            const data = await response.json();
            this.hideTypingIndicator();

            if (response.ok) {
                this.addMessage(data.respuesta, 'bot', data);
            } else {
                this.addMessage('❌ Error al procesar tu mensaje. Intenta nuevamente.', 'bot');
            }

        } catch (error) {
            this.hideTypingIndicator();
            this.addMessage('❌ Error de conexión. Verifica tu internet.', 'bot');
        }
    }

    addMessage(text, sender, metadata = {}) {
        const messagesContainer = document.getElementById('chatbot-messages');
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        
        let messageHTML = text;
        if (sender === 'bot' && metadata.intencion) {
            messageHTML += `<div class="message-info">Intención: ${metadata.intencion} (${(metadata.confianza * 100).toFixed(1)}% confianza)</div>`;
        }
        
        messageDiv.innerHTML = messageHTML;
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // Guardar en historial
        this.chatHistory.push({
            text,
            sender,
            timestamp: new Date(),
            metadata
        });
    }

    showTypingIndicator() {
        const messagesContainer = document.getElementById('chatbot-messages');
        const typingDiv = document.createElement('div');
        typingDiv.id = 'typing-indicator';
        typingDiv.className = 'message bot';
        typingDiv.innerHTML = '🤖 Escribiendo...';
        messagesContainer.appendChild(typingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }
}

// Inicializar chat cuando se cargue la página
document.addEventListener('DOMContentLoaded', () => {
    window.chatModule = new ChatModule();
});