const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.NODE_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function extractSchema() {
    try {
        let output = "-- Database Schema Extraction --\n";
        
        const tablesRes = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        `);

        for (const table of tablesRes.rows) {
            const tableName = table.table_name;
            output += `\n-- Table: ${tableName}\n`;
            
            const columnsRes = await pool.query(`
                SELECT 
                    column_name, 
                    data_type, 
                    character_maximum_length, 
                    is_nullable, 
                    column_default,
                    udt_name
                FROM information_schema.columns 
                WHERE table_name = $1 
                AND table_schema = 'public'
                ORDER BY ordinal_position;
            `, [tableName]);

            output += `CREATE TABLE IF NOT EXISTS public.${tableName} (\n`;
            const columnDefs = columnsRes.rows.map(col => {
                let type = col.data_type === 'USER-DEFINED' ? col.udt_name.toUpperCase() : col.data_type.toUpperCase();
                let def = `    ${col.column_name} ${type}`;
                if (col.character_maximum_length) def += `(${col.character_maximum_length})`;
                if (col.is_nullable === 'NO') def += ' NOT NULL';
                if (col.column_default) def += ` DEFAULT ${col.column_default}`;
                return def;
            });
            output += columnDefs.join(',\n') + '\n);\n';
        }

        fs.writeFileSync('schema_dump.sql', output);
        console.log("Schema saved to schema_dump.sql");
        await pool.end();
    } catch (err) {
        console.error("Error extracting schema:", err);
        process.exit(1);
    }
}

extractSchema();
