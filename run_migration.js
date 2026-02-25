const db = require('./infrastructure/database/db');

async function checkUnused() {
    try {
        console.log("Consultando el misterio de times_used = 0...");

        // El script probará exactamente los JSONs que dio el usuario asegurando que existan y no estén bloqueados.
        const query = `
            SELECT id, topic, times_used 
            FROM question_bank 
            WHERE target='SERUMS' 
              AND difficulty='Básico' 
              AND topic = ANY($1::text[]) 
              AND domain='medicine' 
              AND times_used = 0
        `;
        const topics = ['Salud Pública', 'Cuidado Integral', 'Ética e Interculturalidad', 'Investigación', 'Gestión de Servicios'];

        const res = await db.query(query, [topics]);
        const unusedQuestions = res.rows;
        console.log(`Preguntas en DB con times_used=0 y que matchean: ${unusedQuestions.length}`);

        if (unusedQuestions.length > 0) {
            const ids = unusedQuestions.map(q => q.id);
            const seenQuery = `
                SELECT question_id, times_seen, seen_at 
                FROM user_question_history 
                WHERE user_id='f2ae2b14-8091-419c-92cc-b398db6e52fa' 
                  AND question_id = ANY($1::uuid[])
            `;
            const seenRes = await db.query(seenQuery, [ids]);
            console.log(`De esas ${ids.length} 'NO USADAS', el historial del usuario dice que ha visto: ${seenRes.rows.length}`);

            if (seenRes.rows.length > 0) {
                console.log("Ejemplo de una que dice times_used=0 pero SI esta en el history:", seenRes.rows[0]);
            }
        }

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        process.exit();
    }
}

checkUnused();
