/* global AuthApiService */ // Le decimos al linter que esta clase existe

class SessionManager {
    constructor() {
        this.currentUser = null;
        this.onStateChangeCallbacks = [];
        this.lastSyncTime = 0; // Para throttling global de peticiones pasivas
        this.lastSyncAttemptTime = 0;
        this._listenerAttached = false;
        this._visibilityAttached = false;
        this.initSupabaseListener();
        this._setupVisibilityListener();
        this.initPromise = null;
    }

    // ✅ Helper para obtener o inicializar el cliente de Supabase
    getSupabaseClient() {
        if (typeof window.getSupabaseClient === 'function') {
            return window.getSupabaseClient();
        }
        if (!window.supabaseClient && typeof supabase !== 'undefined' && window.AppConfig) {
            window.supabaseClient = supabase.createClient(window.AppConfig.SUPABASE_URL, window.AppConfig.SUPABASE_ANON_KEY);
        }
        return window.supabaseClient || null;
    }

    // ✅ Centralizar la escucha de Supabase
    initSupabaseListener() {
        const client = this.getSupabaseClient();
        if (client && !this._listenerAttached) {
            this._listenerAttached = true;
            client.auth.onAuthStateChange(async (event, session) => {
                console.log(`📡 [SessionGate] Evento: ${event}`);

                // Mantener sincronizado el espejo local cuando Supabase renueva el JWT.
                if (event === 'TOKEN_REFRESHED' && session?.access_token) {
                    localStorage.setItem('authToken', session.access_token);
                    return;
                }

                // INITIAL_SESSION recupera únicamente una sesión que quedó válida en
                // Supabase pero no alcanzó a sincronizarse/guardarse localmente.
                // Si ya existe authToken, initialize() hará getMe() y evita otro sync.
                const needsInitialRecovery = event === 'INITIAL_SESSION'
                    && session
                    && !localStorage.getItem('authToken');

                if ((event === 'SIGNED_IN' || needsInitialRecovery) && session) {
                    // Guardar de inmediato el token emitido por Supabase para evitar desincronización
                    if (session.access_token) {
                        localStorage.setItem('authToken', session.access_token);
                    }

                    // 🛡️ BLOQUEO ATÓMICO: Evitar doble sincronización concurrente
                    if (window._isGlobalSyncing || this.isSyncing) {
                        console.log('⏳ Sincronización en curso, ignorando evento duplicado.');
                        return;
                    }

                    // 🛡️ THROTTLING: Evitar ráfagas de eventos duplicados
                    const now = Date.now();
                    const throttleWindow = 3000;
                    const lastSyncActivity = Math.max(this.lastSyncTime, this.lastSyncAttemptTime);
                    if (now - lastSyncActivity < throttleWindow) {
                        console.log('📡 [SessionGate] Sync bloqueado por ráfaga (throttle).');
                        return;
                    }
                    this.lastSyncAttemptTime = now;

                    // Si ya tenemos el mismo usuario cargado de forma definitiva (no optimista) y el token es igual, no re-sincronizar
                    if (this.currentUser && !this.currentUser._isOptimistic && this.currentUser.id === session.user.id && localStorage.getItem('authToken') === session.access_token) {
                        console.log('📡 [SessionGate] Usuario y token ya vigentes, omitiendo sync.');
                        return;
                    }

                    try {
                        this.isSyncing = true;
                        window._isGlobalSyncing = true;
                        window._isAuthenticating = true; 

                        // ⚡ RENDERIZADO OPTIMISTA INMEDIATO (0 ms):
                        // Mostrar avatar y nombre al instante con los metadatos de Supabase mientras se sincroniza con el backend
                        if (!this.currentUser) {
                            const meta = session.user?.user_metadata || {};
                            const adminEmails = ['hubacademia01@gmail.com'];
                            const userEmail = (session.user?.email || '').toLowerCase();
                            const isAutoAdmin = adminEmails.includes(userEmail);

                            this.currentUser = {
                                id: session.user.id,
                                email: session.user.email,
                                name: meta.full_name || meta.name || session.user.email.split('@')[0],
                                avatar_url: meta.avatar_url || meta.picture || null,
                                subscriptionTier: isAutoAdmin ? 'admin' : 'unknown',
                                subscriptionStatus: isAutoAdmin ? 'active' : 'pending',
                                role: isAutoAdmin ? 'admin' : 'student',
                                _isOptimistic: true // 🛡️ Protege la UI de parpadeos de vidas o modales prematuras
                            };
                            this.notifyStateChange();
                        }

                        // El token recibido en este mismo evento es la fuente de verdad.
                        const syncResponse = await window.AuthApiService.syncGoogleUser(
                            session.user,
                            session.access_token
                        );
                        
                        if (syncResponse && syncResponse.user) {
                            this.currentUser = {
                                ...syncResponse.user,
                                _isOptimistic: false
                            };
                            this.lastSyncTime = Date.now();
                            localStorage.setItem('authToken', session.access_token);
                            
                            // Notificar UI con el perfil completo desde base de datos
                            this.notifyStateChange();
                            
                            // ✅ LIMPIEZA SEGURA: Solo borramos el hash DESPUÉS de una sincronización exitosa
                            if (window.location.hash.includes('access_token') || window.location.hash.includes('id_token')) {
                                console.log('🧹 Limpiando URL (Login exitoso)');
                                window.history.replaceState(null, '', window.location.pathname + window.location.search);
                            }
                        }
                    } catch (err) {
                        console.error('❌ Error en ciclo de vida Auth:', err);
                    } finally {
                        this.isSyncing = false;
                        window._isGlobalSyncing = false;
                        window._isAuthenticating = false;
                    }
                } else if (event === 'SIGNED_OUT') {
                    console.log('🚪 Sesión finalizada en Auth Provider.');
                    this.clearAllStates();
                }
            });
        }
    }

