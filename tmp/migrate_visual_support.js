const path = require('path');
const dbPath = path.resolve(__dirname, '../infrastructure/database/db');
const db = require(dbPath);

async function migrate() {
    try {
        console.log("🚀 Iniciando migración: Columna visual_support_recommendation...");
        await db.query(`
            ALTER TABLE question_bank 
            ADD COLUMN IF NOT EXISTS visual_support_recommendation TEXT;
        `);
        console.log("✅ Columna añadida exitosamente (o ya existía).");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error en la migración:", error);
        process.exit(1);
    }
}

migrate();
