const db = require('../infrastructure/database/db');

async function debugQuery() {
    console.log('--- Diagnosis Start ---');
    const query = `
        SELECT 
            c.id,
            c.course_id,
            c.name,
            c.name,
            (
                SELECT COALESCE(JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'id', t.id,
                        'name', t.name,
                        'unit', ct.unit_name
                    ) ORDER BY ct.unit_name, t.name
                ), '[]')
                FROM course_topics ct
                JOIN topics t ON t.id = ct.topic_id
                WHERE ct.course_id = c.id
            ) AS topics,
            (
                SELECT COALESCE(JSON_AGG(r.*), '[]')
                FROM course_books cb
                JOIN resources r ON r.id = cb.resource_id
                WHERE cb.course_id = c.id
            ) AS materials,
            (
                SELECT COALESCE(JSON_AGG(cc.career_id), '[]')
                FROM course_careers cc
                WHERE cc.course_id = c.id
            ) AS "careerIds"
        FROM courses c
        ORDER BY c.name ASC
    `;

    try {
        const { rows } = await db.query(query);
        console.log('✅ Query success! Rows returned:', rows.length);
    } catch (error) {
        console.error('❌ Query failed!');
        console.error('Code:', error.code);
        console.error('Message:', error.message);
        console.error('Detail:', error.detail);
        console.error('Hint:', error.hint);
    } finally {
        process.exit();
    }
}

debugQuery();
