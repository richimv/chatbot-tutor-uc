const db = require('./infrastructure/database/db');

async function run() {
    try {
        console.log("🃏 Verifying Flashcards...");
        const res = await db.query("SELECT COUNT(*) FROM user_flashcards;");
        console.log(`✅ Flashcards Count: ${res.rows[0].count}`);

        const res2 = await db.query("SELECT COUNT(*) FROM user_question_history;");
        console.log(`👁️ Question History Count: ${res2.rows[0].count}`);

    } catch (e) {
        console.error("❌ Error:", e.message);
    } finally {
        setTimeout(() => process.exit(0), 1000);
    }
}
run();
