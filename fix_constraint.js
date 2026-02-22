const db = require('./infrastructure/database/db');

(async () => {
    try {
        console.log("🔧 Iniciando reparación de restricción en quiz_scores...");

        // 1. Eliminar constraint antigua
        await db.query(`ALTER TABLE public.quiz_scores DROP CONSTRAINT IF EXISTS quiz_scores_difficulty_check;`);
        console.log("✅ Check constraint eliminado.");

        console.log("🎉 Tabla quiz_scores actualizada para aceptar 'Arcade'.");
        process.exit(0);
    } catch (e) {
        console.error("❌ Error actualizando DB:", e);
        process.exit(1);
    }
})();
