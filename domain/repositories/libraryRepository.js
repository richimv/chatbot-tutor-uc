const db = require('../../infrastructure/database/db');

class LibraryRepository {

    /**
     * Toggles 'is_saved' or 'is_favorite' for a course.
     * Uses upsert (INSERT ... ON CONFLICT DO UPDATE).
     */
    async toggleCourse(userId, courseId, field) {
        // field should be 'is_saved' or 'is_favorite'
        if (!['is_saved', 'is_favorite'].includes(field)) {
            throw new Error('Invalid field for toggle');
        }

        const query = `
            INSERT INTO user_course_library (user_id, course_id, ${field}, updated_at)
            VALUES ($1, $2, TRUE, NOW())
            ON CONFLICT (user_id, course_id)
            DO UPDATE SET 
                ${field} = NOT user_course_library.${field},
                updated_at = NOW()
            RETURNING *;
        `;

        const { rows } = await db.query(query, [userId, courseId]);
        return rows[0];
    }

    /**
     * Toggles 'is_saved' or 'is_favorite' for a book (resource).
     */
    async toggleBook(userId, bookId, field) {
        if (!['is_saved', 'is_favorite'].includes(field)) {
            throw new Error('Invalid field for toggle');
        }

        const query = `
            INSERT INTO user_book_library (user_id, book_id, ${field}, updated_at)
            VALUES ($1, $2, TRUE, NOW())
            ON CONFLICT (user_id, book_id)
            DO UPDATE SET 
                ${field} = NOT user_book_library.${field},
                updated_at = NOW()
            RETURNING *;
        `;

        const { rows } = await db.query(query, [userId, bookId]);
        return rows[0];
    }

    /**
     * Retrieves the user's library (courses and books).
     * Returns objects populated with course/book details.
     */
    async getUserLibrary(userId) {
        // Fetch Courses
        const coursesQuery = `
            SELECT 
                c.id, c.name, c.image_url, 
                ucl.is_saved, ucl.is_favorite, ucl.updated_at
            FROM user_course_library ucl
            JOIN courses c ON c.id = ucl.course_id
            WHERE ucl.user_id = $1 AND (ucl.is_saved = TRUE OR ucl.is_favorite = TRUE)
            ORDER BY ucl.updated_at DESC
        `;

        // Fetch Books (Resources)
        const booksQuery = `
            SELECT 
                r.id, r.title, r.image_url, r.resource_type,
                ubl.is_saved, ubl.is_favorite, ubl.updated_at
            FROM user_book_library ubl
            JOIN resources r ON r.id = ubl.book_id
            WHERE ubl.user_id = $1 AND (ubl.is_saved = TRUE OR ubl.is_favorite = TRUE)
            ORDER BY ubl.updated_at DESC
        `;

        const [coursesRes, booksRes] = await Promise.all([
            db.query(coursesQuery, [userId]),
            db.query(booksQuery, [userId])
        ]);

        return {
            courses: coursesRes.rows,
            books: booksRes.rows
        };
    }

    /**
     * Get IDs only (lightweight, for initial load checking)
     */
    async getUserLibraryIds(userId) {
        const query = `
            SELECT 'course' as type, course_id as id, is_saved, is_favorite FROM user_course_library WHERE user_id = $1
            UNION ALL
            SELECT 'book' as type, book_id as id, is_saved, is_favorite FROM user_book_library WHERE user_id = $1
        `;
        const { rows } = await db.query(query, [userId]);
        return rows;
    }
}

module.exports = LibraryRepository;
