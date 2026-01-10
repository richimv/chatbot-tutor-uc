class User {
    // Constructor estandarizado
    constructor(id, email, passwordHash, role, name, subscriptionStatus = 'pending', paymentId = null, usageCount = 0, maxFreeLimit = 3) {
        this.id = id;
        this.email = email;
        this.passwordHash = passwordHash;
        this.role = role;
        this.name = name;
        this.subscriptionStatus = subscriptionStatus;
        this.paymentId = paymentId;

        // ✅ CORRECCIÓN: Usamos camelCase para que coincida con el resto de la App
        this.usageCount = usageCount;
        this.maxFreeLimit = maxFreeLimit;
    }
}

module.exports = User;