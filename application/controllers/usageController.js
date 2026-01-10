class UsageController {
    constructor(usageService) {
        this.usageService = usageService;
        this.checkAccess = this.checkAccess.bind(this);
    }

    async checkAccess(req, res) {
        try {
            // Debug para ver si el middleware Auth está funcionando
            if (!req.user || !req.user.id) {
                console.error('❌ [UsageController] No hay req.user.id. Middleware de Auth falló?');
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const userId = req.user.id;
            // console.log(`🛡️ [Controller] Solicitud de acceso para: ${userId}`);

            const result = await this.usageService.checkAndIncrementUsage(userId);

            if (result.allowed) {
                res.json(result);
            } else {
                // 403 dispara el modal en el frontend
                res.status(403).json({
                    error: 'PAYMENT_REQUIRED',
                    message: 'Has alcanzado el límite de muestras gratuitas.',
                    result
                });
            }
        } catch (error) {
            console.error('💥 [UsageController] Error crítico:', error);
            res.status(500).json({ error: 'Error interno verificando límites.' });
        }
    }
}

module.exports = UsageController;