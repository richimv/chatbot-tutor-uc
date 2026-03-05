require('dotenv').config();
const db = require('./infrastructure/database/db');

async function migrate() {
    try {
        console.log("⏳ Iniciando la inyección de la columna 'career' en la BD...");
        await db.query("ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS career VARCHAR(100)");
        console.log("✅ Columna 'career' añadida exitosamente a 'question_bank'.");

        await db.query("ALTER TABLE quiz_history ADD COLUMN IF NOT EXISTS career VARCHAR(100)");
        console.log("✅ Columna 'career' añadida exitosamente a 'quiz_history'.");

    } catch (e) {
        console.error("❌ Error en migración:", e);
    } finally {
        process.exit(0);
    }
}

migrate();
