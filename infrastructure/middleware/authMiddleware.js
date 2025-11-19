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
        res.status(400).json({ error: 'Token inválido.' });
    }
}

const adminOnly = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador.' });
    }
};

module.exports = { auth, adminOnly };