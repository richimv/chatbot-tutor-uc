const UserRepository = require('../repositories/userRepository');

class UsageService {
    constructor() {
        // Singleton o inyección manual
        this.userRepository = new UserRepository();
    }

    /**
     * Verifica si el usuario puede acceder a un recurso premium.
     * Incrementa el contador si es usuario gratuito.
     * @param {string} userId - ID del usuario.
     * @returns {Promise<{allowed: boolean, reason?: string, usage: number, limit: number}>}
     */
    async checkAndIncrementUsage(userId) {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new Error('Usuario no encontrado');
        }

        // 1. Superusuarios: Acceso ilimitado (Admin/Profesor)
        if (['admin', 'teacher'].includes(user.role)) {
            return { allowed: true, plan: 'unlimited_role' };
        }

        // 2. Si la suscripción está activa (Premium), acceso ilimitado.
        // ✅ FIX CRÍTICO: El modelo User usa camelCase (subscriptionStatus).
        if (user.subscriptionStatus === 'active') {
            return { allowed: true, plan: 'premium' };
        }

        // 3. Si es usuario Free, verificar límites.
        const usage = parseInt(user.usage_count || 0, 10);
        const limit = parseInt(user.max_free_limit || 3, 10);

        console.log(`🔍 Usage Check: User ${userId} | Count: ${usage} | Limit: ${limit}`);

        if (usage < limit) {
            // Permitir y aumentar contador
            const newUsage = usage + 1;

            // Actualizar solo el usage_count en la BD
            // Dependiendo del repository, puede haber un método específico o update genérico
            await this.userRepository.update(userId, { usage_count: newUsage });

            return {
                allowed: true,
                plan: 'free',
                usage: newUsage,
                limit: limit
            };
        } else {
            // Límite alcanzado
            return {
                allowed: false,
                plan: 'free',
                usage: usage,
                limit: limit,
                reason: 'LIMIT_REACHED'
            };
        }
    }
}

module.exports = UsageService;
