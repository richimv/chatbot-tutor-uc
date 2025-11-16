class AuthApiService {
    static async login(email, password) {
        const response = await fetch('/api/auth/login', {
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

    static async register(name, email, password) { // ✅ CORREGIDO: El orden de los parámetros ahora es correcto
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name }),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error en el registro');
        }
        return response.json();
    }

    static async getMe() {
        const token = localStorage.getItem('authToken');
        if (!token) return null;

        const response = await fetch('/api/auth/me', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.status === 401 || response.status === 400) {
            // Token inválido o expirado
            localStorage.removeItem('authToken');
            return null;
        }
        
        return response.json();
    }

    // ✅ NUEVO: Método para cambiar la contraseña del usuario logueado.
    static async changePassword(oldPassword, newPassword) {
        const token = localStorage.getItem('authToken');
        if (!token) throw new Error('No autenticado');

        const response = await fetch('/api/auth/change-password', {
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

        alert(data.message || 'Contraseña cambiada con éxito.');
        return data;
    }
}