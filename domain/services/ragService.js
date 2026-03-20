const db = require('../../infrastructure/database/db');

/**
 * 🛠️ RAG SERVICE (LOCAL FTS - ALTO RENDIMIENTO):
 * Búsqueda instantánea usando PostgreSQL Full Text Search (tsvector/tsquery).
 * Optimizado para miles de documentos sin costo extra.
 */
class RagService {
    constructor() {
        console.log("✅ RagService: Inicializado en modo RAG FTS (Full Text Search). Optimizado para miles de docs.");
    }

    /**
     * Construye un query vectorial (tsquery) adaptado a medicina.
     */
    _buildFtsQuery(text, target) {
        if (!text) return "";
        let words = text.toLowerCase()
            .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "")
            .split(/\s+/);

        // 🚨 SALVAVIDAS MÉDICO: Lista de acrónimos intocables (menores a 4 letras)
        const medicalAcronyms = ['tb', 'tbc', 'dm', 'vih', 'hta', 'rcp', 'ekg', 'uci', 'pcr', 'itu', 'ira', 'eda', 'tec', 'acv', 'icc', 'rm', 'nts', 'gpc'];

        // Filtramos palabras inútiles (conectores) pero salvamos acrónimos
        words = words.filter(word => word.length >= 4 || medicalAcronyms.includes(word));

        // Inyectamos términos clave según el target
        if (target === "SERUMS") words.push("Resolucion_Ministerial", "ley", "nts", "rm");
        if (target === "ENAM") words.push("guia", "clinica", "gpc", "rm", "nts", "cto");
        if (target === "RESIDENTADO") words.push("harrison", "washington", "amir", "cto");

        // Quitamos duplicados y limitamos a 6 términos para mantener el query rápido
        words = [...new Set(words)].slice(0, 6);

        if (words.length === 0) return "";

        // Unimos las palabras con "|" (OR) para el tsquery de Postgres
        return words.join(' | ');
    }

    /**
     * Búsqueda ultrarrápida usando ts_rank y to_tsvector
     */
    async searchContext(queryText, limit = 8, filters = {}) {
        const target = (filters.target || "").toUpperCase();
        const tsQueryString = this._buildFtsQuery(queryText, target);

        if (!tsQueryString) return "";

        console.log(`🔍 RAG FTS (${target}): Query Vectorial -> [${tsQueryString}]`);

        try {
            // Consulta maestra BILINGÜE: Busca en la columna 'fts' usando ambos diccionarios
            const query = `
                SELECT content, metadata,
                       ts_rank(fts, (to_tsquery('spanish', $1) || to_tsquery('english', $1))) as rank
                FROM documents
                WHERE fts @@ (to_tsquery('spanish', $1) || to_tsquery('english', $1))
                ORDER BY 
                    -- Prioridad 1: Reglas de negocio (Normas para SERUMS, Guías para ENAM, etc)
                    CASE 
                        WHEN $2 = 'SERUMS' AND (metadata->>'folder' ILIKE '%Normas%' OR metadata::text ILIKE '%NTS%' OR metadata::text ILIKE '%RM%') THEN 1
                        WHEN $2 = 'ENAM' AND (metadata->>'folder' ILIKE '%Guias%' OR metadata::text ILIKE '%GPC%') THEN 1
                        WHEN $2 = 'RESIDENTADO' AND metadata::text ILIKE ANY(ARRAY['%Harrison%', '%Washington%', '%Nelson%', '%CTO%', '%AMIR%']) THEN 1
                        ELSE 2
                    END ASC,
                    -- Prioridad 2: El ranking nativo de coincidencia de texto
                    rank DESC,
                    id DESC
                LIMIT $3;
            `;

            const searchRes = await db.query(query, [tsQueryString, target, limit]);
            const results = searchRes.rows;

            if (results.length === 0) {
                console.log("⚠️ RAG FTS: No se encontraron coincidencias directas.");
                return "";
            }

            return this._formatResults(results);

        } catch (error) {
            console.error("❌ Error en RAG FTS (Full Text Search):", error.message);
            return "";
        }
    }

    /**
     * Recupera fragmentos específicos para usarlos como guía de estilo (Few-shot)
     */
    async getStyleExamples(pattern = 'SERUMS-medicina%', limit = 3) {
        try {
            // Para la guía de estilo mantenemos ILIKE porque solo busca en metadata, lo cual es muy rápido
            const query = `
                SELECT content 
                FROM documents 
                WHERE metadata::text ILIKE $1 
                ORDER BY 
                    CASE WHEN metadata->>'type' = 'Examen Pasado' THEN 1 ELSE 2 END,
                    RANDOM() 
                LIMIT $2;
            `;
            const res = await db.query(query, [pattern, limit]);

            return res.rows.map(r => {
                let text = r.content || "";
                // 🧹 Limpieza profunda de cabeceras y ruido de exámenes reales
                text = text.replace(/Evaluación para el Servicio Rural.*?Página \d+ de \d+/gs, '');
                text = text.replace(/Examen Nacional de Medicina.*?ASPEFAM/gs, '');
                text = text.replace(/Página \d+ de \d+/g, '');
                text = text.replace(/MINSA.*?\d{4}/g, '');
                text = text.replace(/ASPEFAM.*?\d{4}/g, '');
                text = text.replace(/Enam Ordinario.*?\d{4}/g, '');

                // 🧹 Limpieza de etiquetas de opciones (A., B., C...) para evitar que la IA las imite
                text = text.replace(/^[A-E]\.\s+/gm, ''); // Al inicio de línea
                text = text.replace(/\s[A-E]\.\s+/g, ' '); // En medio del texto

                return text.trim();
            }).join('\n\n---\n\n');

        } catch (error) {
            console.error("❌ Error recuperando ejemplos de estilo:", error.message);
            return "";
        }
    }

    _formatResults(rows) {
        return rows.map(row => {
            const meta = row.metadata || {};
            const source = meta.title || meta.source || "Documento Local";
            // row.rank nos permite ver (si queremos) qué tan buena fue la coincidencia
            return `--- FUENTE: ${source} ---\n${row.content}`;
        }).join('\n\n');
    }
}

module.exports = new RagService();