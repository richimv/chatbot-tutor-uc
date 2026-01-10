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
    console.log("🚀 App iniciada. Verificando sesión...");

    // Inicializar lógica de Modals y otros componentes
    if (typeof ChatComponent !== 'undefined') new ChatComponent();
    if (typeof ConfirmationModal !== 'undefined' && document.getElementById('confirmation-modal')) window.confirmationModal = new ConfirmationModal();
    const closeAllModals = () => document.querySelectorAll('.modal, .pdf-modal').forEach(m => m.style.display = 'none');
    document.body.addEventListener('click', (e) => {
        if (e.target.closest('.modal-close, .pdf-modal-close-btn') || e.target.classList.contains('modal-overlay')) closeAllModals();
    });

    // ✅ LÓGICA DE AUTENTICACIÓN SOLICITADA
    if (typeof supabase !== 'undefined' && window.AppConfig?.SUPABASE_URL) {
        const { createClient } = supabase;
        const sbClient = createClient(window.AppConfig.SUPABASE_URL, window.AppConfig.SUPABASE_ANON_KEY);

        // Exponer cliente para uso global si es necesario
        window.supabaseClient = sbClient;

        // 1. Verificar sesión actual
        const { data: { session } } = await sbClient.auth.getSession();
        updateUI(session);

        // 2. Escuchar cambios en vivo
        sbClient.auth.onAuthStateChange((event, session) => {
            console.log("🔄 Cambio de estado de autenticación:", event);
            updateUI(session);
        });
    } else {
        console.error("⚠️ Supabase no está configurado.");
    }
});

// Función para actualizar la interfaz visual
function updateUI(session) {
    const userControls = document.getElementById('user-session-controls');
    if (!userControls) return;

    if (session) {
        console.log("✅ Usuario logueado:", session.user.email);

        // Sincronizar con SessionManager para mantener compatibilidad con otras partes de la app
        if (window.sessionManager) {
            // Construir objeto de usuario compatible
            const appUser = {
                id: session.user.id,
                email: session.user.email,
                name: session.user.user_metadata?.full_name || session.user.email.split('@')[0],
                role: 'student', // Se actualizará si el backend responde con datos reales
                subscriptionStatus: 'pending',
                usage_count: 0,
                max_free_limit: 3
            };
            // Solo actualizar si no está ya seteado para evitar bucles si sessionManager dispara eventos
            if (!window.sessionManager.getUser()) {
                window.sessionManager.login(session.access_token, appUser);
            }
        }

        const avatarUrl = session.user.user_metadata.avatar_url || 'https://via.placeholder.com/40';
        const userName = session.user.user_metadata.full_name || 'Estudiante';

        userControls.innerHTML = `
            <div id="user-profile-container" style="display: flex; align-items: center; gap: 10px; color: var(--text-main);">
                <img src="${avatarUrl}" style="width: 35px; height: 35px; border-radius: 50%; border: 2px solid #2563eb;">
                <span class="user-name-display" style="font-weight: 500;">${userName}</span>
                <button onclick="handleLogout()" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 0.9em; margin-left: 5px;" title="Cerrar Sesión">
                    <i class="fas fa-sign-out-alt"></i>
                </button>
            </div>
        `;
    } else {
        console.log("👤 No hay sesión activa.");
        if (window.sessionManager) window.sessionManager.logout();

        userControls.innerHTML = `
            <a href="/login.html" class="nav-link">Iniciar Sesión</a>
            <a href="/register.html" class="btn-primary">Registrarse</a>
        `;
    }
}

// Función global para cerrar sesión
window.handleLogout = async () => {
    if (window.supabaseClient) await window.supabaseClient.auth.signOut();
    if (window.sessionManager) window.sessionManager.logout();
    window.location.reload();
};

// Mantener compatibilidad
window.updateHeaderUI = updateUI;

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