const rateLimit = require('express-rate-limit');

/**
 * Limitador global para la mayoría de las rutas de la API.
 * Permite un número razonable de peticiones para el uso normal de la aplicación.
 */
const globalApiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 500, // ✅ AJUSTE: Aumentado a 500 para ser más flexible durante el desarrollo.
    standardHeaders: true, // Devuelve la información del rate limit en los headers `RateLimit-*`
    legacyHeaders: false, // Deshabilita los headers `X-RateLimit-*`
    message: { error: 'Demasiadas peticiones desde esta IP, por favor intente de nuevo después de 15 minutos.' }
});

/**
 * Limitador más estricto para las rutas sensibles de autenticación (login, register).
 * Ayuda a prevenir ataques de fuerza bruta.
 */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 20, // ✅ AJUSTE: Aumentado a 20 intentos por IP cada 15 minutos. Más razonable.
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiados intentos de autenticación desde esta IP, por favor intente de nuevo después de 5 minutos.' }
});

module.exports = {
    globalApiLimiter,
    authLimiter
};