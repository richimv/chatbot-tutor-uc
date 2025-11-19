const { Pool } = require('pg');
// ✅ SOLUCIÓN DEFINITIVA: Cargar dotenv aquí mismo para garantizar que las variables estén disponibles.
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

let pool;

function getPool() {
    if (!pool) {
        // Esta verificación ahora es una segunda capa de seguridad.
        if (!process.env.DATABASE_URL) {
            throw new Error('FATAL: La variable de entorno DATABASE_URL no está definida. Asegúrate de que tu archivo .env existe y es correcto.');
        }

        console.log('🔧 Creando pool de conexiones a PostgreSQL...');
        pool = new Pool({
            connectionString: process.env.DATABASE_URL, // Ahora garantizamos que esto tiene un valor.
            ssl: {
                rejectUnauthorized: false // Requerido para conexiones a Supabase/Heroku
            },
            // ✅ MEJORA DE RESILIENCIA: Configuración para manejar mejor las conexiones inactivas de Supabase.
            idleTimeoutMillis: 30000, // Cierra clientes inactivos después de 30 segundos.
            // ✅ SOLUCIÓN: Aumentar el tiempo de espera para dar tiempo a que Supabase "despierte".
            connectionTimeoutMillis: 10000, // 10 segundos es un valor mucho más seguro.
            // ✅ SOLUCIÓN CRÍTICA: Mantener las conexiones vivas para evitar que Supabase las termine.
            keepAlive: true,

        });

        // ✅ SOLUCIÓN DEFINITIVA: Manejador de errores que destruye el pool defectuoso.
        // Esto fuerza a getPool() a crear uno nuevo en la siguiente petición, recuperando la conexión.
        pool.on('error', (err, client) => {
            // ✅ SOLUCIÓN CRÍTICA: Si el pool ya es nulo, no hacer nada.
            // Esto previene el crash 'Cannot read properties of null (reading 'end')'.
            // Usamos una variable local para evitar condiciones de carrera.
            const currentPool = pool;
            if (currentPool && (err.code === 'XX000' || err.message.includes('terminat'))) {
                console.error('❌ Error fatal detectado en el pool de la base de datos (posiblemente por Supabase). Recreando el pool...', err.message);
                console.log('🔥 Destruyendo el pool de conexiones defectuoso...');
                pool = null; // Establece el pool a null para que se recree.
                currentPool.end().catch(e => console.error("Error al cerrar el pool:", e)); // Cierra todas las conexiones del pool antiguo.
            }
        });
    }
    return pool;
}

module.exports = {
    // ✅ CORRECCIÓN: Devolver el objeto de resultado completo (incluye .rows y .rowCount).
    // Esto hace que el módulo sea más flexible y previene errores como el del arranque.
    query: (text, params) => getPool().query(text, params),
    pool: () => getPool()
};