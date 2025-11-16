const UserRepository = require('../../domain/repositories/userRepository');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'este-es-un-secreto-muy-largo-y-seguro-para-desarrollo';

class AuthService {
    constructor() {
        this.userRepository = new UserRepository();
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
        const payload = {
            user: {
                id: user.id,
                role: user.role,
                name: user.name
            }
        };

        // Firmar el token
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });

        return { token, user: payload.user };
    }

    async register(email, password, name) {
        const existingUser = await this.userRepository.findByEmail(email);
        if (existingUser) {
            throw new Error('El correo electrónico ya está en uso');
        }
        return await this.userRepository.create(email, password, name, 'student');
    }

    // ✅ NUEVO: Lógica para cambiar la contraseña.
    async changePassword(userId, oldPassword, newPassword) {
        if (!newPassword || newPassword.length < 6) {
            throw new Error('La nueva contraseña debe tener al menos 6 caracteres.');
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