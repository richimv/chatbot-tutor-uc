const db = require('./infrastructure/database/db');

async function run() {
    try {
        console.log("🕵️ Inspecting quiz_scores columns...");
        const res = await db.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'quiz_scores';
        `);

        if (res.rows.length === 0) {
            console.log("⚠️ Table 'quiz_scores' NOT FOUND.");
        } else {
            console.table(res.rows);
            console.log("✅ Table 'quiz_scores' EXISTS.");
        }

    } catch (e) {
        console.error("❌ Error:", e.message);
    } finally {
        setTimeout(() => process.exit(0), 1000);
    }
}
run();
