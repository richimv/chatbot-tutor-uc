const db = require('../db');

async function runMigration() {
    console.log('Running migration: Create course_careers table...');
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS course_careers (
                course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                career_id INTEGER NOT NULL REFERENCES careers(id) ON DELETE CASCADE,
                PRIMARY KEY (course_id, career_id)
            );
        `);
        console.log('Migration successful: course_careers table created.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        process.exit();
    }
}

runMigration();
