/**
 * app.js
 * Punto de entrada principal.
 * Versión corregida: Soluciona error de Avatar y Logout en bucle.
 */

// ✅ 1. CONFIGURACIÓN INTELIGENTE DE LA API
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BACKEND_URL = isLocal ? 'http://localhost:3000' : 'https://tutor-ia-backend.onrender.com';
window.API_URL = BACKEND_URL;

console.log('🌍 Entorno:', isLocal ? 'Local' : 'Producción', '| API:', window.API_URL);

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 DOM completamente cargado. Inicializando componentes...');

    // ✅ TRACKING AUTOMÁTICO DE VISTAS (Career / Course)
    try {
        if (window.AnalyticsApiService) {
            const path = window.location.pathname;
            const params = new URLSearchParams(window.location.search);
            const id = params.get('id');

            if (id) {
                if (path.includes('career.html')) {
                    window.AnalyticsApiService.recordView('career', id);
                    console.log('📊 Vista registrada: Carrera', id);
                } else if (path.includes('course.html')) {
                    window.AnalyticsApiService.recordView('course', id);
                    console.log('📊 Vista registrada: Curso', id);
                } else if (path.includes('topic.html')) {
                    window.AnalyticsApiService.recordView('topic', id);
                    console.log('📊 Vista registrada: Tema', id);
                }
            }
        }
    } catch (err) {
        console.warn('⚠️ Error en tracking automático:', err);
    }

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
        if (window.supabaseClient) {
            try {
                // Escuchamos eventos de Login (Google o Email)
                window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
                    console.log('🔄 Estado Auth Supabase:', event);

                    if (event === 'SIGNED_IN' && session) {
                        // 🛑 FRENO DE MANO (ANTI-BUCLE):
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

                            // Guardamos en el Manager
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

    // ✅ FIX: Restaurar listener global de cierre de modales
    document.body.addEventListener('click', (event) => {
        if (event.target.closest('.modal-close, .pdf-modal-close-btn') || event.target.classList.contains('modal-overlay')) {
            closeAllModals();
        }
    });

    // ✅ KEEP-ALIVE: Ping al servidor cada 5 minutos para evitar que Render se duerma
    setInterval(() => {
        fetch('/health')
            .then(res => {
                if (!res.ok) console.warn('⚠️ Keep-alive ping failed');
            })
            .catch(err => console.warn('⚠️ Keep-alive error:', err));
    }, 5 * 60 * 1000); // 5 minutos
});

// ✅ LÓGICA DEL BOTÓN "HUB QUIZ ARENA"
const btnQuiz = document.getElementById('btn-quiz-arena');
if (btnQuiz) {
    btnQuiz.addEventListener('click', () => {
        // ✅ STANDARD AUTH CHECK: Use UI Manager to handle Auth or Show Paywall Modal
        if (window.uiManager) {
            window.uiManager.checkAuthAndExecute(() => {
                console.log('🎮 Iniciando Hub Quiz Arena...');
                window.location.href = '/quiz.html';
            });
        } else {
            // Fallback if UIManager not loaded
            if (!window.sessionManager || !window.sessionManager.isLoggedIn()) {
                window.location.href = '/login.html';
            } else {
                window.location.href = '/quiz.html';
            }
        }
    });
}

// ✅ FUNCIÓN DE UI (Solo pinta, no modifica datos para evitar bucles)
function updateHeaderUI(user) {
    const container = document.getElementById('user-session-controls');
    if (!container) return;

    if (user) {
        // --- MODO: USUARIO LOGUEADO ---
        // 🔧 FIX: Usamos ui-avatars.com porque via.placeholder.com suele fallar
        const avatarUrl = user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&color=fff`;
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
                    <!-- ✅ NUEVO: Enlace a Cambiar Contraseña -->
                    <a href="/change-password.html" style="display: block; color: white; text-decoration: none; padding: 5px 0;"><i class="fas fa-key"></i> Cambiar Contraseña</a>
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

        // 🔧 FIX: Usamos la función robusta handleLogout
        if (logout) logout.onclick = () => window.handleLogout();

    } else {
        // --- MODO: INVITADO ---
        container.innerHTML = `
            <a href="/login.html" class="nav-link"><i class="fas fa-sign-in-alt"></i> <span>Ingresar</span></a>
            <a href="/register.html" class="btn-primary"><i class="fas fa-user-plus"></i> <span>Registrarse</span></a>
        `;
    }
}

// ✅ FUNCIÓN DE LOGOUT ROBUSTA (Evita bucles y limpia todo)
window.handleLogout = async () => {
    console.log("🚪 Iniciando cierre de sesión...");

    try {
        // 1. Cerrar sesión en Supabase explícitamente
        if (window.supabaseClient) {
            await window.supabaseClient.auth.signOut();
        }
    } catch (error) {
        console.warn("⚠️ Error al cerrar sesión en Supabase:", error);
    }

    // 2. Limpiar SessionManager y LocalStorage
    if (window.sessionManager) {
        window.sessionManager.logout();
    }
    localStorage.clear();
    sessionStorage.clear();

    // 3. Redirigir al inicio
    window.location.href = '/index.html';
};

// Helpers Globales
window.openChat = () => window.uiManager?.checkAuthAndExecute(() => window.chatComponent?.openAndAsk(''));
window.askAboutCourse = (n) => window.uiManager?.checkAuthAndExecute(() => window.chatComponent?.openAndAsk(`Cuéntame del curso "${n}"`));
window.askAboutTopic = (t) => window.uiManager?.checkAuthAndExecute(() => window.chatComponent?.openAndAsk(`Explícame "${t}"`));