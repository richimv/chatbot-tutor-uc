class UIManager {
    constructor() {
        this.modalId = 'auth-prompt-modal';
        this.injectModalHTML();
        // ✅ NUEVO: Inyectar Modal de Video
        this.injectVideoModalHTML();
        // ✅ NUEVO: Registro seguro de URLs para ofuscación
        this.materialRegistry = new Map();

        // ✅ NUEVO: Verificar estado de pago al cargar
        this.checkPaymentStatus();
    }

    checkPaymentStatus() {
        const urlParams = new URLSearchParams(window.location.search);
        const status = urlParams.get('payment');

        if (status === 'success') {
            window.history.replaceState({}, document.title, window.location.pathname);
            this.showPremiumSuccessModal();
        } else if (status === 'failure') {
            this.showToast('❌ Hubo un problema con el pago. Inténtalo de nuevo.');
        }
    }

    showPremiumSuccessModal() {
        const modalId = 'premium-success-modal';
        if (document.getElementById(modalId)) return;

        const modalHTML = `
            <div id="${modalId}" class="modal auth-prompt-modal" style="display:flex; backdrop-filter: blur(8px); background: rgba(15, 23, 42, 0.9); z-index: 10001; align-items: center; justify-content: center;">
                <div class="modal-content" style="
                    background: linear-gradient(145deg, #0f172a, #1e293b); 
                    border: 1px solid rgba(255, 215, 0, 0.3); 
                    box-shadow: 0 0 50px rgba(255, 215, 0, 0.2); 
                    width: 90%;
                    max-width: 450px; 
                    border-radius: 16px;
                    font-family: 'Inter', sans-serif;
                    text-align: center;
                ">
                    <div style="padding: 30px;">
                        <div style="
                            width: 70px; height: 70px; 
                            background: rgba(255, 215, 0, 0.1); 
                            border-radius: 50%; 
                            display: flex; align-items: center; justify-content: center; 
                            margin: 0 auto 20px auto;
                            border: 1px solid rgba(255, 215, 0, 0.4);
                            box-shadow: 0 0 30px rgba(255, 215, 0, 0.2);
                        ">
                            <i class="fas fa-crown" style="font-size: 2rem; color: #ffd700;"></i>
                        </div>
                        
                        <h2 style="
                            background: linear-gradient(90deg, #fbbf24, #d97706); 
                            -webkit-background-clip: text; 
                            -webkit-text-fill-color: transparent; 
                            font-weight: 800;
                            font-size: 1.5rem;
                            margin: 0 0 10px 0;
                        ">
                            ¡Suscripción Activada!
                        </h2>
                        
                        <p style="color: #cbd5e1; font-size: 1rem; line-height: 1.5; margin-bottom: 25px;">
                            Gracias por unirte a la comunidad Premium. <br>
                            Ahora tienes <strong>Acceso Ilimitado</strong> a todos los recursos y al Tutor IA.
                        </p>

                        <button onclick="document.getElementById('${modalId}').remove()" style="
                            background: linear-gradient(90deg, #f59e0b, #d97706); 
                            color: #fff; 
                            font-weight: 700; 
                            border: none;
                            padding: 12px 30px; 
                            font-size: 1rem;
                            border-radius: 50px;
                            box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3);
                            cursor: pointer;
                            transition: transform 0.2s;
                        " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                            ¡Comenzar! 🚀
                        </button>
                    </div>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Confetti effect (simulated via toast for now, or just the modal is enough)
        if (window.confetti) window.confetti();
    }

    /**
     * Registra una URL asociada a un ID de material para no exponerla en el HTML.
     */
    registerMaterial(id, url) {
        if (id && url) {
            this.materialRegistry.set(String(id), url);
        }
    }

    /**
     * Intenta acceder a un recurso protegido (Libro, Video, Artículo).
     * Valida límites de uso en el backend.
     * @param {string} id - ID del recurso.
     * @param {string} type - Tipo ('video', 'book', 'article').
     * @param {string} videoContainerId - (Opcional) ID del contenedor DOM para inyectar video.
     */
    async unlockResource(id, type = 'book', videoContainerId = null) {
        this.checkAuthAndExecute(async () => {
            const url = this.materialRegistry.get(String(id));
            if (!url) {
                console.error('Material no encontrado o acceso denegado.');
                return;
            }

            try {
                // ✅ Verificar límite de uso en el backend
                const token = localStorage.getItem('authToken');
                const response = await fetch(`${window.AppConfig.API_URL}/api/usage/verify`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ resource_id: id })
                });

                const data = await response.json();

                if (response.ok && data.allowed) {
                    // ✅ Éxito: Acceso concedido

                    // 1. Actualizar estado local si es Freemium
                    if (data.plan === 'free' && window.sessionManager) {
                        const user = window.sessionManager.getUser();
                        if (user) {
                            user.usageCount = data.usage; // Sincronizar
                            window.sessionManager.notifyStateChange(); // Actualizar UI

                            // 2. Feedback Visual (Toast)
                            this.showToast(`🔓 Desbloqueado. Te quedan ${data.limit - data.usage} pases.`);
                        }
                    }

                    // 👉 ACCIÓN SEGÚN TIPO
                    if (type === 'video') {
                        this.openVideoModal(url, data.title || 'Video');
                    } else {
                        // Artículos y Libros se abren en nueva pestaña
                        window.open(url, '_blank');
                    }

                    // Tracking
                    if (window.AnalyticsApiService) {
                        window.AnalyticsApiService.recordView(type, id);
                    }

                } else if (response.status === 403) {
                    // ⛔ Límite alcanzado
                    this.showPaywallModal();
                } else {
                    console.error('Error verificando acceso:', data);
                    alert('Error verificando acceso. Intenta nuevamente.');
                }
            } catch (error) {
                console.error('Error de red:', error);
            }
        });
    }

    /**
     * Alias para compatibilidad con código existente de libros.
     */
    openMaterial(id) {
        this.unlockResource(id, 'book');
    }

    /**
     * Inicia el Modal de Video.
     */
    openVideoModal(url, title) {
        let videoId = '';
        try {
            const urlObj = new URL(url);
            if (urlObj.hostname.includes('youtube.com')) {
                videoId = urlObj.searchParams.get('v');
            } else if (urlObj.hostname.includes('youtu.be')) {
                videoId = urlObj.pathname.slice(1);
            }
        } catch (e) { console.warn('Invalid Video URL'); }

        if (!videoId) {
            window.open(url, '_blank');
            return;
        }

        const modal = document.getElementById('video-player-modal');
        const container = document.getElementById('video-modal-content-area');
        const titleEl = document.getElementById('video-modal-title-text');

        if (modal && container) {
            container.innerHTML = `
                <div class="video-container-responsive">
                    <iframe 
                        src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0" 
                        title="${title}" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowfullscreen>
                    </iframe>
                </div>
            `;
            if (titleEl) titleEl.innerText = title;
            modal.style.display = 'flex';

            // ✅ OPTIMIZACIÓN MÓVIL: Solicitar Fullscreen Automático
            // Esto ayuda a que los celulares giren o ocupen toda la pantalla.
            if (window.innerWidth < 768) {
                const videoContainer = container.querySelector('.video-container-responsive');
                if (videoContainer) {
                    try {
                        if (videoContainer.requestFullscreen) videoContainer.requestFullscreen();
                        else if (videoContainer.webkitRequestFullscreen) videoContainer.webkitRequestFullscreen(); // Safari
                        else if (videoContainer.msRequestFullscreen) videoContainer.msRequestFullscreen(); // IE/Edge
                    } catch (e) { console.warn('Fullscreen triggered automatically blocked by browser policy'); }
                }
            }
        }
    }

    closeVideoModal() {
        const modal = document.getElementById('video-player-modal');
        const container = document.getElementById('video-modal-content-area');
        if (modal) {
            modal.style.display = 'none';
            // Limpiar iframe para detener el audio
            if (container) container.innerHTML = '';
        }
    }

    /**
     * Inyecta el HTML del modal de video si no existe.
     */
    injectVideoModalHTML() {
        if (document.getElementById('video-player-modal')) return;

        const modalHTML = `
            <div id="video-player-modal" class="modal" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.9); z-index: 10001; align-items: center; justify-content: center; backdrop-filter: blur(8px);">
                <div class="modal-content" style="background: transparent; border: none; box-shadow: none; width: 95%; max-width: 900px; position: relative;">
                    <div class="modal-header" style="border: none; padding: 0; justify-content: flex-end; position: absolute; top: -40px; right: 0;">
                        <button class="modal-close-btn" onclick="window.uiManager.closeVideoModal()" style="color: white; font-size: 2.5rem; background: none; border: none; cursor: pointer;">&times;</button>
                    </div>
                    <div class="modal-body" style="overflow: visible; padding: 0;">
                        <div id="video-modal-content-area"></div>
                        <h3 id="video-modal-title-text" class="video-modal-title" style="color: white; text-align: center; margin-top: 15px; font-weight: 500;"></h3>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }


    /**
     * ✅ Valida límites freemium para acciones secundarias (Citar, Guardar, Favorito).
     * Retorna FALSE si el usuario está bloqueado, TRUE si puede proceder.
     */
    validateFreemiumAction(event) {
        if (!window.sessionManager) return true;
        const user = window.sessionManager.getUser();

        // Si no hay usuario, dejamos pasar (el checkAuth posterior lo atrapará)
        if (!user) return true;

        // Validar campos camelCase o snake_case por robustez
        const status = user.subscriptionStatus || user.subscription_status;
        const usage = user.usageCount !== undefined ? user.usageCount : (user.usage_count || 0);
        const limit = user.maxFreeLimit !== undefined ? user.maxFreeLimit : (user.max_free_limit || 3);

        if (status === 'pending' && usage >= limit) {
            if (event) {
                event.preventDefault();
                event.stopPropagation(); // Detener propagación a listeners globales
            }
            this.showPaywallModal();
            return false;
        }
        return true;
    }

    showPaywallModal() {
        const modalId = 'paywall-modal';
        let modal = document.getElementById(modalId);

        if (!modal) {
            const modalHTML = `
            <div id="${modalId}" class="modal auth-prompt-modal" style="display:flex; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.85); z-index: 10001; align-items: center; justify-content: center; backdrop-filter: blur(8px);">
                <div class="modal-content" style="
                    background: linear-gradient(145deg, #0f172a, #1e293b); 
                    border: 2px solid #ffd700; 
                    box-shadow: 0 25px 50px rgba(0,0,0,0.6); 
                    width: 90%;
                    max-width: 450px; 
                    border-radius: 16px;
                    font-family: 'Inter', sans-serif;
                    overflow: hidden;
                ">
                    <div class="modal-header" style="border-bottom: 1px solid rgba(255,255,255,0.08); padding: 15px 20px; display: flex; justify-content: space-between; align-items: center;">
                        <h2 style="
                            background: linear-gradient(90deg, #f8fafc, #94a3b8); 
                            -webkit-background-clip: text; 
                            -webkit-text-fill-color: transparent; 
                            font-weight: 800;
                            font-size: 1.2rem;
                            margin: 0;
                        ">¡Te encantó la prueba!</h2>
                        <button class="modal-close-btn" onclick="document.getElementById('${modalId}').style.display='none'" style="color: #64748b; font-size: 1.5rem; background: none; border: none; cursor: pointer;">&times;</button>
                    </div>
                    <div class="modal-body" style="padding: 30px 25px; text-align: center;">
                        <div class="auth-prompt-icon" style="margin-bottom: 20px;">
                           <i class="fas fa-crown" style="font-size: 3.5rem; color: #ffd700; filter: drop-shadow(0 0 10px rgba(255, 215, 0, 0.3));"></i>
                        </div>
                        <div class="auth-prompt-main-text" style="font-size: 1.1rem; color: #f8fafc; line-height: 1.6; margin-bottom: 25px;">
                            Ya usaste tus 3 pruebas gratuitas.
                            <br>Para continuar, suscríbete por <strong style="color: #ffd700;">S/ 9.90</strong>.
                        </div>
                        <button class="btn-primary" style="
                            width: 100%; 
                            background: linear-gradient(45deg, #ffd700, #ffa500); 
                            color: #000; 
                            font-weight: 800; 
                            border: none;
                            padding: 14px; 
                            font-size: 1rem;
                            border-radius: 10px;
                            box-shadow: 0 4px 15px rgba(255, 215, 0, 0.3);
                            cursor: pointer;
                            transition: transform 0.2s;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 10px;
                        " onclick="window.location.href='/pricing'" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                            <i class="fas fa-rocket"></i> Suscríbete ahora
                        </button>
                    </div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            modal = document.getElementById(modalId);
        } else {
            modal.style.display = 'flex';
        }
    }

    /**
     * Verifica si el usuario está logueado. Si sí, ejecuta el callback.
     * Si no, muestra el modal de registro.
     * @param {Function} callback - La acción a ejecutar si el usuario está autenticado.
     */
    checkAuthAndExecute(callback) {
        if (window.sessionManager && window.sessionManager.isLoggedIn()) {
            callback();
        } else {
            this.showAuthPromptModal();
        }
    }

    /**
     * Muestra el modal de restricción "Soft Block".
     */
    showAuthPromptModal() {
        const modal = document.getElementById(this.modalId);
        if (modal) {
            modal.style.display = 'flex';
        } else {
            console.error('Auth Modal not found in DOM');
        }
    }

    /**
     * Oculta el modal.
     */
    hideAuthPromptModal() {
        const modal = document.getElementById(this.modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * Inyecta el HTML del modal en el body si no existe.
     * Esto evita tener que modificar todos los archivos HTML manualmente.
     */
    injectModalHTML() {
        if (document.getElementById(this.modalId)) return;

        const modalHTML = `
            <div id="${this.modalId}" class="modal auth-prompt-modal" style="display:none; backdrop-filter: blur(8px); background: rgba(15, 23, 42, 0.85); z-index: 10001; align-items: center; justify-content: center;">
                <div class="modal-content" style="
                    background: linear-gradient(145deg, #0f172a, #1e293b); 
                    border: 1px solid rgba(255, 215, 0, 0.15); 
                    box-shadow: 0 25px 50px rgba(0,0,0,0.6); 
                    width: 90%;
                    max-width: 450px; 
                    border-radius: 16px;
                    font-family: 'Inter', sans-serif;
                ">
                    <div class="modal-header" style="border-bottom: 1px solid rgba(255,255,255,0.08); padding: 15px 20px;">
                        <h2 style="
                            background: linear-gradient(90deg, #f8fafc, #94a3b8); 
                            -webkit-background-clip: text; 
                            -webkit-text-fill-color: transparent; 
                            font-weight: 800;
                            font-size: 1.2rem;
                            margin: 0;
                            display: flex; align-items: center; gap: 8px;
                        ">
                            Únete a Hub Academia
                        </h2>
                        <button class="modal-close-btn" onclick="window.uiManager.hideAuthPromptModal()" style="color: #64748b; font-size: 1.5rem; cursor: pointer;">&times;</button>
                    </div>
                    
                    <div class="modal-body" style="padding: 20px 25px; text-align: center;">
                        <div class="auth-prompt-icon" style="margin-bottom: 15px;">
                            <div style="
                                width: 50px; height: 50px; 
                                background: rgba(59, 130, 246, 0.1); 
                                border-radius: 50%; 
                                display: flex; align-items: center; justify-content: center; 
                                margin: 0 auto;
                                border: 1px solid rgba(59, 130, 246, 0.2);
                                box-shadow: 0 0 15px rgba(59, 130, 246, 0.2);
                            ">
                                <img src="/assets/logo.png" alt="Hub Academia Logo" style="width: 100%; height: 100%; object-fit: contain; padding: 4px; border-radius: 50%;">
                            </div>
                        </div>

                        <div class="auth-prompt-main-text" style="font-size: 0.95rem; color: #e2e8f0; margin-bottom: 20px; line-height: 1.5;">
                            Regístrate gratis para acceder al potencial completo del <span style="color: #60a5fa; font-weight: 700;">Tutor IA</span> y el <span style="color: #fbbf24; font-weight: 700;">Centro de Entrenamiento</span>.
                        </div>

                        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 15px; text-align: left;">
                            <p style="margin: 0 0 10px 0; font-size: 0.9rem; color: #94a3b8; font-weight: 600;">Beneficios de tu cuenta:</p>
                            <ul style="list-style: none; padding: 0; margin: 0; color: #cbd5e1; font-size: 0.85rem;">
                                <li style="margin-bottom: 8px; display: flex; align-items: center; gap: 10px;">
                                    <i class="fas fa-check-circle" style="color: #4ade80;"></i>
                                    <span>Simulacros médicos ilimitados con IA</span>
                                </li>
                                <li style="margin-bottom: 8px; display: flex; align-items: center; gap: 10px;">
                                    <i class="fas fa-check-circle" style="color: #4ade80;"></i>
                                    <span>Chatear con el Tutor IA 24/7</span>
                                </li>
                                <li style="margin-bottom: 8px; display: flex; align-items: center; gap: 10px;">
                                    <i class="fas fa-check-circle" style="color: #4ade80;"></i>
                                    <span>Flashcards con repaso espaciado inteligente</span>
                                </li>
                                <li style="margin-bottom: 8px; display: flex; align-items: center; gap: 10px;">
                                    <i class="fas fa-check-circle" style="color: #4ade80;"></i>
                                    <span>Analítica de rendimiento y diagnóstico IA</span>
                                </li>
                                <li style="margin-bottom: 0; display: flex; align-items: center; gap: 10px;">
                                    <i class="fas fa-gamepad" style="color: #f472b6;"></i>
                                    <span style="color: #f1f5f9; font-weight:600;">Compite en Quiz Battle Arena</span>
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div class="modal-footer" style="
                        justify-content: center; 
                        gap: 10px; 
                        padding: 0 25px 25px 25px; 
                        border-top: none;
                        display: flex;
                        flex-direction: column; 
                    ">
                        <button class="btn-primary" onclick="window.location.href='register'" style="
                            width: 100%; 
                            background: linear-gradient(90deg, #3b82f6, #2563eb); 
                            color: #fff; 
                            font-weight: 700; 
                            border: none;
                            padding: 12px; 
                            font-size: 0.95rem;
                            border-radius: 10px;
                            box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3);
                            transition: transform 0.2s;
                            cursor: pointer;
                        " onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                            Registrarse Gratis
                        </button>
                         <button class="btn-secondary" onclick="window.location.href='login'" style="
                            width: 100%; 
                            background: transparent; 
                            border: 1px solid rgba(255,255,255,0.1); 
                            color: #94a3b8;
                            padding: 10px; 
                            font-size: 0.9rem;
                            border-radius: 10px;
                            cursor: pointer;
                            transition: all 0.2s;
                        " onmouseover="this.style.borderColor='rgba(255,255,255,0.3)'; this.style.color='#e2e8f0'" onmouseout="this.style.borderColor='rgba(255,255,255,0.1)'; this.style.color='#94a3b8'">
                             Ya tengo cuenta
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    /**
     * Inyecta el HTML de la barra de estado Freemium.
     */
    injectFreemiumStatusBar() {
        if (document.getElementById('freemium-status-bar')) return;

        const barHTML = `
            <style>
                .freemium-status-bar {
                    background: #1e293b;
                    border-bottom: 1px solid #334155;
                    color: white;
                    padding: 8px 16px;
                    display: none; /* Oculto por defecto */
                    justify-content: center;
                    align-items: center;
                    font-size: 0.9rem;
                    position: fixed; /* ✅ FIXED: Always on top */
                    top: 0; 
                    left: 0;
                    width: 100%;
                    height: 46px; /* Explicit height matching CSS var */
                    box-sizing: border-box;
                    z-index: 9999; /* Z-Index Alto */
                    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                }
                .freemium-status-bar.visible {
                    display: flex;
                    animation: slideDown 0.3s ease-out;
                }
                .status-content {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                }
                .usage-pill {
                    background: rgba(255, 255, 255, 0.1);
                    padding: 4px 10px;
                    border-radius: 12px;
                    font-weight: bold;
                    color: #ffd700; /* Gold */
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }
                .upgrade-btn-small {
                    background: linear-gradient(45deg, #ffd700, #ffa500);
                    border: none;
                    border-radius: 20px;
                    padding: 4px 12px;
                    font-size: 0.8rem;
                    font-weight: bold;
                    cursor: pointer;
                    color: #000;
                    text-transform: uppercase;
                    transition: transform 0.2s;
                }
                .upgrade-btn-small:hover {
                    transform: scale(1.05);
                }
                @keyframes slideDown {
                    from { transform: translateY(-100%); }
                    to { transform: translateY(0); }
                }

                /* Toast Notification */
                .freemium-toast {
                    position: fixed;
                    bottom: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: #334155;
                    color: white;
                    padding: 12px 24px;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    z-index: 10000; /* Toast Z-Index Supremo */
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    opacity: 0;
                    transition: opacity 0.3s, transform 0.3s;
                    pointer-events: none;
                }
                .freemium-toast.show {
                    opacity: 1;
                    transform: translateX(-50%) translateY(0);
                }
                .freemium-toast i { color: #ffd700; }
            </style>
            <div id="freemium-status-bar" class="freemium-status-bar">
                <div class="status-content">
                    <span>⚡ MODO PRUEBA</span>
                    <div class="usage-pill">
                        <i class="fas fa-bolt"></i> <span id="free-usage-count">--/--</span>
                    </div>
                    <span>restantes</span>
                    <button class="upgrade-btn-small" onclick="window.location.href='/pricing'">
                         💎 Activar Ilimitado
                    </button>
                </div>
            </div>
            <div id="freemium-toast" class="freemium-toast">
                <i class="fas fa-unlock"></i>
                <span id="freemium-toast-msg">Mensaje</span>
            </div>
        `;

        if (document.body) {
            document.body.insertAdjacentHTML('afterbegin', barHTML);
        } else {
            // Fallback si corre en head
            document.addEventListener('DOMContentLoaded', () => {
                document.body.insertAdjacentHTML('afterbegin', barHTML);
            });
        }
    }

    /**
     * Actualiza la barra de estado con los datos del usuario.
     */
    updateFreemiumStatus(user) {
        this.injectFreemiumStatusBar();
        const bar = document.getElementById('freemium-status-bar');
        const countSpan = document.getElementById('free-usage-count');

        if (!user || user.subscriptionStatus === 'active' || user.role === 'admin') {
            if (bar) bar.style.display = 'none';
            document.body.classList.remove('has-trial-mode'); // ✅ Remove class
            return;
        }

        // Es Freemium/Pending
        if (bar) {
            bar.classList.add('visible');
            // Asegurarnos que no se oculte por display:none directo
            bar.style.display = 'flex';
            document.body.classList.add('has-trial-mode'); // ✅ Add class
        }

        const usage = user.usageCount !== undefined ? user.usageCount : (user.usage_count || 0);
        const limit = user.maxFreeLimit !== undefined ? user.maxFreeLimit : (user.max_free_limit || 3);
        const remaining = Math.max(0, limit - usage);

        if (countSpan) {
            countSpan.textContent = `${remaining}/${limit}`;
            // Alerta visual si queda poco
            if (remaining <= 1) {
                countSpan.parentElement.style.background = 'rgba(239, 68, 68, 0.2)'; // Red tint
                countSpan.style.color = '#f87171';
            }
        }
    }

    /**
     * Muestra un Toast temporal.
     */
    showToast(message) {
        const toast = document.getElementById('freemium-toast');
        const msgEl = document.getElementById('freemium-toast-msg');
        if (toast && msgEl) {
            msgEl.textContent = message;
            toast.classList.add('show');
            // Ocultar a los 3s
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }
    }

    /**
     * Muestra el modal de bienvenida si es la primera vez.
     */
    checkAndShowWelcomeModal(user) {
        if (!user) return;
        // Solo para usuarios free/pending
        if (user.subscriptionStatus === 'active') return;

        // ✅ REGLA UX: Solo mostrar si usage_count es 0 (Usuario Nuevo)
        // Esto evita que salga si ya gastó vidas
        const usage = user.usageCount !== undefined ? user.usageCount : (user.usage_count || 0);
        if (usage > 0) return;

        const hasSeen = localStorage.getItem('hasSeenFreemiumWelcome_v2');
        if (hasSeen) return;

        const modalId = 'welcome-freemium-modal';
        if (document.getElementById(modalId)) return;

        const modalHTML = `
            <div id="${modalId}" class="modal auth-prompt-modal" style="display:flex; backdrop-filter: blur(8px); background: rgba(15, 23, 42, 0.85); z-index: 10001; align-items: center; justify-content: center;">
                <div class="modal-content" style="
                    background: linear-gradient(145deg, #0f172a, #1e293b); 
                    border: 1px solid rgba(255, 215, 0, 0.15); 
                    box-shadow: 0 25px 50px rgba(0,0,0,0.6); 
                    width: 90%;
                    max-width: 450px; 
                    border-radius: 16px;
                    font-family: 'Inter', sans-serif;
                    max-height: 90vh;
                    overflow-y: auto; 
                ">
                    <div class="modal-header" style="border-bottom: 1px solid rgba(255,255,255,0.08); padding: 15px 20px;">
                        <h2 style="
                            background: linear-gradient(90deg, #f8fafc, #94a3b8); 
                            -webkit-background-clip: text; 
                            -webkit-text-fill-color: transparent; 
                            font-weight: 800;
                            font-size: 1.25rem;
                            margin: 0;
                            display: flex; align-items: center; gap: 10px;
                        ">
                            ¡Bienvenido a Hub Academia!
                        </h2>
                        <button class="modal-close-btn" onclick="document.getElementById('${modalId}').style.display='none'" style="color: #64748b; font-size: 1.5rem; cursor: pointer;">&times;</button>
                    </div>
                    
                    <div class="modal-body" style="padding: 20px 25px; text-align: center;">
                         <div class="auth-prompt-icon" style="margin-bottom: 15px;">
                            <div style="
                                width: 60px; height: 60px; 
                                background: rgba(255, 215, 0, 0.05); 
                                border-radius: 50%; 
                                display: flex; align-items: center; justify-content: center; 
                                margin: 0 auto;
                                border: 1px solid rgba(255, 215, 0, 0.2);
                                box-shadow: 0 0 20px rgba(255, 215, 0, 0.1);
                            ">
                                <i class="fas fa-gift" style="font-size: 1.8rem; color: #ffd700;"></i>
                            </div>
                        </div>
                        
                        <div class="auth-prompt-main-text" style="font-size: 1rem; color: #e2e8f0; margin-bottom: 20px; line-height: 1.5;">
                            Te damos la bienvenida con un <br>
                            <span style="color: #fbbf24; font-weight: 700; letter-spacing: 0.5px;">Paquete de Inicio Gratuito</span>
                        </div>

                        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 15px; text-align: left;">
                            <ul style="list-style: none; padding: 0; margin: 0; color: #cbd5e1; font-size: 0.9rem;">
                                <li style="margin-bottom: 10px; display: flex; align-items: start; gap: 10px;">
                                    <i class="fas fa-check-circle" style="color: #4ade80; margin-top: 2px; font-size: 1rem;"></i>
                                    <div>
                                        <strong style="color: #f1f5f9; display: block; margin-bottom: 1px;">3 Pases Premium de Regalo</strong>
                                        <div style="font-size: 0.8rem; color: #94a3b8; line-height: 1.3;">Desbloquea recursos, videos y el Tutor IA.</div>
                                    </div>
                                </li>
                                <li style="margin-bottom: 0; display: flex; align-items: start; gap: 10px;">
                                    <i class="fas fa-check-circle" style="color: #4ade80; margin-top: 2px; font-size: 1rem;"></i>
                                    <div>
                                        <strong style="color: #f1f5f9; display: block; margin-bottom: 1px;">3 Partidas de Quiz Diarias</strong>
                                        <div style="font-size: 0.8rem; color: #94a3b8; line-height: 1.3;">Pon a prueba tus conocimientos cada 24h.</div>
                                    </div>
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div class="modal-footer" style="
                        justify-content: center; 
                        gap: 10px; 
                        padding: 0 25px 25px 25px; 
                        border-top: none;
                        flex-direction: column;
                    ">
                        <button class="btn-primary" onclick="window.location.href='/pricing'" style="
                            width: 100%; 
                            background: linear-gradient(90deg, #f59e0b, #d97706); 
                            color: #fff; 
                            font-weight: 700; 
                            border: none;
                            padding: 12px; 
                            font-size: 0.95rem;
                            border-radius: 10px;
                            box-shadow: 0 4px 15px rgba(245, 158, 11, 0.25);
                            transition: transform 0.2s;
                            cursor: pointer;
                        " onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                            👑 Obtener Acceso Ilimitado
                        </button>
                        <button class="btn-secondary" onclick="window.uiManager.closeWelcomeModal('${modalId}')" style="
                            width: 100%; 
                            background: transparent; 
                            border: 1px solid rgba(255,255,255,0.1); 
                            color: #94a3b8;
                            padding: 10px; 
                            font-size: 0.9rem;
                            border-radius: 10px;
                            cursor: pointer;
                            transition: all 0.2s;
                        " onmouseover="this.style.borderColor='rgba(255,255,255,0.3)'; this.style.color='#e2e8f0'" onmouseout="this.style.borderColor='rgba(255,255,255,0.1)'; this.style.color='#94a3b8'">
                             Empezar con mi cuenta gratuita
                        </button>
                    </div>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        localStorage.setItem('hasSeenFreemiumWelcome_v2', 'true');
    }

    closeWelcomeModal(id) {
        const modal = document.getElementById(id);
        if (modal) modal.style.display = 'none';
    }
}

// Inicializar y exponer globalmente
window.uiManager = new UIManager();

// Hook automático para la barra al cargar sesión
// Esperamos a que sessionManager esté listo, o escuchamos directamente aquí si App no lo hace
if (window.sessionManager) {
    window.sessionManager.onStateChange((user) => {
        window.uiManager.updateFreemiumStatus(user);
        window.uiManager.checkAndShowWelcomeModal(user);
    });
}
