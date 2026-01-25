const db = require('../db');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    try {
        const sqlPath = path.join(__dirname, '006_create_ai_analytics.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log('🔄 Ejecutando migración 006 (AI Analytics)...');
        await db.query(sql);
        console.log('✅ Migración completada: Tabla ai_analytics creada.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error en la migración:', error);
        process.exit(1);
    }
}

runMigration();
