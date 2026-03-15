const RagService = require('../domain/services/ragService');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function extract() {
    const topic = process.argv[2];
    const limit = parseInt(process.argv[3]) || 15; // Límite sugerido para RAG completo

    if (!topic) {
        console.log("❌ Uso: node extract_context.js \"Tema\" [límite]");
        console.log("Ejemplo: node extract_context.js \"TBC Norma Técnica\" 15");
        process.exit(1);
    }

    console.log(`🔍 Extrayendo información de alta relevancia para: "${topic}" (Límite: ${limit})...`);
    const results = await RagService.searchContext(topic, limit);

    if (results) {
        console.log("\n=======================================================");
        console.log("📝 CONTEXTO RECUPERADO (Copia esto al chat)");
        console.log("=======================================================");
        console.log(results);
        console.log("=======================================================");
        console.log(`\"Utiliza este contexto para generar 10 preguntas profesionales de nivel [Elegir: Básico/Intermedio/Avanzado]. 
                    REQUISITO: Sustenta la explicación basándote en la fuente donde se mencione el tema (NTS, RM, GPC, Harrison, Washington, AMIR, CTO, Manuales, otros autores, etc.). Si falta fundamento, refuerza con data externa oficial. 
                    LÍMITES: Preguntas de hasta [40/80/150] palabras según nivel. Las explicaciones deben ser detalladas y citar las fuentes pertinentes. Básico: Mínimo 2 párrafos, Intermedio: Mínimo 2 párrafos, Avanzado: Mínimo 3 párrafos\"`);
    } else {
        console.log("❌ No se encontró información relevante. Intenta con palabras clave más específicas.");
    }
    process.exit(0);
}

extract();
