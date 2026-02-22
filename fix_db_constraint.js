const db = require('./infrastructure/database/db');

async function run() {
    try {
        console.log("🔧 Fixing Database Constraint...");

        // 1. Limpiar duplicados o basura anterior
        console.log("🧹 Truncando historial para asegurar consistencia...");
        await db.query("TRUNCATE user_question_history;");

        // 2. Agregar Constraint
        console.log("🔒 Agregando CONSTRAINT UNIQUE (user_id, question_id)...");
        await db.query("ALTER TABLE user_question_history ADD CONSTRAINT user_question_history_user_id_question_id_key UNIQUE (user_id, question_id);");

        console.log("✅ ¡Éxito! Base de datos reparada.");
    } catch (e) {
        if (e.message.includes("already exists")) {
            console.log("⚠️ La constraint ya existía.");
        } else {
            console.error("❌ Error:", e.message);
        }
    } finally {
        // Force exit
        setTimeout(() => process.exit(0), 1000);
    }
}

run();
