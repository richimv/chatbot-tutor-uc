class UIManager {
    constructor() {
        this.modalId = 'auth-prompt-modal';
        this.injectModalHTML();
        // NUEVO: Inyectar Modal de Video
        this.injectVideoModalHTML();
        // NUEVO: Inyectar Visor de Medios (Imágenes)
        this.injectMediaViewerHTML();
        // NUEVO: Registro seguro de URLs para ofuscación
        this.materialRegistry = new Map();

        // NUEVO: Verificar estado de pago al cargar
        this.checkPaymentStatus();

        // NUEVO: Lógica de Botón "Atrás" para Modales
        this.openModals = new Set();
        window.addEventListener('popstate', (e) => this.handlePopState(e));

        // ✅ NUEVO: Monitor de Conectividad
        this.isOnline = navigator.onLine;
        this.injectStatusPillHTML();
        
        // Sincronizar estado inicial inmediatamente
        this.handleConnectivityChange(this.isOnline);

        window.addEventListener('online', () => this.handleConnectivityChange(true));
        window.addEventListener('offline', () => this.handleConnectivityChange(false));
    }

    /**
     * Gestión de Resiliencia de Red
     */
    injectStatusPillHTML() {
        if (document.getElementById('status-pill-container')) return;
        const div = document.createElement('div');
        div.id = 'status-pill-container';
        div.className = 'status-pill-container';
        div.innerHTML = `
            <div id="status-pill" class="status-pill">
                <span class="status-dot"></span>
                <span id="status-text">Sin conexión</span>
            </div>
        `;
        document.body.appendChild(div);
    }

    handleConnectivityChange(isOnline) {
        this.isOnline = isOnline;
        const container = document.getElementById('status-pill-container');
        const pill = document.getElementById('status-pill');
        const text = document.getElementById('status-text');

        if (!isOnline) {
            pill.className = 'status-pill offline';
            text.textContent = 'Sin conexión - Trabajando localmente';
            container.classList.add('active');
        } else {
            pill.className = 'status-pill online';
            text.textContent = 'Conectado';
            // Ocultar después de un momento
            setTimeout(() => {
                container.classList.remove('active');
            }, 3000);
        }
    }

    /**
     * safeFetch: Wrapper robusto sobre fetch con reintentos automáticos.
     * Ideal para microcortes.
     */
    async safeFetch(url, options = {}, retries = 3, backoff = 1000) {
        const canRetry = !options.method || options.method === 'GET' || options.isRetryable === true;

        for (let i = 0; i < retries; i++) {
            try {
                // Si estamos offline y no es un reintento, avisar al UI
                if (!navigator.onLine && i === 0) {
                    this.handleConnectivityChange(false);
                }

                const response = await fetch(url, options);
                
                // Si la respuesta es OK o no es reintentable (ej. 401, 400), salir
                if (response.ok || response.status < 500) return response;

                // Si es un error 500+ y es reintentable, seguimos al catch para el backoff
                throw new Error(`Server Error: ${response.status}`);

            } catch (err) {
                const isNetworkError = err.name === 'TypeError' || err.message.includes('fetch');
                
                // Si no es reintentable o es el último intento, propagar el error
                if (!canRetry || i === retries - 1 || (!isNetworkError && i === 0)) {
                    // Si falló por red definitiva, avisar
                    if (isNetworkError) this.handleConnectivityChange(false);
                    throw err;
                }

                // Esperar antes de reintentar (Exponential Backoff)
                console.warn(`🔄 Error de red. Reintentando (${i + 1}/${retries}) en ${backoff}ms...`);
                await new Promise(res => setTimeout(res, backoff));
                backoff *= 2; // Duplicar tiempo de espera
            }
        }
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
     * @param {string} title - (Opcional) Título del recurso para el visor.
     * @param {string} videoContainerId - (Opcional) ID del contenedor DOM para inyectar video.
     */
    /**
     * MÉTODO CENTRALIZADO: Verifica y descuenta acceso para recursos Premium.
     * Gestiona autenticación, límites de lives y analíticas.
     * @private
     */
    async _verifyAndConsumeAccess(id, type, isPremium) {
        // ✅ Caso 1: Recurso Gratuito
        if (!isPremium) {
            if (window.AnalyticsApiService) window.AnalyticsApiService.recordView(type, id);
            return { allowed: true, free: true };
        }

        // ✅ Caso 2: Recurso Premium - Validar Auth
        const token = localStorage.getItem('authToken');
        const userStr = localStorage.getItem('user');
        const user = window.sessionManager?.getUser() || (userStr ? JSON.parse(userStr) : null);

        if (!token || !user) {
            this.showAuthPromptModal();
            return { allowed: false, reason: 'unauthorized' };
        }

        // Caso 2a: Freemium sin vidas (Cortocircuito local)
        const status = user.subscriptionStatus || user.subscription_status;
        if (status !== 'active' && user.role !== 'admin') {
            const usage = user.usageCount !== undefined ? user.usageCount : (user.usage_count || 0);
            const limit = user.maxFreeLimit !== undefined ? user.maxFreeLimit : (user.max_free_limit || 50);
            if (usage >= limit) {
                this.showPaywallModal();
                return { allowed: false, reason: 'limit_reached' };
            }
        }

        // Caso 2b: Validar exactamente en el Backend
        try {
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
                // Sincronizar estado local si es free
                if (data.plan === 'free' && window.sessionManager) {
                    const sessionUser = window.sessionManager.getUser();
                    if (sessionUser) {
                        sessionUser.usageCount = data.usage;
                        window.sessionManager.notifyStateChange();
                        this.showToast(`🔓 Desbloqueado. Te quedan ${data.limit - data.usage} pases.`);
                    }
                }

                // Registrar visualización
                if (window.AnalyticsApiService) window.AnalyticsApiService.recordView(type, id);

                return { allowed: true, ...data };
            } else if (response.status === 403 || !data.allowed) {
                if (user && window.sessionManager) {
                    user.usageCount = data.usage || 50;
                    window.sessionManager.notifyStateChange();
                }
                this.showPaywallModal();
                return { allowed: false, reason: 'limit_reached' };
            } else {
                console.error('Error verificando acceso:', data);
                alert('Error al verificar acceso. Reintenta.');
                return { allowed: false, reason: 'error' };
            }
        } catch (error) {
            console.error('Error de red:', error);
            alert('Error de conexión.');
            return { allowed: false, reason: 'network' };
        }
    }

    /**
     * Intenta acceder a un recurso protegido (Libro, Video, Artículo) o gratuito.
     * Muestra el visor correspondiente o abre el enlace.
     */
    async unlockResource(id, type = 'book', isPremium = false, title = '', videoContainerId = null) {
        const url = this.materialRegistry.get(String(id));
        if (!url) {
            console.error('Material no encontrado o acceso denegado.');
            return;
        }

        const result = await this._verifyAndConsumeAccess(id, type, isPremium);
        if (!result.allowed) return;

        // ACCIÓN SEGÚN TIPO
        const finalTitle = result.title || title;

        if (type === 'video') {
            // Video siempre usa su modal especializado (YouTube/MP4)
            this.openVideoModal(url, finalTitle);
        } else if (type === 'other' || this.isImage(url) || this.isDriveLink(url)) {
            // 'other', imágenes y links de Drive pasan por el MediaViewer
            // El MediaViewer internamente decidirá si abrir en pestaña nueva (Drive) o visor inmersivo (GCS)
            this.showMediaViewer(url, finalTitle);
        } else {
            // Libros, artículos y otros documentos estándar abren en pestaña nueva
            window.open(url, '_blank');
        }
    }

    /**
     * Intercepta la navegación a una página dedicada.
     * Verifica acceso antes de redirigir.
     */
    /**
     * Intercepta la navegación a una página dedicada.
     * Verifica acceso antes de redirigir.
     * MEJORA: Si el tipo es visual (video/other), abre el visor directamente en lugar de navegar.
     */
    async unlockAndNavigate(id, type = 'book', isPremium = false) {
        // ✅ REGLA DE EXPERIENCIA DIRECTA:
        // Si es video u otro recurso visual, abrir el visor directamente
        if (type === 'video' || type === 'other') {
            await this.unlockResource(id, type, isPremium);
            return;
        }

        let baseUrl = type === 'course' ? '/course' : '/resource';
        let targetUrl = `${baseUrl}?id=${id}`;

        const result = await this._verifyAndConsumeAccess(id, type, isPremium);
        if (result.allowed) {
            setTimeout(() => { window.location.href = targetUrl; }, 100);
        }
    }

    /**
     * MÉTODO CENTRALIZADO: Determina si un recurso debería mostrarse como bloqueado para el usuario actual.
     * @param {boolean} isPremium - Si el recurso es premium.
     * @returns {boolean} - true si está bloqueado visualmente por falta de suscripción/vidas.
     */
    isResourceLocked(isPremium) {
        if (!isPremium) return false;

        const token = localStorage.getItem('authToken');
        const userStr = localStorage.getItem('user');
        const user = window.sessionManager?.getUser() || (userStr ? JSON.parse(userStr) : null);

        // Si no hay usuario ni token, está bloqueado (Visitante)
        if (!user && !token) return true;

        if (user) {
            const status = user.subscriptionStatus || user.subscription_status;
            // Si es active (Premium) o admin, NUNCA está bloqueado
            if (status === 'active' || user.role === 'admin') return false;

            // Freemium: Solo bloquear si ya no tiene usos
            const usage = user.usageCount !== undefined ? user.usageCount : (user.usage_count || 0);
            const limit = user.maxFreeLimit !== undefined ? user.maxFreeLimit : (user.max_free_limit || 50);
            return usage >= limit;
        }

        return true;
    }

    /**
     * Alias para compatibilidad con código existente.
     */
    openMaterial(id, isPremium = false, title = '', type = 'book') {
        this.unlockResource(id, type, isPremium, title);
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
            // Limpiar y preparar contenido con un "safe area" inferior
            container.innerHTML = `
                <div class="video-player-wrapper-safe" style="padding-bottom: 40px;">
                    <div class="video-container-responsive">
                        <iframe 
                            src="https://www.youtube.com/embed/${videoId}?autoplay=1&controls=1&rel=1" 
                            title="${title || 'Video Hub Academia'}" 
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; compute-pressure" 
                            allowfullscreen>
                        </iframe>
                    </div>
                </div>
            `;
            if (titleEl) {
                titleEl.innerText = title || '';
                titleEl.style.display = title ? 'block' : 'none';
            }

            modal.style.display = 'flex';
            this.pushModalState('video-player-modal');

            // ✅ Listener para tecla ESC
            const escListener = (e) => {
                if (e.key === 'Escape') {
                    this.closeVideoModal();
                    document.removeEventListener('keydown', escListener);
                }
            };
            document.addEventListener('keydown', escListener);

            // OPTIMIZACIÓN MÓVIL: Fullscreen Automático si es posible
            if (window.innerWidth < 768) {
                const videoContainer = container.querySelector('.video-container-responsive');
                if (videoContainer) {
                    try {
                        if (videoContainer.requestFullscreen) videoContainer.requestFullscreen();
                        else if (videoContainer.webkitRequestFullscreen) videoContainer.webkitRequestFullscreen();
                    } catch (e) { }
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
            <div id="video-player-modal" class="modal video-modal-overlay" onclick="if(event.target === this) window.uiManager.closeVideoModal()">
                <div class="modal-content video-modal-container">
                    <div class="video-modal-close-wrapper">
                        <button class="modal-close-btn" onclick="window.uiManager.closeVideoModal()">&times;</button>
                    </div>
                    <div class="modal-body" style="overflow: visible; padding: 0;">
                        <div id="video-modal-content-area"></div>
                        <h3 id="video-modal-title-text" class="video-modal-title"></h3>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    /**
     * Inicia el Visor de Medios (Universal).
     */
    showMediaViewer(url, title) {
        if (!url) return;

        // LÓGICA SMART ROUTING SENIOR
        const isOurContent = this.isOurResource(url);

        // 1. Si NO es nuestro recurso (Excluye GCS) -> ABRIR EN PESTAÑA NUEVA (Seguro y Oficial)
        if (!isOurContent || this.isDriveLink(url)) {
            window.open(url, '_blank');
            return;
        }

        // 2. Si es Nuestro Recurso (GCS) -> ABRIR EN EL MODAL (Experiencia Inmersiva)
        const modal = document.getElementById('media-viewer-modal');
        const img = document.getElementById('media-viewer-img');
        const titleEl = document.getElementById('media-viewer-title');
        const downloadBtn = document.getElementById('media-viewer-download');
        const body = document.getElementById('media-viewer-body');

        if (modal && body) {
            // USAR  RESOLUTOR UNIVERSAL
            const resolvedUrl = window.resolveImageUrl(url);

            // Limpiar visor de restos de iframes anteriores
            if (img) img.style.display = 'none';
            body.querySelectorAll('iframe, video, audio').forEach(el => el.remove());

            if (titleEl) titleEl.innerText = title || 'Visualizando Recurso';

            // Detección y Renderizado
            if (this.isImage(url)) {
                if (img) {
                    img.src = resolvedUrl;
                    img.style.display = 'block';
                }
            } else if (this.isVideo(url)) {
                const video = document.createElement('video');
                video.controls = true;
                video.style.width = '100%';
                video.style.maxHeight = '85vh';
                video.style.borderRadius = '8px';
                video.style.backgroundColor = '#000';
                video.src = resolvedUrl;
                body.appendChild(video);
            } else if (this.isPDF(url)) {
                const iframe = document.createElement('iframe');
                iframe.src = resolvedUrl;
                iframe.style.width = '100%';
                iframe.style.height = '85vh';
                iframe.style.border = 'none';
                iframe.style.borderRadius = '8px';
                iframe.style.backgroundColor = '#fff'; // Necesario para que algunos PDFs no queden transparentes
                body.appendChild(iframe);
            } else if (this.isOffice(url)) {
                const iframe = document.createElement('iframe');
                // Google Docs Viewer (Requiere URL Absoluta accesible publicamente para el motor de Google)
                const absoluteUrl = resolvedUrl.startsWith('http') ? resolvedUrl : `${window.location.origin}${resolvedUrl}`;
                iframe.src = `https://docs.google.com/viewer?url=${encodeURIComponent(absoluteUrl)}&embedded=true`;
                iframe.style.width = '100%';
                iframe.style.height = '85vh';
                iframe.style.border = 'none';
                iframe.style.borderRadius = '8px';
                body.appendChild(iframe);
            } else {
                // Fallback de seguridad
                window.open(resolvedUrl, '_blank');
                return;
            }

            if (downloadBtn) {
                downloadBtn.onclick = () => {
                    // Simulamos clic dinámico para descarga
                    window.open(resolvedUrl, '_blank');
                };
            }

            // Experiencia Inmersiva: Ocultar scrool, Chat y Botones Flotantes
            document.body.style.overflow = 'hidden';

            const chatContainer = document.getElementById('chatbot-container');
            const chatToggle = document.getElementById('chatbot-toggle');
            const libraryToggle = document.querySelector('.library-toggle');

            if (chatContainer) chatContainer.style.visibility = 'hidden';
            if (chatToggle) chatToggle.style.visibility = 'hidden';
            if (libraryToggle) libraryToggle.style.visibility = 'hidden';

            modal.style.display = 'flex';
            this.pushModalState('media-viewer-modal');
        } else {
            // 3. FALLBACK SI NO INYECTÓ HTML
            window.open(url, '_blank');
        }
    }

    closeMediaViewer() {
        const modal = document.getElementById('media-viewer-modal');
        const body = document.getElementById('media-viewer-body');
        if (modal) {
            modal.style.display = 'none';
            if (body) {
                body.querySelectorAll('iframe, video, audio').forEach(el => el.remove());
                const img = document.getElementById('media-viewer-img');
                if (img) {
                    img.src = '';
                    img.style.display = 'none';
                }
            }

            // Restaurar visuales inmersivos
            document.body.style.overflow = '';

            const chatContainer = document.getElementById('chatbot-container');
            const chatToggle = document.getElementById('chatbot-toggle');
            const libraryToggle = document.querySelector('.library-toggle');

            if (chatContainer) chatContainer.style.visibility = '';
            if (chatToggle) chatToggle.style.visibility = '';
            if (libraryToggle) libraryToggle.style.visibility = '';

            this.popModalState('media-viewer-modal');
        }
    }

    injectMediaViewerHTML() {
        if (document.getElementById('media-viewer-modal')) return;

        const modalHTML = `
            <div id="media-viewer-modal" class="modal media-viewer-overlay" onclick="if(event.target === this) window.uiManager.closeMediaViewer()">
                <div class="media-viewer-container">
                    <div class="media-viewer-header">
                        <span id="media-viewer-title" class="media-viewer-title-text">Visualizando Recurso</span>
                        <div class="media-viewer-actions">
                            <a id="media-viewer-full-link" href="#" target="_blank" class="media-btn-download" title="Ver original"><i class="fas fa-external-link-alt"></i></a>
                            <button id="media-viewer-download" class="media-btn-download" title="Descargar"><i class="fas fa-download"></i></button>
                            <button class="media-btn-close" onclick="window.uiManager.closeMediaViewer()">&times;</button>
                        </div>
                    </div>
                    <div id="media-viewer-body" class="media-viewer-body">
                        <img id="media-viewer-img" src="" alt="Recurso">
                        <div id="media-viewer-loader" class="media-loader" style="display:none;">
                            <i class="fas fa-circle-notch fa-spin"></i> Cargando documento...
                        </div>
                    </div>
                </div>
            </div>
            <style>
                .media-viewer-overlay {
                    display: none;
                    position: fixed;
                    top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(0,0,0,0.95);
                    backdrop-filter: blur(15px);
                    z-index: 999999; /* Z-Index extremo para asegurar Full Screen */
                    justify-content: center;
                    align-items: center;
                }
                .media-viewer-container {
                    width: 95%;
                    max-width: 1400px; /* Mas ancho para pdfs y videos */
                    height: 95vh;      /* Ocupa casi todo el alto */
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                }
                .media-viewer-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    color: white;
                    padding: 0 10px;
                }
                .media-viewer-title-text {
                    font-weight: 600;
                    font-size: 1.1rem;
                }
                .media-viewer-actions {
                    display: flex;
                    gap: 15px;
                    align-items: center;
                }
                .media-btn-download, .media-btn-close {
                    background: rgba(255,255,255,0.1);
                    border: none;
                    color: white;
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.2rem;
                    transition: all 0.2s;
                }
                .media-btn-download:hover { background: #3b82f6; }
                .media-btn-close:hover { background: #ef4444; }
                .media-viewer-body {
                    flex: 1;
                    overflow: hidden; /* Evitar scroll interno del Modal */
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    background: transparent;
                }
                .media-viewer-body img {
                    max-width: 100%;
                    max-height: 85vh;
                    object-fit: contain;
                    border-radius: 8px;
                }
                .media-viewer-body iframe {
                    width: 100%;
                    height: 75vh;
                    border: none;
                    border-radius: 8px;
                    display: none;
                }
                .media-loader {
                    color: white;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 10px;
                    font-size: 1rem;
                }
            </style>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    isImage(url) {
        if (!url) return false;
        const cleanUrl = url.split('?')[0].toLowerCase();
        return /\.(png|jpe?g|webp|gif|svg)$/i.test(cleanUrl);
    }

    isPDF(url) {
        if (!url) return false;
        return url.split('?')[0].toLowerCase().endsWith('.pdf');
    }

    isVideo(url) {
        if (!url) return false;
        const clean = url.split('?')[0].toLowerCase();
        return /\.(mp4|webm|mov)$/i.test(clean);
    }

    isOffice(url) {
        if (!url) return false;
        const clean = url.split('?')[0].toLowerCase();
        return /\.(docx?|pptx?|xlsx?)$/i.test(clean);
    }

    isOurResource(url) {
        if (!url) return false;
        if (!url.startsWith('http')) return true; // Relative GCS path
        if (url.includes(window.AppConfig.API_URL)) return true; // Already resolved GCS path
        return false;
    }

    /**
     * NUEVO: Detecta si un enlace pertenece a Google Drive.
     */
    isDriveLink(url) {
        if (!url) return false;
        return url.includes('drive.google.com');
    }

    /**
     * NUEVO: Detecta si un enlace de Drive es una CARPETA (Folder).
     */
    isDriveFolder(url) {
        if (!this.isDriveLink(url)) return false;
        return url.includes('/folders/') || url.includes('folderid=');
    }


    /**
     * Extrae el ID de un enlace de Google Drive
     */
    extractDriveFileId(url) {
        const match = url.match(/\/d\/(.+?)(\/|$)/) || url.match(/id=(.+?)(&|$)/);
        return match ? match[1] : null;
    }


    /**
     * Valida límites para acciones (Simulador, Arena, o Asistente IA).
     * Retorna FALSE si el usuario está bloqueado, TRUE si puede proceder.
     */
    validateFreemiumAction(event, type = 'arena') {
        if (!window.sessionManager) return true;
        const user = window.sessionManager.getUser();

        // Si no hay usuario, dejamos pasar (el checkAuth posterior lo atrapará)
        if (!user) return true;

        // 🛡️ DETECCIÓN DE TIER Y PROPIEDADES (Robusto: camelCase o snake_case)
        const userTier = (user.subscriptionTier || user.subscription_tier || 'free').toLowerCase();
        const usageCount = user.usageCount !== undefined ? user.usageCount : (user.usage_count || 0);
        const maxFreeLimit = user.maxFreeLimit !== undefined ? user.maxFreeLimit : (user.max_free_limit || 50);
        const dailySimUsage = user.dailySimulatorUsage !== undefined ? user.dailySimulatorUsage : (user.daily_simulator_usage || 0);

        // 1. Lógica para Usuarios FREE (Vidas Globales)
        if (userTier === 'free') {
            if (usageCount >= maxFreeLimit) {
                if (event) {
                    event.preventDefault();
                    event.stopPropagation();
                }
                this.showPaywallModal(null, type);
                return false;
            }
            return true;
        }

        // 2. Lógica para Usuarios PREMIUM (Límites Diarios)
        if (type === 'simulator') {
            const limit = userTier === 'basic' ? 15 : 40;
            if (dailySimUsage >= limit) {
                if (event) {
                    event.preventDefault();
                    event.stopPropagation();
                }
                // Disparar modal con contexto simulator para que use los textos correctos
                this.showPaywallModal(null, 'simulator');
                return false;
            }
        }

        return true;
    }

    showPaywallModal(customMsg = null, context = 'arena') {
        const modalId = 'paywall-modal';
        let modal = document.getElementById(modalId);

        // 🛡️ DETECCIÓN DE TIER DINÁMICA
        let userTier = 'free';
        try {
            const user = window.sessionManager?.getUser();
            if (user) userTier = (user.subscriptionTier || user.subscription_tier || 'free').toLowerCase();
        } catch (e) { }

        // CONFIGURACIÓN POR DEFECTO (Free / Global)
        let config = {
            title: '¡Te encantó la prueba!',
            message: customMsg || '¡Te encantó la prueba gratuita!<br>Suscríbete ahora por s/ 9.90.<br><span style="color: #94a3b8; font-size: 0.9rem;">Acceso a más beneficios.</span>',
            btnText: 'Suscríbete ahora',
            btnUrl: '/pricing',
            icon: 'fa-crown'
        };

        // BIFURCACIÓN POR CONTEXTO Y TIER
        if (context === 'simulator') {
            if (userTier === 'basic') {
                config.title = '¡Cuota Diaria Completada!';
                config.message = customMsg || 'Has alcanzado tu límite de <strong>15 simulacros diarios</strong>.<br>Mejora a <strong>Advanced</strong> para obtener 40 simulacros e IA Clínica.';
                config.btnText = 'Mejorar Plan 🚀';
                config.btnUrl = '/pricing';
            } else if (userTier === 'advanced' || userTier === 'admin' || userTier === 'elite') {
                config.title = '¡Meta Diaria Alcanzada!';
                config.message = customMsg || 'Has completado tus <strong>40 simulacros épicos</strong> de hoy. ¡Mañana volvemos con más desafíos!';
                config.btnText = 'Volver al Inicio 🏠';
                config.btnUrl = '/';
                config.icon = 'fa-medal';
            }
        } else {
            // Contexto Arena (Default)
            if (userTier === 'basic') {
                config.title = '¡Cuota Diaria Completada!';
                config.message = customMsg || 'Has alcanzado tu límite de 5 partidas diarias en Arena.<br>Mejora a <strong>Advanced</strong> para duplicar tu cuota y tener IA ilimitada.';
                config.btnText = 'Mejorar Plan 🚀';
                config.btnUrl = '/pricing';
            } else if (userTier === 'advanced' || userTier === 'admin' || userTier === 'elite') {
                config.title = '¡Entrenamiento Finalizado!';
                config.message = customMsg || 'Has completado tus 10 partidas épicas de hoy. ¡Mañana volvemos con más desafíos!';
                config.btnText = 'Volver al Inicio 🏠';
                config.btnUrl = '/';
                config.icon = 'fa-medal';
            }
        }

        if (!modal) {
            const modalHTML = `
            <div id="${modalId}" class="auth-prompt-modal" style="display:flex;">
                <div class="modal-content premium-variant">
                    <div class="modal-header">
                        <h2 id="${modalId}-title" style="background: linear-gradient(90deg, #fbbf24, #f59e0b); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${config.title}</h2>
                        <button class="modal-close-btn" onclick="window.uiManager.popModalState('${modalId}'); document.getElementById('${modalId}').style.display='none'">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="auth-prompt-icon" style="margin-bottom: 20px;">
                           <i id="${modalId}-icon" class="fas ${config.icon}" style="font-size: 3.5rem; color: #ffd700; filter: drop-shadow(0 0 10px rgba(255, 215, 0, 0.4));"></i>
                        </div>
                        <div id="${modalId}-text" class="auth-prompt-main-text" style="font-size: 1.1rem; color: #f8fafc; line-height: 1.6;">
                            ${config.message}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button id="${modalId}-btn" class="btn-primary" style="
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
                        " onclick="window.location.href='${config.btnUrl}'">
                            <i class="fas fa-rocket"></i> <span id="${modalId}-btn-text">${config.btnText}</span>
                        </button>
                    </div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            modal = document.getElementById(modalId);
        } else {
            // Actualizar contenido si ya existe
            const titleEl = document.getElementById(`${modalId}-title`);
            const textEl = document.getElementById(`${modalId}-text`);
            const iconEl = document.getElementById(`${modalId}-icon`);
            const btnEl = document.getElementById(`${modalId}-btn`);
            const btnTextEl = document.getElementById(`${modalId}-btn-text`);

            if (titleEl) titleEl.innerText = config.title;
            if (textEl) textEl.innerHTML = config.message;
            if (iconEl) iconEl.className = `fas ${config.icon}`;
            if (btnEl) btnEl.onclick = () => window.location.href = config.btnUrl;
            if (btnTextEl) btnTextEl.innerText = config.btnText;

            modal.style.display = 'flex';
        }
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
    /**
     * Inyecta el HTML de la modal de captura de visitantes (Join Modal)
     * ✅ MEJORA PREMIUM: Glastomorfismo y Auth Directo
     */
    injectModalHTML() {
        if (document.getElementById(this.modalId)) return;

        const modalHTML = `
            <div id="${this.modalId}" class="auth-prompt-modal">
                <div class="modal-content premium-glass-dark">
                    <div class="modal-header">
                        <h2 style="color: #f8fafc !important;"><i class="fas fa-rocket"></i> Únete a Hub Academia</h2>
                        <button class="modal-close-btn" onclick="window.uiManager.hideAuthPromptModal()">&times;</button>
                    </div>
                    
                    <div class="modal-body">
                        <div class="auth-prompt-icon" style="margin-bottom: 24px;">
                            <div style="
                                width: 70px; height: 70px; 
                                background: linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.08)); 
                                border-radius: 20px; 
                                display: flex; align-items: center; justify-content: center; 
                                margin: 0 auto;
                                border: 1px solid rgba(255, 255, 255, 0.1);
                                box-shadow: 0 8px 16px rgba(0,0,0,0.5);
                                transform: rotate(-5deg);
                            ">
                                <img src="/assets/logo.png" alt="Hub Academia" style="width: 80%; height: 80%; object-fit: contain;">
                            </div>
                        </div>

                        <div style="font-size: 0.9rem; color: #94a3b8; margin-bottom: 5px; line-height: 1.5; padding: 0 10px;">
                            Registra tu progreso real, accede a analítica avanzada y desbloquea +5,000 preguntas.
                        </div>
                    </div>

                    <div class="modal-footer" style="padding: 0 24px 32px 24px;">
                        <button class="btn-primary" onclick="window.triggerGoogleLogin(this)" style="
                            width: 100%; 
                            background: #60a5fa; /* Usamos un color sólido para mejor contraste vs glass */
                            color: #0f172a; 
                            font-weight: 800; 
                            border: none;
                            padding: 16px; 
                            font-size: 1.05rem;
                            border-radius: 14px;
                            box-shadow: 0 4px 20px rgba(96, 165, 250, 0.3);
                            cursor: pointer;
                            display: flex; align-items: center; justify-content: center; gap: 10px;
                            transition: all 0.2s;
                        " onmouseover="this.style.transform='translateY(-2px)'; this.style.background='#93c5fd'" onmouseout="this.style.transform='translateY(0)'; this.style.background='#60a5fa'">
                            <i class="fab fa-google"></i> Continuar con Google
                        </button>
                    </div>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    /**
     * ✅ CENTRALIZACIÓN: Renderiza el banner de Modo Invitado con estilo Premium Glass
     */
    renderGuestBanner(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        if (document.getElementById('guest-mode-banner-premium')) return;

        const banner = document.createElement('div');
        banner.id = 'guest-mode-banner-premium';
        banner.className = 'premium-glass-dark';
        banner.style.cssText = 'border-radius: 20px; padding: 1.5rem; margin-bottom: 2rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1.5rem; animation: fadeIn 0.8s ease-out;';
        banner.innerHTML = `
            <div style="display: flex; align-items: center; gap: 1.2rem;">
                <div style="width: 54px; height: 54px; background: rgba(255, 255, 255, 0.05); border-radius: 16px; display: flex; align-items: center; justify-content: center; color: #f8fafc; font-size: 1.6rem; border: 1px solid rgba(255, 255, 255, 0.1);">
                    <i class="fas fa-user-astronaut"></i>
                </div>
                <div>
                    <h3 style="color: #f8fafc; margin: 0; font-size: 1.15rem; font-weight: 700;">Estás en Modo Invitado</h3>
                    <p style="color: #94a3b8; margin: 0.3rem 0 0 0; font-size: 0.9rem; line-height: 1.4;">Regístrate para guardar tu progreso académico y acceder a todas las funciones.</p>
                </div>
            </div>
            <button id="banner-auth-trigger" class="btn-action" style="background: #f8fafc; color: #0f172a; padding: 0.8rem 1.8rem; border-radius: 12px; font-weight: 700; border: none; cursor: pointer; box-shadow: 0 4px 15px rgba(255, 255, 255, 0.1); transition: all 0.2s;" 
                onclick="window.triggerGoogleLogin(this)"
                onmouseover="this.style.transform='scale(1.05)'; this.style.background='#fff'" onmouseout="this.style.transform='scale(1)'; this.style.background='#f8fafc'">
                <i class="fab fa-google"></i> Continuar con Google
            </button>
        `;
        container.prepend(banner);
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
                    width: 100%;
                    max-width: 1200px;
                    justify-content: center;
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
                    white-space: nowrap;
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
                    white-space: nowrap;
                }
                .upgrade-btn-small:hover {
                    transform: scale(1.05);
                }

                /* 📱 MOBILE RESPONSIVE OPTIMIZATION */
                @media (max-width: 600px) {
                    .freemium-status-bar {
                        padding: 0 10px;
                    }
                    .status-content {
                        gap: 8px;
                        justify-content: space-between;
                    }
                    .hide-mobile {
                        display: none !important;
                    }
                    .usage-pill {
                        padding: 4px 8px;
                        font-size: 0.85rem;
                    }
                    .upgrade-btn-small {
                        padding: 4px 10px;
                        font-size: 0.75rem;
                    }
                    .probation-text {
                        font-size: 0.8rem;
                        font-weight: 700;
                    }
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
                    <span class="probation-text">⚡ <span class="hide-mobile">MODO </span>PRUEBA</span>
                    <div class="usage-pill">
                        <i class="fas fa-bolt"></i> <span id="free-usage-count">--/--</span>
                    </div>
                    <span class="hide-mobile">restantes</span>
                    <button class="upgrade-btn-small" onclick="window.location.href='/pricing'">
                         💎 <span class="hide-mobile">Activar </span>Ilimitado
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
        const limit = user.maxFreeLimit !== undefined ? user.maxFreeLimit : (user.max_free_limit || 50);
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
                                        <strong style="color: #f1f5f9; display: block; margin-bottom: 1px;">50 Pases de Vidas Globales</strong>
                                        <div style="font-size: 0.8rem; color: #94a3b8; line-height: 1.3;">Para simulacros, Quiz Arena, Asistente y más.</div>
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
