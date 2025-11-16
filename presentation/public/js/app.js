/**
 * app.js
 * 
 * Punto de entrada principal para la inicialización de componentes de JavaScript.
 * Detecta qué componentes son necesarios en la página actual y los instancia.
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 DOM completamente cargado. Inicializando componentes...');

    // --- PASO 1: Inicializar todos los componentes globales ---
    // ✅ CORRECCIÓN: El chatbot es un componente global y debe inicializarse siempre.
    window.chatComponent = new ChatComponent();

    // --- PASO 2: Registrar todos los listeners que dependen de la sesión ---
    // El header necesita saber si el usuario cambió.
    window.sessionManager.onStateChange(updateHeaderUI);
    // El chat ya registra su propio listener dentro de su constructor/init.

    // --- PASO 3: Inicializar la sesión DESPUÉS de que todos se hayan suscrito ---
    // Esto notificará tanto al header como al chat sobre el estado actual del usuario.
    await window.sessionManager.initialize();

    if (document.querySelector('.admin-container')) {
        console.log('⚙️ Página de admin detectada.');
        // El script de admin.js se auto-inicializa, lo mantenemos así por ahora.
    }

    // ✅ SOLUCIÓN: Lógica centralizada para cerrar TODAS las modales.
    // Esto reemplaza el código repetitivo anterior y funciona para cualquier modal.

    /**
     * Cierra todas las ventanas modales abiertas.
     * Es una función reutilizable para no repetir código.
     */
    const closeAllModals = () => {
        // Busca todas las modales visibles y las oculta.
        document.querySelectorAll('.modal, .pdf-modal').forEach(modal => {
            modal.style.display = 'none';
        });
    };

    /**
     * Gestiona los clics en toda la página para cerrar modales.
     * Utiliza delegación de eventos para un rendimiento óptimo.
     */
    document.body.addEventListener('click', (event) => {
        // Cierra la modal si se hace clic en un botón de cierre (clase .modal-close)
        if (event.target.closest('.modal-close')) {
            closeAllModals();
        }
        // Cierra la modal si se hace clic en el fondo (clase .modal-overlay)
        if (event.target.classList.contains('modal-overlay')) {
            closeAllModals();
        }
    });

    // Listener para el formulario de cambio de contraseña (se mantiene)
    const changePasswordForm = document.getElementById('change-password-form');
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', handleChangePasswordSubmit);
    }

});

function updateHeaderUI(user) {
    const userControlsContainer = document.getElementById('user-session-controls');
    if (!userControlsContainer) return;

    if (user) {
        // Usuario logueado
        // ✅ MEJORA UI/UX: Usar un menú desplegable para las opciones de usuario.
        userControlsContainer.innerHTML = `
            <div class="user-menu-container">
                <button id="user-menu-toggle" class="user-menu-toggle">
                    Hola, ${user.name} <i class="fas fa-chevron-down"></i>
                </button>
                <div id="user-menu-dropdown" class="user-menu-dropdown">
                    <div class="user-menu-header">
                        <span class="user-menu-name">${user.name}</span>
                        <span class="user-menu-email">${user.email}</span>
                    </div>
                    <div class="user-menu-group">
                        ${user.role === 'admin' ? '<a href="/admin.html" class="user-menu-item"><i class="fas fa-user-shield"></i><span>Panel de Admin</span></a>' : ''}
                        <button id="change-password-btn" class="user-menu-item">
                            <i class="fas fa-key"></i>
                            <span>Cambiar Contraseña</span>
                        </button>
                    </div>
                    <div class="user-menu-group">
                        <button id="logout-button" class="user-menu-item logout-item"><i class="fas fa-sign-out-alt"></i><span>Cerrar Sesión</span></button>
                    </div>
                </div>
            </div>
        `;
        // Listeners para el nuevo menú
        document.getElementById('user-menu-toggle').addEventListener('click', () => {
            document.getElementById('user-menu-dropdown').classList.toggle('show');
        });
        document.getElementById('logout-button').addEventListener('click', () => {
            window.sessionManager.logout();
        });
        document.getElementById('change-password-btn').addEventListener('click', () => {
            document.getElementById('change-password-modal').style.display = 'flex';
        });
    } else {
        // Usuario no logueado
        userControlsContainer.innerHTML = `
            <a href="/login.html" class="nav-link">Iniciar Sesión</a>
            <a href="/register.html" class="btn-primary">Registrarse</a>
        `;
    }
}

// ✅ NUEVO: Manejador para el formulario de cambio de contraseña.
async function handleChangePasswordSubmit(e) {
    e.preventDefault();
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (newPassword !== confirmPassword) {
        alert('La nueva contraseña y su confirmación no coinciden.');
        return;
    }

    try {
        await AuthApiService.changePassword(currentPassword, newPassword);
        document.getElementById('change-password-modal').style.display = 'none';
        e.target.reset(); // Limpiar el formulario
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}


// --- Funciones globales para interactuar con el chat desde otros componentes ---
    
function showLoginPrompt() {
    const modal = document.getElementById('login-prompt-modal');
    if (modal) modal.style.display = 'flex';
}

// Abre el widget de chat
window.openChat = function() {
    if (window.sessionManager.isLoggedIn()) {
        if (window.chatComponent) window.chatComponent.openAndAsk('');
    } else {
        showLoginPrompt();
    }
};

// Abre el widget de chat con una pregunta específica
window.askAboutCourse = function(courseName) {
    if (window.sessionManager.isLoggedIn()) {
        if (window.chatComponent) window.chatComponent.openAndAsk(`Háblame más sobre el curso "${courseName}"`);
    } else {
        showLoginPrompt();
    }
};

window.askAboutTopic = function(topic) {
    if (window.sessionManager.isLoggedIn()) {
        if (window.chatComponent) window.chatComponent.openAndAsk(`Explícame sobre "${topic}"`);
    } else {
        showLoginPrompt();
    }
};
