const db = require('./infrastructure/database/db');

async function run() {
    try {
        console.log("🔧 Updating Schema: user_question_history...");

        // Add times_seen column if not exists
        await db.query(`
            ALTER TABLE user_question_history 
            ADD COLUMN IF NOT EXISTS times_seen INTEGER DEFAULT 1;
        `);

        console.log("✅ Column 'times_seen' added.");

    } catch (e) {
        console.error("❌ Error:", e.message);
    } finally {
        setTimeout(() => process.exit(0), 1000);
    }
}
run();
