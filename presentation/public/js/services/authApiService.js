class AuthApiService {

    // ✅ 1. Obtener URL de forma segura usando la config global
    static getApiUrl() {
        if (window.AppConfig && window.AppConfig.API_URL) {
            return window.AppConfig.API_URL;
        }
        // Fallback por si acaso config.js no cargó (evita romper todo)
        return 'https://tutor-ia-backend.onrender.com';
    }
    // ✅ 1.5 Helper para Obtener Token Fresco (Sincronizado Supabase -> LocalStorage)
    static async getValidToken() {
        if (window.supabaseClient) {
            try {
                const { data } = await window.supabaseClient.auth.getSession();
                if (data && data.session) {
                    const freshToken = data.session.access_token;
                    localStorage.setItem('authToken', freshToken);
                    return freshToken;
                }
            } catch (e) {
                console.warn("AuthApiService: Error refreshing ui token via Supabase", e);
            }
        }
        // Fallback al clásico
        return localStorage.getItem('authToken');
    }

    static async login(email, password) {
        const API_URL = this.getApiUrl();
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al iniciar sesión');
        }
        return response.json();
    }

    static async register(name, email, password) {
        const API_URL = this.getApiUrl();
        // Nota: Asegúrate que tu backend espere 'name' en el body
        const response = await fetch(`${API_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error en el registro');
        }

        return {
            status: response.status,
            data: await response.json()
        };
    }

    // ✅ NUEVO: Método para enviar los datos de Google al Backend
    static async syncGoogleUser(supabaseUser) {
        const API_URL = this.getApiUrl();

        // Extraemos los datos útiles de Supabase
        const payload = {
            id: supabaseUser.id,
            email: supabaseUser.email,
            // Google suele guardar el nombre en user_metadata
            name: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || 'Usuario Google'
        };

        const response = await fetch(`${API_URL}/api/auth/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al sincronizar usuario');
        }

        return await response.json();
    }

    // ✅ MEJORA: Manejo silencioso de 401 para evitar ruido excesivo
    static async getMe() {
        const token = await this.getValidToken();
        if (!token) return null;

        const API_URL = this.getApiUrl();
        try {
            const response = await fetch(`${API_URL}/api/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            // Si el token expiró o es inválido (401/403), limpiamos y retornamos null
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    console.warn('⚠️ Sesión expirada o token inválido. Limpiando credenciales locales.');
                    localStorage.removeItem('authToken');
                    return null;
                }
                // Otros errores (500, etc)
                return null;
            }

            return await response.json();
        } catch (error) {
            console.error('Error de conexión verificando sesión:', error);
            return null;
        }
    }

    static async changePassword(oldPassword, newPassword) {
        const token = localStorage.getItem('authToken');
        if (!token) throw new Error('No autenticado');

        const API_URL = this.getApiUrl();
        const response = await fetch(`${API_URL}/api/auth/change-password`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ oldPassword, newPassword })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'No se pudo cambiar la contraseña.');
        }

        // Feedback visual simple
        if (typeof alert !== 'undefined') alert(data.message || 'Contraseña cambiada con éxito.');
        return data;
    }

    // Verificación de contraseñas filtradas (HIBP)
    static async isPasswordPwned(password) {
        try {
            const buffer = new TextEncoder().encode(password);
            const hashBuffer = await crypto.subtle.digest('SHA-1', buffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const sha1Hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

            const prefix = sha1Hash.substring(0, 5);
            const suffix = sha1Hash.substring(5);

            const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
            const text = await response.text();
            return text.split('\r\n').some(line => line.split(':')[0] === suffix);
        } catch (error) {
            console.error('Error HIBP:', error);
            return false;
        }
    }

    static async verifyEmail(verificationToken) {
        const API_URL = this.getApiUrl();
        const response = await fetch(`${API_URL}/api/auth/verify-email?token=${verificationToken}`, {
            method: 'GET',
        });

        if (!response.ok && response.redirected === false) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error durante la verificación.');
        }
    }

    /**
     * Eliminar cuenta de usuario
     * @param {string} password - Contraseña actual para confirmación
     */
    static async deleteAccount(password) {
        const token = await this.getValidToken();
        if (!token) throw new Error('No hay sesión activa.');

        const API_URL = this.getApiUrl();
        const response = await fetch(`${API_URL}/api/auth/delete-account`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ password })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            // Manejar error de contraseña específicamente
            if (response.status === 401) {
                throw new Error('Contraseña incorrecta.');
            }
            throw new Error(data.error || `Error del servidor (${response.status})`);
        }
        return data;
    }
}