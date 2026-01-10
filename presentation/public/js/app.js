/**
 * app.js
 * Punto de entrada principal.
 * Versión corregida: Integra Google Auth sin bucles infinitos.
 */

// ✅ 1. CONFIGURACIÓN INTELIGENTE DE LA API
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BACKEND_URL = isLocal ? 'http://localhost:3000' : 'https://tutor-ia-backend.onrender.com';
window.API_URL = BACKEND_URL;

console.log('🌍 Entorno:', isLocal ? 'Local' : 'Producción', '| API:', window.API_URL);

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 DOM completamente cargado. Inicializando componentes...');

    // --- PASO 1: Componentes Globales ---
    if (typeof ChatComponent !== 'undefined') window.chatComponent = new ChatComponent();

    if (typeof ConfirmationModal !== 'undefined' && document.getElementById('confirmation-modal')) {
        window.confirmationModal = new ConfirmationModal();
    }

    // --- PASO 2: Gestión de Sesión ---
    if (window.sessionManager) {
        // Suscribir la UI a cambios (Para pintar el header)
        window.sessionManager.onStateChange(updateHeaderUI);

        // Inicializar sesión guardada (si existe token antiguo)
        await window.sessionManager.initialize();

        // ✅ PASO 3: INTEGRACIÓN GOOGLE AUTH (SUPABASE)
        // Esta es la pieza que faltaba para detectar el regreso de Google.
        if (typeof supabase !== 'undefined' && window.AppConfig?.SUPABASE_URL) {
            try {
                const { createClient } = supabase;
                const sb = createClient(window.AppConfig.SUPABASE_URL, window.AppConfig.SUPABASE_ANON_KEY);

                // Escuchamos eventos de Login (Google o Email)
                sb.auth.onAuthStateChange(async (event, session) => {
                    console.log('🔄 Estado Auth Supabase:', event);

                    if (event === 'SIGNED_IN' && session) {
                        // 🛑 FRENO DE MANO (ANTI-BUCLE):
                        // Solo procesamos si el SessionManager NO tiene usuario todavía
                        // o si el usuario que llega es diferente al que tenemos.
                        const currentUser = window.sessionManager.getUser();

                        if (!currentUser || currentUser.email !== session.user.email) {
                            console.log('👤 Usuario detectado (Google/Auth), sincronizando...');

                            // Preparamos los datos para la app
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

                            // Guardamos en el Manager (Esto actualizará el Header automáticamente)
                            window.sessionManager.login(session.access_token, appUser);
                        }
                    } else if (event === 'SIGNED_OUT') {
                        if (window.sessionManager.isLoggedIn()) {
                            window.sessionManager.logout();
                        }
                    }
                });
            } catch (err) {
                console.error('❌ Error inicializando Supabase Client:', err);
            }
        }
    }

    // --- Helpers de Admin y Modals ---
    if (document.querySelector('.admin-container')) console.log('⚙️ Página de admin detectada.');

    const closeAllModals = () => {
        document.querySelectorAll('.modal, .pdf-modal').forEach(m => m.style.display = 'none');
    };

    document.body.addEventListener('click', (event) => {
        if (event.target.closest('.modal-close, .pdf-modal-close-btn') || event.target.classList.contains('modal-overlay')) {
            closeAllModals();
        }
    });
});

// ✅ FUNCIÓN DE UI (Solo pinta, no modifica datos para evitar bucles)
function updateHeaderUI(user) {
    const container = document.getElementById('user-session-controls');
    if (!container) return;

    if (user) {
        // --- MODO: USUARIO LOGUEADO ---
        const avatarUrl = user.avatar_url || 'https://via.placeholder.com/40';
        const displayName = user.name || 'Estudiante';

        container.innerHTML = `
            <div class="user-menu-container" style="position: relative; display: inline-block;">
                <button id="user-menu-toggle" class="user-menu-toggle" style="background: none; border: none; color: white; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                    <img src="${avatarUrl}" style="width: 35px; height: 35px; border-radius: 50%; border: 2px solid #2563eb;">
                    <span style="font-weight: 500;">${displayName}</span>
                    <i class="fas fa-chevron-down" style="font-size: 0.8em;"></i>
                </button>
                <div id="user-menu-dropdown" style="display: none; position: absolute; right: 0; top: 100%; background: #1e293b; border: 1px solid #334155; border-radius: 8px; width: 200px; padding: 10px; z-index: 1000; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
                    <div style="padding-bottom: 8px; border-bottom: 1px solid #334155; margin-bottom: 8px;">
                        <div style="font-size: 0.85em; color: #94a3b8;">${user.email}</div>
                         ${user.subscriptionStatus !== 'active' ? `
                            <div style="font-size: 0.75em; color: #60a5fa; margin-top: 4px;">
                                🎁 Vistas gratis: ${Math.max(0, (user.max_free_limit || 3) - (user.usage_count || 0))}
                            </div>` : ''}
                    </div>
                    ${user.role === 'admin' ? '<a href="/admin.html" style="display: block; color: white; text-decoration: none; padding: 5px 0;"><i class="fas fa-shield-alt"></i> Admin</a>' : ''}
                    <button id="logout-btn-action" style="background: none; border: none; color: #ef4444; cursor: pointer; width: 100%; text-align: left; padding: 5px 0;"><i class="fas fa-sign-out-alt"></i> Cerrar Sesión</button>
                </div>
            </div>
        `;

        // Eventos del Menú
        const toggle = document.getElementById('user-menu-toggle');
        const dropdown = document.getElementById('user-menu-dropdown');
        const logout = document.getElementById('logout-btn-action');

        if (toggle && dropdown) {
            toggle.onclick = (e) => {
                e.stopPropagation();
                dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
            };
            document.addEventListener('click', (e) => {
                if (!container.contains(e.target)) dropdown.style.display = 'none';
            }, { once: true });
        }
        if (logout) logout.onclick = () => window.sessionManager.logout();

    } else {
        // --- MODO: INVITADO ---
        container.innerHTML = `
            <a href="/login.html" class="nav-link">Iniciar Sesión</a>
            <a href="/register.html" class="btn-primary">Registrarse</a>
        `;
    }
}

// Helpers Globales
window.openChat = () => window.uiManager?.checkAuthAndExecute(() => window.chatComponent?.openAndAsk(''));
window.askAboutCourse = (n) => window.uiManager?.checkAuthAndExecute(() => window.chatComponent?.openAndAsk(`Cuéntame del curso "${n}"`));
window.askAboutTopic = (t) => window.uiManager?.checkAuthAndExecute(() => window.chatComponent?.openAndAsk(`Explícame "${t}"`));