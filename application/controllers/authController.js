const AuthService = require('../services/authService');

class AuthController {
    constructor() {
        this.authService = new AuthService();
        this.login = this.login.bind(this);
        this.register = this.register.bind(this);
        this.getMe = this.getMe.bind(this);
        this.changePassword = this.changePassword.bind(this); // ✅ NUEVO
        this.adminResetPassword = this.adminResetPassword.bind(this); // ✅ NUEVO
    }

    async login(req, res) {
        const { email, password } = req.body;
        try {
            const { token, user } = await this.authService.login(email, password);
            res.json({ token, user });
        } catch (error) {
            res.status(401).json({ error: error.message });
        }
    }

    async register(req, res) {
        const { email, password, name } = req.body;
        try {
            const newUser = await this.authService.register(email, password, name);
            // Opcional: Iniciar sesión automáticamente después del registro
            const { token, user } = await this.authService.login(email, password);
            res.status(201).json({ token, user });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    // Endpoint para que el frontend verifique quién es el usuario logueado
    async getMe(req, res) {
        // Este endpoint estará protegido, por lo que `req.user` será añadido por el middleware
        if (!req.user) {
            return res.status(401).json({ error: 'No autenticado' });
        }
        res.json(req.user);
    }

    async changePassword(req, res) {
        const { oldPassword, newPassword } = req.body;
        const userId = req.user.id; // El ID del usuario logueado viene del token.
        try {
            await this.authService.changePassword(userId, oldPassword, newPassword);
            res.json({ message: 'Contraseña actualizada con éxito.' });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    // ✅ NUEVO: Método para que un admin restablezca una contraseña.
    async adminResetPassword(req, res) {
        const userIdToReset = parseInt(req.params.id, 10);
        // Verificación de que el que hace la petición es un admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador.' });
        }
        try {
            const { newPassword } = await this.authService.adminResetPassword(userIdToReset);
            res.json({ message: 'Contraseña restablecida con éxito.', newPassword });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
}

module.exports = new AuthController();