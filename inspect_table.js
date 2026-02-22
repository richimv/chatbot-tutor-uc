const db = require('./infrastructure/database/db');

async function run() {
    try {
        console.log("🕵️ Inspecting user_question_history columns...");
        const res = await db.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'user_question_history';
        `);
        console.table(res.rows);
    } catch (e) {
        console.error("❌ Error:", e.message);
    } finally {
        setTimeout(() => process.exit(0), 1000);
    }
}
run();
