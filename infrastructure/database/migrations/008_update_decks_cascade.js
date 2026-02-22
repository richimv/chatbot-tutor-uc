const db = require('../../database/db');

async function runMigration() {
    try {
        console.log("🚀 Starting Migration: 008_update_decks_cascade...");

        // 1. Drop existing FK constraint
        // We need to find the name of the constraint first or assume a standard naming convention if created by postgres.
        // Usually it is 'user_flashcards_deck_id_fkey'.

        // Let's try to drop it safely.
        await db.query(`
            ALTER TABLE public.user_flashcards
            DROP CONSTRAINT IF EXISTS user_flashcards_deck_id_fkey;
        `);

        // 2. Add new FK constraint with ON DELETE CASCADE
        await db.query(`
            ALTER TABLE public.user_flashcards
            ADD CONSTRAINT user_flashcards_deck_id_fkey
            FOREIGN KEY (deck_id)
            REFERENCES public.decks(id)
            ON DELETE CASCADE;
        `);

        console.log("✅ Constraint updated: Deleting a Deck now deletes its Flashcards.");
        console.log("🎉 Migration 008 completed successfully.");

    } catch (error) {
        console.error("❌ Migration Failed:", error);
    } finally {
        setTimeout(() => process.exit(0), 1000);
    }
}

runMigration();
