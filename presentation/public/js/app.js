/**
 * app.js
 * * Punto de entrada principal.
 * Maneja la inicialización segura sin bucles infinitos.
 */

// 1. CONFIGURACIÓN DE ENTORNO
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BACKEND_URL = isLocal ? 'http://localhost:3000' : 'https://tutor-ia-backend.onrender.com';
window.API_URL = BACKEND_URL;

console.log('🌍 Entorno:', isLocal ? 'Local' : 'Producción', '| API:', window.API_URL);

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 DOM cargado. Iniciando sistema...');

    // --- PASO 1: Componentes Globales (UI) ---
    if (typeof ChatComponent !== 'undefined') window.chatComponent = new ChatComponent();

    if (typeof ConfirmationModal !== 'undefined' && document.getElementById('confirmation-modal')) {
        window.confirmationModal = new ConfirmationModal();
    }

    // --- PASO 2: Lógica de Sesión (El cerebro) ---
    if (window.sessionManager) {

        // A. Suscribir la UI a los cambios de sesión
        // IMPORTANTE: updateHeaderUI SOLO pinta, no cambia datos (evita el bucle).
        window.sessionManager.onStateChange(updateHeaderUI);

        // B. Inicializar sesión guardada en LocalStorage
        await window.sessionManager.initialize();

        // C. Integración con Google Auth (Supabase)
        // Esta parte detecta si el usuario viene redirigido desde Google
        if (typeof supabase !== 'undefined' && window.AppConfig?.SUPABASE_URL) {
            try {
                const { createClient } = supabase;
                const sb = createClient(window.AppConfig.SUPABASE_URL, window.AppConfig.SUPABASE_ANON_KEY);

                // Escucha ACTIVA de eventos de autenticación
                sb.auth.onAuthStateChange(async (event, session) => {
                    console.log('🔄 Evento Supabase:', event);

                    if (event === 'SIGNED_IN' && session) {
                        // 🛑 PREVENCIÓN DE BUCLE:
                        // Solo procesamos el login si el SessionManager NO tiene este usuario aún.
                        const currentUser = window.sessionManager.getUser();

                        // Si no hay usuario en app, O si el email es diferente al de la sesión actual
                        if (!currentUser || currentUser.email !== session.user.email) {
                            console.log('👤 Usuario Google nuevo detectado. Sincronizando...');

                            const sbUser = session.user;
                            const appUser = {
                                id: sbUser.id,
                                email: sbUser.email,
                                name: sbUser.user_metadata?.full_name || sbUser.email.split('@')[0],
                                role: 'student',
                                subscriptionStatus: 'pending',
                                usage_count: 0,
                                max_free_limit: 3
                            };

                            // Esto actualiza el manager, quien a su vez llamará a updateHeaderUI
                            window.sessionManager.login(session.access_token, appUser);
                        } else {
                            console.log('✅ Sesión ya sincronizada. No se requiere acción.');
                        }
                    } else if (event === 'SIGNED_OUT') {
                        if (window.sessionManager.isLoggedIn()) {
                            window.sessionManager.logout();
                        }
                    }
                });
            } catch (err) {
                console.error('❌ Error Supabase:', err);
            }
        }
    }

    // --- PASO 3: Utilidades Globales ---

    // Cierre de modales global
    const closeAllModals = () => {
        document.querySelectorAll('.modal, .pdf-modal').forEach(m => m.style.display = 'none');
    };

    document.body.addEventListener('click', (e) => {
        if (e.target.closest('.modal-close, .pdf-modal-close-btn') || e.target.classList.contains('modal-overlay')) {
            closeAllModals();
        }
    });
});

