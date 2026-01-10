class UsageController {
    constructor(usageService) {
        this.usageService = usageService;
        // Bind methods
        this.checkAccess = this.checkAccess.bind(this);
    }

    async checkAccess(req, res) {
        // Asumiendo que 'auth' middleware ya ha puesto req.user.id
        const userId = req.user.id;
        try {
            const result = await this.usageService.checkAndIncrementUsage(userId);

            if (result.allowed) {
                res.json(result);
            } else {
                // 403 Forbidden is appropriate for "Payment Required" flows usually, or 402 Payment Required
                res.status(403).json({
                    error: 'PAYMENT_REQUIRED',
                    message: 'Has alcanzado el límite de muestras gratuitas.',
                    result
                });
            }
        } catch (error) {
            console.error('Error en checkAccess usage:', error);
            res.status(500).json({ error: 'Error interno verificando límites.' });
        }
    }
}

module.exports = UsageController;
