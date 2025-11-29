// config.js
// Este archivo debe cargarse ANTES que cualquier otro script

(function () {
    // Detectar entorno
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    // Definir URL del Backend
    const API_URL = isLocal
        ? 'http://localhost:3000'
        : 'https://tutor-ia-backend.onrender.com'; // Tu URL de Render

    // Exponer globalmente
    window.AppConfig = {
        API_URL: API_URL
    };

    console.log('🔧 Configuración cargada. API:', API_URL);
})();