    // ✅ NUEVO: Limpieza Nuclear de Estados
    clearAllStates() {
        console.log('🧹 Limpieza nuclear de estados...');
        this.currentUser = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('sb-rayjtupppcbhzjizhamn-auth-token'); 
        
        // Limpiar cualquier cache de aplicaciones específicas
        sessionStorage.clear();
        
        this.notifyStateChange();
    }

    // ✅ Refresco proactivo al retomar la pestaña tras inactividad
    _setupVisibilityListener() {
        if (typeof document === 'undefined' || this._visibilityAttached) return;
        this._visibilityAttached = true;
        document.addEventListener('visibilitychange', async () => {
            if (document.visibilityState === 'visible') {
                const token = localStorage.getItem('authToken');
                if (token && window.AuthApiService && typeof window.AuthApiService.getValidToken === 'function') {
                    try {
                        const freshToken = await window.AuthApiService.getValidToken();
                        if (freshToken && this.currentUser && typeof this.refreshUser === 'function') {
                            this.refreshUser().catch(() => {});
                        }
                    } catch (_) {}
                }
            }
        });
    }

    initialize() {
        this.initSupabaseListener();
        if (!this.initPromise) {
            this.initPromise = (async () => {
                // 1. 🛡️ IMPORTANTE: Si regresamos de Google OAuth con el hash en la URL,
                // esperamos a que onAuthStateChange maneje el token fresco y NO llamamos getMe con un token viejo.
                const isOAuthReturn = typeof window !== 'undefined' && window.location.hash && (
                    window.location.hash.includes('access_token') || window.location.hash.includes('id_token')
                );

                if (isOAuthReturn) {
                    console.log('⚡ [SessionManager] Retorno OAuth detectado en URL. Delegando a onAuthStateChange...');
                    if (this.currentUser) {
                        this.notifyStateChange();
                    }
                    return this.currentUser;
                }

                // 2. Recuperar sesión local si existe
                const token = localStorage.getItem('authToken');
                if (token) {
                    try {
                        // No bloqueamos desesperadamente, intentamos recuperar
                        this.currentUser = await AuthApiService.getMe();
                        if (this.currentUser) {
                            this.currentUser._isOptimistic = false;
                        }
                    } catch (err) {
                        this.currentUser = null;
                        localStorage.removeItem('authToken');
                    }
                }

                // Si no hay usuario tras initialize, notificamos para que aparezca el botón "Acceder"
                this.notifyStateChange();
                return this.currentUser;
            })();
        }
        return this.initPromise;
    }

