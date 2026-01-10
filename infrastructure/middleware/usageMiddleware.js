const UsageService = require('../../domain/services/usageService');
// Instancia del servicio (Singleton)
const usageService = new UsageService();

/**
 * Middleware para verificar y hacer cumplir los límites de uso gratuito.
 * Se debe colocar DESPUÉS del middleware de autenticación (auth).
 */
const usageMiddleware = async (req, res, next) => {
    try {
        const userId = req.user.id; // Asumimos que authMiddleware ya populó req.user

        // Usar el servicio para verificar e incrementar
        // Nota: Esto INCREMENTA el contador. Solo usar en endpoints que consuman una "vida".
        const result = await usageService.checkAndIncrementUsage(userId);

        if (result.allowed) {
            // Adjuntar información de uso al request por si se necesita después
            req.usage = result;
            next();
        } else {
            // Límite alcanzado
            return res.status(403).json({
                code: 'LIMIT_REACHED',
                message: 'Límite gratuito excedido',
                paywall: true,
                result
            });
        }
    } catch (error) {
        console.error('❌ Error en usageMiddleware:', error);
        res.status(500).json({ error: 'Error interno verificando límites.' });
    }
};

module.exports = usageMiddleware;
