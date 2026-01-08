const db = require('../db');

async function runMigration() {
    console.log('Running migration: Create library interaction tables...');
    try {
        await db.query(`
            -- Tabla para Cursos Guardados/Favoritos
            -- user_id es UUID en Supabase/nuestro esquema
            CREATE TABLE IF NOT EXISTS user_course_library (
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                is_saved BOOLEAN DEFAULT FALSE,
                is_favorite BOOLEAN DEFAULT FALSE,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, course_id)
            );

            -- Tabla para Libros Guardados/Favoritos (Referencia a RESOURCES)
            CREATE TABLE IF NOT EXISTS user_book_library (
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                book_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
                is_saved BOOLEAN DEFAULT FALSE,
                is_favorite BOOLEAN DEFAULT FALSE,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, book_id)
            );
        `);
        console.log('Migration successful: library tables created.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        process.exit();
    }
}

runMigration();
