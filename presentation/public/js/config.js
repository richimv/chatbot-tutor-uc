// config.js
// Este archivo debe cargarse ANTES que cualquier otro script
// Configuración global de la aplicación

(function () {
    // 1. Detectar si estamos en local o producción
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    // 2. Definir URL del Backend (API)
    const API_URL = isLocal
        ? 'http://localhost:3000'
        : 'https://tutor-ia-backend.onrender.com';

    // 3. Exponer configuración globalmente
    window.AppConfig = {
        API_URL: API_URL,

        // ✅ SUPABASE CONFIG (Credenciales Públicas)
        // Estas claves son seguras para estar en el frontend (Anon Key).
        SUPABASE_URL: 'https://rayjtupppcbhzjizhamn.supabase.co',
        SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJheWp0dXBwcGNiaHpqaXpoYW1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzMDEyMDAsImV4cCI6MjA3Nzg3NzIwMH0.BXZOjsUfCbi2_bBw9wglTMBX7WkwcGxlZjfaNwteDD8'
    };

    console.log('🔧 Configuración cargada correctamente.');
    console.log('📍 Entorno:', isLocal ? 'Local' : 'Producción');
    console.log('🔗 API:', API_URL);
    console.log('⚡ Supabase:', 'Configurado');
})();