// --- FUNCIÓN DE UI (SOLO PINTAR) ---
// Esta función es segura, solo manipula el DOM.
function updateHeaderUI(user) {
    const container = document.getElementById('user-session-controls');
    if (!container) return; // Si no existe el header, no hacemos nada

    if (user) {
        // --- MODO: USUARIO LOGUEADO ---
        // Extraemos nombre corto
        const displayName = user.name ? user.name.split(' ')[0] : 'Estudiante';
        const avatarUrl = user.avatar_url || 'https://via.placeholder.com/40';

        // Generamos HTML del menú
        container.innerHTML = `
            <div class="user-menu-container" style="position: relative; display: inline-block;">
                <button id="user-menu-toggle" class="user-menu-toggle" style="background: none; border: none; color: white; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 1rem;">
                    <img src="${avatarUrl}" style="width: 32px; height: 32px; border-radius: 50%; border: 2px solid #2563eb;">
                    <span>Hola, ${displayName}</span>
                    <i class="fas fa-chevron-down" style="font-size: 0.8rem;"></i>
                </button>
                
                <div id="user-menu-dropdown" class="user-menu-dropdown" style="display: none; position: absolute; right: 0; top: 100%; background: #1e293b; border: 1px solid #334155; border-radius: 8px; width: 220px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.5); z-index: 50; margin-top: 8px;">
                    <div style="padding: 12px; border-bottom: 1px solid #334155;">
                        <div style="font-weight: bold; color: white;">${user.name}</div>
                        <div style="font-size: 0.8rem; color: #94a3b8; word-break: break-all;">${user.email}</div>
                         ${user.subscriptionStatus !== 'active' ? `
                            <div style="margin-top: 8px; background: rgba(37, 99, 235, 0.1); color: #60a5fa; padding: 4px; border-radius: 4px; font-size: 0.75rem; text-align: center;">
                                🎁 ${Math.max(0, (user.max_free_limit || 3) - (user.usage_count || 0))} vistas gratis
                            </div>
                        ` : ''}
                    </div>
                    
                    <div style="padding: 8px;">
                        ${user.role === 'admin' ? `
                            <a href="/admin.html" style="display: flex; items-center; gap: 8px; padding: 8px; color: #cbd5e1; text-decoration: none; border-radius: 4px; transition: background 0.2s;">
                                <i class="fas fa-shield-alt"></i> Admin Panel
                            </a>` : ''}
                        
                        <button id="logout-btn-action" style="width: 100%; text-align: left; background: none; border: none; padding: 8px; color: #ef4444; cursor: pointer; display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                            <i class="fas fa-sign-out-alt"></i> Cerrar Sesión
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Listeners del menú (Apertura y Logout)
        const toggleBtn = document.getElementById('user-menu-toggle');
        const dropdown = document.getElementById('user-menu-dropdown');
        const logoutBtn = document.getElementById('logout-btn-action');

        if (toggleBtn && dropdown) {
            toggleBtn.onclick = (e) => {
                e.stopPropagation(); // Evitar que se cierre inmediatamente
                const isVisible = dropdown.style.display === 'block';
                dropdown.style.display = isVisible ? 'none' : 'block';
            };

            // Cerrar menú al hacer clic fuera
            document.addEventListener('click', (e) => {
                if (!container.contains(e.target)) {
                    dropdown.style.display = 'none';
                }
            }, { once: true }); // Listener de un solo uso para eficiencia
        }

        if (logoutBtn) {
            logoutBtn.onclick = () => window.sessionManager.logout();
        }

    } else {
        // --- MODO: INVITADO ---
        container.innerHTML = `
            <div style="display: flex; gap: 10px;">
                <a href="/login.html" class="nav-link" style="color: white; text-decoration: none; padding: 8px 12px;">Iniciar Sesión</a>
                <a href="/register.html" class="btn-primary" style="background: #2563eb; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-weight: 500;">Registrarse</a>
            </div>
        `;
    }
}

// Helpers globales para Chat
window.openChat = () => window.uiManager?.checkAuthAndExecute(() => window.chatComponent?.openAndAsk(''));
window.askAboutCourse = (n) => window.uiManager?.checkAuthAndExecute(() => window.chatComponent?.openAndAsk(`Cuéntame del curso "${n}"`));
window.askAboutTopic = (t) => window.uiManager?.checkAuthAndExecute(() => window.chatComponent?.openAndAsk(`Explícame "${t}"`));