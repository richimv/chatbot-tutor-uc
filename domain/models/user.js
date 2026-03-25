class User {
    // Constructor estandarizado
    constructor(id, email, passwordHash, role, name, subscriptionStatus = 'pending', paymentId = null, usageCount = 0, maxFreeLimit = 3, subscriptionTier = 'free', subscriptionExpiresAt = null, dailySimulatorUsage = 0) {
        this.id = id;
        this.email = email;
        this.passwordHash = passwordHash;
        this.role = role;
        this.name = name;
        this.subscriptionStatus = subscriptionStatus;
        this.subscriptionTier = subscriptionTier;
        this.paymentId = paymentId;
        this.subscriptionExpiresAt = subscriptionExpiresAt;

        // ✅ CORRECCIÓN: Usamos camelCase para que coincida con el resto de la App
        this.usageCount = usageCount;
        this.maxFreeLimit = maxFreeLimit;
        this.dailySimulatorUsage = dailySimulatorUsage;
    }
}

module.exports = User;