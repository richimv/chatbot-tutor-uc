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

        // Inicializar sesión (Limpia URL y recupera perfil si existe token)
        await window.sessionManager.initialize();
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
        // ✅ SENIOR FIX: Si entramos, cerramos cualquier modal de login que haya quedado abierta
        const loginOverlay = document.getElementById('login-modal-overlay');
        if (loginOverlay) loginOverlay.style.display = 'none';
        
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
                        <span class="user-menu-name">
                            ${displayName}
                            <i class="fas fa-check-circle" title="Cuenta verificada via Google" style="color: #10b981; margin-left: 5px; font-size: 0.8rem;"></i>
                        </span>
                        <span class="user-menu-email">${user.email}</span>
                         ${user.subscriptionStatus !== 'active' ? `
                            <div class="user-usage-badge">
                                🎁 Vistas gratis: ${Math.max(0, (user.max_free_limit || 50) - (user.usage_count || 0))}
                            </div>` : ''}
                    </div>
                    
                    <div class="user-menu-group">
                        ${user.role === 'admin' ? '<a href="/admin" class="user-menu-item"><i class="fas fa-shield-alt"></i> Admin</a>' : ''}
                        <a href="/profile" class="user-menu-item"><i class="fas fa-user-cog"></i> Mi Perfil</a>
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
            <button id="open-login-modal" class="btn-primary" style="padding: 0.6rem 1.5rem; border-radius: 12px; font-weight: 700; display: flex; align-items: center; gap: 8px; cursor: pointer; border: none;">
                <i class="fas fa-sign-in-alt"></i> <span>Acceder</span>
            </button>
        `;

        // ✅ Crear modal de login (reutiliza la UI premium de login.html)
        if (!document.getElementById('login-modal-overlay')) {
            const modalHTML = `
                <div id="login-modal-overlay" style="
                    display: none; position: fixed; inset: 0; z-index: 2147483647;
                    background: rgba(0,0,0,0.75); backdrop-filter: blur(8px);
                    align-items: center; justify-content: center;
                ">
                    <div style="
                        width: 100%; max-width: 440px; background: #121212;
                        border: 1px solid rgba(255,255,255,0.1); border-radius: 28px;
                        padding: 3rem 2.5rem; text-align: center;
                        box-shadow: 0 20px 50px rgba(0,0,0,0.5);
                        animation: fadeInScale 0.4s cubic-bezier(0.16,1,0.3,1);
                        position: relative; margin: 1rem;
                    ">
                        <button id="login-modal-close" style="
                            position: absolute; top: 16px; right: 16px; background: none;
                            border: none; color: #a1a1aa; font-size: 1.5rem; cursor: pointer;
                            width: 36px; height: 36px; display: flex; align-items: center;
                            justify-content: center; border-radius: 50%;
                            transition: all 0.2s;
                        " onmouseover="this.style.color='#fff';this.style.background='rgba(255,255,255,0.1)'"
                           onmouseout="this.style.color='#a1a1aa';this.style.background='none'">
                            <i class="fas fa-times"></i>
                        </button>

                        <div style="margin-bottom: 2rem;">
                            <img src="/assets/logo.png" alt="Hub Academia" style="
                                width: 80px; height: 80px; object-fit: contain;
                                filter: drop-shadow(0 0 15px rgba(59,130,246,0.3));
                            ">
                        </div>

                        <h2 style="font-size: 2.2rem; font-weight: 800; margin: 0 0 1rem 0; color: #fff; letter-spacing: -0.02em;">
                            ¡Bienvenido!
                        </h2>
                        <p style="color: #a1a1aa; font-size: 1.05rem; line-height: 1.6; margin-bottom: 2.5rem; padding: 0 10px;">
                            Accede a tu cuenta para continuar tu aprendizaje con Hub Academia.
                        </p>

                        <button id="modal-google-login" style="
                            width: 100%; display: flex; align-items: center; justify-content: center;
                            gap: 14px; background: #fff; color: #1a1a1a; border: none;
                            padding: 1rem; border-radius: 100px; font-size: 1.05rem; font-weight: 700;
                            cursor: pointer; transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
                            box-shadow: 0 4px 12px rgba(255,255,255,0.1);
                        " onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 20px rgba(255,255,255,0.2)'"
                           onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 4px 12px rgba(255,255,255,0.1)'">
                            <img src="https://fonts.gstatic.com/s/i/productlogos/googleg/v6/24px.svg" alt="Google" style="width: 22px; height: 22px;">
                            Continuar con Google
                        </button>

                        <div style="margin-top: 2.5rem; font-size: 0.85rem; color: #a1a1aa; line-height: 1.5;">
                            Al crear una cuenta, acepto los
                            <a href="/terms" style="color: #fff; text-decoration: none; font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.2);">Términos de Servicio</a> y la
                            <a href="/privacy" style="color: #fff; text-decoration: none; font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.2);">Política de Privacidad</a> de Hub Academia
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);

            // Eventos de la modal
            const overlay = document.getElementById('login-modal-overlay');
            const closeBtn = document.getElementById('login-modal-close');
            const googleBtn = document.getElementById('modal-google-login');

            // Cerrar con X o clic fuera
            closeBtn.addEventListener('click', () => { overlay.style.display = 'none'; });
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) overlay.style.display = 'none';
            });

            // ✅ Botón "Continuar con Google" → OAuth directo
            googleBtn.addEventListener('click', async () => {
                if (window.supabaseClient) {
                    // 🔄 Feedback Visual: Cambiar estado del botón
                    const originalContent = googleBtn.innerHTML;
                    googleBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Iniciando sesión...';
                    googleBtn.style.pointerEvents = 'none';
                    googleBtn.style.opacity = '0.7';

                    // 🛡️ Flag: evita modales durante la redirección OAuth
                    window._isAuthenticating = true;
                    try {
                        const { error } = await window.supabaseClient.auth.signInWithOAuth({
                            provider: 'google',
                            options: { redirectTo: window.location.origin + '/' }
                        });
                        if (error) throw error;
                    } catch (err) {
                        window._isAuthenticating = false;
                        googleBtn.innerHTML = originalContent;
                        googleBtn.style.pointerEvents = 'auto';
                        googleBtn.style.opacity = '1';
                        console.error('❌ Error OAuth:', err);
                    }
                }
            });
        }

        // Abrir modal al hacer clic en "Acceder"
        document.getElementById('open-login-modal').addEventListener('click', () => {
            document.getElementById('login-modal-overlay').style.display = 'flex';
        });
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