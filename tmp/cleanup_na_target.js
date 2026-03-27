const db = require('../infrastructure/database/db');

async function cleanup() {
    try {
        const res = await db.query(`
            UPDATE question_bank 
            SET target = NULL 
            WHERE domain = 'GENERAL_TRIVIA' AND target = 'N/A'
            RETURNING id
        `);
        console.log(`✅ Se han limpiado ${res.rows.length} registros que tenían target 'N/A'.`);
        process.exit(0);
    } catch (err) {
        console.error('❌ Error en el cleanup:', err);
        process.exit(1);
    }
}

cleanup();
