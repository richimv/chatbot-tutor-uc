const db = require('../../database/db');

async function runMigration() {
    try {
        console.log("🚀 Starting Migration: 007_create_decks_table...");

        // 1. Create DECKS table
        await db.query(`
            CREATE TABLE IF NOT EXISTS public.decks (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
                name VARCHAR(100) NOT NULL,
                type VARCHAR(20) DEFAULT 'USER', -- 'SYSTEM' or 'USER'
                source_module VARCHAR(50) DEFAULT 'MANUAL', -- 'MEDICINA', 'IDIOMAS', 'MANUAL'
                icon VARCHAR(50) DEFAULT '📚',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);
        console.log("✅ Table 'decks' created.");

        // 2. Add deck_id to USER_FLASHCARDS
        // Check if column exists first to avoid error
        const checkCol = await db.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='user_flashcards' AND column_name='deck_id';
        `);

        if (checkCol.rows.length === 0) {
            await db.query(`
                ALTER TABLE public.user_flashcards 
                ADD COLUMN deck_id UUID REFERENCES public.decks(id) ON DELETE SET NULL;
            `);
            console.log("✅ Column 'deck_id' added to 'user_flashcards'.");
        } else {
            console.log("ℹ️ Column 'deck_id' already exists.");
        }

        // 3. Enable RLS for decks
        await db.query(`ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;`);

        // 4. Create Policy for decks
        // Check if policy exists is hard in raw SQL without complex query, 
        // so we try-catch or use DO block. Let's use DO block.
        await db.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_policies WHERE tablename = 'decks' AND policyname = 'Users manage own decks'
                ) THEN
                    CREATE POLICY "Users manage own decks" ON public.decks
                    FOR ALL USING (auth.uid() = user_id);
                END IF;
            END
            $$;
        `);
        console.log("✅ RLS Policy enabled for 'decks'.");

        // 5. MIGRATION: Auto-assign existing flashcards to a default "General" deck per user
        // Find users with flashcards but no decks
        const usersWithCards = await db.query(`SELECT DISTINCT user_id FROM user_flashcards WHERE deck_id IS NULL`);

        for (const row of usersWithCards.rows) {
            const userId = row.user_id;

            // Create default deck
            const newDeck = await db.query(`
                INSERT INTO decks (user_id, name, type, source_module, icon)
                VALUES ($1, 'Repaso General', 'SYSTEM', 'MEDICINA', '🩺')
                RETURNING id;
            `, [userId]);

            const deckId = newDeck.rows[0].id;

            // Update cards
            await db.query(`
                UPDATE user_flashcards 
                SET deck_id = $1 
                WHERE user_id = $2 AND deck_id IS NULL;
            `, [deckId, userId]);

            console.log(`✅ Migrated cards for user ${userId} to new deck ${deckId}.`);
        }

        console.log("🎉 Migration 007 completed successfully.");
    } catch (error) {
        console.error("❌ Migration Failed:", error);
    } finally {
        setTimeout(() => process.exit(0), 1000);
    }
}

runMigration();
