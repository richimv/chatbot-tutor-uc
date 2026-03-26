const db = require('../infrastructure/database/db');

async function migrate() {
    try {
        console.log('🚀 Iniciando migración: Añadiendo explanation_image_url a question_bank...');
        
        const sql = `
            ALTER TABLE public.question_bank 
            ADD COLUMN IF NOT EXISTS explanation_image_url TEXT;
        `;
        
        await db.query(sql);
        console.log('✅ Migración completada: Columna añadida/verificada con éxito.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error en la migración:', error.message);
        process.exit(1);
    }
}

migrate();
