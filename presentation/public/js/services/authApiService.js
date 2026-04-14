class AuthApiService {

    // ✅ Obtener URL de forma segura usando la config global
    static getApiUrl() {
        if (window.AppConfig && window.AppConfig.API_URL) {
            return window.AppConfig.API_URL;
        }
        return 'https://tutor-ia-backend.onrender.com';
    }

    // ✅ Obtener Token Fresco (Supabase -> LocalStorage)
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
        return localStorage.getItem('authToken');
    }

    // ✅ ÚNICO MÉTODO DE ACCESO: Sincronización Google OAuth
    static async syncGoogleUser(supabaseUser) {
        const API_URL = this.getApiUrl();
        const payload = {
            id: supabaseUser.id,
            email: supabaseUser.email,
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

    // ✅ Obtener perfil del usuario (getMe)
    static async getMe() {
        const token = await this.getValidToken();
        if (!token) return null;

        const API_URL = this.getApiUrl();
        try {
            const response = await fetch(`${API_URL}/api/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    localStorage.removeItem('authToken');
                    return null;
                }
                return null;
            }

            return await response.json();
        } catch (error) {
            console.error('Error de conexión verificando sesión:', error);
            return null;
        }
    }

    /**
     * Eliminar cuenta de usuario (Google-Only: no requiere password)
     */
    static async deleteAccount() {
        const token = await this.getValidToken();
        if (!token) throw new Error('No hay sesión activa.');

        const API_URL = this.getApiUrl();
        const response = await fetch(`${API_URL}/api/auth/delete-account`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.error || `Error del servidor (${response.status})`);
        }
        return data;
    }
}