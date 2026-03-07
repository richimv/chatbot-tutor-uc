const RagService = require('./domain/services/ragService');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

async function test() {
    console.log("🔍 Probando RAG con consulta: 'Norma Técnica de Inmunizaciones'");
    const results = await RagService.searchContext("Norma Técnica de Inmunizaciones", 5);

    if (results) {
        console.log("✅ RESULTADOS ENCONTRADOS POSITIVOS (>0.55):");
        console.log(results.substring(0, 500) + "...");
    } else {
        console.log("❌ NO SE ENCONTRARON RESULTADOS CON UMBRAL 0.55.");
    }

    console.log("\n📊 DIAGNÓSTICO DE SIMILITUD (Top 5 resultados brutos):");
    const db = require('./infrastructure/database/db');
    const embedding = await RagService.generateEmbedding("Norma Técnica de Inmunizaciones");
    if (embedding) {
        const vectorStr = `[${embedding.join(',')}]`;
        const query = `
            SELECT content, metadata, 1 - (embedding <=> $1) as similarity
            FROM documents
            ORDER BY embedding <=> $1
            LIMIT 5;
        `;
        const res = await db.query(query, [vectorStr]);
        res.rows.forEach(row => {
            console.log(`- [Similitud: ${row.similarity.toFixed(4)}] ${row.metadata?.title || row.metadata?.source || 'Sin título'}`);
        });
    }
    process.exit(0);
}

test();
