const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.NODE_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log('🚀 Iniciando creación de tabla topic_resources...');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS topic_resources (
                topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE,
                resource_id INTEGER REFERENCES resources(id) ON DELETE CASCADE,
                PRIMARY KEY (topic_id, resource_id)
            );
        `);

        console.log('✅ Tabla creada correctamente.');
    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        await pool.end();
    }
}

run();
