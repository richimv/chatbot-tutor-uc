/**
 * app.js
 * Capa de Presentación - Punto de Entrada y Orquestador de la UI Global.
 * Responsabilidades:
 *  - Configuración e inicialización de endpoints y tracking de analíticas.
 *  - Sincronización resiliente de simulacros offline (Médico y Docente).
 *  - Control de sesión en Header UI y delegación segura de Google OAuth.
 *  - Gestión global de modales, temas y helpers interactivos.
 */

// 1. CONFIGURACIÓN DE LA API DESDE LA CONFIGURACIÓN GLOBAL (AppConfig)
window.API_URL = window.AppConfig?.API_URL || '';

console.log('🌍 Entorno:', (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'Local' : 'Producción', '| API:', window.API_URL);

/**
 * Determina la etiqueta y clase CSS correspondiente al nivel de suscripción del usuario.
 * Función pura y modular para evitar duplicidad lógica en la UI.
 * @param {Object|null} user - Objeto de usuario con subscriptionStatus y subscriptionTier.
 * @returns {{ tierLabel: string, tierClass: string }}
 */
function getTierBadgeConfig(user) {
    if (!user) {
        return { tierLabel: 'Plan Gratuito', tierClass: 'tier-free' };
    }

    const tier = (user.subscriptionTier || 'free').toLowerCase();
    const isActive = user.subscriptionStatus === 'active';

    if (tier === 'advanced' || tier === 'avanzado') {
        if (isActive) {
            return { tierLabel: 'Plan Avanzado', tierClass: 'tier-advanced' };
        }
    }

    if (tier === 'basic' || tier === 'basico') {
        if (isActive) {
            return { tierLabel: 'Plan Básico', tierClass: 'tier-basic' };
        }
    }

    if (user.role === 'admin' || tier === 'admin') {
        return { tierLabel: 'Administrador', tierClass: 'tier-admin' };
    }

    return { tierLabel: 'Plan Gratuito', tierClass: 'tier-free' };
}

/**
 * Sincronización de Simulacros guardados localmente por fallas de conexión.
 */
async function syncPendingSubmissions() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    try {
        const token = localStorage.getItem('authToken');
        if (!token || token === 'null' || token === 'undefined') {
            // No hay sesión activa, abortamos para evitar bucles de redirección 401
            return;
        }

        const pendingKey = 'simulator_pending_submissions';
        let pending = [];
        try {
            pending = JSON.parse(localStorage.getItem(pendingKey) || '[]');
        } catch (e) {
            return;
        }

        if (!Array.isArray(pending) || pending.length === 0) return;

        console.log(`📡 [Sync] Se encontraron ${pending.length} simulacros pendientes de sincronizar.`);

        const remaining = [];
        const apiUrl = window.AppConfig?.API_URL || window.API_URL || '';

        for (const item of pending) {
            try {
                const ctxUpper = (item.context || 'MEDICINA').toUpperCase();
                const syncUrl = ctxUpper === 'EDUCACION'
                    ? `${apiUrl}/api/docente/submit`
                    : `${apiUrl}/api/medico/submit`;

                const response = await window.NetworkService.fetch(syncUrl, {
                    method: 'POST',
                    body: JSON.stringify(item.payload)
                });

                if (response && response.ok) {
                    console.log(`✅ [Sync] Simulacro ${item.quizId} sincronizado exitosamente.`);
                } else {
                    const status = response ? response.status : 'desconocido';
                    console.warn(`⚠️ [Sync] Error del servidor al sincronizar ${item.quizId} (${status}). Se reintentará luego.`);
                    remaining.push(item);
                }
            } catch (err) {
                console.warn(`❌ [Sync] Error de conexión al sincronizar ${item.quizId}. Se reintentará luego.`, err);
                remaining.push(item);
            }
        }

        localStorage.setItem(pendingKey, JSON.stringify(remaining));
    } catch (globalErr) {
        console.warn('⚠️ [Sync] Error general en proceso de sincronización:', globalErr);
    }
}

/**
 * Tracking de Tráfico en Tiempo Real (Heartbeat / Pulso).
 */
