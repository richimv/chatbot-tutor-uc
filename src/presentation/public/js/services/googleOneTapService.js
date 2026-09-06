/**
 * GoogleOneTapService
 * Servicio modular para la gestión segura, resiliente y reactiva de Google One Tap.
 * Cumple con los estándares modernos de Google Identity Services (GIS) y FedCM.
 * Diseñado bajo arquitectura desacoplada para evitar errores 400 y degradar con elegancia.
 */
class GoogleOneTapService {
    static isInitialized = false;

    /**
     * Obtiene el Client ID de Google configurado en el entorno.
     * @returns {string} Client ID de Google.
     */
    static getClientId() {
        if (typeof window !== 'undefined' && window.AppConfig && window.AppConfig.GOOGLE_CLIENT_ID) {
            return window.AppConfig.GOOGLE_CLIENT_ID;
        }
        return '244839077130-pmqphk8eu7j78qq9icc6folabo5437ga.apps.googleusercontent.com';
    }

    /**
     * Evalúa si las condiciones de la sesión permiten inicializar Google One Tap.
     * @returns {boolean} True si el prompt puede mostrarse; False si debe omitirse.
     */
    static canPrompt() {
        if (typeof window === 'undefined') return false;

        // 1. Omitir si el usuario ya tiene sesión activa
        const hasToken = typeof localStorage !== 'undefined' && !!localStorage.getItem('authToken');
        const isLoggedIn = window.sessionManager && typeof window.sessionManager.isLoggedIn === 'function' && window.sessionManager.isLoggedIn();
        if (hasToken || isLoggedIn) {
            return false;
        }

        // 2. Omitir si la app está en medio de un flujo de autenticación o redirección OAuth
        const isAuthFlow = !!window._isAuthenticating || 
            (window.location && typeof window.location.hash === 'string' && (window.location.hash.includes('access_token') || window.location.hash.includes('id_token')));
        if (isAuthFlow) {
            return false;
        }

        // 3. Verificar disponibilidad del SDK de Google
        if (typeof google === 'undefined' || !google.accounts || !google.accounts.id) {
            return false;
        }

        return true;
    }

    /**
     * Procesa la credencial JWT recibida de Google One Tap y la intercambia con Supabase.
     * @param {Object} response - Objeto de respuesta emitido por Google Identity Services.
     * @param {string} response.credential - ID Token JWT de Google.
     * @returns {Promise<boolean>} True si la autenticación fue exitosa.
     */
    static async handleCredential(response) {
        if (!response || !response.credential) {
            console.warn('⚠️ [GoogleOneTapService] Credencial vacía recibida.');
            return false;
        }

        console.log('⚡ [GoogleOneTapService] Token recibido. Autenticando con Supabase...');
        if (typeof window !== 'undefined') {
            window._isAuthenticating = true;
        }

        try {
            const client = (typeof window !== 'undefined' && typeof window.getSupabaseClient === 'function')
                ? window.getSupabaseClient()
                : (typeof window !== 'undefined' ? window.supabaseClient : null);

            if (!client || !client.auth) {
                throw new Error('Supabase client no disponible.');
            }

            const { data, error } = await client.auth.signInWithIdToken({
                provider: 'google',
                token: response.credential
            });

            if (error) throw error;

            if (data && data.session) {
                console.log('✅ [GoogleOneTapService] Sesión establecida exitosamente.');
                return true;
            }
            return false;
        } catch (err) {
            if (typeof window !== 'undefined') {
                window._isAuthenticating = false;
            }
            console.warn('⚠️ [GoogleOneTapService] Error al autenticar con ID Token:', err.message || err);
            return false;
        }
    }

    /**
     * Cancela de forma segura cualquier diálogo activo de Google One Tap en pantalla.
     */
    static cancel() {
        if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
            try {
                google.accounts.id.cancel();
            } catch (e) {
                // Silencioso
            }
        }
    }

    /**
     * Inicializa programáticamente el SDK de Google Identity Services con configuración blindada.
     * Reglas de oro aplicadas:
     * - NUNCA usar itp_support: true (evita popups con error 400 en Chrome ante multi-cuenta).
     * - NUNCA forzar ux_mode: "popup" en initialize.
     * - Degradación silenciosa en el momentListener.
     * @returns {boolean} True si se inicializó correctamente.
     */
    static initialize() {
        if (this.isInitialized) return true;
        if (!this.canPrompt()) return false;

        try {
            this.isInitialized = true;
            const clientId = this.getClientId();

            google.accounts.id.initialize({
                client_id: clientId,
                callback: (res) => this.handleCredential(res),
                auto_select: false,
                cancel_on_tap_outside: true,
                context: 'signin'
            });

            // Invocar el prompt cumpliendo estrictamente con la migración FedCM de Google Identity
            google.accounts.id.prompt((notification) => {
                if (typeof notification?.isDismissedMoment === 'function' && notification.isDismissedMoment()) {
                    const reason = typeof notification.getDismissedReason === 'function' ? notification.getDismissedReason() : 'desconocido';
                    console.log('ℹ️ [GoogleOneTapService] Prompt cerrado:', reason);
                }
            });

            // Cancelar One Tap reactivamente si el usuario se autentica por otro canal
            if (typeof window !== 'undefined' && window.sessionManager && typeof window.sessionManager.onStateChange === 'function') {
                window.sessionManager.onStateChange((user) => {
                    if (user) {
                        this.cancel();
                    }
                });
            }

            return true;
        } catch (err) {
            console.warn('ℹ️ [GoogleOneTapService] Inicialización abortada:', err.message || err);
            return false;
        }
    }
}

// Exposición global para navegador y exportación CommonJS para suite de pruebas
if (typeof window !== 'undefined') {
    window.GoogleOneTapService = GoogleOneTapService;
    window.initGoogleOneTap = () => GoogleOneTapService.initialize();
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GoogleOneTapService;
}
