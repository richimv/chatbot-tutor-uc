const db = require('../db');

async function runMigration() {
    console.log('Running migration: Add unit_name to course_topics...');
    try {
        await db.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='course_topics' AND column_name='unit_name') THEN 
                    ALTER TABLE course_topics ADD COLUMN unit_name VARCHAR(255) DEFAULT 'General'; 
                END IF; 
            END $$;
        `);
        console.log('Migration successful!');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        process.exit();
    }
}

runMigration();
