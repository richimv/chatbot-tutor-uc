const db = require('../../database/db');

async function runMigration() {
    try {
        console.log("🚀 Starting Migration: 009_secure_questions_rls...");

        console.log("🔒 Securing 'question_bank'...");
        // 1. Enable RLS on question_bank
        await db.query(`ALTER TABLE IF EXISTS public.question_bank ENABLE ROW LEVEL SECURITY;`);

        // 2. Policy: Public Read (Authenticated users can read all questions)
        // We check if policy exists first or just drop and recreate
        await db.query(`DROP POLICY IF EXISTS "Public Read Questions" ON public.question_bank;`);
        await db.query(`
            CREATE POLICY "Public Read Questions" ON public.question_bank
            FOR SELECT
            TO authenticated
            USING (true);
        `);
        // Note: Write access is implicitly denied for 'authenticated' role unless a policy allows it.
        // We only want Service Role (admin) to write, which bypasses RLS.

        console.log("🔒 Securing 'user_question_history'...");
        // 3. Enable RLS on user_question_history
        await db.query(`ALTER TABLE IF EXISTS public.user_question_history ENABLE ROW LEVEL SECURITY;`);

        // 4. Policy: Owner Manage (Users can only see and insert their own history)
        await db.query(`DROP POLICY IF EXISTS "Users view own history" ON public.user_question_history;`);
        await db.query(`
            CREATE POLICY "Users view own history" ON public.user_question_history
            FOR SELECT
            USING (auth.uid() = user_id);
        `);

        await db.query(`DROP POLICY IF EXISTS "Users insert own history" ON public.user_question_history;`);
        await db.query(`
            CREATE POLICY "Users insert own history" ON public.user_question_history
            FOR INSERT
            WITH CHECK (auth.uid() = user_id);
        `);

        console.log("✅ RLS enabled for Question Tables.");
        console.log("🎉 Migration 009 completed successfully.");

    } catch (error) {
        console.error("❌ Migration Failed:", error);
    } finally {
        setTimeout(() => process.exit(0), 1000);
    }
}

runMigration();
