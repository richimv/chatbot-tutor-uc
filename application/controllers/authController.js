const AuthService = require('../../domain/services/authService');

class AuthController {
    constructor(authService) {
        this.authService = authService;
        this.getMe = this.getMe.bind(this);
        this.syncUser = this.syncUser.bind(this);
        this.deleteAccount = this.deleteAccount.bind(this);
    }

    /**
     * Obtiene el perfil del usuario actual (Middleware)
     */
    async getMe(req, res) {
        if (!req.user) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        try {
            const user = await this.authService.getUserWithStatus(req.user.id);
            if (!user) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }
            // Omitimos passwordHash por seguridad
            const { passwordHash, ...userWithoutPassword } = user;
            res.json(userWithoutPassword);
        } catch (error) {
            console.error('Error en getMe:', error);
            res.status(500).json({ error: 'Error interno al obtener datos.' });
        }
    }

    /**
     * Endpoint para sincronización desde el frontend tras login con Google
     */
    async syncUser(req, res) {
        const { email, name, id } = req.body;

        if (!email || !id) {
            return res.status(400).json({ error: 'Faltan datos requeridos (email, id).' });
        }

        try {
            const user = await this.authService.syncGoogleUser({ email, name, id });
            res.status(200).json({ message: 'Sincronización exitosa', user });
        } catch (error) {
            console.error('❌ Error en syncUser:', error);
            // Devolver el mensaje real para poder arreglar el 500 inmediatamente
            res.status(500).json({ 
                error: 'Error al sincronizar usuario.', 
                details: error.message 
            });
        }
    }

    /**
     * Eliminar cuenta de usuario
     */
    async deleteAccount(req, res) {
        const userId = req.user.id;
        try {
            // Nota: Para usuarios Google no necesitamos password para confirmar borrado
            await this.authService.deleteAccount(userId);
            res.json({ message: 'Cuenta eliminada con éxito.' });
        } catch (error) {
            console.error('Error en deleteAccount:', error);
            res.status(500).json({ error: 'Error al eliminar la cuenta.' });
        }
    }
}

module.exports = AuthController;