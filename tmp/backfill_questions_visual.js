const { VertexAI } = require('@google-cloud/vertexai');
const db = require('../infrastructure/database/db');
require('dotenv').config();

const project = process.env.GOOGLE_CLOUD_PROJECT;
const location = process.env.GOOGLE_CLOUD_LOCATION;
const vertex_ai = new VertexAI({ project, location });

const model = vertex_ai.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    generationConfig: {
        maxOutputTokens: 100,
        temperature: 0.2,
        responseMimeType: "text/plain"
    }
});

async function backfill() {
    console.log('🚀 Iniciando PROCESAMIENTO MASIVO (Backfill Visual)...');
    try {
        const queryRes = await db.query('SELECT id, explanation FROM question_bank WHERE visual_support_recommendation IS NULL');
        const questions = queryRes.rows;
        const total = questions.length;
        
        console.log(`📊 Total a procesar: ${total} preguntas.`);
        
        const BATCH_SIZE = 20; // Lotes más pequeños para mejor control
        let processed = 0;

        const sleep = ms => new Promise(res => setTimeout(res, ms));

        for (let i = 0; i < total; i += BATCH_SIZE) {
            const batch = questions.slice(i, i + BATCH_SIZE);
            console.log(`\n📦 Procesando lote ${Math.floor(i/BATCH_SIZE) + 1} (${batch.length} preguntas)...`);

            for (const row of batch) {
                if (!row.explanation || row.explanation.length < 10) {
                    await db.query('UPDATE question_bank SET visual_support_recommendation = $1 WHERE id = $2', ['null', row.id]);
                    continue;
                }

                try {
                    const prompt = `Analiza esta explicación médica y devuelve "Recomendado: [Descripción corta]" si requiere soporte visual (EKG, Placa, Derma, Diagrama) o "null" si no.\n\nEXPLICACIÓN: ${row.explanation}`;
                    const result = await model.generateContent(prompt);
                    const recommendation = result.response.candidates[0].content.parts[0].text.trim();
                    
                    const cleanRec = recommendation.replace(/["']/g, '');
                    await db.query('UPDATE question_bank SET visual_support_recommendation = $1 WHERE id = $2', [cleanRec, row.id]);
                    
                    await sleep(500); // 💡 Pausa entre preguntas para respetar cuotas
                } catch (e) {
                    console.error(`❌ Error en ID ${row.id}:`, e.message);
                    if (e.message.includes('429')) {
                        console.log('⏳ Cuota agotada, esperando 5 segundos extra...');
                        await sleep(5000);
                    }
                }
            }

            processed += batch.length;
            console.log(`✅ Avance: ${processed} / ${total} (${Math.round((processed/total)*100)}%)`);
        }

        console.log('\n✨ [BACKFILL COMPLETADO] Todas las preguntas han sido procesadas.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error crítico en backfill:', err);
        process.exit(1);
    }
}

backfill();
