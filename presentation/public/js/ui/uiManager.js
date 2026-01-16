class UIManager {
    constructor() {
        this.modalId = 'auth-prompt-modal';
        this.injectModalHTML();
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
     * Intenta abrir un material protegido validando límites de uso en el backend.
     */
    openMaterial(id) {
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
                    // ✅ Éxito: Abrir el material
                    // ✅ TRACKING: Registrar la vista del recurso
                    if (window.AnalyticsApiService) {
                        try {
                            window.AnalyticsApiService.recordView('book', id);
                        } catch (e) { console.warn('Tracking error', e); }
                    }
                    window.open(url, '_blank');
                } else if (response.status === 403) {
                    // ⛔ Límite alcanzado: Mostrar Paywall
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

    showPaywallModal() {
        const modalId = 'paywall-modal';
        let modal = document.getElementById(modalId);

        if (!modal) {
            const modalHTML = `
            <div id="${modalId}" class="modal auth-prompt-modal" style="display:flex;">
                <div class="modal-content" style="border: 2px solid #ffd700;"> <!-- Gold border -->
                    <div class="modal-header">
                        <h2>¡Te encantó la prueba! 🌟</h2>
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
                        <button class="btn-primary" style="width:100%; margin-top:15px; background: linear-gradient(45deg, #ffd700, #ffa500); color: black; font-weight:bold;" onclick="window.location.href='/pricing.html'">
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
                        <h2>¡Únete a nuestra Comunidad! 🚀</h2>
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
                                <li><i class="fas fa-check-circle"></i> Leer libros completos</li>
                                <li><i class="fas fa-check-circle"></i> Chatear con el Tutor IA ilimitadamente</li>
                                <li><i class="fas fa-check-circle"></i> Guardar tus favoritos</li>
                                <li><i class="fas fa-check-circle"></i> Citar material académico (APA, ISO)</li>
                                <li><i class="fas fa-check-circle"></i> Descargar materiales de estudio</li>
                            </ul>
                        </div>
                    </div>
                    <div class="modal-footer" style="justify-content: center;">
                        <button class="btn-secondary" onclick="window.location.href='login.html'">Iniciar Sesión</button>
                        <button class="btn-primary" onclick="window.location.href='register.html'">Registrarse Gratis</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
}

// Inicializar y exponer globalmente
window.uiManager = new UIManager();