    // ✅ NUEVO: Método para refrescar sesión sin recargar (para actualizar vidas/tokens)
    async refreshUser() {
        if (!this.currentUser) return;
        try {
            console.log('🔄 Refrescando sesión de usuario en segundo plano...');
            const updatedUser = await AuthApiService.getMe();
                if (updatedUser) {
                // Solo notificar si cambió el conteo de uso (Free/Pending) o contadores premium o el tier
                const usageChanged = 
                    this.currentUser.usageCount !== updatedUser.usageCount ||
                    this.currentUser.dailyAiUsage !== updatedUser.dailyAiUsage ||
                    this.currentUser.dailySimulatorUsage !== updatedUser.dailySimulatorUsage ||
                    this.currentUser.monthlyFlashcardsUsage !== updatedUser.monthlyFlashcardsUsage ||
                    this.currentUser.usage_count !== updatedUser.usage_count ||
                    this.currentUser.daily_ai_usage !== updatedUser.daily_ai_usage ||
                    this.currentUser.daily_simulator_usage !== updatedUser.daily_simulator_usage ||
                    this.currentUser.monthly_flashcards_usage !== updatedUser.monthly_flashcards_usage;
                const tierChanged = this.currentUser.subscriptionTier !== updatedUser.subscriptionTier;
                
                this.currentUser = updatedUser;
                if (usageChanged || tierChanged) {
                    this.notifyStateChange();
                }
                console.log('✅ Sesión refrescada. Vidas:', updatedUser.usageCount, 'Daily AI:', updatedUser.dailyAiUsage);
            }
        } catch (error) {
            console.warn('⚠️ Falló el refresco silencioso de sesión:', error);
            // No hacemos logout, solo ignoramos el error de red momentáneo
        }
    }

    // 🛡️ NUEVO: Método para validar activamente si el token caducó en el backend y forzar logout en la UI
    async validateSession() {
        if (!this.currentUser) return;
        try {
            // getMe() retorna destructivamente null si el servidor responde 401 (Expirado)
            const isValid = await AuthApiService.getMe();
            if (!isValid) {
                console.warn('🕒 Sesión local detectada como EXPIRADA por el servidor. Forzando cierre de sesión...');
                const isQuizPage = window.location.pathname.includes('quiz.html') || window.location.pathname.includes('simulator');
                this.logout(!isQuizPage);
                if (isQuizPage && window.uiManager && typeof window.uiManager.showAuthPromptModal === 'function') {
                    window.uiManager.showAuthPromptModal();
                }
            }
        } catch (error) {
            // Ignorar errores de red temporales, solo destruir si el backend explícitamente rechaza el token
        }
    }

    login(token, user) {
        localStorage.setItem('authToken', token);
        this.currentUser = user;
        this.notifyStateChange();
    }

    setUser(user) {
        this.currentUser = user;
        this.notifyStateChange();
    }

    decrementUsage(amount = 1) {
        if (this.currentUser) {
            const usage = Number(this.currentUser.usageCount !== undefined ? this.currentUser.usageCount : (this.currentUser.usage_count || 0));
            const limit = Number(this.currentUser.maxFreeLimit !== undefined ? this.currentUser.maxFreeLimit : (this.currentUser.max_free_limit || 10));
            const numAmount = Number(amount) || 1;
            
            const tier = String(this.currentUser.subscriptionTier || this.currentUser.subscription_tier || 'free').toLowerCase();
            const status = String(this.currentUser.subscriptionStatus || this.currentUser.subscription_status || 'pending').toLowerCase();
            const isPaidActive = (tier === 'basic' || tier === 'advanced' || tier === 'premium') && status === 'active';
            const isFree = !isPaidActive && this.currentUser.role !== 'admin' && tier !== 'admin';

            if (isFree) {
                const newUsage = Math.min(limit, usage + numAmount);
                this.currentUser.usageCount = newUsage;
                this.currentUser.usage_count = newUsage;
                const remaining = Math.max(0, limit - newUsage);
                console.log(`⚡ [SessionManager] Descuento optimista aplicado localmente: ${remaining}/${limit}`);
                this.notifyStateChange();

                // ⚡ Disparar notificación en pantalla en tiempo real
                if (window.uiManager && typeof window.uiManager.showLifeDecrementToast === 'function') {
                    window.uiManager.showLifeDecrementToast(remaining, limit);
                }
            }
        }
    }


    async logout(shouldRedirect = true) {
        console.log('🚪 Iniciando cierre de sesión global...');
        try {
            // 1. Limpiar estado local de Supabase (y revocar si es posible)
            if (window.supabaseClient) {
                await window.supabaseClient.auth.signOut();
            }
        } catch (e) {
            console.warn('⚠️ Supabase Logout Warning:', e);
        }

        // 2. Limpieza Agresiva de LocalStorage
        localStorage.removeItem('authToken');
        localStorage.removeItem('sb-rayjtupppcbhzjizhamn-auth-token'); 
        
        // Limpiar cualquier cache de aplicaciones específicas
        sessionStorage.clear();

        this.currentUser = null;
        this.notifyStateChange();

        // 3. Redirigir solo cuando estemos limpios y no se haya cancelado explícitamente
        if (shouldRedirect) {
            window.location.href = '/';
        }
    }

    isLoggedIn() {
        return !!this.currentUser;
    }

    getUser() {
        return this.currentUser;
    }

