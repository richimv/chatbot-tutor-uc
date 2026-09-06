const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env'), override: true });

let pool;

function getSslConfig() {
    const caBase64 = String(process.env.NODE_DATABASE_SSL_CA_BASE64 || '').trim();
    const caText = String(process.env.NODE_DATABASE_SSL_CA || '').replace(/\\n/g, '\n').trim();
    const ca = caBase64 ? Buffer.from(caBase64, 'base64').toString('utf8') : caText;
    const rejectUnauthorized = String(process.env.NODE_DATABASE_SSL_REJECT_UNAUTHORIZED || 'false').toLowerCase() === 'true';

    if (process.env.NODE_ENV === 'production' && !rejectUnauthorized) {
        console.warn('⚠️ PostgreSQL TLS cifra el tráfico, pero la verificación de CA está desactivada. Configure NODE_DATABASE_SSL_CA_BASE64 y NODE_DATABASE_SSL_REJECT_UNAUTHORIZED=true.');
    }

    return {
        rejectUnauthorized,
        ...(ca ? { ca } : {})
    };
}

function getPool() {
    if (!pool) {
        // ✅ CORRECCIÓN: Usar la variable específica para Node (Puerto 6543)
        if (!process.env.NODE_DATABASE_URL) {
            throw new Error('FATAL: NODE_DATABASE_URL no definida en .env');
        }

        console.log('🔧 Creando pool de conexiones a PostgreSQL...');
        pool = new Pool({
            connectionString: process.env.NODE_DATABASE_URL,
            ssl: getSslConfig(),
            max: 5,

            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
            keepAlive: true,
            keepAliveInitialDelayMillis: 10000,
        });

        // Manejador de errores del pool (distinguir desconexiones idle normales de fallos fatales)
        pool.on('error', (err, client) => {
            const currentPool = pool;
            const isIdleDisconnect = err.message && (
                err.message.includes('terminat') || 
                err.message.includes('closed') || 
                err.code === 'ECONNRESET'
            );

            if (isIdleDisconnect) {
                // Desconexión normal por inactividad de Supavisor/PgBouncer
                console.warn('⚠️ [Postgres Pool] Cliente inactivo desconectado por el servidor. El pool reciclará la conexión bajo demanda.');
                return;
            }

            if (currentPool && err.code === 'XX000') {
                console.error('❌ Error fatal detectado en el pool. Recreando...', err.message);
                console.log('🔥 Destruyendo el pool de conexiones defectuoso...');
                pool = null;
                currentPool.end().catch(e => console.error("Error al cerrar pool:", e));
            }
        });
    }
    return pool;
}

async function safeQuery(text, params) {
    try {
        return await getPool().query(text, params);
    } catch (err) {
        const isTerminated = err.message && (
            err.message.includes('terminat') || 
            err.message.includes('closed') || 
            err.code === 'ECONNRESET' ||
            err.code === '57P01'
        );
        if (isTerminated) {
            console.warn(`🔄 [db.js] Conexión interrumpida (${err.message}). Reintentando consulta con conexión fresca...`);
            return await getPool().query(text, params);
        }
        throw err;
    }
}

module.exports = {
    query: safeQuery,
    pool: () => getPool()
};
