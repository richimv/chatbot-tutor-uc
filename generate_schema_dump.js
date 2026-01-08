const fs = require('fs');
const path = require('path');
const db = require('./infrastructure/database/db');

const OUTPUT_FILE = path.join(__dirname, 'database_schema.sql');

async function generateSchema() {
    try {
        console.log('🔌 Conectando a la base de datos...');
        const client = await db.pool().connect();

        console.log('🔍 Leyendo esquema de la base de datos...');
        let sqlContent = `-- Database Schema Dump\n-- Generated at: ${new Date().toISOString()}\n\n`;

        // 1. Obtener Tablas
        const tablesRes = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
              AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        `);

        for (const row of tablesRes.rows) {
            const tableName = row.table_name;
            console.log(`   Processed table: ${tableName}`);

            sqlContent += `-- Table: ${tableName}\n`;
            sqlContent += `CREATE TABLE IF NOT EXISTS public.${tableName} (\n`;

            // 2. Obtener Columnas
            const columnsRes = await client.query(`
                SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_name = $1 AND table_schema = 'public'
                ORDER BY ordinal_position;
            `, [tableName]);

            const colDefs = [];
            for (const col of columnsRes.rows) {
                let def = `    ${col.column_name} ${col.data_type.toUpperCase()}`;

                if (col.character_maximum_length) {
                    def += `(${col.character_maximum_length})`;
                }

                if (col.column_default) {
                    def += ` DEFAULT ${col.column_default}`;
                }

                if (col.is_nullable === 'NO') {
                    def += ' NOT NULL';
                }
                colDefs.push(def);
            }

            // 3. Obtener Constraints (PKs)
            const pkRes = await client.query(`
                SELECT kcu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                WHERE tc.constraint_type = 'PRIMARY KEY'
                  AND tc.table_name = $1
                  AND tc.table_schema = 'public';
            `, [tableName]);

            if (pkRes.rows.length > 0) {
                const pkCols = pkRes.rows.map(r => r.column_name).join(', ');
                colDefs.push(`    CONSTRAINT ${tableName}_pkey PRIMARY KEY (${pkCols})`);
            }

            sqlContent += colDefs.join(',\n');
            sqlContent += `\n);\n\n`;
        }

        // 4. Obtener Foreign Keys (al final para evitar orden de creación)
        // (Opcional, se pueden añadir como ALTER TABLE para seguridad)
        console.log('🔗 Generando relaciones (Foreign Keys)...');
        const fkRes = await client.query(`
             SELECT
                tc.table_name, 
                kcu.column_name, 
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name,
                tc.constraint_name
            FROM 
                information_schema.table_constraints AS tc 
                JOIN information_schema.key_column_usage AS kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage AS ccu
                  ON ccu.constraint_name = tc.constraint_name
                  AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public';
        `);

        for (const fk of fkRes.rows) {
            sqlContent += `ALTER TABLE ONLY public.${fk.table_name}\n`;
            sqlContent += `    ADD CONSTRAINT ${fk.constraint_name} FOREIGN KEY (${fk.column_name}) REFERENCES public.${fk.foreign_table_name}(${fk.foreign_column_name});\n\n`;
        }

        fs.writeFileSync(OUTPUT_FILE, sqlContent);
        console.log(`✅ Esquema guardado exitosamente en: ${OUTPUT_FILE}`);

        client.release();
        process.exit(0);

    } catch (err) {
        console.error('❌ Error generando esquema:', err);
        process.exit(1);
    }
}

generateSchema();
