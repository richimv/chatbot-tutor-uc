const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'este-es-un-secreto-muy-largo-y-seguro-para-desarrollo';

function auth(req, res, next) {
    const authHeader = req.header('Authorization');

    if (!authHeader) {
        return res.status(401).json({ error: 'Acceso denegado. No se proveyó un token.' });
    }

    // El token debe venir en el formato "Bearer <token>"
    const token = authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Acceso denegado. Formato de token inválido.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        // ✅ SOLUCIÓN DEFINITIVA: El payload del token ya es el objeto de usuario.
        // No está anidado dentro de una propiedad 'user'.
        req.user = decoded; // Asignamos el payload decodificado directamente a req.user
        next();
    } catch (ex) {
        // ✅ MEJORA: Loguear el error específico para depuración
        console.error('❌ Error de autenticación (JWT):', ex.message);

        // ✅ MEJORA: Devolver 401 (Unauthorized) en lugar de 400 (Bad Request)
        // y un mensaje más específico si es posible.
        if (ex.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expirado. Por favor, inicia sesión nuevamente.' });
        }
        res.status(401).json({ error: 'Token inválido.' });
    }
}

function optionalAuth(req, res, next) {
    const authHeader = req.header('Authorization');

    if (!authHeader) {
        return next();
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return next();
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (ex) {
        // Si el token es inválido, simplemente continuamos sin usuario autenticado
        // No bloqueamos la petición porque es una ruta pública
        next();
    }
}

const adminOnly = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador.' });
    }
};

module.exports = { auth, optionalAuth, adminOnly };