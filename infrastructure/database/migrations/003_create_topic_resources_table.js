const db = require('../db');

async function up() {
    const client = await db.pool().connect();
    try {
        await client.query('BEGIN');

        console.log('🏗️ Creando tabla topic_resources...');

        await client.query(`
            CREATE TABLE IF NOT EXISTS topic_resources (
                topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE,
                resource_id INTEGER REFERENCES resources(id) ON DELETE CASCADE,
                PRIMARY KEY (topic_id, resource_id)
            );
        `);

        console.log('✅ Tabla topic_resources creada exitosamente.');
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error creando tabla topic_resources:', error);
        throw error;
    } finally {
        client.release();
    }
}

up().catch(err => console.error(err));
