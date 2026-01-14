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
        this.forgotPassword = this.forgotPassword.bind(this); // ✅ NUEVO
    }

    async login(req, res) {
        const { email, password } = req.body;
        try {
            // ✅ REFACTOR: Login Delegado a Supabase
            // El servicio ahora devuelve { session, user }
            // 'session' es la sesión de Supabase (access_token, refresh_token)
            // 'user' es el usuario de NUESTRA base de datos (con roles, vidas, etc)
            const { session, user } = await this.authService.login(email, password);

            // Devolvemos:
            // - token: El access_token de Supabase (que espera el middleware)
            // - user: El objeto completo de nuestra DB
            res.json({
                token: session.access_token,
                user: user
            });
        } catch (error) {
            console.error('❌ Error en AuthController.login:', error.message);
            // Diferenciar errores de credenciales vs errores de servidor
            if (error.message.includes('Credenciales') || error.message.includes('Invalid login')) {
                return res.status(401).json({ error: 'Credenciales inválidas' });
            }
            res.status(400).json({ error: error.message });
        }
    }

    async register(req, res) {
        const { email, password, name } = req.body;
        try {
            // ✅ CORRECCIÓN: Devolver el mensaje del servicio directamente.
            const result = await this.authService.register(email, password, name);
            // Aseguramos explícitamente el código 201 (Created)
            res.status(201).json(result);
        } catch (error) {
            console.error('❌ Error en AuthController.register:', error);

            // Manejo específico para errores de duplicados (Postgres o Service)
            if (error.message.includes('duplicate key') || error.message.includes('already in use') || error.message.includes('ya está en uso')) {
                return res.status(409).json({ error: 'El correo electrónico ya está registrado. Intenta iniciar sesión.' });
            }

            // Solo devolvemos 400 si es un error controlado (mensaje del servicio)
            res.status(400).json({ error: error.message });
        }
    }

    async getMe(req, res) {
        // Este endpoint estará protegido, por lo que `req.user` será añadido por el middleware
        if (!req.user) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        try {
            // ✅ MEJORA: Obtener datos frescos de la base de datos (incluyendo estado de suscripción).
            const user = await this.authService.userRepository.findById(req.user.id);
            if (!user) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }
            // Devolvemos el usuario COMPLETO (sin el hash de la password, que debería filtrarse en el modelo o aquí)
            // Para simplicidad, devolvemos el objeto User que ya tiene las propiedades públicas.
            // Asegúrate de NO devolver passwordHash en producción si el modelo lo expone directamente en JSON.
            // En este caso, User es una clase, al serializar a JSON se incluirán sus propiedades.
            // Deberíamos omitir passwordHash.
            const { passwordHash, ...userWithoutPassword } = user;
            res.json(userWithoutPassword);

        } catch (error) {
            console.error('Error en getMe:', error);
            res.status(500).json({ error: 'Error interno al obtener datos del usuario.' });
        }
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

    // ✅ NUEVO: Controlador para solicitar recuperación de contraseña.
    async forgotPassword(req, res) {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'El correo electrónico es requerido.' });
        }
        try {
            const result = await this.authService.requestPasswordReset(email);
            res.json(result);
        } catch (error) {
            // No exponemos el error interno exacto por seguridad, a menos que sea algo controlado
            console.error('Error en forgotPassword:', error);
            res.status(500).json({ error: 'Error al procesar la solicitud.' });
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