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

        // ✅ NUEVO: Lógica de Botón "Atrás" para Modales
        this.openModals = new Set();
        window.addEventListener('popstate', (e) => this.handlePopState(e));
    }

    handlePopState(event) {
        // Cerrar todos los modales abiertos si el usuario navega hacia atrás físicamente
        if (this.openModals.size > 0) {
            this.openModals.forEach(modalId => {
                const modal = document.getElementById(modalId);
                if (modal) {
                    if (modal.classList.contains('active')) {
                        modal.classList.remove('active');
                        // Limpiar posible estilo inline residual para no romper futuras aperturas dependientes de la clase CSS
                        if (modal.style.display === 'none' || modal.style.display === 'flex') {
                            modal.style.display = '';
                        }
                    } else {
                        // Comportamiento regular para modales inyectados (como auth o video)
                        modal.style.display = 'none';
                    }
                }
            });
            this.openModals.clear();
        }
    }

    /**
     * Registra el modal en la historia para cerrarlo con botón Atrás.
     */
    pushModalState(modalId) {
        this.openModals.add(modalId);
        window.history.pushState({ modalOpen: true, modalId }, '');
    }

    /**
     * Quita el modal del Set cuando se cierra manualmente (botón 'x').
     */
    popModalState(modalId) {
        if (this.openModals.has(modalId)) {
            this.openModals.delete(modalId);
            // Hacer "atrás" invisible si cerramos manual para no ensuciar el historial extra
            if (window.history.state && window.history.state.modalOpen) {
                window.history.back();
            }
        }
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
            <div id="${modalId}" class="auth-prompt-modal" style="display:flex;">
                <div class="modal-content premium-variant">
                    <div class="modal-body" style="padding-top: 40px;">
                        <div class="auth-prompt-icon" style="margin-bottom: 20px;">
                            <i class="fas fa-crown" style="font-size: 3.5rem; color: #ffd700; filter: drop-shadow(0 0 10px rgba(255, 215, 0, 0.3));"></i>
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
                            Ahora tienes <strong>Acceso Ilimitado</strong> a todos los recursos y al Asistente.
                        </p>

                        <button onclick="document.getElementById('${modalId}').remove()" class="btn-primary" style="
                            width: 100%; 
                            background: linear-gradient(90deg, #f59e0b, #d97706); 
                            color: #fff; 
                            font-weight: 700; 
                            border: none;
                            padding: 12px 30px; 
                            font-size: 1rem;
                            border-radius: 50px;
                            box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3);
                        ">
                            ¡Comenzar! 🚀
                        </button>
                    </div>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.pushModalState(modalId);

        // Interceptar cierre X
        const realCloseBtn = document.querySelector(`#${modalId} .close-success`);
        if (realCloseBtn) {
            realCloseBtn.addEventListener('click', () => {
                document.getElementById(modalId).remove();
                this.popModalState(modalId);
            });
        }

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
     * Intenta acceder a un recurso protegido (Libro, Video, Artículo) o gratuito.
     * Valida límites de uso en el backend si es Premium.
     * @param {string} id - ID del recurso.
     * @param {string} type - Tipo ('video', 'book', 'article').
     * @param {boolean} isPremium - Si el recurso requiere autenticación y vidas/suscripción.
     * @param {string} videoContainerId - (Opcional) ID del contenedor DOM para inyectar video.
     */
    async unlockResource(id, type = 'book', isPremium = false, videoContainerId = null) {
        const url = this.materialRegistry.get(String(id));
        if (!url) {
            console.error('Material no encontrado o acceso denegado.');
            return;
        }

        // ✅ LÓGICA DE RECURSOS GRATUITOS
        // Si el recurso es gratuito (isPremium = false), se accede directamente sin descontar vidas ni pedir login.
        if (!isPremium) {
            if (type === 'video') {
                this.openVideoModal(url, 'Video Gratuito');
            } else {
                window.open(url, '_blank');
            }
            if (window.AnalyticsApiService) window.AnalyticsApiService.recordView(type, id);
            return;
        }

        // ✅ LÓGICA DE RECURSOS PREMIUM
        const token = localStorage.getItem('authToken');
        const userStr = localStorage.getItem('user');
        const user = window.sessionManager?.getUser() || (userStr ? JSON.parse(userStr) : null);

        // 1. Visitante: No Logueado -> Modal "Únete"
        if (!token || !user) {
            this.showAuthPromptModal();
            return;
        }

        // 2. Freemium Sin Vidas: Cortocircuito Local -> Modal "Te encantó"
        const status = user.subscriptionStatus || user.subscription_status;
        if (status !== 'active' && user.role !== 'admin') {
            const usage = user.usageCount !== undefined ? user.usageCount : (user.usage_count || 0);
            const limit = user.maxFreeLimit !== undefined ? user.maxFreeLimit : (user.max_free_limit || 3);
            if (usage >= limit) {
                this.showPaywallModal();
                return; // Cortocircuito, no llama al servidor
            }
        }

        // 3. Autenticado (Freemium con Vidas o Premium): Validar uso exacto en el backend.
        (async () => {
            try {
                // Verificar límite de uso / grabar visita
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
                    // Éxito: Acceso concedido

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
                        this.openVideoModal(url, data.title || 'Video Premium');
                    } else {
                        // Artículos y Libros se abren en nueva pestaña
                        window.open(url, '_blank');
                    }

                    // Tracking
                    if (window.AnalyticsApiService) {
                        window.AnalyticsApiService.recordView(type, id);
                    }

                } else if (response.status === 403 || !data.allowed) {
                    // ⛔ Límite alcanzado o suscripción inactiva
                    // Actualizar estado local si el backend reporta límite
                    if (user && window.sessionManager) {
                        user.usageCount = data.usage || 3;
                        window.sessionManager.notifyStateChange();
                    }
                    this.showPaywallModal();
                } else {
                    console.error('Error verificando acceso:', data);
                    alert('Error verificando acceso. Intenta nuevamente.');
                }
            } catch (error) {
                console.error('Error de red:', error);
            }
        })();
    }

    /**
     * Alias para compatibilidad con código existente de libros.
     */
    openMaterial(id, isPremium = false) {
        this.unlockResource(id, 'book', isPremium);
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
            this.pushModalState('video-player-modal');

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
            this.popModalState('video-player-modal');
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

    showPaywallModal(customMsg = null) {
        const modalId = 'paywall-modal';
        let modal = document.getElementById(modalId);

        if (!modal) {
            const modalHTML = `
            <div id="${modalId}" class="auth-prompt-modal" style="display:flex;">
                <div class="modal-content premium-variant">
                    <div class="modal-header">
                        <h2 style="background: linear-gradient(90deg, #fbbf24, #f59e0b); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">¡Te encantó la prueba!</h2>
                        <button class="modal-close-btn" onclick="window.uiManager.popModalState('${modalId}'); document.getElementById('${modalId}').style.display='none'">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="auth-prompt-icon" style="margin-bottom: 20px;">
                           <i class="fas fa-crown" style="font-size: 3.5rem; color: #ffd700; filter: drop-shadow(0 0 10px rgba(255, 215, 0, 0.4));"></i>
                        </div>
                        <div class="auth-prompt-main-text" style="font-size: 1.1rem; color: #f8fafc; line-height: 1.6;">
                            ¡Te encantó la prueba gratuita!<br>Suscríbete ahora por s/ 9.90.
                            <br><span style="color: #94a3b8; font-size: 0.9rem;">Acceso a más beneficios.</span>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-primary" style="
                            width: 100%; 
                            background: linear-gradient(45deg, #ffd700, #ffa500); 
                            color: #000; 
                            font-weight: 800; 
                            border: none;
                            padding: 14px; 
                            font-size: 1rem;
                            border-radius: 12px;
                            box-shadow: 0 4px 20px rgba(251, 191, 36, 0.4);
                            cursor: pointer;
                            transition: transform 0.2s;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 10px;
                        " onclick="window.location.href='/pricing'">
                            <i class="fas fa-rocket"></i> Suscríbete ahora
                        </button>
                    </div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            modal = document.getElementById(modalId);
        } else {
            if (customMsg) {
                const textEl = modal.querySelector('.auth-prompt-main-text');
                if (textEl) textEl.innerHTML = customMsg;
            }
            modal.style.display = 'flex';
        }
        this.pushModalState(modalId);
    }

    /**
     * ✅ MODAL UNIFICADO: Cuando el banco se agota y requiere Advanced para IA.
     * Funciona para usuarios Free y Basic.
     */
    showBankExhaustedModal() {
        const modalId = 'bank-exhausted-modal';

        // Determinar texto del botón según el plan actual
        let userPlan = 'free';
        try {
            const user = window.sessionManager?.getUser();
            if (user) userPlan = (user.subscriptionTier || user.subscription_tier || 'free').toLowerCase();
        } catch (e) { }

        const btnText = userPlan === 'free' ? 'Obtener Plan Advanced' : 'Subir a Advanced (IA Ilimitada)';

        if (document.getElementById(modalId)) {
            const btn = document.getElementById(`${modalId}-action-btn`);
            if (btn) btn.innerHTML = `<i class="fas fa-crown"></i> ${btnText}`;
            document.getElementById(modalId).style.display = 'flex';
            this.pushModalState(modalId);
            return;
        }

        const modalHTML = `
        <div id="${modalId}" class="auth-prompt-modal" style="display:flex;">
            <div class="modal-content" style="border: 1px solid rgba(59, 130, 246, 0.3); background: rgba(15, 23, 42, 0.95); box-shadow: 0 0 40px rgba(0,0,0,0.6);">
                <div class="modal-header">
                    <h2 style="background: linear-gradient(90deg, #60a5fa, #3b82f6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-weight: 800;">¡Has dominado el Banco!</h2>
                    <button class="modal-close-btn" onclick="window.uiManager.popModalState('${modalId}'); document.getElementById('${modalId}').style.display='none'">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="auth-prompt-icon" style="margin-bottom: 20px;">
                       <div style="width: 80px; height: 80px; background: rgba(59, 130, 246, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto; border: 2px solid rgba(59, 130, 246, 0.3); box-shadow: 0 0 20px rgba(59, 130, 246, 0.2);">
                            <i class="fas fa-brain" style="font-size: 2.5rem; color: #60a5fa; filter: drop-shadow(0 0 8px rgba(96, 165, 250, 0.5));"></i>
                       </div>
                    </div>
                    <div class="auth-prompt-main-text" style="font-size: 1.1rem; color: #f1f5f9; line-height: 1.6; text-align: center;">
                        Has completado todas las preguntas disponibles en nuestro banco oficial para esta configuración.
                        <br><br>
                        Para seguir entrenando con <strong>las preguntas</strong> generadas por IA en tiempo real, necesitas el plan <span style="color: #fbbf24; font-weight: 800; text-shadow: 0 0 10px rgba(251, 191, 36, 0.3);">ADVANCED</span>.
                    </div>
                </div>
                <div class="modal-footer" style="flex-direction: column; gap: 12px; padding-bottom: 20px;">
                    <button id="${modalId}-action-btn" class="btn-primary" style="width: 100%; background: linear-gradient(135deg, #3b82f6, #2563eb); border: none; border-radius: 14px; padding: 16px; font-weight: 800; font-size: 1.05rem; box-shadow: 0 4px 15px rgba(37, 99, 235, 0.4); cursor: pointer; transition: transform 0.2s;" 
                        onclick="window.location.href='/pricing'">
                        <i class="fas fa-crown"></i> ${btnText}
                    </button>
                    <button class="btn-secondary" style="width: 100%; border-radius: 14px; background: rgba(255,255,255,0.05); color: #94a3b8; border: 1px solid rgba(255,255,255,0.1); padding: 12px;" 
                        onclick="window.location.href='/simulator-dashboard'">
                        Explorar otros temas
                    </button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.pushModalState(modalId);
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
            this.pushModalState(this.modalId);
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
            this.popModalState(this.modalId);
        }
    }

    /**
     * Inyecta el HTML del modal en el body si no existe.
     * Esto evita tener que modificar todos los archivos HTML manualmente.
     */
    injectModalHTML() {
        if (document.getElementById(this.modalId)) return;

        const modalHTML = `
            <div id="${this.modalId}" class="auth-prompt-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Únete a Hub Academia</h2>
                        <button class="modal-close-btn" onclick="window.uiManager.hideAuthPromptModal()">&times;</button>
                    </div>
                    
                    <div class="modal-body">
                        <div class="auth-prompt-icon" style="margin-bottom: 20px;">
                            <div style="
                                width: 50px; height: 50px; 
                                background: rgba(59, 130, 246, 0.1); 
                                border-radius: 50%; 
                                display: flex; align-items: center; justify-content: center; 
                                margin: 0 auto;
                                border: 1px solid rgba(59, 130, 246, 0.2);
                            ">
                                <img src="/assets/logo.png" alt="Hub Academia" style="width: 100%; height: 100%; object-fit: contain; padding: 5px; border-radius: 50%;">
                            </div>
                        </div>

                        <div style="font-size: 0.95rem; color: #cbd5e1; margin-bottom: 5px; line-height: 1.5;">
                            Regístrate gratis para acceder a simulacros médicos, flashcards inteligentes y analítica avanzada.
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button class="btn-primary" onclick="window.location.href='register'" style="
                            width: 100%; 
                            background: linear-gradient(90deg, #3b82f6, #2563eb); 
                            color: #fff; 
                            font-weight: 700; 
                            border: none;
                            padding: 14px; 
                            font-size: 1rem;
                            border-radius: 12px;
                            box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3);
                            cursor: pointer;
                        ">
                            Registrarse Gratis
                        </button>
                         <button class="btn-secondary" onclick="window.location.href='login'" style="
                            width: 100%; 
                            background: transparent; 
                            border: 1px solid rgba(255,255,255,0.1); 
                            color: #94a3b8;
                            padding: 12px; 
                            font-size: 0.95rem;
                            border-radius: 12px;
                            cursor: pointer;
                        ">
                             Ya tengo cuenta
                        </button>
                    </div>
                </div>
            </div>`;

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
            <div id="${modalId}" class="auth-prompt-modal" style="display:flex;">
                <div class="modal-content premium-variant" style="max-height: 90vh; overflow-y: auto;">
                    <div class="modal-header">
                        <h2>¡Bienvenido a Hub Academia!</h2>
                        <button class="modal-close-btn" onclick="window.uiManager.closeWelcomeModal('${modalId}')">&times;</button>
                    </div>
                    
                    <div class="modal-body">
                         <div class="auth-prompt-icon" style="margin-bottom: 15px;">
                            <div style="
                                width: 60px; height: 60px; 
                                background: rgba(255, 215, 0, 0.05); 
                                border-radius: 50%; 
                                display: flex; align-items: center; justify-content: center; 
                                margin: 0 auto;
                                border: 1px solid rgba(255, 215, 0, 0.2);
                                box-shadow: 0 0 15px rgba(255, 215, 0, 0.1);
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
                                        <strong style="color: #f1f5f9; display: block; margin-bottom: 1px;">3 Pases de Vidas Globales</strong>
                                        <div style="font-size: 0.8rem; color: #94a3b8; line-height: 1.3;">Desbloquea simulacros, retos de Arena, Asistente y más.</div>
                                    </div>
                                </li>
                                <li style="margin-bottom: 0; display: flex; align-items: start; gap: 10px;">
                                    <i class="fas fa-check-circle" style="color: #4ade80; margin-top: 2px; font-size: 1rem;"></i>
                                    <div>
                                        <strong style="color: #f1f5f9; display: block; margin-bottom: 1px;">Estadísticas en Tiempo Real</strong>
                                        <div style="font-size: 0.8rem; color: #94a3b8; line-height: 1.3;">Mide tu rendimiento clínico y académico instantáneamente.</div>
                                    </div>
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div class="modal-footer">
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
        this.pushModalState(modalId);
    }

    closeWelcomeModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.style.display = 'none';
            this.popModalState(id);
        }
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
