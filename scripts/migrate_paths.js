const db = require('../infrastructure/database/db');

async function migratePaths() {
    console.log('🔄 Iniciando migración de rutas de imágenes (assets/libros -> assets/recursos)...');

    try {
        const client = await db.pool().connect();
        try {
            await client.query('BEGIN');

            // Actualizar rutas que empiecen por "assets/libros/"
            const result = await client.query(`
                UPDATE resources 
                SET image_url = REPLACE(image_url, 'assets/libros/', 'assets/recursos/') 
                WHERE image_url LIKE 'assets/libros/%'
            `);

            console.log(`✅ Se actualizaron ${result.rowCount} registros en la tabla 'resources'.`);

            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            console.error('❌ Error durante la transacción:', e);
            throw e;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('❌ Error fatal en migración:', error);
    } finally {
        process.exit();
    }
}

migratePaths();
