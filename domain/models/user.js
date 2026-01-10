class User {
    constructor(id, email, passwordHash, role, name, subscriptionStatus = 'pending', paymentId = null, usageCount = 0, maxFreeLimit = 3) {
        // ✅ SOLUCIÓN DEFINITIVA: El ID del usuario SIEMPRE debe ser el que se le pasa desde el repositorio.
        // La lógica anterior que generaba un `USER_...` era la causa raíz de todos los problemas de autenticación.
        this.id = id;
        this.email = email;
        this.passwordHash = passwordHash;
        this.role = role;
        this.name = name;
        this.subscriptionStatus = subscriptionStatus;
        this.paymentId = paymentId;
        // ✅ NUEVO: Campos para el modelo Freemium (3 muestras gratis)
        this.usage_count = usageCount; // Mapeamos al snake_case de la DB si queremos, o mantenemos camelCase.
        // Wait, UsageService uses `user.usage_count`.
        // If I map `usageCount` -> `this.usage_count`, it matches properties access `user.usage_count`.
        this.max_free_limit = maxFreeLimit;
    }
}

module.exports = User;