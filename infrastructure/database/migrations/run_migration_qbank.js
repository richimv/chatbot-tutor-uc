const db = require('../db');

const createTables = async () => {
    try {
        console.log('🚀 Iniciando migración de Base de Datos para Question Bank...');

        // 1. Tabla Question Bank
        await db.query(`
            CREATE TABLE IF NOT EXISTS question_bank (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                domain VARCHAR(20) DEFAULT 'GENERAL',
                topic VARCHAR(100) NOT NULL,
                difficulty VARCHAR(50) DEFAULT 'Intermedio',
                question_text TEXT NOT NULL,
                options JSONB NOT NULL,
                correct_option_index INTEGER NOT NULL,
                explanation TEXT,
                times_used INTEGER DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                question_hash TEXT UNIQUE 
            );
        `);
        console.log('✅ Tabla question_bank creada/verificada.');

        // 2. Tabla User Q History
        await db.query(`
            CREATE TABLE IF NOT EXISTS user_question_history (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                question_id UUID REFERENCES question_bank(id) ON DELETE CASCADE,
                seen_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('✅ Tabla user_question_history creada/verificada.');

        // 3. Índices para búsqueda rápida
        await db.query(`CREATE INDEX IF NOT EXISTS idx_qbank_topic ON question_bank(topic);`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_qbank_domain ON question_bank(domain);`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_uhist_user_q ON user_question_history(user_id, question_id);`);
        console.log('✅ Índices creados.');

        console.log('🏁 Migración completada exitosamente.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error en la migración:', error);
        process.exit(1);
    }
};

createTables();
