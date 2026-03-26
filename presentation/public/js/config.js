// config.js
// Este archivo debe cargarse ANTES que cualquier otro script
// Configuración global de la aplicación S

(function () {
    // 1. Detectar si estamos en local o producción
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    // 🛡️ SECURITY: Deshabilitar logs en Producción (ANTES DE CUALQUIER LOG)
    if (!isLocal) {
        // Guardamos reference al error original por si acaso
        const consoleError = console.error;
        const consoleWarn = console.warn;

        // Silenciamos logs verbose
        console.log = function () { };
        console.info = function () { };
        console.debug = function () { };
    }

    console.log('🔄 Cargando Configuración...');

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

    /**
     * Resolutor Universal de URLs de Imagen (GCS / Externo)
     * Detecta si una URL es una ruta relativa de GCS y la redirige al proxy del backend.
     */
    window.resolveImageUrl = function (url) {
        if (!url || url.trim() === '') {
            return 'https://placehold.co/400x300/1e293b/ffffff?text=Material';
        }

        // Si ya es una URL absoluta o relativa local conocida, no tocar
        if (url.startsWith('http') || url.startsWith('/') || url.startsWith('data:') || url.startsWith('assets/')) {
            return url;
        }

        // Caso GCS: Es una ruta como "test.png" o "folders/image.jpg"
        const token = localStorage.getItem('authToken');
        const tokenParam = token ? `&token=${token}` : '';
        
        return `${window.AppConfig.API_URL}/api/media/gcs?path=${encodeURIComponent(url)}${tokenParam}`;
    };

    console.log('✅ Configuración Cargada Exitosamente.');
    console.log('📍 API:', window.AppConfig.API_URL);

    // ✅ SUPABASE SINGLETON INITIALIZATION
    // Inicializamos el cliente una sola vez para evitar advertencias de "Multiple GoTrueClient instances".
    if (typeof supabase !== 'undefined') {
        window.supabaseClient = supabase.createClient(window.AppConfig.SUPABASE_URL, window.AppConfig.SUPABASE_ANON_KEY);
        console.log('✅ Supabase Singleton Initialized.');
    } else {
        // console.warn('⚠️ Librería Supabase no detectada al cargar config.js'); // SIlenced to prevent unnecessary console noise on pages that don't need Supabase Auth
    }

})();