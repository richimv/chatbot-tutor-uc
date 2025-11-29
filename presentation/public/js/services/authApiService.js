class AuthApiService {
    static async login(email, password) {
        const response = await fetch(`${window.API_URL}/api/auth/login`, {
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
        const response = await fetch(`${window.API_URL}/api/auth/register`, {
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

        const response = await fetch(`${window.API_URL}/api/auth/me`, {
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

        const response = await fetch(`${window.API_URL}/api/auth/change-password`, {
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

    /**
     * ✅ NUEVO: Verifica si una contraseña está comprometida (pwned) llamando a la API de HIBP.
     * Este método es seguro porque la contraseña real no se envía, solo un hash.
     * @param {string} password La contraseña a verificar.
     * @returns {Promise<boolean>} `true` si la contraseña está comprometida.
     */
    static async isPasswordPwned(password) {
        try {
            // Esta lógica es idéntica a la del backend, pero en el cliente.
            // Usamos la API de Web Crypto que es estándar en los navegadores modernos.
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
            console.error('Error al verificar contraseña con HIBP en el cliente:', error);
            return false; // No bloquear si la API falla.
        }
    }

    /**
     * ✅ NUEVO: Llama al endpoint del backend para verificar un token de correo electrónico.
     * Este método no necesita enviar un token de autorización, ya que el token de verificación
     * es la propia autorización.
     * @param {string} verificationToken - El token recibido en la URL del correo.
     * @returns {Promise<object>} La respuesta del servidor.
     */
    static async verifyEmail(verificationToken) {
        const response = await fetch(`${window.API_URL}/api/auth/verify-email?token=${verificationToken}`, {
            method: 'GET', // La verificación se hace con un GET
        });

        // No necesitamos el cuerpo de la respuesta aquí, el backend redirigirá.
        // Solo verificamos si la respuesta fue un error del servidor.
        if (!response.ok && response.redirected === false) { // Si no fue exitoso Y no hubo redirección
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error durante la verificación.');
        }
    }
}