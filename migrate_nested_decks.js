const { Pool } = require('pg');
require('dotenv').config({ path: 'c:/Users/ricar/Downloads/PROYECTOS/chatbot-tutor-uc/.env' });

const pool = new Pool({
    connectionString: process.env.NODE_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function runMigration() {
    const client = await pool.connect();
    try {
        console.log('🚀 Starting Nested Decks Migration...');

        // 1. Add parent_id to decks
        console.log('📦 Adding parent_id column to decks...');
        await client.query(`
            ALTER TABLE decks 
            ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES decks(id) ON DELETE CASCADE;
        `);
        console.log('✅ Column parent_id added.');

        // 2. Update user_flashcards topics
        console.log('🏷️ Updating empty topics in user_flashcards...');
        const res = await client.query(`
            UPDATE user_flashcards uf
            SET topic = d.name
            FROM decks d
            WHERE uf.deck_id = d.id 
            AND (uf.topic IS NULL OR uf.topic = '' OR uf.topic = 'NULL');
        `);
        console.log(`✅ Updated ${res.rowCount} flashcards with deck names.`);

        console.log('🎉 Migration Complete!');
    } catch (err) {
        console.error('❌ Migration Failed:', err);
    } finally {
        client.release();
        pool.end();
    }
}

runMigration();
