const db = require('../db');

async function runMigration() {
    console.log('Running migration: Add image_url to resources table...');
    try {
        await db.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='resources' AND column_name='image_url') THEN 
                    ALTER TABLE resources ADD COLUMN image_url VARCHAR(500); 
                END IF; 
            END $$;
        `);
        console.log('Migration successful: image_url column added to resources.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        process.exit();
    }
}

runMigration();
