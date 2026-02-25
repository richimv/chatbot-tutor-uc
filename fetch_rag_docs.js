const db = require('./infrastructure/database/db');

async function fetchDocs() {
    try {
        console.log("Conectando a DB para buscar contexto de Salud Pública/SERUMS...");
        const query = `
            SELECT content, metadata
            FROM documents
            WHERE content ILIKE '%salud%' OR content ILIKE '%minsa%' OR content ILIKE '%norma técnica%' OR content ILIKE '%serums%'
            LIMIT 5;
        `;
        const res = await db.query(query);
        console.log("Documentos encontrados:", res.rows.length);
        res.rows.forEach((row, i) => {
            console.log(`\n--- DOCUMENTO ${i + 1} ---`);
            console.log(row.content.substring(0, 500) + '...');
        });
        process.exit(0);
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
}

fetchDocs();
