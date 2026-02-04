class UIManager {
    constructor() {
        this.modalId = 'auth-prompt-modal';
        this.injectModalHTML();
        // ✅ NUEVO: Inyectar Modal de Video
        this.injectVideoModalHTML();
        // ✅ NUEVO: Registro seguro de URLs para ofuscación
        this.materialRegistry = new Map();
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

                    // ✅ TRACKING
                    if (window.AnalyticsApiService) {
                        try {
                            window.AnalyticsApiService.recordView(type, id);
                        } catch (e) { console.warn('Tracking error', e); }
                    }

                    // 👉 ACCIÓN SEGÚN TIPO
                    if (type === 'video') {
                        // ✅ SOLUCIÓN: Usar Modal Dedicado
                        this.openVideoModal(url, data.title || 'Video');
                    } else {
                        // Artículos y Libros se abren en nueva pestaña
                        window.open(url, '_blank');
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
            <div id="video-player-modal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <button class="modal-close-btn" onclick="window.uiManager.closeVideoModal()">&times;</button>
                    </div>
                    <div class="modal-body" style="overflow: visible;">
                        <div id="video-modal-content-area"></div>
                        <h3 id="video-modal-title-text" class="video-modal-title"></h3>
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
            <div id="${modalId}" class="modal auth-prompt-modal" style="display:flex;">
                <div class="modal-content" style="border: 2px solid #ffd700;"> <!-- Gold border -->
                    <div class="modal-header">
                        <h2>¡Te encantó la prueba!</h2>
                        <button class="modal-close-btn" onclick="document.getElementById('${modalId}').style.display='none'">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="auth-prompt-icon">
                           <i class="fas fa-crown" style="color: #ffd700;"></i>
                        </div>
                        <div class="auth-prompt-main-text">
                            Ya usaste tus 3 pruebas gratuitas.
                            <br>Para continuar, suscríbete por <strong>S/ 9.90</strong>.
                        </div>
                        <button class="btn-primary" style="width:100%; margin-top:15px; background: linear-gradient(45deg, #ffd700, #ffa500); color: black; font-weight:bold;" onclick="window.location.href='/pricing'">
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
            <div id="${this.modalId}" class="modal auth-prompt-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>¡Únete a nuestra Comunidad!</h2>
                        <button class="modal-close-btn" onclick="window.uiManager.hideAuthPromptModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="auth-prompt-icon">
                            <i class="fas fa-user-astronaut"></i>
                        </div>
                        <div class="auth-prompt-main-text">
                            Regístrate gratis para acceder a todo el potencial de tu Tutor IA y la Biblioteca.
                        </div>
                        <div class="auth-prompt-benefits">
                            <p>Beneficios de tu cuenta:</p>
                            <ul>
                                <li><i class="fas fa-check-circle"></i> Leer y descargar libros completos</li>
                                <li><i class="fas fa-check-circle"></i> Chatear con el Tutor IA ilimitadamente</li>
                                <li><i class="fas fa-check-circle"></i> Gestionar tus materiales académicos</li>
                                <li><i class="fas fa-check-circle"></i> Generar Referencias Bibliográficas</li>
                            </ul>
                        </div>
                    </div>
                    <div class="modal-footer" style="justify-content: center;">
                        <button class="btn-secondary" onclick="window.location.href='login'">Iniciar Sesión</button>
                        <button class="btn-primary" onclick="window.location.href='register'">Registrarse Gratis</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
}

// Inicializar y exponer globalmente
window.uiManager = new UIManager();
