/**
 * app.js
 * 
 * Punto de entrada principal para la inicialización de componentes de JavaScript.
 * Detecta qué componentes son necesarios en la página actual y los instancia.
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM completamente cargado. Inicializando componentes...');

    // --- Inicialización para la página de Búsqueda (index.html) ---
    if (document.getElementById('searchButton')) {
        console.log('🔎 Página de búsqueda detectada. Inicializando componentes.');
        
        // ✅ CORRECCIÓN: Se instancia SearchComponent para activar la funcionalidad de búsqueda.
        // El componente se auto-configura al ser creado.
        new SearchComponent();
        window.chatComponent = new ChatComponent();
    }

    // --- Inicialización para la página de Admin (admin.html) ---
    // Nota: admin.js se auto-inicializa, pero podríamos moverlo aquí para consistencia.
    if (document.querySelector('.admin-container')) {
        console.log('⚙️ Página de admin detectada.');
        // new AdminManager(); // Descomentar si movemos la inicialización de admin.js aquí.
    }
});

// --- Funciones globales para interactuar con el chat desde otros componentes ---
    
// Abre el widget de chat
window.openChat = function() {
    if (window.chatComponent) window.chatComponent.openAndAsk('');
};

// Abre el widget de chat con una pregunta específica
window.askAboutCourse = function(courseName) {
    if (window.chatComponent) window.chatComponent.openAndAsk(`Háblame más sobre el curso "${courseName}"`);
};

// ✅ CORRECCIÓN: Añadir la función que faltaba para preguntar sobre un tema.
window.askAboutTopic = function(topic) {
    if (window.chatComponent) window.chatComponent.openAndAsk(`Explícame sobre "${topic}"`);
};