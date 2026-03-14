const UserRepository = require('../repositories/userRepository');

class UsageService {
    constructor() {
        this.userRepository = new UserRepository();
    }

    async checkAndIncrementUsage(userId) {
        console.log(`🔍 [UsageService] Verificando: ${userId}`);
        const user = await this.userRepository.findById(userId);

        if (!user) throw new Error('Usuario no encontrado');

        // 1. Roles privilegiados
        if (['admin', 'teacher'].includes(user.role)) return { allowed: true, plan: 'unlimited' };

        // 2. Premium Tiers (basic, advanced)
        const tier = String(user.subscriptionTier || 'free').toLowerCase();
        if (['basic', 'advanced'].includes(tier)) return { allowed: true, plan: 'premium' };

        // 3. Freemium - Lógica corregida usando las propiedades estandarizadas
        // Ahora user.usageCount y user.maxFreeLimit existen y son números
        const currentUsage = user.usageCount || 0;
        const limit = user.maxFreeLimit || 3;

        console.log(`📊 [Usage] Actual: ${currentUsage} / Límite: ${limit}`);

        if (currentUsage < limit) {
            // ✅ Permitir y aumentar
            const newUsage = currentUsage + 1;

            // Usamos camelCase, el repositorio lo traducirá
            await this.userRepository.update(userId, { usageCount: newUsage });

            return { allowed: true, plan: 'free', usage: newUsage, limit: limit };
        } else {
            // ⛔ Bloquear
            return { allowed: false, plan: 'free', usage: currentUsage, limit: limit, reason: 'LIMIT_REACHED' };
        }
    }
}

module.exports = UsageService;