function initTrafficTracking() {
    const SESSION_KEY = 'hub_visitor_session_id';
    let sessionId = sessionStorage.getItem(SESSION_KEY);

    if (!sessionId) {
        sessionId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        sessionStorage.setItem(SESSION_KEY, sessionId);
    }

    const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const apiUrl = window.AppConfig?.API_URL || window.API_URL || '';

    const sendPulse = async () => {
        if (typeof navigator !== 'undefined' && !navigator.onLine) return;
        if (!apiUrl) return;

        try {
            const headers = { 'Content-Type': 'application/json' };
            const authToken = typeof localStorage !== 'undefined'
                ? localStorage.getItem('authToken')
                : null;

            // NetworkService añade este header, pero el heartbeat usa fetch nativo
            // para no mostrar toasts ni reintentos globales. Mantenerlo conserva
            // la asociación del pulso con el usuario autenticado en optionalAuth.
            if (authToken && authToken !== 'null' && authToken !== 'undefined') {
                headers.Authorization = `Bearer ${authToken}`;
            }

            // ✅ FIX: Usar fetch nativo en lugar de NetworkService para evitar:
            // 1. Reintentos ruidosos que generan errores CORS en consola durante cold start de Render
            // 2. Toasts de error visibles al usuario por un endpoint secundario de telemetría
            await fetch(`${apiUrl}/api/analytics/pulse`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ sessionId, isMobile }),
                credentials: 'include'
            });
        } catch {
            // Silencioso: el pulse es telemetría no crítica
        }
    };

    // ✅ FIX: Retrasar el primer pulso 5s para dar tiempo al servidor de Render
    // a despertar (cold start) antes de intentar la primera petición CORS.
    setTimeout(sendPulse, 5000);

    // Enviar pulso cada 3 minutos para mantener activo el servidor
    setInterval(sendPulse, 3 * 60 * 1000);
}

/**
 * Inyecta el botón de cambio de tema si no existe en la cabecera.
 */
function ensureThemeToggleButton() {
    const nav = document.querySelector('.header-nav');
    if (nav && !document.getElementById('theme-toggle-btn')) {
        const themeBtn = document.createElement('button');
        themeBtn.type = 'button';
        themeBtn.id = 'theme-toggle-btn';
        themeBtn.className = 'theme-toggle-btn';
        themeBtn.setAttribute('title', 'Cambiar tema');
        themeBtn.setAttribute('aria-label', 'Cambiar tema');
        themeBtn.innerHTML = '<i class="fas fa-sun"></i>';
        nav.prepend(themeBtn);
        if (window.themeManager) {
            window.themeManager.updateToggleButtons();
        }
    }
}

/**
 * Configura el botón "Acceder" de la cabecera para el inicio de sesión directo con Google.
 */
function setupDirectLoginListener() {
    const openBtn = document.getElementById('open-login-modal');
    if (!openBtn) return;

    openBtn.onclick = (e) => {
        e.preventDefault();
        window.triggerGoogleLogin(openBtn);
    };
}

/**
 * Retorna una URL segura y validada para el avatar del usuario con fallback a UI-Avatars.
 * @param {Object|null} user - Datos del usuario.
 * @returns {string} URL segura para el avatar.
 */
