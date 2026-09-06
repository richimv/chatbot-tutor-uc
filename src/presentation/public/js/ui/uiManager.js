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
        // 🛡️ Estilos inline de seguridad: garantizan position:fixed incluso si components.css no está cargado
        div.style.cssText = 'position:fixed;top:70px;left:50%;transform:translateX(-50%) translateY(-120px);z-index:9999;transition:transform 0.4s cubic-bezier(0.175,0.885,0.32,1.275);pointer-events:none;';
        div.innerHTML = `
            <div id="status-pill" class="status-pill">
                <span class="status-dot"></span>
                <span id="status-text">Sin conexión</span>
            </div>
        `;
        document.body.appendChild(div);
    }

    handleConnectivityChange(isOnline, wasOffline = false) {
        this.isOnline = isOnline;
        const container = document.getElementById('status-pill-container');
        const pill = document.getElementById('status-pill');
        const text = document.getElementById('status-text');

        if (!isOnline) {
            pill.className = 'status-pill offline';
            text.textContent = 'Sin conexión - Trabajando localmente';
            // 🛡️ También aplicar estilo inline para páginas sin components.css
            container.style.transform = 'translateX(-50%) translateY(0)';
            this._wasOffline = true;
        } else {
            // 🚨 FIX: Solo mostrar "Conectado" si se recuperó de un estado offline
            // No mostrar en la carga inicial cuando ya hay conexión
            if (this._wasOffline) {
                pill.className = 'status-pill online';
                text.textContent = 'Conectado';
                container.style.transform = 'translateX(-50%) translateY(0)';
                // Ocultar después de 3 segundos
                setTimeout(() => {
                    container.style.transform = 'translateX(-50%) translateY(-120px)';
                    container.classList.remove('active');
                    this._wasOffline = false;
                }, 3000);
            } else {
                // Conexión inicial normal: mantener oculto silenciosamente
                container.style.transform = 'translateX(-50%) translateY(-120px)';
                container.classList.remove('active');
            }
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

                // ✅ USAR NETWORK SERVICE (CENTRALIZADO)
                const response = await window.NetworkService.fetch(url, options);

                // Si la respuesta es OK o no es reintentable (ej. 401, 400), salir
                if (response.ok || response.status < 500) return response;

                // Si es un error 500+ y es reintentable, seguimos al catch para el backoff
                throw new Error(`Server Error: ${response.status}`);

            } catch (err) {
                // Si es un error de autorización (401/403), NetworkService ya disparó el logout
                if (err.message === 'Unauthorized') throw err;

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
                    if (modalId === 'lightboxModal') {
                        if (typeof window.closeLightbox === 'function') {
                            window.closeLightbox(true);
                        } else if (modal.classList.contains('active')) {
                            modal.classList.remove('active');
                        }
                    } else if (modal.classList.contains('active')) {
                        modal.classList.remove('active');
                        // Limpiar posible estilo inline residual para no romper futuras aperturas dependientes de la clase CSS
                        if (modal.style.display === 'none' || modal.style.display === 'flex') {
                            modal.style.display = '';
                        }
                    } else if (modalId === 'note-modal-overlay') {
                        if (window.libraryUI) {
                            window.libraryUI.closeNoteModal();
                        } else {
                            modal.classList.remove('open');
                        }
                    } else {
                        // Comportamiento regular para modales inyectados (como auth o video)
                        modal.style.display = 'none';
                    }
                }
            });
            this.openModals.clear();
            this._modalHistoryStack = [];
            document.body.classList.remove('modal-open');
        }
    }

    /**
     * Registra el modal en la historia para cerrarlo con botón Atrás.
     */
    pushModalState(modalId) {
        if (window.tooltipManager && typeof window.tooltipManager.hideTooltip === 'function') {
            window.tooltipManager.hideTooltip();
        }
        this.openModals.add(modalId);
        document.body.classList.add('modal-open');
        this._modalHistoryStack = this._modalHistoryStack || [];
        this._modalHistoryStack.push({
            state: window.history.state || null,
            href: window.location.href
        });
        window.history.pushState({ modalOpen: true, modalId }, '');
    }

    /**
     * Quita el modal del Set cuando se cierra manualmente (botón 'x', cancelar o guardar).
     */
    popModalState(modalId) {
        if (this.openModals.has(modalId)) {
            this.openModals.delete(modalId);
            if (this.openModals.size === 0) {
                document.body.classList.remove('modal-open');
            }
            // Restaurar el estado de navegación silenciosamente SIN disparar evento 'popstate'
            if (this._modalHistoryStack && this._modalHistoryStack.length > 0) {
                const prev = this._modalHistoryStack.pop();
                if (window.history.state && window.history.state.modalOpen) {
                    window.history.replaceState(prev.state, '', prev.href);
                }
            } else if (window.history.state && window.history.state.modalOpen) {
                window.history.replaceState(null, '', window.location.href);
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
                        
                        <p style="color: var(--text-secondary); font-size: 1rem; line-height: 1.5; margin-bottom: 25px;">
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
            const limit = user.maxFreeLimit !== undefined ? user.maxFreeLimit : (user.max_free_limit || 10);
            if (usage >= limit) {
                this.showPaywallModal();
                return { allowed: false, reason: 'limit_reached' };
            }
        }

        // Caso 2b: Validar exactamente en el Backend
        try {
            const response = await window.NetworkService.fetch(`${window.AppConfig.API_URL}/api/usage/verify`, {
                method: 'POST',
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
                    user.usageCount = data.usage || 10;
                    window.sessionManager.notifyStateChange();
                }
                this.showPaywallModal();
                return { allowed: false, reason: 'limit_reached' };
            } else {
                console.error('Error verificando acceso:', data);
                this.showToast('Error al verificar acceso. Reintenta.', 'error');
                return { allowed: false, reason: 'error' };
            }
        } catch (error) {
            console.error('Error de red:', error);
            this.showToast('Error de conexión.', 'warning');
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
        } else if (type === 'other' || this.isImage(url) || this.isDriveLink(url) || this.isPDF(url) || this.isOffice(url)) {
            // 'other', imágenes, PDFs, documentos de Office y links de Drive pasan por el MediaViewer
            // El MediaViewer internamente decidirá si abrir en pestaña nueva (Drive/externos) o visor inmersivo (GCS/locales)
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
    async unlockAndNavigate(id, type = 'book', isPremium = false, openDirectly = false) {
        // ✅ REGLA DE EXPERIENCIA DIRECTA:
        // Si es video o tiene habilitada la Apertura Directa (openDirectly = true), abrir el visor directamente.
        if (type === 'video' || openDirectly === true || String(openDirectly).toLowerCase() === 'true' || openDirectly === 1) {
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
            const status = String(user.subscriptionStatus || user.subscription_status || '').toLowerCase();
            const tier = String(user.subscriptionTier || user.subscription_tier || 'free').toLowerCase();
            // Si es active (Premium) o admin, NUNCA está bloqueado
            if ((status === 'active' && tier !== 'free') || user.role === 'admin' || tier === 'admin') return false;

            // Freemium / Pending / Expired: Solo bloquear si ya no tiene usos (0 vidas restantes)
            const usage = Number(user.usageCount !== undefined ? user.usageCount : (user.usage_count || 0));
            const limit = Number(user.maxFreeLimit !== undefined ? user.maxFreeLimit : (user.max_free_limit || 10));
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
                // Soporte para URLs de inserción (embed/ID)
                if (!videoId && urlObj.pathname.includes('/embed/')) {
                    videoId = urlObj.pathname.split('/embed/')[1].split('?')[0];
                }
            } else if (urlObj.hostname.includes('youtu.be')) {
                videoId = urlObj.pathname.slice(1).split('?')[0];
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
                        src="https://www.youtube.com/embed/${videoId}?autoplay=1&controls=1&rel=0&playsinline=1&fs=1&modestbranding=1" 
                        title="${title || 'Video Hub Academia'}" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                        allowfullscreen>
                    </iframe>
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

        // 1. Si NO es nuestro recurso y no es imagen -> ABRIR EN PESTAÑA NUEVA
        // Pero si ES una imagen, siempre intentamos usar el modal para mejor UX
        if ((!isOurContent || this.isDriveLink(url)) && !this.isImage(url)) {
            window.open(url, '_blank');
            return;
        }

        // 2. Si es Nuestro Recurso (GCS) -> ABRIR EN EL MODAL (Experiencia Inmersiva)
        const modal = document.getElementById('media-viewer-modal');
        const img = document.getElementById('media-viewer-img');
        const titleEl = document.getElementById('media-viewer-title');
        const downloadBtn = document.getElementById('media-viewer-download');
        const fullLinkBtn = document.getElementById('media-viewer-full-link');
        const body = document.getElementById('media-viewer-body');

        const zoomInBtn = document.getElementById('media-viewer-zoom-in');
        const zoomOutBtn = document.getElementById('media-viewer-zoom-out');
        const zoomResetBtn = document.getElementById('media-viewer-zoom-reset');

        if (modal && body) {
            // USAR RESOLUTOR UNIVERSAL
            const resolvedUrl = window.resolveImageUrl(url);

            // Limpiar visor de restos de iframes anteriores y destruir zoom anterior
            this.destroyImageZoomAndPan();
            if (img) {
                img.style.display = 'none';
                img.style.transform = '';
                img.className = '';
            }
            body.querySelectorAll('iframe, video, audio').forEach(el => el.remove());

            if (titleEl) titleEl.innerText = title || 'Visualizando Recurso';

            // Detección y Renderizado
            if (this.isImage(url)) {
                if (img) {
                    img.referrerPolicy = 'no-referrer';
                    img.src = resolvedUrl;
                    img.style.display = 'block';
                }
                if (zoomInBtn) zoomInBtn.style.display = 'flex';
                if (zoomOutBtn) zoomOutBtn.style.display = 'flex';
                if (zoomResetBtn) zoomResetBtn.style.display = 'flex';

                // Inicializar zoom y pan interactivo
                this.setupImageZoomAndPan(img);
            } else {
                if (zoomInBtn) zoomInBtn.style.display = 'none';
                if (zoomOutBtn) zoomOutBtn.style.display = 'none';
                if (zoomResetBtn) zoomResetBtn.style.display = 'none';

                if (this.isVideo(url)) {
                    const video = document.createElement('video');
                    video.controls = true;
                    video.src = resolvedUrl;
                    body.appendChild(video);
                } else if (this.isPDF(url)) {
                    const iframe = document.createElement('iframe');
                    iframe.src = resolvedUrl;
                    iframe.style.backgroundColor = '#fff'; // Evitar transparencias
                    body.appendChild(iframe);
                } else if (this.isOffice(url)) {
                    const iframe = document.createElement('iframe');
                    const absoluteUrl = resolvedUrl.startsWith('http') ? resolvedUrl : `${window.location.origin}${resolvedUrl}`;
                    iframe.src = `https://docs.google.com/viewer?url=${encodeURIComponent(absoluteUrl)}&embedded=true`;
                    body.appendChild(iframe);
                } else {
                    window.open(resolvedUrl, '_blank');
                    return;
                }
            }

            if (fullLinkBtn) {
                fullLinkBtn.href = resolvedUrl;
            }

            if (downloadBtn) {
                downloadBtn.onclick = () => {
                    if (this.isOurResource(url)) {
                        const downloadUrl = resolvedUrl + (resolvedUrl.includes('?') ? '&' : '?') + 'download=true';
                        window.open(downloadUrl, '_blank');
                    } else {
                        window.open(resolvedUrl, '_blank');
                    }
                };
            }

            // Experiencia Inmersiva: Ocultar scroll, Chat y Botones Flotantes
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
            window.open(url, '_blank');
        }
    }

    closeMediaViewer() {
        const modal = document.getElementById('media-viewer-modal');
        const body = document.getElementById('media-viewer-body');
        if (modal) {
            modal.style.display = 'none';
            
            // Destruir controladores de zoom/pan
            this.destroyImageZoomAndPan();

            if (body) {
                body.querySelectorAll('iframe, video, audio').forEach(el => el.remove());
                const img = document.getElementById('media-viewer-img');
                if (img) {
                    img.src = '';
                    img.style.display = 'none';
                    img.style.transform = '';
                    img.className = '';
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

    setupImageZoomAndPan(img) {
        if (!img) return;

        this.zoomState = {
            scale: 1,
            x: 0,
            y: 0,
            isDragging: false,
            startX: 0,
            startY: 0,
            lastTouchDist: 0
        };

        const updateTransform = () => {
            img.style.transform = `translate(${this.zoomState.x}px, ${this.zoomState.y}px) scale(${this.zoomState.scale})`;
            if (this.zoomState.scale > 1) {
                img.classList.add('zoom-active');
            } else {
                img.classList.remove('zoom-active');
            }
        };

        const resetZoom = () => {
            this.zoomState.scale = 1;
            this.zoomState.x = 0;
            this.zoomState.y = 0;
            img.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
            updateTransform();
        };

        // Botón Zoom In
        const zoomInBtn = document.getElementById('media-viewer-zoom-in');
        if (zoomInBtn) {
            zoomInBtn.onclick = () => {
                this.zoomState.scale = Math.min(this.zoomState.scale * 1.5, 6);
                img.style.transition = 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)';
                updateTransform();
            };
        }

        // Botón Zoom Out
        const zoomOutBtn = document.getElementById('media-viewer-zoom-out');
        if (zoomOutBtn) {
            zoomOutBtn.onclick = () => {
                this.zoomState.scale = Math.max(this.zoomState.scale / 1.5, 1);
                if (this.zoomState.scale === 1) {
                    resetZoom();
                } else {
                    img.style.transition = 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)';
                    updateTransform();
                }
            };
        }

        // Botón Zoom Reset
        const zoomResetBtn = document.getElementById('media-viewer-zoom-reset');
        if (zoomResetBtn) {
            zoomResetBtn.onclick = resetZoom;
        }

        // Drag / Pan con el Mouse
        const onMouseDown = (e) => {
            if (this.zoomState.scale <= 1) return;
            e.preventDefault();
            this.zoomState.isDragging = true;
            this.zoomState.startX = e.clientX - this.zoomState.x;
            this.zoomState.startY = e.clientY - this.zoomState.y;
            img.style.transition = 'none';
        };

        const onMouseMove = (e) => {
            if (!this.zoomState.isDragging) return;
            e.preventDefault();
            this.zoomState.x = e.clientX - this.zoomState.startX;
            this.zoomState.y = e.clientY - this.zoomState.startY;
            updateTransform();
        };

        const onMouseUp = () => {
            this.zoomState.isDragging = false;
            img.style.transition = 'transform 0.1s ease-out';
        };

        img.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);

        // Zoom con la Rueda (Wheel)
        const onWheel = (e) => {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 1.2 : 0.8;
            this.zoomState.scale = Math.max(1, Math.min(this.zoomState.scale * delta, 6));

            if (this.zoomState.scale === 1) {
                this.zoomState.x = 0;
                this.zoomState.y = 0;
            }
            img.style.transition = 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)';
            updateTransform();
        };
        img.addEventListener('wheel', onWheel);

        // Doble Clic para Zoom Rápido
        const onDblClick = () => {
            if (this.zoomState.scale > 1) {
                resetZoom();
            } else {
                this.zoomState.scale = 2.5;
                img.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
                updateTransform();
            }
        };
        img.addEventListener('dblclick', onDblClick);

        // Soporte Táctil (Pinch-to-zoom y Arrastre en Móviles)
        const onTouchStart = (e) => {
            if (e.touches.length === 1 && this.zoomState.scale > 1) {
                this.zoomState.isDragging = true;
                this.zoomState.startX = e.touches[0].clientX - this.zoomState.x;
                this.zoomState.startY = e.touches[0].clientY - this.zoomState.y;
                img.style.transition = 'none';
            } else if (e.touches.length === 2) {
                this.zoomState.isDragging = false;
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                this.zoomState.lastTouchDist = dist;
            }
        };

        const onTouchMove = (e) => {
            if (this.zoomState.isDragging && e.touches.length === 1) {
                e.preventDefault();
                this.zoomState.x = e.touches[0].clientX - this.zoomState.startX;
                this.zoomState.y = e.touches[0].clientY - this.zoomState.startY;
                updateTransform();
            } else if (e.touches.length === 2) {
                e.preventDefault();
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                const factor = dist / this.zoomState.lastTouchDist;
                this.zoomState.lastTouchDist = dist;

                this.zoomState.scale = Math.max(1, Math.min(this.zoomState.scale * factor, 6));
                if (this.zoomState.scale === 1) {
                    this.zoomState.x = 0;
                    this.zoomState.y = 0;
                }
                img.style.transition = 'none';
                updateTransform();
            }
        };

        const onTouchEnd = () => {
            this.zoomState.isDragging = false;
            img.style.transition = 'transform 0.15s ease-out';
        };

        img.addEventListener('touchstart', onTouchStart);
        img.addEventListener('touchmove', onTouchMove, { passive: false });
        img.addEventListener('touchend', onTouchEnd);

        // Guardar destructora de eventos
        this._zoomCleanup = () => {
            img.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            img.removeEventListener('wheel', onWheel);
            img.removeEventListener('dblclick', onDblClick);
            img.removeEventListener('touchstart', onTouchStart);
            img.removeEventListener('touchmove', onTouchMove);
            img.removeEventListener('touchend', onTouchEnd);
        };
    }

    destroyImageZoomAndPan() {
        if (typeof this._zoomCleanup === 'function') {
            this._zoomCleanup();
            this._zoomCleanup = null;
        }
        this.zoomState = null;
    }

    injectMediaViewerHTML() {
        if (document.getElementById('media-viewer-modal')) return;

        const modalHTML = `
            <div id="media-viewer-modal" class="modal media-viewer-overlay" onclick="if(event.target === this) window.uiManager.closeMediaViewer()">
                <div class="media-viewer-container">
                    <div class="media-viewer-header">
                        <span id="media-viewer-title" class="media-viewer-title-text">Visualizando Recurso</span>
                        <div class="media-viewer-actions">
                            <button id="media-viewer-zoom-in" class="media-btn-action" title="Acercar"><i class="fas fa-search-plus"></i></button>
                            <button id="media-viewer-zoom-out" class="media-btn-action" title="Alejar"><i class="fas fa-search-minus"></i></button>
                            <button id="media-viewer-zoom-reset" class="media-btn-action" title="Restaurar zoom"><i class="fas fa-sync-alt"></i></button>
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
                    top: 0; left: 0; width: 100vw; height: 100vh;
                    background: rgba(10, 10, 10, 0.98);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    z-index: 9999999;
                    justify-content: center;
                    align-items: center;
                    animation: fadeInMedia 0.25s cubic-bezier(0.16, 1, 0.3, 1);
                }
                @keyframes fadeInMedia {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .media-viewer-container {
                    width: 96%;
                    max-width: 1200px;
                    height: 94vh;
                    display: flex;
                    flex-direction: column;
                    background: rgba(20, 20, 20, 0.5);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 20px;
                    overflow: hidden;
                    box-shadow: 0 30px 70px rgba(0, 0, 0, 0.8);
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                }
                .media-viewer-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    color: #f1f5f9;
                    padding: 15px 24px;
                    background: rgba(10, 10, 10, 0.6);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                    backdrop-filter: blur(5px);
                }
                .media-viewer-title-text {
                    font-weight: 600;
                    font-size: 1.15rem;
                    color: #f8fafc;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 50%;
                }
                .media-viewer-actions {
                    display: flex;
                    gap: 10px;
                    align-items: center;
                }
                .media-btn-action, .media-btn-download, .media-btn-close {
                    background: rgba(255, 255, 255, 0.06);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    color: #e2e8f0;
                    width: 38px;
                    height: 38px;
                    border-radius: 10px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.1rem;
                    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                    text-decoration: none;
                }
                .media-btn-action:hover, .media-btn-download:hover {
                    background: #3b82f6;
                    color: #fff;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
                }
                .media-btn-close {
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.2);
                    color: #f87171;
                }
                .media-btn-close:hover {
                    background: #ef4444;
                    color: #fff;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
                }
                .media-viewer-body {
                    flex: 1;
                    overflow: hidden;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    background: #050505;
                    position: relative;
                }
                .media-viewer-body img {
                    max-width: 100%;
                    max-height: 100%;
                    object-fit: contain;
                    border-radius: 4px;
                    cursor: grab;
                    transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                    user-select: none;
                    -webkit-user-drag: none;
                }
                .media-viewer-body img.zoom-active {
                    cursor: grabbing;
                }
                .media-viewer-body iframe, .media-viewer-body video {
                    width: 100%;
                    height: 100%;
                    border: none;
                    outline: none;
                    background: transparent;
                }
                .media-loader {
                    position: absolute;
                    color: #94a3b8;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 12px;
                    font-size: 1rem;
                    pointer-events: none;
                    z-index: 10;
                }
                @media (max-width: 768px) {
                    .media-viewer-container {
                        width: 100%;
                        height: 100%;
                        border-radius: 0;
                        border: none;
                    }
                    .media-viewer-header {
                        padding: 10px 15px;
                    }
                    .media-viewer-title-text {
                        font-size: 1rem;
                        max-width: 40%;
                    }
                    .media-btn-action, .media-btn-download, .media-btn-close {
                        width: 34px;
                        height: 34px;
                        font-size: 1rem;
                    }
                }
            </style>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    isImage(url) {
        if (!url) return false;
        const cleanUrl = url.split('?')[0].toLowerCase();
        // Extensiones estándar
        if (/\.(png|jpe?g|webp|gif|svg)$/i.test(cleanUrl)) return true;
        // ✅ MEJORA: Detectar imágenes servidas por nuestra API (GCS/AI/Thumbnails)
        if (url.includes('/api/media/gcs') || 
            url.includes('/api/media/explanation') || 
            url.includes('/api/admin/upload-editor') ||
            url.includes('thumbnails/')) return true;
        return false;
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
        // Si es una ruta relativa o contiene thumbnails, es nuestro
        if (!url.startsWith('http') || url.includes('thumbnails/')) return true;
        // ✅ MEJORA: Detectar si es una URL servida por nuestro proxy o dominio
        const domain = window.location.hostname;
        if (url.includes(domain) || 
            url.includes('/api/media/gcs') || 
            url.includes('/api/media/explanation')) return true;
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
        const userTier = String(user.subscriptionTier || user.subscription_tier || 'free').toLowerCase();
        const userStatus = String(user.subscriptionStatus || user.subscription_status || 'pending').toLowerCase();
        const isAdmin = user.role === 'admin' || userTier === 'admin';
        if (isAdmin) return true;

        const isPaidActive = (userTier === 'basic' || userTier === 'advanced' || userTier === 'premium') && userStatus === 'active';
        const usageCount = Number(user.usageCount !== undefined ? user.usageCount : (user.usage_count || 0));
        const maxFreeLimit = Number(user.maxFreeLimit !== undefined ? user.maxFreeLimit : (user.max_free_limit || 10));
        const dailySimUsage = Number(user.dailySimulatorUsage !== undefined ? user.dailySimulatorUsage : (user.daily_simulator_usage || 0));

        // 1. Lógica para Usuarios FREE / PENDING / EXPIRED (Vidas Globales)
        if (!isPaidActive) {
            if (usageCount >= maxFreeLimit) {
                if (event && typeof event.preventDefault === 'function') {
                    event.preventDefault();
                    event.stopPropagation();
                }
                this.showPaywallModal(null, type);
                return false;
            }
            return true;
        }

        // 2. Lógica para Usuarios PREMIUM (Límites Diarios)
        if (type === 'simulator' || type === 'diagnostic') {
            const limits = user.limits || {};
            const limit = Number(limits.simulator !== undefined ? limits.simulator : (userTier === 'basic' ? 15 : 50));
            if (dailySimUsage >= limit) {
                if (event && typeof event.preventDefault === 'function') {
                    event.preventDefault();
                    event.stopPropagation();
                }
                // Disparar modal con contexto simulator/diagnostic para que use los textos correctos
                this.showPaywallModal(null, type);
                return false;
            }
        } else if (type === 'chat_standard' || type === 'chat' || type === 'flashcard_tutor' || type === 'quiz_tutor') {
            const dailyAiUsage = Number(user.dailyAiUsage !== undefined ? user.dailyAiUsage : (user.daily_ai_usage || 0));
            const limits = user.limits || {};
            const limit = Number(limits.chat_standard !== undefined ? limits.chat_standard : (userTier === 'basic' ? 50 : 100));
            if (dailyAiUsage >= limit) {
                if (event && typeof event.preventDefault === 'function') {
                    event.preventDefault();
                    event.stopPropagation();
                }
                this.showPaywallModal(null, 'quiz_tutor');
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
            if (user) userTier = String(user.subscriptionTier || user.subscription_tier || 'free').toLowerCase().trim();
        } catch (e) { }

        // CONFIGURACIÓN BASE
        let config = {
            title: '¡Desbloquea el Acceso Premium! 💎',
            message: customMsg || 'Suscríbete hoy y accede a todos los beneficios y herramientas ilimitadas de Hub Academia.',
            btnText: 'Ver Planes Premium',
            btnUrl: '/pricing',
            icon: 'fa-crown',
            badgeText: 'Acceso Premium',
            badgeIcon: 'fa-crown'
        };

        let features = [];

        // BIFURCACIÓN POR CONTEXTO Y TIER
        if (context === 'chat_standard' || context === 'chat' || context === 'flashcard_tutor' || context === 'quiz_tutor') {
            config.icon = 'fa-comments';
            if (userTier === 'basic') {
                config.title = '¡Límite de Consultas Alcanzado! 🚀';
                config.message = customMsg || 'Has alcanzado tu límite de consultas diarias al Tutor IA para el Plan Básico (50 consultas/día). Mejora tu plan a Avanzado para obtener 100 consultas diarias y soporte pedagógico/médico profundo.';
                config.btnText = 'Mejorar a Avanzado';
                config.btnUrl = '/pricing';
                config.icon = 'fa-rocket';
                config.badgeText = 'Plan Avanzado';
                config.badgeIcon = 'fa-rocket';
                features = [
                    { icon: 'fa-check-circle', text: '100 consultas diarias al Tutor IA' },
                    { icon: 'fa-check-circle', text: 'Tutoría especializada en Salud y Educación' }
                ];
            } else if (userTier === 'advanced' || userTier === 'admin') {
                config.title = '¡Meta Diaria Alcanzada! 🏆';
                config.message = customMsg || 'Has completado tus consultas diarias al Tutor IA para el Plan Avanzado (100 consultas/día). ¡Mañana se renovará automáticamente tu cuota!';
                config.btnText = 'Volver al Inicio';
                config.btnUrl = '/';
                config.icon = 'fa-medal';
                config.badgeText = 'Meta Diaria';
                config.badgeIcon = 'fa-medal';
                features = [
                    { icon: 'fa-check-circle', text: 'Cuota diaria de consultas completada al 100%' },
                    { icon: 'fa-check-circle', text: 'Tus notas y flashcards continúan disponibles' }
                ];
            } else {
                // Tier FREE o EXPIRED
                config.title = '¡Prueba Gratuita Finalizada! 💎';
                config.message = customMsg || 'Has consumido tus 10 vidas de prueba gratuitas. Activa un plan premium para continuar practicando con el Tutor IA sin interrupciones.';
                config.btnText = 'Ver Planes Premium';
                config.btnUrl = '/pricing';
                config.icon = 'fa-crown';
                config.badgeText = 'Acceso Ilimitado';
                config.badgeIcon = 'fa-crown';
                features = [
                    { icon: 'fa-check-circle', text: 'Consultas continuas sin esperas semanales' },
                    { icon: 'fa-check-circle', text: 'Retroalimentación detallada y resolución de dudas 24/7' }
                ];
            }
        } else if (context === 'simulator' || context === 'diagnostic') {
            config.icon = 'fa-chart-pie';
            if (userTier === 'basic') {
                config.title = '¡Límite Diario Alcanzado! 🚀';
                config.message = customMsg || 'Has alcanzado tu límite diario para este recurso. Mejora tu plan a Avanzado para acceder a diagnósticos IA en tiempo real y mayor capacidad.';
                config.btnText = 'Mejorar a Avanzado';
                config.btnUrl = '/pricing';
                config.icon = 'fa-rocket';
                config.badgeText = 'Plan Avanzado';
                config.badgeIcon = 'fa-rocket';
                features = [
                    { icon: 'fa-check-circle', text: 'Hasta 50 simulacros diarios con cronómetro' },
                    { icon: 'fa-check-circle', text: 'Diagnósticos inteligentes de preguntas falladas' }
                ];
            } else if (userTier === 'advanced' || userTier === 'admin') {
                config.title = '¡Meta Diaria Alcanzada! 🏆';
                config.message = customMsg || 'Has completado tus diagnósticos y simulacros de hoy. ¡Mañana se renovará automáticamente tu cuota!';
                config.btnText = 'Volver al Inicio';
                config.btnUrl = '/';
                config.icon = 'fa-medal';
                config.badgeText = 'Meta Diaria';
                config.badgeIcon = 'fa-medal';
                features = [
                    { icon: 'fa-check-circle', text: 'Simulacros del día completados con éxito' },
                    { icon: 'fa-check-circle', text: 'Historial y estadísticas guardados en tu perfil' }
                ];
            } else {
                // Tier FREE o EXPIRED
                config.title = '¡Desbloquea el Acceso Premium! 💎';
                config.message = customMsg || 'Has consumido tus 10 vidas de prueba gratuitas. Suscríbete hoy para acceder a diagnósticos inteligentes con IA y simulacros ilimitados.';
                config.btnText = 'Ver Planes Premium';
                config.btnUrl = '/pricing';
                config.icon = 'fa-crown';
                config.badgeText = 'Acceso Premium';
                config.badgeIcon = 'fa-crown';
                features = [
                    { icon: 'fa-check-circle', text: 'Simulacros ilimitados con banco oficial de preguntas' },
                    { icon: 'fa-check-circle', text: 'Diagnósticos inteligentes y retroalimentación IA' }
                ];
            }
        } else if (context === 'flashcards' || context === 'monthly_flashcards' || context === 'study') {
            if (userTier === 'basic') {
                config.title = '¡Función Exclusiva Plan Avanzado! 🚀';
                config.message = customMsg || 'La generación con IA, audios TTS e imágenes en flashcards son exclusivas del Plan Avanzado. ¡Mejora tu plan para activarlas!';
                config.btnText = 'Mejorar a Avanzado';
                config.btnUrl = '/pricing';
                config.icon = 'fa-rocket';
                config.badgeText = 'Plan Avanzado';
                config.badgeIcon = 'fa-rocket';
                features = [
                    { icon: 'fa-check-circle', text: 'Generación asistida de flashcards con IA' },
                    { icon: 'fa-check-circle', text: 'Narración con audio TTS HD e imágenes' }
                ];
            } else if (userTier === 'advanced' || userTier === 'admin') {
                config.title = '¡Cuota Mensual Completada! 🏆';
                config.message = customMsg || 'Has alcanzado tu límite mensual de generación de flashcards con IA. Tu cuota se renovará automáticamente el próximo mes.';
                config.btnText = 'Entendido';
                config.btnUrl = '/repaso';
                config.icon = 'fa-medal';
                config.badgeText = 'Cuota Completada';
                config.badgeIcon = 'fa-medal';
                features = [
                    { icon: 'fa-check-circle', text: 'Repaso espaciado inteligente siempre disponible' },
                    { icon: 'fa-check-circle', text: 'Creación y edición manual ilimitada' }
                ];
            } else {
                config.title = '¡Desbloquea el Acceso Premium! 💎';
                config.message = customMsg || 'Has consumido tus vidas de prueba gratuitas. Suscríbete hoy a un plan premium para repasar tus flashcards sin interrupciones.';
                config.btnText = 'Ver Planes Premium';
                config.btnUrl = '/pricing';
                config.icon = 'fa-crown';
                config.badgeText = 'Acceso Premium';
                config.badgeIcon = 'fa-crown';
                features = [
                    { icon: 'fa-check-circle', text: 'Sesiones de repaso espaciado ilimitadas' },
                    { icon: 'fa-check-circle', text: 'Sincronización en la nube multidispositivo' }
                ];
            }
        } else {
            // Contexto Autoevaluación / Default
            if (userTier === 'basic') {
                config.title = '¡Límite Diario Alcanzado! 🚀';
                config.message = customMsg || 'Has alcanzado tu límite de uso diario. Mejora tu plan para continuar entrenando.';
                config.btnText = 'Mejorar Plan';
                config.btnUrl = '/pricing';
                config.icon = 'fa-rocket';
                config.badgeText = 'Plan Avanzado';
                config.badgeIcon = 'fa-rocket';
                features = [
                    { icon: 'fa-check-circle', text: 'Capacidad ampliada en todas las herramientas del Hub' },
                    { icon: 'fa-check-circle', text: 'Tutoría pedagógica y médica profunda' }
                ];
            } else if (userTier === 'advanced' || userTier === 'admin') {
                config.title = '¡Meta Diaria Alcanzada! 🏆';
                config.message = customMsg || 'Has completado tus autoevaluaciones de hoy. ¡Mañana volvemos con más desafíos!';
                config.btnText = 'Volver al Inicio';
                config.btnUrl = '/';
                config.icon = 'fa-medal';
                config.badgeText = 'Meta Diaria';
                config.badgeIcon = 'fa-medal';
                features = [
                    { icon: 'fa-check-circle', text: 'Meta de práctica diaria completada al 100%' },
                    { icon: 'fa-check-circle', text: 'Tu biblioteca y notas siguen disponibles' }
                ];
            } else {
                config.badgeText = 'Acceso Premium';
                config.badgeIcon = 'fa-crown';
                features = [
                    { icon: 'fa-check-circle', text: 'Acceso ilimitado a todas las herramientas' },
                    { icon: 'fa-check-circle', text: 'Tutoría IA disponible para resolver tus dudas' }
                ];
            }
        }

        const featuresHTML = features.map(f => `
            <div class="paywall-feature-item">
                <i class="fas ${f.icon} paywall-feature-icon"></i>
                <span>${this._escapeHtml(f.text)}</span>
            </div>
        `).join('');

        const isDismissible = userTier !== 'advanced' && userTier !== 'admin';
        const secondaryBtnText = isDismissible ? 'Quizás más tarde' : 'Cerrar';

        if (!modal) {
            const modalHTML = `
            <div id="${modalId}" class="auth-prompt-modal paywall-overlay" style="display:flex;">
                <div class="modal-content paywall-modal-content">
                    <div class="paywall-glow"></div>
                    <div class="paywall-header">
                        <div class="paywall-header-top">
                            <span class="paywall-badge">
                                <i id="${modalId}-badge-icon" class="fas ${config.badgeIcon}"></i>
                                <span id="${modalId}-badge-text">${config.badgeText}</span>
                            </span>
                            <button class="modal-close-btn" onclick="window.uiManager.closePaywallModal('${modalId}')" aria-label="Cerrar modal">&times;</button>
                        </div>
                        <h2 id="${modalId}-title" class="paywall-title">${config.title}</h2>
                    </div>
                    <div class="paywall-body">
                        <p id="${modalId}-text" class="paywall-description">
                            ${this._escapeHtml(config.message)}
                        </p>
                        <div id="${modalId}-features" class="paywall-features-list">
                            ${featuresHTML}
                        </div>
                    </div>
                    <div class="paywall-footer">
                        <button id="${modalId}-btn" class="btn-paywall-primary" onclick="window.location.href='${config.btnUrl}'">
                            <span id="${modalId}-btn-text">${config.btnText}</span>
                            <i class="fas fa-arrow-right"></i>
                        </button>
                        <button id="${modalId}-secondary-btn" class="btn-paywall-secondary" onclick="window.uiManager.closePaywallModal('${modalId}')">
                            ${secondaryBtnText}
                        </button>
                    </div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            modal = document.getElementById(modalId);

            if (modal) {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) this.closePaywallModal(modalId);
                });
            }
        } else {
            // Actualizar contenido si ya existe
            const titleEl = document.getElementById(`${modalId}-title`);
            const textEl = document.getElementById(`${modalId}-text`);
            const badgeTextEl = document.getElementById(`${modalId}-badge-text`);
            const badgeIconEl = document.getElementById(`${modalId}-badge-icon`);
            const btnEl = document.getElementById(`${modalId}-btn`);
            const btnTextEl = document.getElementById(`${modalId}-btn-text`);
            const secondaryBtnEl = document.getElementById(`${modalId}-secondary-btn`);
            const featuresEl = document.getElementById(`${modalId}-features`);

            if (titleEl) titleEl.innerText = config.title;
            if (textEl) textEl.textContent = config.message;
            if (badgeTextEl) badgeTextEl.innerText = config.badgeText;
            if (badgeIconEl) badgeIconEl.className = `fas ${config.badgeIcon}`;
            if (btnEl) btnEl.onclick = () => window.location.href = config.btnUrl;
            if (btnTextEl) btnTextEl.innerText = config.btnText;
            if (secondaryBtnEl) secondaryBtnEl.innerText = secondaryBtnText;
            if (featuresEl) featuresEl.innerHTML = featuresHTML;

            modal.style.display = 'flex';
        }
        this.pushModalState(modalId);
    }

    /**
     * Cierra el modal de Paywall de forma segura revirtiendo el historial.
     */
    closePaywallModal(modalId = 'paywall-modal') {
        this.popModalState(modalId);
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
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
        this.injectModalHTML();
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
                        <h2 style="color: var(--text-main) !important;"><i class="fas fa-rocket" style="color: var(--primary);"></i> Únete a Hub Academia</h2>
                        <button class="modal-close-btn" onclick="window.uiManager.hideAuthPromptModal()">&times;</button>
                    </div>
                    
                    <div class="modal-body">
                        <div class="auth-prompt-icon" style="margin-bottom: 24px;">
                            <div style="
                                width: 70px; height: 70px; 
                                background: var(--bg-tertiary); 
                                border-radius: 20px; 
                                display: flex; align-items: center; justify-content: center; 
                                margin: 0 auto;
                                border: 1px solid var(--border-color);
                                box-shadow: var(--shadow-md);
                                transform: rotate(-5deg);
                            ">
                                <img src="/assets/logo.png" alt="Hub Academia" style="width: 80%; height: 80%; object-fit: contain;">
                            </div>
                        </div>

                        <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 5px; line-height: 1.5; padding: 0 10px;">
                            Únete hoy de forma gratuita para guardar tu progreso, analizar tus estadísticas y probar todos los simuladores y servicios de la plataforma.
                        </div>
                    </div>

                    <div class="modal-footer" style="padding: 0 24px 32px 24px;">
                        <button class="btn-primary" onclick="window.triggerGoogleLogin(this)" style="
                            width: 100%; 
                            background: linear-gradient(135deg, #2563eb, #1d4ed8); 
                            color: #ffffff !important; 
                            font-weight: 700; 
                            border: none;
                            padding: 14px 20px; 
                            font-size: 1rem;
                            border-radius: 12px;
                            box-shadow: 0 4px 15px rgba(37, 99, 235, 0.35);
                            cursor: pointer;
                            display: flex; align-items: center; justify-content: center; gap: 10px;
                            transition: all 0.2s ease;
                        " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(37, 99, 235, 0.45)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(37, 99, 235, 0.35)'">
                            <i class="fab fa-google" style="font-size: 1.1rem;"></i> Continuar con Google
                        </button>
                    </div>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    /**
     * ✅ CENTRALIZACIÓN: Renderiza el banner de Modo Invitado con estilo Premium Glass
     */
    /**
     * ✅ CENTRALIZACIÓN: Banner de Modo Invitado (Desactivado a solicitud del usuario para una UI más limpia)
     */
    renderGuestBanner(containerId) {
        // Desactivado a petición del usuario
        return;
    }
    /**
     * Inyecta el HTML de la barra de estado Freemium.
     */
    injectFreemiumStatusBar() {
        if (document.getElementById('freemium-status-bar')) return;

        const barHTML = `
            <style>
                .freemium-status-bar {
                    background: #272727ff;
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
                    transition: all 0.3s ease;
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
                    z-index: 2147483647; /* MAX Z-INDEX: Absolutamente sobre todo */
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
            <div id="freemium-status-bar" class="freemium-status-bar" title="Tus créditos de vidas se restablecen a 10 cada 7 días automáticamente">
                <div class="status-content">
                    <span class="probation-text">⚡ <span class="hide-mobile">PLAN </span>GRATUITO</span>
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
            document.body.insertAdjacentHTML('beforeend', barHTML);
        } else {
            // Fallback si corre en head
            document.addEventListener('DOMContentLoaded', () => {
                document.body.insertAdjacentHTML('beforeend', barHTML);
            });
        }
    }

    /**
     * Actualiza la barra de estado con los datos del usuario.
     */
    updateFreemiumStatus(user) {
        // Excluir de las páginas de Flashcards y Quiz para evitar solapamientos e interrupción de la UI de estudio
        const isExcludedPage = window.location.pathname.includes('/flashcards') || 
                               window.location.pathname.includes('/quiz') || 
                               window.location.pathname.endsWith('flashcards.html') || 
                               window.location.pathname.endsWith('quiz.html');

        this.injectFreemiumStatusBar();
        const bar = document.getElementById('freemium-status-bar');
        const countSpan = document.getElementById('free-usage-count');

        const tier = user ? String(user.subscriptionTier || user.subscription_tier || 'free').toLowerCase().trim() : 'free';
        const status = user ? String(user.subscriptionStatus || user.subscription_status || 'pending').toLowerCase().trim() : 'pending';
        const isPaidActive = user && (tier === 'basic' || tier === 'advanced') && status === 'active';
        const isOptimistic = Boolean(user && user._isOptimistic);

        if (isExcludedPage || !user || isPaidActive || user.role === 'admin' || isOptimistic || tier === 'unknown') {
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
        const limit = user.maxFreeLimit !== undefined ? user.maxFreeLimit : (user.max_free_limit || 10);
        const remaining = Math.max(0, limit - usage);

        if (countSpan) {
            const prevText = countSpan.textContent;
            const newText = `${remaining}/${limit}`;
            
            if (prevText !== newText && prevText !== '--/--') {
                // Agregar animación de rebote y destello dorado
                const pill = countSpan.closest('.usage-pill');
                if (pill) {
                    pill.style.transform = 'scale(1.15)';
                    pill.style.background = 'rgba(255, 215, 0, 0.35)';
                    pill.style.boxShadow = '0 0 10px rgba(255, 215, 0, 0.5)';
                    setTimeout(() => {
                        pill.style.transform = 'scale(1)';
                        pill.style.background = remaining <= 1 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.1)';
                        pill.style.boxShadow = 'none';
                    }, 300);
                }
            }
            
            countSpan.textContent = newText;
            // Alerta visual si queda poco
            if (remaining <= 1) {
                countSpan.parentElement.style.background = 'rgba(239, 68, 68, 0.2)'; // Red tint
                countSpan.style.color = '#f87171';
            } else {
                countSpan.parentElement.style.background = 'rgba(255, 255, 255, 0.1)';
                countSpan.style.color = '#ffd700';
            }
        }
    }

    /**
     * Muestra un Toast temporal no intrusivo con soporte de tipos e iconos dual-theme.
     * @param {string} message - Texto del mensaje
     * @param {'info'|'success'|'error'|'warning'|'life'} type - Tipo semántico del toast
     * @param {number} duration - Duración en milisegundos (default: 3200)
     */
    showToast(message, type = 'info', duration = 3200) {
        let container = document.getElementById('hub-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'hub-toast-container';
            container.className = 'hub-toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `hub-toast toast-${type}`;
        
        let iconClass = 'fa-info-circle';
        if (type === 'success') iconClass = 'fa-check-circle';
        else if (type === 'error') iconClass = 'fa-times-circle';
        else if (type === 'warning') iconClass = 'fa-exclamation-triangle';
        else if (type === 'life') iconClass = 'fa-bolt';

        const iconWrapper = document.createElement('span');
        iconWrapper.className = 'hub-toast-icon';
        const icon = document.createElement('i');
        icon.className = `fas ${iconClass}`;
        iconWrapper.appendChild(icon);

        // Sanitizar emojis iniciales redundantes para evitar doble icono visual
        const cleanMsg = String(message || '')
            .replace(/^([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{FE00}-\u{FE0F}\u{200D}]+\s*)+/u, '')
            .trim();

        const messageWrapper = document.createElement('span');
        messageWrapper.className = 'hub-toast-msg';
        messageWrapper.textContent = cleanMsg;

        toast.append(iconWrapper, messageWrapper);

        container.appendChild(toast);

        // Forzar reflow para animación suave
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentElement) toast.parentElement.removeChild(toast);
            }, 300);
        }, duration);
    }

    _escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Muestra una notificación en tiempo real cuando se consume una vida en cuenta Free.
     * @param {number} remaining - Vidas restantes
     * @param {number} limit - Límite total (10)
     */
    showLifeDecrementToast(remaining, limit = 10) {
        const numRemaining = Number(remaining);
        const numLimit = Number(limit) || 10;

        if (numRemaining <= 0) {
            // Informar que consumió la última vida sin bloquear ni mostrar modal prematuramente.
            // El modal solo aparecerá cuando intente una NUEVA acción con 0 vidas.
            this.showToast('Has consumido tu última vida de prueba semanal. Te quedan 0 vidas.', 'warning', 4000);
            return;
        }

        if (numRemaining === 1 || numRemaining === 2) {
            this.showToast(`¡Atención! Te quedan solo ${numRemaining}/${numLimit} vidas de prueba.`, 'warning', 3500);
        } else {
            this.showToast(`1 crédito utilizado. Te quedan ${numRemaining}/${numLimit} vidas de prueba.`, 'life', 2800);
        }
    }

    /**
     * Reemplazo centralizado y seguro de alert()
     */
    showAlert(message, title = 'Aviso', buttonText = 'Aceptar') {
        if (window.confirmationModal && typeof window.confirmationModal.showAlert === 'function') {
            return window.confirmationModal.showAlert(message, title, buttonText);
        }
        this.showToast(message, 'info');
        return Promise.resolve(true);
    }

    /**
     * Reemplazo centralizado y seguro de confirm()
     */
    showConfirm(message, title = 'Confirmación', confirmText = 'Confirmar', cancelText = 'Cancelar') {
        if (window.confirmationModal && typeof window.confirmationModal.show === 'function') {
            return window.confirmationModal.show(message, title, confirmText, cancelText);
        }
        return Promise.resolve(window.confirm(message));
    }
    /**
     * Muestra el modal de bienvenida o renovación de vidas semanal para usuarios free.
     */
    checkAndShowWelcomeModal(user) {
        if (!user || user._isOptimistic) return;

        // Excluir de páginas de examen y estudio para no interrumpir simulacros ni flashcards
        const isExcludedPage = window.location.pathname.includes('/flashcards') || 
                               window.location.pathname.includes('/quiz') || 
                               window.location.pathname.includes('/simulator') ||
                               window.location.pathname.endsWith('flashcards.html') || 
                               window.location.pathname.endsWith('quiz.html') ||
                               window.location.pathname.endsWith('simulator-dashboard.html');
        if (isExcludedPage) return;

        // Solo para usuarios estrictamente free (nunca para basic, advanced ni admin)
        if (user.role === 'admin') return;

        const tier = String(user.subscriptionTier || user.subscription_tier || 'free').toLowerCase().trim();
        const status = String(user.subscriptionStatus || user.subscription_status || 'pending').toLowerCase().trim();
        if (tier !== 'free' || tier === 'basic' || tier === 'advanced' || status === 'active') return;

        // Solo mostrar si usage_count es 0 (indica vidas completas, es decir, inicio o renovación)
        const usage = user.usageCount !== undefined ? user.usageCount : (user.usage_count || 0);
        if (usage > 0) return;

        const lastRenewalStr = user.lastFreeRenewal || user.last_free_renewal;
        if (!lastRenewalStr) return;

        // Estandarizar la fecha a string simple (YYYY-MM-DD)
        const lastRenewalDate = (lastRenewalStr instanceof Date)
            ? lastRenewalStr.toISOString().split('T')[0]
            : String(lastRenewalStr).split('T')[0];

        const lastSeen = localStorage.getItem('lastSeenFreeRenewal');

        // Si el usuario ya vio la renovación/bienvenida de esta fecha específica, no hacemos nada
        if (lastSeen === lastRenewalDate) return;

        const isRenewal = !!lastSeen; // Si ya vio alguna renovación antes, esta es una renovación semanal
        const modalId = 'welcome-freemium-modal';
        if (document.getElementById(modalId)) return;

        const titleText = isRenewal ? '¡Tus 10 vidas semanales están listas!' : 'Bienvenido a Hub Academia';
        const bodyText = isRenewal 
            ? 'Hemos renovado tu cuenta. Recibiste de regalo <strong>10 vidas adicionales</strong> para continuar utilizando todas nuestras herramientas de estudio y tutoría IA esta semana.'
            : 'Tu cuenta ha sido configurada correctamente. Dispones de <strong>10 créditos de uso</strong> para explorar todas las herramientas de estudio y productividad de la plataforma.';
        const buttonText = isRenewal ? '¡A estudiar!' : 'Acceder al Hub';

        const modalHTML = `
            <div id="${modalId}" class="auth-prompt-modal" style="display:flex; backdrop-filter: blur(15px); background: rgba(0,0,0,0.5);">
                <div class="modal-content" style="
                    background: var(--modal-bg); 
                    border: 1px solid var(--border-color); 
                    border-radius: 20px; 
                    padding: 3rem; 
                    text-align: center; 
                    max-width: 440px; 
                    box-shadow: var(--shadow-xl);
                ">
                    <div style="margin-bottom: 2rem;">
                        <img src="/assets/logo.png" alt="Hub Academia" style="height: 60px; object-fit: contain;">
                    </div>

                    <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--text-main); margin-bottom: 1rem; letter-spacing: -0.01em;">
                        ${titleText}
                    </h2>
                    
                    <div style="margin-bottom: 2.5rem; text-align: center;">
                        <p style="color: var(--text-secondary); font-size: 0.95rem; line-height: 1.6; margin-bottom: 1.5rem;">
                            ${bodyText}
                        </p>
                    </div>

                    <button class="btn-primary" onclick="window.uiManager.closeWelcomeModal('${modalId}', '${lastRenewalDate}')" style="
                        width: 100%; 
                        background: #3b82f6; 
                        color: white; 
                        font-weight: 600; 
                        border: none;
                        padding: 1rem; 
                        font-size: 1rem;
                        border-radius: 8px;
                        cursor: pointer;
                        transition: background 0.2s;
                    " onmouseover="this.style.background='#2563eb'" onmouseout="this.style.background='#3b82f6'">
                        ${buttonText}
                    </button>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.pushModalState(modalId);
    }

    closeWelcomeModal(id, lastRenewalDate) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.style.display = 'none';
            this.popModalState(id);
        }
        if (lastRenewalDate) {
            localStorage.setItem('lastSeenFreeRenewal', lastRenewalDate);
            localStorage.setItem('hasSeenFreemiumWelcome_v2', 'true');
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
