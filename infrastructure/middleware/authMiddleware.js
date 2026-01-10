const supabase = require('../config/supabaseClient');
const UserRepository = require('../../domain/repositories/userRepository');
const userRepository = new UserRepository();

async function auth(req, res, next) {
    const authHeader = req.header('Authorization');

    if (!authHeader) {
        return res.status(401).json({ error: 'Acceso denegado. Token no provisto.' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Formato de token inválido.' });
    }

    try {
        // 1. Verificar token con Supabase
        const { data: { user: sbUser }, error } = await supabase.auth.getUser(token);

        if (error || !sbUser) {
            // console.warn('⚠️ Token Supabase inválido:', error?.message);
            return res.status(401).json({ error: 'Sesión inválida o expirada.' });
        }

        // 2. Obtener usuario de nuestra Base de Datos (Roles, Usage, Subscription)
        const dbUser = await userRepository.findById(sbUser.id);

        if (!dbUser) {
            // Caso raro: Existe en Auth pero no en DB (Sincronización fallida?)
            console.error(`❌ Usuario Auth ${sbUser.id} no encontrado en DB Local.`);
            return res.status(401).json({ error: 'Usuario no registrado en el sistema.' });
        }

        // 3. Adjuntar usuario completo a la request
        req.user = dbUser;
        next();

    } catch (ex) {
        console.error('❌ Error Auth Middleware:', ex.message);
        res.status(500).json({ error: 'Error interno de autenticación.' });
    }
}

async function optionalAuth(req, res, next) {
    const authHeader = req.header('Authorization');
    if (!authHeader) return next();

    const token = authHeader.split(' ')[1];
    if (!token) return next();

    try {
        const { data: { user: sbUser }, error } = await supabase.auth.getUser(token);
        if (sbUser) {
            const dbUser = await userRepository.findById(sbUser.id);
            if (dbUser) req.user = dbUser;
        }
    } catch (err) {
        // Ignorar errores en auth opcional
    }
    next();
}

const adminOnly = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador.' });
    }
};

module.exports = { auth, optionalAuth, adminOnly };