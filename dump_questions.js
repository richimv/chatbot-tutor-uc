const db = require('./infrastructure/database/db');
const fs = require('fs');

async function dumpQuestions() {
    try {
        console.log("📥 Fetching last 30 questions from question_bank...");
        const res = await db.query(`
            SELECT topic, difficulty, question_text, options, correct_option_index, explanation, created_at, target, career
            FROM public.question_bank 
            ORDER BY created_at DESC 
            LIMIT 30;
        `);
        
        const output = res.rows.map((row, index) => {
            return `--- PREGUNTA ${index + 1} ---
ID/Fecha: ${row.created_at}
Contexto: ${row.target || 'N/A'} | ${row.career || 'N/A'} | ${row.topic} | ${row.difficulty}
Pregunta: ${row.question_text}
Opciones: ${JSON.stringify(row.options, null, 2)}
Respuesta Correcta (Índice): ${row.correct_option_index}
Explicación: ${row.explanation}
\n`;
        }).join('\n');

        fs.writeFileSync('last_30_questions_dump.txt', output);
        console.log("✅ Dump complete: last_30_questions_dump.txt");
    } catch (e) {
        console.error("❌ Error:", e.message);
    } finally {
        setTimeout(() => process.exit(0), 1000);
    }
}

dumpQuestions();
