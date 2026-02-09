const supabase = require('../config/supabaseClient');
const UserRepository = require('../../domain/repositories/userRepository');
const userRepository = new UserRepository();

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;

async function getUserWithRetry(token, retries = MAX_RETRIES) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (error) throw error; // Re-throw to cache if it's a supabase error (401, etc) - though 401 shouldn't be retried usually, but network errors will be caught below. 
            // Wait, supabase-js returns error object, doesn't throw for 401. 
            // We should only retry on NETWORK errors (detected via catch block) or 5xx.
            // But getUser failing with 401 is permanent. 
            return { user, error: null };
        } catch (err) {
            const isNetworkError = err.cause && (err.cause.code === 'ECONNRESET' || err.cause.code === 'ETIMEDOUT' || err.message.includes('fetch failed'));

            if (isNetworkError && attempt < retries) {
                console.warn(`⚠️ Supabase Auth Network Error (Attempt ${attempt}/${retries}): ${err.message}. Retrying in ${RETRY_DELAY_MS}ms...`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
                continue;
            }
            // If it's the last attempt or not a network error, return/throw
            if (attempt === retries) throw err;
            throw err;
        }
    }
}

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
        // 1. Verificar token con Supabase (con Retry Pattern para evitar ECONNRESET)
        let sbUser;
        try {
            const result = await getUserWithRetry(token);
            sbUser = result.user;
        } catch (err) {
            // ✅ CORRECCIÓN: Distinguir entre error de red y error de token inválido
            const msg = err.message || '';
            if (msg.includes('invalid JWT') || msg.includes('expired') || msg.includes('invalid claim')) {
                console.warn('⚠️ Token inválido o expirado:', msg);
                return res.status(401).json({ error: 'Sesión expirada. Por favor inicie sesión nuevamente.' });
            }

            console.error('❌ Supabase Auth Connectivity Error:', msg);
            return res.status(503).json({ error: 'Error de conexión con servicio de autenticación. Intente nuevamente.' });
        }

        if (!sbUser) {
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