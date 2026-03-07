const db = require('./infrastructure/database/db');

async function testSchema() {
    try {
        const res = await db.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'documents'
        `);
        console.log("COLUMNS IN 'documents' TABLE:");
        res.rows.forEach(row => console.log(`- ${row.column_name} (${row.data_type})`));

        const sample = await db.query("SELECT metadata FROM documents WHERE metadata IS NOT NULL LIMIT 2");
        console.log("\nSAMPLE METADATA:");
        sample.rows.forEach(row => console.log(JSON.stringify(row.metadata)));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

testSchema();
