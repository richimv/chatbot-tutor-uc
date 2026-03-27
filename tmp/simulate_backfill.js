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
        temperature: 0.2, // Baja temperatura para mayor consistencia
        responseMimeType: "text/plain"
    }
});

async function simulate() {
    console.log('🧪 Iniciando SIMULACIÓN de Backfill Visual...');
    try {
        // Obtener 3 preguntas aleatorias que no tengan recomendación
        const res = await db.query(`
            SELECT id, question_text, explanation 
            FROM question_bank 
            WHERE visual_support_recommendation IS NULL 
            LIMIT 3
        `);

        if (res.rows.length === 0) {
            console.log('✅ No hay preguntas pendientes.');
            process.exit(0);
        }

        for (const row of res.rows) {
            console.log('\n----------------------------------------');
            console.log(`ID: ${row.id}`);
            console.log(`PREGUNTA: ${row.question_text.substring(0, 80)}...`);
            
            const prompt = `
                Eres un experto en educación médica (ENAM/SERUMS/RESIDENTADO).
                Analiza la siguiente explicación técnica y determina si se beneficiaría de un SOPORTE VISUAL (Imagen, Placa, EKG, Foto de Lesión, Diagrama o Tabla).
                
                REGLAS:
                1. Si es pertinente, devuelve una recomendación MUY CORTA (máx 10 palabras) empezando con "Recomendado: ".
                2. Si la pregunta es puramente teórica, administrativa o no requiere imagen, devuelve EXACTAMENTE la palabra "null".
                
                EXPLICACIÓN:
                ${row.explanation}
                
                RESPUESTA:
            `;

            const result = await model.generateContent(prompt);
            const recommendation = result.response.candidates[0].content.parts[0].text.trim();
            
            console.log(`💡 RECOMENDACIÓN IA: ${recommendation}`);
        }

        console.log('\n----------------------------------------');
        console.log('✅ Simulación finalizada.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error en simulación:', err);
        process.exit(1);
    }
}

simulate();
