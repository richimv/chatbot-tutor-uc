// config.js
// Este archivo debe cargarse ANTES que cualquier otro script
// Configuración global de la aplicación S

(function () {
    console.log('🔄 Cargando Configuración...');
    // 1. Detectar si estamos en local o producción
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    // 2. Definir URL del Backend (API)
    const API_URL = isLocal
        ? 'http://localhost:3000'
        : 'https://tutor-ia-backend.onrender.com';

    // 3. Exponer configuración globalmente
    // Usamos var o window para asegurar que sea global
    window.AppConfig = {
        API_URL: API_URL,

        // ✅ SUPABASE CONFIG (Credenciales Públicas)
        // Estas claves son seguras para estar en el frontend (Anon Key).
        SUPABASE_URL: 'https://rayjtupppcbhzjizhamn.supabase.co',
        SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJheWp0dXBwcGNiaHpqaXpoYW1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzMDEyMDAsImV4cCI6MjA3Nzg3NzIwMH0.BXZOjsUfCbi2_bBw9wglTMBX7WkwcGxlZjfaNwteDD8'
    };

    console.log('✅ Configuración Cargada Exitosamente.');
    console.log('📍 API:', window.AppConfig.API_URL);
    // console.log('📍 Supabase URL:', window.AppConfig.SUPABASE_URL);

    // ✅ SUPABASE SINGLETON INITIALIZATION
    // Inicializamos el cliente una sola vez para evitar advertencias de "Multiple GoTrueClient instances".
    if (typeof supabase !== 'undefined') {
        window.supabaseClient = supabase.createClient(window.AppConfig.SUPABASE_URL, window.AppConfig.SUPABASE_ANON_KEY);
        console.log('✅ Supabase Singleton Initialized.');
    } else {
        console.warn('⚠️ Librería Supabase no detectada al cargar config.js');
    }

})();