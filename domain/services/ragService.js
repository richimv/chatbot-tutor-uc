const db = require('../../infrastructure/database/db');

/**
 * 🛠️ RAG SERVICE (LOCAL - CERO COSTO):
 * Este servicio realiza búsquedas en la biblioteca de documentos (libros, manuales, leyes)
 * de forma 100% LOCAL usando SQL ILIKE.
 * ✅ NO USA EMbeddings de Google Cloud (Costo $0).
 * ✅ NO USA IA para la búsqueda (Costo $0).
 */
class RagService {
    constructor() {
        console.log("✅ RagService: Inicializado en modo RAG Local (ILIKE). Búsqueda gratuita activa.");
    }

    /**
     * Extrae palabras clave de un texto para optimizar la búsqueda SQL.
     */
    _extractKeywords(text) {
        if (!text) return [];
        return text.toLowerCase()
            .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "")
            .split(/\s+/)
            .filter(word => word.length > 3) // Solo palabras significativas
            .slice(0, 5); // Máximo 5 palabras clave para no saturar la DB
    }

    /**
     * Busca fragmentos de texto relevantes en la base de datos local usando coincidencia de palabras.
     * @param {string} queryText - Términos de búsqueda (ej: "Tratamiento Bronquiolitis").
     * @param {number} limit - Cantidad de fragmentos a recuperar.
     * @param {object} filters - Filtros por metadatos o contexto (ej: { target: 'SERUMS' }).
     */
    async searchContext(queryText, limit = 6, filters = {}) {
        let keywords = this._extractKeywords(queryText);

        // 🎯 OPTIMIZACIÓN POR TARGET: Inyectar términos normativos si es SERUMS o ENAM
        const target = (filters.target || "").toUpperCase();
        if (target === "SERUMS") {
            keywords = [...new Set([...keywords, "nts", "norma", "ley", "resolución", "rm"])];
        } else if (target === "ENAM") {
            keywords = [...new Set([...keywords, "gpc", "guía", "clínica", "nts"])];
        }

        if (keywords.length === 0) return "";

        console.log(`🔍 RAG Local (${target}): Buscando palabras clave: [${keywords.join(', ')}]`);

        // Construir cláusula LIKE con OR para maximizar la recuperación (Libros + Normas)
        let searchClause = keywords.map((_, i) => `(content ILIKE $${i + 1} OR metadata::text ILIKE $${i + 1})`).join(' OR ');
        const params = keywords.map(kw => `%${kw}%`);

        const limitIndex = params.length + 1;
        params.push(limit);

        let query = `
            SELECT content, metadata
            FROM documents
            WHERE ${searchClause}
            ORDER BY id DESC 
            LIMIT $${limitIndex};
        `;

        try {
            const res = await db.query(query, params);
            return this._formatResults(res.rows);

        } catch (error) {
            console.error("❌ Error en RAG Local (ILIKE):", error.message);
            return "";
        }
    }

    _formatResults(rows) {
        return rows.map(row => {
            const meta = row.metadata || {};
            const source = meta.title || meta.source || "Documento Local";
            return `--- FUENTE LOCAL: ${source} ---\n${row.content}`;
        }).join('\n\n');
    }
}

module.exports = new RagService();
