const db = require('./infrastructure/database/db');

async function fixDeckName() {
    try {
        console.log('🔄 Actualizando nombre del mazo...');
        const res = await db.query(`
            UPDATE decks 
            SET name = 'Repaso Medicina' 
            WHERE name = 'Repaso General' AND source_module = 'MEDICINA'
            RETURNING id, name;
        `);

        if (res.rowCount > 0) {
            console.log(`✅ ${res.rowCount} mazo(s) renombrado(s) a 'Repaso Medicina'.`);
        } else {
            console.log('ℹ️ No se encontraron mazos con nombre "Repaso General" y modulo "MEDICINA".');
        }
    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        process.exit();
    }
}

fixDeckName();
