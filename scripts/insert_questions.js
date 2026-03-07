const db = require('../infrastructure/database/db');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function insert() {
    const filePath = process.argv[2];
    if (!filePath) {
        console.log("❌ Uso: node insert_questions.js preguntas.json");
        process.exit(1);
    }

    try {
        const data = fs.readFileSync(filePath, 'utf8');
        const questions = JSON.parse(data);

        if (!Array.isArray(questions)) {
            throw new Error("El archivo JSON debe ser un Array de preguntas.");
        }

        console.log(`📥 Procesando ${questions.length} preguntas...`);

        let inserted = 0;
        let skipped = 0;

        for (const q of questions) {
            // Validación mínima de campos
            if (!q.question_text || !q.options || q.correct_option_index === undefined) {
                console.warn("⚠️ Saltando pregunta inválida (faltan campos obligatorios).");
                skipped++;
                continue;
            }

            const id = uuidv4();
            const hash = crypto.createHash('md5').update(q.question_text.trim()).digest('hex');

            const query = `
                INSERT INTO question_bank (
                    id, domain, topic, subtopic, difficulty, target, career, 
                    question_text, options, correct_option_index, explanation, 
                    question_hash
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                ON CONFLICT (question_hash) DO NOTHING
                RETURNING id;
            `;

            const values = [
                id, q.domain || 'medicine', q.topic || 'General', q.subtopic || 'Varios',
                q.difficulty || 'Intermedio', q.target || 'SERUMS', q.career || 'Medicina',
                q.question_text, JSON.stringify(q.options),
                q.correct_option_index, q.explanation, hash
            ];

            const res = await db.query(query, values);
            if (res.rowCount > 0) {
                inserted++;
            } else {
                skipped++;
            }
        }

        console.log(`\n=========================================`);
        console.log(`✅ ¡Proceso finalizado!`);
        console.log(`✨ Insertadas: ${inserted}`);
        console.log(`⏭️ Saltadas (Duplicadas/Error): ${skipped}`);
        console.log(`=========================================`);
    } catch (error) {
        console.error("❌ Error al procesar el archivo:", error.message);
    }
    process.exit(0);
}

insert();
