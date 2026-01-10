// config.js
// Este archivo debe cargarse ANTES que cualquier otro script

(function () {
    // Detectar entorno
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    // Definir URL del Backend
    // Definir URL del Backend
    // Si estamos en localhost (dev), usamos local.
    // Si estamos en producción (Vercel), usamos la URL del Backend en Render.
    const API_URL = isLocal
        ? 'http://localhost:3000'
        : 'https://tutor-ia-backend.onrender.com';

    // Exponer globalmente
    window.AppConfig = {
        API_URL: API_URL,
        // ✅ SUPABASE CONFIG (Requerido para Google Login)
        SUPABASE_URL: 'INSERT_YOUR_SUPABASE_URL_HERE',
        SUPABASE_ANON_KEY: 'INSERT_YOUR_SUPABASE_ANON_KEY_HERE'
    };

    console.log('🔧 Configuración cargada. API:', API_URL);
})();