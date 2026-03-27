const db = require('../infrastructure/database/db');

async function count() {
    try {
        const userId = 'f2ae2b14-8091-419c-92cc-b398db6e52fa'; // The one with 687 records.
        
        console.log('--- PREGUNTAS MÁS USADAS (TECNOLOGÍA) ---');
        const mostUsed = await db.query(`
            SELECT id, question_text, times_used 
            FROM question_bank 
            WHERE domain = 'GENERAL_TRIVIA' AND UPPER(topic) = 'TECNOLOGÍA'
            ORDER BY times_used DESC LIMIT 5
        `);
        console.table(mostUsed.rows);

        const ids = mostUsed.rows.map(r => r.id);
        console.log('IDs a buscar en historial:', ids);

        const history = await db.query(`
            SELECT question_id, COUNT(*) as seen_count, MAX(seen_at) as last_seen
            FROM user_question_history
            WHERE user_id = $1 AND question_id = ANY($2::uuid[])
            GROUP BY question_id
        `, [userId, ids]);
        
        console.log('Presencia en historial del usuario:');
        console.table(history.rows);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

count();
