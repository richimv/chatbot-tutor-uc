// Aplicación principal - Inicializar todos los componentes
class ChatbotTutorApp {
    constructor() {
        this.components = {};
        this.init();
    }

    init() {
        console.log('🚀 Chatbot Tutor UC - Sistema Completo PMV1 + PMV2');
        this.initializeComponents();
        this.setupGlobalFunctions();
    }

    initializeComponents() {
        try {
            // Inicializar componentes en orden
            this.components.search = new SearchComponent();
            this.components.chat = new ChatComponent();
            
            console.log('✅ Todos los componentes inicializados correctamente');
            
            // Hacer disponibles globalmente para los onclick
            window.searchComponent = this.components.search;
            window.chatComponent = this.components.chat;
            
        } catch (error) {
            console.error('❌ Error inicializando componentes:', error);
        }
    }

    setupGlobalFunctions() {
        // Funciones globales para los botones HTML
        window.openChat = () => {
            if (this.components.chat) {
                this.components.chat.toggleChat();
            } else {
                console.error('Chat component not available');
                alert('El chatbot se está cargando, por favor espera...');
            }
        };

        window.askAboutCourse = (courseName) => {
            if (this.components.chat) {
                const question = `Necesito información sobre el curso de ${courseName}`;
                const chatInput = document.getElementById('chatbot-input');
                if (chatInput) {
                    chatInput.value = question;
                    this.components.chat.toggleChat();
                    setTimeout(() => chatInput.focus(), 500);
                }
            } else {
                alert('El chatbot no está disponible en este momento.');
            }
        };

        // ✅ NUEVA FUNCIÓN para preguntas teóricas
        window.askAboutTopic = (topic) => {
            if (this.components.chat) {
                // No añade "el curso de"
                this.components.chat.openAndAsk(topic);
            } else {
                alert('El chatbot no está disponible en este momento.');
            }
        };
    }
}

// ✅ CORREGIDO: Se elimina la inicialización duplicada.
// La clase ChatbotTutorApp se encargará de todo.
document.addEventListener('DOMContentLoaded', function() {
    window.tutorApp = new ChatbotTutorApp();
});