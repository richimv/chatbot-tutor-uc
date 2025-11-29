const UserRepository = require('../../domain/repositories/userRepository');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto'); // Módulo nativo de Node.js
const axios = require('axios'); // Para hacer la petición a la API

const JWT_SECRET = process.env.JWT_SECRET || 'este-es-un-secreto-muy-largo-y-seguro-para-desarrollo';

class AuthService {
    constructor() {
        this.userRepository = new UserRepository();
    }

    /**
     * Verifica si una contraseña ha sido expuesta en brechas de seguridad de datos
     * utilizando la API de 'Have I Been Pwned' (HIBP) de forma segura.
     * @param {string} password La contraseña a verificar.
     * @returns {Promise<boolean>} Devuelve `true` si la contraseña está comprometida, `false` en caso contrario.
     */
    async isPasswordPwned(password) {
        try {
            // 1. Crear un hash SHA-1 de la contraseña.
            const sha1Hash = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
            const prefix = sha1Hash.substring(0, 5);
            const suffix = sha1Hash.substring(5);

            // 2. Enviar solo el prefijo a la API de HIBP.
            const response = await axios.get(`https://api.pwnedpasswords.com/range/${prefix}`);

            // 3. Buscar el sufijo en la respuesta de la API.
            // La respuesta es una lista de sufijos y su conteo de apariciones.
            return response.data.split('\r\n').some(line => line.split(':')[0] === suffix);
        } catch (error) {
            console.error('Error al verificar la contraseña con HIBP:', error.message);
            return false; // En caso de error, no bloqueamos el registro por seguridad.
        }
    }

    /**
     * Valida la complejidad de una contraseña.
     * @param {string} password La contraseña a validar.
     * @throws {Error} Si la contraseña no cumple con los requisitos.
     */
    validatePasswordComplexity(password) {
        const minLength = 8;
        const errors = [];

        if (!password || password.length < minLength) {
            errors.push(`debe tener al menos ${minLength} caracteres`);
        }
        if (!/[A-Z]/.test(password)) {
            errors.push('debe contener al menos una mayúscula');
        }
        if (!/[a-z]/.test(password)) {
            errors.push('debe contener al menos una minúscula');
        }
        if (!/[0-9]/.test(password)) {
            errors.push('debe contener al menos un número');
        }

        if (errors.length > 0) {
            throw new Error(`La contraseña es débil: ${errors.join(', ')}.`);
        }
    }

    async login(email, password) {
        const user = await this.userRepository.findByEmail(email);
        if (!user) {
            throw new Error('Credenciales inválidas');
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            throw new Error('Credenciales inválidas');
        }

        // Crear el payload del token
        // ✅ SOLUCIÓN DEFINITIVA: Aplanar el payload. El objeto de usuario es el payload, no está anidado.
        // Esto asegura que cuando el middleware 'auth' decodifique el token, req.user sea { id, role, name, email }.
        const payload = {
            id: user.id,
            role: user.role,
            name: user.name,
            email: user.email
        };

        // Firmar el token
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });

        // Devolver el mismo objeto que se usó para el payload, para consistencia en el frontend.
        return { token, user: payload };
    }

    async register(email, password, name) {
        const existingUser = await this.userRepository.findByEmail(email);
        if (existingUser) {
            throw new Error('El correo electrónico ya está en uso');
        }

        // ✅ NUEVO: Validar complejidad de la contraseña.
        this.validatePasswordComplexity(password);

        // ✅ NUEVO: Verificar si la contraseña está comprometida antes de registrar.
        if (await this.isPasswordPwned(password)) {
            throw new Error('Esa contraseña ha sido expuesta en brechas de seguridad. Por favor, elige una más segura.');
        }
        // ✅ CORRECCIÓN: No devolver el usuario directamente.
        // El flujo de verificación de correo se encargará del resto.
        await this.userRepository.create(email, password, name, 'student');
        
        return {
            message: 'Registro exitoso. Por favor, revisa tu correo para verificar tu cuenta.'
        };
    }

    // ✅ NUEVO: Lógica para cambiar la contraseña.
    async changePassword(userId, oldPassword, newPassword) {
        // ✅ NUEVO: Reutilizar la validación de complejidad.
        this.validatePasswordComplexity(newPassword);

        // ✅ NUEVO: Verificar también al cambiar la contraseña.
        if (await this.isPasswordPwned(newPassword)) {
            throw new Error('La nueva contraseña ha sido expuesta en brechas de seguridad. Por favor, elige una diferente.');
        }

        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new Error('Usuario no encontrado.');
        }

        const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
        if (!isMatch) {
            throw new Error('La contraseña antigua es incorrecta.');
        }

        const newPasswordHash = await bcrypt.hash(newPassword, 10);
        await this.userRepository.updatePassword(userId, newPasswordHash);
    }

    // ✅ NUEVO: Lógica para que un admin restablezca una contraseña.
    async adminResetPassword(userIdToReset) {
        const user = await this.userRepository.findById(userIdToReset);
        if (!user) {
            throw new Error('Usuario no encontrado.');
        }

        const newPassword = Math.random().toString(36).slice(-8);
        console.log(`🔑 (Admin) Nueva contraseña temporal generada para ${user.email}: ${newPassword}`);

        const newPasswordHash = await bcrypt.hash(newPassword, 10);
        await this.userRepository.updatePassword(userIdToReset, newPasswordHash);

        return { newPassword };
    }
}

module.exports = AuthService;