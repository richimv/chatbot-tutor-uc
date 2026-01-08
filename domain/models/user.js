class User {
    constructor(id, email, passwordHash, role, name, subscriptionStatus = 'pending', paymentId = null) {
        // ✅ SOLUCIÓN DEFINITIVA: El ID del usuario SIEMPRE debe ser el que se le pasa desde el repositorio.
        // La lógica anterior que generaba un `USER_...` era la causa raíz de todos los problemas de autenticación.
        this.id = id;
        this.email = email;
        this.passwordHash = passwordHash;
        this.role = role;
        this.name = name;
        this.subscriptionStatus = subscriptionStatus;
        this.paymentId = paymentId;
    }
}

module.exports = User;