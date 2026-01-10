/**
 * app.js
 * 
 * Punto de entrada principal para la inicialización de componentes de JavaScript.
 * Detecta qué componentes son necesarios en la página actual y los instancia.
 */

// ✅ 1. CONFIGURACIÓN INTELIGENTE DE LA API (Local vs Nube)
// Detectamos el entorno para configurar la URL base de la API.
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BACKEND_URL = isLocal
    ? 'http://localhost:3000'
    : 'https://tutor-ia-backend.onrender.com';

// Hacemos la URL global para que authApiService.js y otros puedan usarla
window.API_URL = BACKEND_URL;

console.log('🌍 Entorno detectado:', isLocal ? 'Local (localhost)' : 'Producción (Render)');
console.log('🔗 Conectando API a:', window.API_URL);

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 DOM completamente cargado. Inicializando componentes...');

    // --- PASO 1: Inicializar todos los componentes globales ---

    // ✅ CORRECCIÓN: Verificar si ChatComponent existe antes de inicializarlo.
    if (typeof ChatComponent !== 'undefined') {
        window.chatComponent = new ChatComponent();
    }

    // ✅ NUEVO: Inicializar el modal de confirmación global (Solo si existe en el DOM)
    if (typeof ConfirmationModal !== 'undefined' && document.getElementById('confirmation-modal')) {
        window.confirmationModal = new ConfirmationModal();
    }

    // --- PASO 2: Registrar todos los listeners que dependen de la sesión ---
    // El header necesita saber si el usuario cambió.
    if (window.sessionManager) {
        window.sessionManager.onStateChange(updateHeaderUI);

        // --- PASO 3: Inicializar la sesión DESPUÉS de que todos se hayan suscrito ---
        await window.sessionManager.initialize();
    }

    if (document.querySelector('.admin-container')) {
        console.log('⚙️ Página de admin detectada.');
        // El script de admin.js se auto-inicializa.
    }

    // ✅ SOLUCIÓN: Lógica centralizada para cerrar TODAS las modales.
    const closeAllModals = () => {
        document.querySelectorAll('.modal, .pdf-modal').forEach(modal => {
            modal.style.display = 'none';
        });
    };

    /**
     * Gestiona los clics en toda la página para cerrar modales.
     */
    document.body.addEventListener('click', (event) => {
        // Cierra la modal si se hace clic en un botón de cierre
        const closeButton = event.target.closest('.modal-close, .pdf-modal-close-btn');
        if (closeButton) {
            closeAllModals();
        }
        // Cierra la modal si se hace clic en el fondo
        if (event.target.classList.contains('modal-overlay')) {
            closeAllModals();
        }
    });
});

function updateHeaderUI(user) {
    const userControlsContainer = document.getElementById('user-session-controls');
    if (!userControlsContainer) return;

    if (user) {
        // Usuario logueado - Menú desplegable
        userControlsContainer.innerHTML = `
            <div class="user-menu-container">
                <button id="user-menu-toggle" class="user-menu-toggle">
                    Hola, ${user.name} <i class="fas fa-chevron-down"></i>
                </button>
                <div id="user-menu-dropdown" class="user-menu-dropdown">
                    <div class="user-menu-header">
                        <span class="user-menu-name">${user.name}</span>
                        <span class="user-menu-email">${user.email}</span>
                        ${user.subscriptionStatus !== 'active' ? `
                            <div class="usage-badge" style="background: #2563eb15; color: #2563eb; padding: 4px 8px; border-radius: 4px; font-size: 0.85rem; margin-top: 8px; font-weight: 600; text-align: center; border: 1px solid #2563eb30;">
                                🎁 Te quedan ${Math.max(0, (user.max_free_limit || 3) - (user.usage_count || 0))} vistas gratis
                            </div>
                        ` : ''}
                    </div>
                    <div class="user-menu-group">
                        ${user.role === 'admin' ? '<a href="/admin.html" class="user-menu-item"><i class="fas fa-user-shield"></i><span>Panel de Admin</span></a>' : ''}
                        <a href="/change-password.html" class="user-menu-item" id="change-password-link">
                            <i class="fas fa-key"></i>
                            <span>Cambiar Contraseña</span>
                        </a>
                    </div>
                    <div class="user-menu-group">
                        <button id="logout-button" class="user-menu-item logout-item"><i class="fas fa-sign-out-alt"></i><span>Cerrar Sesión</span></button>
                    </div>
                </div>
            </div>
        `;

        // Listeners para el nuevo menú
        const menuToggle = document.getElementById('user-menu-toggle');
        const logoutBtn = document.getElementById('logout-button');

        if (menuToggle) {
            menuToggle.addEventListener('click', () => {
                document.getElementById('user-menu-dropdown').classList.toggle('show');
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                window.sessionManager.logout();
            });
        }
    } else {
        // Usuario no logueado
        userControlsContainer.innerHTML = `
            <a href="/login.html" class="nav-link">Iniciar Sesión</a>
            <a href="/register.html" class="btn-primary">Registrarse</a>
        `;
    }
}

// --- Funciones globales para interactuar con el chat desde otros componentes ---

// --- Funciones globales para interactuar con el chat desde otros componentes ---

window.openChat = function () {
    window.uiManager.checkAuthAndExecute(() => {
        if (window.chatComponent) window.chatComponent.openAndAsk('');
    });
};

window.askAboutCourse = function (courseName) {
    window.uiManager.checkAuthAndExecute(() => {
        if (window.chatComponent) window.chatComponent.openAndAsk(`Háblame más sobre el curso "${courseName}"`);
    });
};

window.askAboutTopic = function (topic) {
    window.uiManager.checkAuthAndExecute(() => {
        if (window.chatComponent) window.chatComponent.openAndAsk(`Explícame sobre "${topic}"`);
    });
};