function getSafeAvatarUrl(user) {
    if (!user) return `https://ui-avatars.com/api/?name=Estudiante&background=random&color=fff`;
    const displayName = user.name || 'Estudiante';
    const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random&color=fff`;
    
    const candidate = user.avatar_url || user.avatarUrl || user.picture;
    if (!candidate || typeof candidate !== 'string') return fallbackAvatar;
    const trimmed = candidate.trim();
    if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return fallbackAvatar;
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('/')) {
        return fallbackAvatar;
    }
    return trimmed;
}

/**
 * Actualiza la UI de la cabecera (Header) según el estado de la sesión.
 * @param {Object|null} user - Datos del usuario autenticado o null.
 */
function updateHeaderUI(user) {
    ensureThemeToggleButton();
    const container = document.getElementById('user-session-controls');
    if (!container) return;

    if (user) {
        console.log(`👤 Sesión Activa: ${user.email} | Rango: ${user.subscriptionTier} | Status: ${user.subscriptionStatus}`);

        const displayName = user.name || 'Estudiante';
        const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random&color=fff`;
        const avatarUrl = getSafeAvatarUrl(user);
        const { tierLabel, tierClass } = getTierBadgeConfig(user);

        const existingMenu = typeof container.querySelector === 'function' ? container.querySelector('.user-menu-container') : null;
        if (existingMenu) {
            // Actualización granular reactiva (elimina parpadeos y preserva listeners)
            const img = container.querySelector('.user-avatar');
            if (img) {
                img.referrerPolicy = 'no-referrer';
                img.onerror = () => {
                    img.onerror = null;
                    img.src = fallbackAvatar;
                };
                if (img.getAttribute('src') !== avatarUrl) {
                    img.setAttribute('src', avatarUrl);
                }
            }
            const nameEl = container.querySelector('.user-header-name');
            if (nameEl && nameEl.textContent !== displayName) nameEl.textContent = displayName;

            const tierEl = container.querySelector('.user-header-tier');
            if (tierEl) {
                tierEl.className = `user-header-tier ${tierClass}`;
                tierEl.textContent = tierLabel;
            }

            const menuName = container.querySelector('.user-menu-name');
            if (menuName) {
                menuName.innerHTML = `${displayName}`;
            }

            const menuEmail = container.querySelector('.user-menu-email');
            if (menuEmail) menuEmail.textContent = user.email || '';

            // 🛡️ Actualizar reactivamente el enlace al Panel de Gestión para administradores
            const adminItem = container.querySelector('.user-menu-admin-item');
            const menuGroup = container.querySelector('.user-menu-group');
            if (user.role === 'admin') {
                if (!adminItem && menuGroup) {
                    const adminLink = document.createElement('a');
                    adminLink.href = '/admin';
                    adminLink.className = 'user-menu-item user-menu-admin-item';
                    adminLink.innerHTML = '<i class="fas fa-shield-alt"></i> Panel de Gestión';
                    menuGroup.prepend(adminLink);
                }
            } else if (adminItem) {
                adminItem.remove();
            }

            return;
        }

        container.innerHTML = `
            <div class="user-menu-container">
                <button id="user-menu-toggle" class="user-menu-toggle" title="${displayName} (${tierLabel})">
                    <img src="${avatarUrl}" class="user-avatar" alt="Avatar" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='${fallbackAvatar}';">
                    <div class="user-header-meta">
                        <span class="user-header-name">${displayName}</span>
                        <span class="user-header-tier ${tierClass}">${tierLabel}</span>
                    </div>
                    <i class="fas fa-chevron-down user-header-chevron"></i>
                </button>
                <div id="user-menu-dropdown" class="user-menu-dropdown">
                    <div class="user-menu-header">
                        <span class="user-menu-name">
                            ${displayName}
                            <i class="fas fa-check-circle" title="Cuenta verificada via Google" style="color: #10b981; margin-left: 5px; font-size: 0.8rem;"></i>
                        </span>
                        <span class="user-menu-email">${user.email || ''}</span>
                    </div>
                    
                    <div class="user-menu-group">
                        ${user.role === 'admin' ? '<a href="/admin" class="user-menu-item user-menu-admin-item"><i class="fas fa-shield-alt"></i> Panel de Gestión</a>' : ''}
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

        // Eventos del menú desplegable
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

        if (logout) {
            logout.onclick = () => window.handleLogout();
        }
    } else {
        // --- MODO: INVITADO ---
        container.innerHTML = `
            <button id="open-login-modal" class="btn-primary">
                <i class="fas fa-sign-in-alt"></i> <span>Acceder</span>
            </button>
        `;
        setupDirectLoginListener();
    }
}

/**
 * Utilería Global de Autenticación con Google OAuth.
 * Permite disparar el flujo de Google desde cualquier lugar (Header, Modales, Banners).
 * @param {HTMLElement|null} buttonElement - Botón que originó la acción para feedback visual.
 */
window.triggerGoogleLogin = async (buttonElement = null) => {
    console.log('🖱️ [AuthManager] Iniciando flujo Google OAuth...');

    const client = typeof window.getSupabaseClient === 'function'
        ? window.getSupabaseClient()
        : window.supabaseClient;

    if (!client) {
        window.uiManager?.showToast('⏳ El servicio de autenticación se está preparando. Reintenta en breve.');
        return;
    }

    if (buttonElement) {
        if (!buttonElement.dataset.originalHtml) {
            buttonElement.dataset.originalHtml = buttonElement.innerHTML;
        }
        buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        buttonElement.style.pointerEvents = 'none';
        buttonElement.style.opacity = '0.7';
    }

    window._isAuthenticating = true;

    // 🛡️ Normalizar URL de retorno: nunca incluir hash (#) ni fragmentos que violen RFC 6749
    const cleanRedirectTo = window.location.origin + window.location.pathname;

    try {
        const { data, error } = await client.auth.signInWithOAuth({
            provider: 'google',
            options: { 
                redirectTo: cleanRedirectTo,
                queryParams: { prompt: 'select_account' }
            }
        });
        if (error) throw error;
        // 🛡️ Redirección explícita de seguridad por si el entorno no navega automáticamente
        if (data && data.url) {
            window.location.href = data.url;
        }
    } catch (err) {
        window._isAuthenticating = false;
        if (buttonElement && buttonElement.dataset.originalHtml) {
            buttonElement.innerHTML = buttonElement.dataset.originalHtml;
            buttonElement.style.pointerEvents = 'auto';
            buttonElement.style.opacity = '1';
        }
        console.error('❌ Error OAuth:', err.message);
    }
};

/**
 * Función de Cierre de Sesión Centralizada y Resiliente.
 */
window.handleLogout = async () => {
    console.log("🚪 Iniciando cierre de sesión...");
    try {
        if (window.sessionManager) {
            await window.sessionManager.logout();
            console.log("✅ Sesión y memoria purgadas.");
        } else {
            if (window.supabaseClient) await window.supabaseClient.auth.signOut();
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = '/';
        }
    } catch (error) {
        console.warn("⚠️ Error durante el cierre de sesión:", error);
        window.location.href = '/';
    }
};

// Helpers Globales para interacción con el Chatbot
window.openChat = () => window.uiManager?.checkAuthAndExecute(() => window.chatbot?.openAndAsk(''));
window.askAboutCourse = (n) => window.uiManager?.checkAuthAndExecute(() => window.chatbot?.openAndAsk(`Cuéntame del curso "${n}"`));
window.askAboutTopic = (t) => window.uiManager?.checkAuthAndExecute(() => window.chatbot?.openAndAsk(`Explícame "${t}"`));

// 🛡️ Inicialización al cargar el DOM
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 [App] DOM cargado. Inicializando...');

    setupDirectLoginListener();
    initTrafficTracking();
    syncPendingSubmissions();
    window.addEventListener('online', syncPendingSubmissions);

    // Interceptar retorno de pago exitoso
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('payment') === 'success') {
        console.log('🎉 Retorno de Pago Exitoso Detectado.');
        window.history.replaceState({}, document.title, window.location.pathname);

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
                window.uiManager?.showToast('✅ ¡Pago procesado con éxito! Tu cuenta ahora es Premium.');
            }
        }, 1200);
    }

    // Tracking automático de vistas (Career / Course / Topic)
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

    // Inicialización de Componentes Globales
    ensureThemeToggleButton();

    if (typeof ChatComponent !== 'undefined') {
        window.chatbot = new ChatComponent();
    }

    if (typeof ConfirmationModal !== 'undefined') {
        window.confirmationModal = new ConfirmationModal();
    }

    // Gestión de Sesión
    if (window.sessionManager) {
        window.sessionManager.onStateChange(updateHeaderUI);
        window.sessionManager.initialize();
    }

    if (document.querySelector('.admin-container')) {
        console.log('⚙️ Página de admin detectada.');
    }

    // Listener global para cierre de modales
    const closeAllModals = () => {
        document.querySelectorAll('.modal, .pdf-modal').forEach(m => m.style.display = 'none');
    };

    document.body.addEventListener('click', (event) => {
        if (event.target.closest('.modal-close, .pdf-modal-close-btn') || event.target.classList.contains('modal-overlay')) {
            closeAllModals();
        }
    });
});

// Resetear estados de botones y refrescar vidas al volver a la página (evita spinners infinitos y datos desactualizados)
window.addEventListener('pageshow', () => {
    console.log('🔄 [App] Página mostrada. Reseteando estados de botones y actualizando sesión...');
    ensureThemeToggleButton();
    if (window.sessionManager) {
        window.sessionManager.refreshUser().catch(() => {});
    }
    
    const restoreButtons = () => {
        document.querySelectorAll('[data-original-html]').forEach(btn => {
            btn.innerHTML = btn.dataset.originalHtml;
            btn.style.pointerEvents = 'auto';
            btn.style.opacity = '1';
        });
        window._isAuthenticating = false;
    };

    restoreButtons();
    setTimeout(restoreButtons, 200); 
});

// Exportación modular para pruebas unitarias
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getTierBadgeConfig,
        syncPendingSubmissions,
        initTrafficTracking,
        ensureThemeToggleButton,
        setupDirectLoginListener,
        updateHeaderUI
    };
}
