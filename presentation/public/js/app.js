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

// ✅ NUEVO: Tracking de Tráfico en Tiempo Real
function initTrafficTracking() {
    const SESSION_KEY = 'hub_visitor_session_id';
    let sessionId = sessionStorage.getItem(SESSION_KEY);
    
    if (!sessionId) {
        sessionId = crypto.randomUUID();
        sessionStorage.setItem(SESSION_KEY, sessionId);
    }

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    const sendPulse = async () => {
        // ✅ MEJORA: No intentar si estamos offline
        if (!navigator.onLine) return;

        try {
            await fetch(`${window.API_URL}/api/analytics/pulse`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, isMobile })
            });
        } catch (err) {
            // Silencioso para no ensuciar la consola del usuario
        }
    };

    // Enviar primer pulso inmediato
    sendPulse();

    // Enviar pulso cada 2.5 minutos (para estar dentro del margen de 5 min del servidor)
    setInterval(sendPulse, 2.5 * 60 * 1000);
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 DOM completamente cargado. Inicializando componentes...');
    
    // Inicializar tracking de tráfico
    initTrafficTracking();

    // ✅ 0. INTERCEPTAR RECOVERY LINK (Recuperación de Contraseña)
    if (window.location.hash && window.location.hash.includes('type=recovery')) {
        console.log('🔑 Link de recuperación detectado. Redirigiendo a update-password...');
        window.location.href = '/update-password' + window.location.hash;
        return; // Detener inicialización normal para evitar logueo silencioso
    }

    // ✅ 0.5 INTERCEPTAR RETORNO DE PAGO EXITOSO
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('payment') === 'success') {
        console.log('🎉 Retorno de Pago Exitoso Detectado.');

        // Limpiamos la URL por estética sin recargar la página
        window.history.replaceState({}, document.title, window.location.pathname);

        // Obligamos al App a volver a descargar sus privilegios (Pasa de Pending a Active)
        setTimeout(async () => {
            if (window.sessionManager && window.sessionManager.isLoggedIn()) {
                await window.sessionManager.validateSession();
            }
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    title: '<span style="color: #ffd700; font-weight:800;">¡Pago Procesado con Éxito!</span>',
                    html: '<p style="color:#cbd5e1;">Tu Cuenta se ha actualizado a Premium. Tus limites se han restablecido. ¡A estudiar sin límites!</p>',
                    icon: 'success',
                    background: 'rgba(20,20,20,0.95)',
                    confirmButtonText: 'Genial, gracias'
                });
            } else {
                alert('¡Pago procesado con éxito! Tu cuenta ahora es Premium.');
            }
        }, 1200); // Pequeño delay de 1.2s para dar tiempo al Webhook a escribir en la DB
    }

    // ✅ TRACKING AUTOMÁTICO DE VISTAS (Career / Course)
    try {
        if (window.AnalyticsApiService) {
            const path = window.location.pathname;
            const params = new URLSearchParams(window.location.search);
            const id = params.get('id');

            if (id) {
                if (path.includes('career')) {
                    window.AnalyticsApiService.recordView('career', id);
                    console.log('📊 Vista registrada: Carrera', id);
                } else if (path.includes('course')) {
                    window.AnalyticsApiService.recordView('course', id);
                    console.log('📊 Vista registrada: Curso', id);
                } else if (path.includes('topic')) {
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
                                max_free_limit: 50
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
    // ✅ NOTA: El sistema de KEEP-ALIVE anterior ha sido reemplazado por initTrafficTracking(),
    // que envía pulsos cada 2.5 minutos, manteniendo el servidor activo de forma más eficiente.
});

// ✅ LÓGICA DEL BOTÓN "HUB QUIZ ARENA"
const btnQuiz = document.getElementById('btn-quiz-arena');
if (btnQuiz) {
    btnQuiz.addEventListener('click', () => {
        // ✅ STANDARD AUTH CHECK: Use UI Manager to handle Auth or Show Paywall Modal
        if (window.uiManager) {
            window.uiManager.checkAuthAndExecute(() => {
                console.log('🎮 Iniciando Hub Quiz Arena...');
                window.location.href = '/quiz';
            });
        } else {
            // Fallback if UIManager not loaded
            if (!window.sessionManager || !window.sessionManager.isLoggedIn()) {
                window.location.href = '/login';
            } else {
                window.location.href = '/quiz';
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
            <div class="user-menu-container">
                <button id="user-menu-toggle" class="user-menu-toggle">
                    <img src="${avatarUrl}" class="user-avatar">
                    <i class="fas fa-chevron-down"></i>
                </button>
                <div id="user-menu-dropdown" class="user-menu-dropdown">
                    <div class="user-menu-header">
                        <span class="user-menu-name">${displayName}</span>
                        <span class="user-menu-email">${user.email}</span>
                         ${user.subscriptionStatus !== 'active' ? `
                            <div class="user-usage-badge">
                                🎁 Vistas gratis: ${Math.max(0, (user.max_free_limit || 50) - (user.usage_count || 0))}
                            </div>` : ''}
                    </div>
                    
                    <div class="user-menu-group">
                        ${user.role === 'admin' ? '<a href="/admin" class="user-menu-item"><i class="fas fa-shield-alt"></i> Admin</a>' : ''}
                        <a href="/profile" class="user-menu-item"><i class="fas fa-user-cog"></i> Mi Perfil</a>
                        <a href="/change-password" class="user-menu-item"><i class="fas fa-key"></i> Cambiar Contraseña</a>
                    </div>

                    <div class="user-menu-group">
                        <button id="logout-btn-action" class="user-menu-item logout-item">
                            <i class="fas fa-sign-out-alt"></i> Cerrar Sesión
                        </button>
                    </div>
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
            <a href="/login" class="nav-link"><i class="fas fa-sign-in-alt"></i> <span>Ingresar</span></a>
            <a href="/register" class="btn-primary"><i class="fas fa-user-plus"></i> <span>Registrarse</span></a>
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
    window.location.href = '/';
};

// Helpers Globales
window.openChat = () => window.uiManager?.checkAuthAndExecute(() => window.chatComponent?.openAndAsk(''));
window.askAboutCourse = (n) => window.uiManager?.checkAuthAndExecute(() => window.chatComponent?.openAndAsk(`Cuéntame del curso "${n}"`));
window.askAboutTopic = (t) => window.uiManager?.checkAuthAndExecute(() => window.chatComponent?.openAndAsk(`Explícame "${t}"`));