    isAdmin() {
        return this.currentUser?.role === 'admin' || String(this.currentUser?.subscriptionTier || '').toLowerCase() === 'admin';
    }

    onStateChange(callback) {
        this.onStateChangeCallbacks.push(callback);
        if (this.currentUser) {
            try {
                callback(this.currentUser);
            } catch (e) {
                console.warn('⚠️ [SessionManager] Error en callback de onStateChange:', e);
            }
        }
    }

    notifyStateChange() {
        this.onStateChangeCallbacks.forEach(cb => cb(this.currentUser));
    }

    checkSubscriptionStatus() {
        if (!this.currentUser) return;
        if (this.currentUser.role === 'admin') return;
        console.log(`👤 Verificando estatus: ${this.currentUser.subscriptionStatus}`);
    }
}

/**
 * ====================================================================
 * 🛡️ GuestSessionManager (Arquitectura Centralizada para Visitantes)
 * ====================================================================
 * Controla la cuota de simulacros para usuarios no autenticados (1 intento/día)
 * y asegura que los datos y estadísticas generados tengan un ciclo de vida
 * estricto de 1 DÍA (TTL diario con timezone America/Lima).
 */
class GuestSessionManager {
    static MAX_DAILY_DEMOS = 1;

    static getTodayDateStr() {
        return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' });
    }

    /**
     * Revisa la fecha del almacenamiento local. Si el día cambió, purga
     * todas las métricas de demostración del día anterior y resetea el contador.
     */
    static checkAndCleanExpiredGuestData() {
        const today = this.getTodayDateStr();
        const lastDemoDate = localStorage.getItem('demo_sessions_date');

        if (lastDemoDate && lastDemoDate !== today) {
            console.log(`🧹 [GuestSessionManager] Nuevo día detectado (${today}). Purgando estadísticas demo de ${lastDemoDate}...`);
            localStorage.setItem('demo_sessions_count', '0');
            localStorage.setItem('demo_sessions_date', today);

            // Eliminar estadísticas locales para que los datos duren exactamente 1 día
            const domains = ['medicina', 'educacion', 'medicine', 'education'];
            domains.forEach(dom => {
                localStorage.removeItem(`guest_demo_stats_${dom}`);
            });
            localStorage.removeItem('guest_demo_stats'); // Legacy cleanup
        } else if (!lastDemoDate) {
            localStorage.setItem('demo_sessions_date', today);
            localStorage.setItem('demo_sessions_count', '0');
        }
    }

    /**
     * Verifica si el visitante puede rendir su simulacro diario de 10 preguntas.
     * @returns {boolean}
     */
    static canTakeDailyDemo() {
        this.checkAndCleanExpiredGuestData();
        const count = parseInt(localStorage.getItem('demo_sessions_count') || '0', 10);
        return count < this.MAX_DAILY_DEMOS;
    }

    /**
     * Registra un nuevo intento de simulacro para el visitante.
     */
    static recordDemoAttempt() {
        this.checkAndCleanExpiredGuestData();
        const count = parseInt(localStorage.getItem('demo_sessions_count') || '0', 10);
        localStorage.setItem('demo_sessions_count', (count + 1).toString());
        localStorage.setItem('demo_sessions_date', this.getTodayDateStr());
    }

    /**
     * Recupera las estadísticas del visitante para el dominio solicitado.
     * Si la data es de un día anterior, se purga automáticamente.
     */
    static getGuestStats(domain) {
        this.checkAndCleanExpiredGuestData();
        const domainKey = (domain || 'MEDICINA').toLowerCase();
        const raw = localStorage.getItem(`guest_demo_stats_${domainKey}`);
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    }

    /**
     * Guarda las estadísticas del simulacro demo para el visitante.
     */
    static saveGuestStats(domain, stats) {
        this.checkAndCleanExpiredGuestData();
        const domainKey = (domain || 'MEDICINA').toLowerCase();
        const dataToSave = {
            ...stats,
            savedAtDate: this.getTodayDateStr()
        };
        localStorage.setItem(`guest_demo_stats_${domainKey}`, JSON.stringify(dataToSave));
    }
}

// Instancias globales
if (typeof window !== 'undefined') {
    window.sessionManager = new SessionManager();
    window.guestSessionManager = GuestSessionManager;
    window.GuestSessionManager = GuestSessionManager;

    // ✅ Alias Global para fácil acceso desde NetworkService
    window.handleLogout = () => window.sessionManager.logout();

    window.sessionManager.onStateChange((user) => {
        if (user) {
            window.sessionManager.checkSubscriptionStatus();
        }
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SessionManager, GuestSessionManager };
}
