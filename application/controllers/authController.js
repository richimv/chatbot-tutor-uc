const AuthService = require('../../domain/services/authService');

class AuthController {
    constructor(authService) {
        this.authService = authService;
        this.login = this.login.bind(this);
        this.register = this.register.bind(this);
        this.getMe = this.getMe.bind(this);
        this.changePassword = this.changePassword.bind(this); // ✅ NUEVO
        this.adminResetPassword = this.adminResetPassword.bind(this); // ✅ NUEVO
        this.verifyEmail = this.verifyEmail.bind(this); // ✅ NUEVO
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
            // ✅ CORRECCIÓN: Devolver el mensaje del servicio directamente.
            const result = await this.authService.register(email, password, name);
            res.status(201).json(result);
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

    // ✅ NUEVO: Controlador para manejar la verificación de correo.
    async verifyEmail(req, res) {
        const { token } = req.query;
        try {
            await this.authService.verifyEmail(token);
            // Redirigir al usuario a una página de éxito con un mensaje.
            res.redirect('/verification-status.html?success=true');
        } catch (error) {
            // Redirigir a la misma página pero con un mensaje de error.
            const errorMessage = encodeURIComponent(error.message);
            res.redirect(`/verification-status.html?success=false&message=${errorMessage}`);
        }
    }
}

module.exports = AuthController; // ✅ CORRECCIÓN: Exportar la clase, no la instancia.