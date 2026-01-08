const db = require('./infrastructure/database/db');

async function debug() {
    try {
        console.log('--- DEBUGGING SEARCH ---');

        // 1. Raw DB Check (ILIKE %anatom%):
        console.log('\n1. Raw DB Check (ILIKE %anatom%):');
        const res1 = await db.query("SELECT id, name, code FROM courses WHERE name ILIKE '%anatom%'");
        console.log("Raw matches:", res1.rows);

        // 2. Testing Repository Logic (translate):
        console.log('\n2. Testing Repository Logic (translate):');
        const queryTerm = '%anatomia%';
        const normalize = (col) => `translate(lower(${col}), 'áéíóúÁÉÍÓÚüÜ', 'aeiouaeiouuu')`;

        const sqlQuery = `
            SELECT DISTINCT c.id, c.name, c.code
            FROM courses c
            LEFT JOIN course_topics ct ON c.id = ct.course_id
            LEFT JOIN topics t ON t.id = ct.topic_id
            WHERE 
                ${normalize('c.name')} LIKE ${normalize('$1')} OR
                c.code ILIKE $1 OR
                ${normalize('t.name')} LIKE ${normalize('$1')}
            ORDER BY c.name ASC
        `;

        const res2 = await db.query(sqlQuery, [queryTerm]);
        console.log('Query Result Count:', res2.rows.length);
        console.log('Rows:', res2.rows);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        // Force exit since db.js might keep pool open
        process.exit(0);
    }
}

debug();
