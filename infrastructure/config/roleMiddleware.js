/**
 * Middleware para verificar roles de usuario.
 */

const isAdmin = (req, res, next) => {
    // Se asume que el middleware 'auth' ya se ejecutó y pobló req.user
    if (req.user && req.user.role === 'admin') {
        return next(); // El usuario es admin, continuar
    }

    return res.status(403).json({ 
        error: 'Acceso denegado. Se requiere rol de administrador.' 
    });
};

module.exports = {
    isAdmin
};