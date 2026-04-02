const db = require('../../infrastructure/database/db');

/**
 * 🛠️ RAG SERVICE (LOCAL FTS + AGENTIC REWRITER - V4):
 * Búsqueda inteligente usando PostgreSQL Full Text Search (tsvector/tsquery)
 * + Pre-extracción de términos clínicos con IA (Rewrite-Retrieve-Read).
 * Optimizado para miles de documentos sin costo extra.
 */
class RagService {
    constructor() {
        this._rewriterModel = null; // Lazy-init para no bloquear el arranque
        console.log("✅ RagService V4: Inicializado con Agentic Rewriter + FTS. Optimizado para miles de docs.");
    }

    /**
     * 🧠 AGENTIC REWRITER: La IA lee la pregunta y extrae los términos de búsqueda óptimos.
     * Solo se activa para preguntas extensas (>80 chars) para proteger velocidad.
     * @param {string} message - Pregunta completa del usuario
     * @param {string} target - Enfoque (SERUMS, ENAM, RESIDENTADO, o vacío)
     * @returns {string[]} Array de términos clínicos puros (máx 10)
     */
    async _extractSmartTerms(message, target = '') {
        try {
            // 🚀 Lazy-init del modelo rewriter (solo la primera vez)
            if (!this._rewriterModel) {
                const { VertexAI } = require('@google-cloud/vertexai');
                const project = process.env.GOOGLE_CLOUD_PROJECT;
                const location = process.env.GOOGLE_CLOUD_LOCATION;
                if (!project || !location) {
                    console.warn("⚠️ Rewriter: Sin credenciales Vertex. Fallback a extracción mecánica.");
                    return null;
                }
                const vertexAI = new VertexAI({ project, location });
                this._rewriterModel = vertexAI.getGenerativeModel({
                    model: 'gemini-2.5-flash-lite',
                    generationConfig: {
                        maxOutputTokens: 1024,  // Suficiente para el JSON de términos
                        temperature: 0.1,      // Determinista: Queremos precisión, no creatividad
                        responseMimeType: "application/json"
                    }
                });
                console.log("🧠 Rewriter Model: gemini-2.5-flash-lite inicializado (Ultra-Lite para keywords).");
            }

            const rewriterPrompt = `Eres un indexador médico experto peruano. Tu ÚNICA misión es generar los mejores términos de búsqueda para encontrar información relevante en una biblioteca médica con Full Text Search (PostgreSQL).

REGLAS ESTRICTAS:
1. Devuelve SOLO un JSON con un array "terms" de PALABRAS SUELTAS (1 sola palabra cada una, NO frases).
2. Máximo 10 términos, mínimo 3.
3. INFERENCIA DIAGNÓSTICA (CRÍTICO): Si el usuario describe signos/síntomas sin nombrar la enfermedad, TÚ DEBES DEDUCIR el diagnóstico probable e incluirlo como término. Ejemplo: "cefalea + edema + hipertensión + gestante" → incluir "preeclampsia".
4. INFERENCIA FARMACOLÓGICA: Si la pregunta implica tratamiento, incluye los fármacos de primera línea del diagnóstico inferido. Ejemplo: preeclampsia → incluir "sulfato", "magnesio".
5. Prioriza: diagnósticos, síndromes, fármacos, signos patognomónicos, normas (NTS, RM, GPC), órganos afectados, procedimientos.
6. IGNORA ABSOLUTAMENTE: conectores, artículos, verbos genéricos (presenta, tiene, muestra, acude), pronombres, números de edad, palabras descriptivas genéricas (paciente, años, examen, físico).
7. Si detectas acrónimos médicos (TB, VIH, HTA, DM, PCR, EKG), INCLÚYELOS.
8. Si la pregunta menciona un contexto normativo o legal peruano, incluye "NTS" o "RM" o "ley".
9. Los términos deben ser en ESPAÑOL (salvo acrónimos universales).
${target ? `10. Enfoque del examen: ${target}. Incluye 1-2 términos de fuentes relevantes (ej: si SERUMS → "nts"; si RESIDENTADO → "harrison").` : ''}

PREGUNTA DEL USUARIO:
"${message}"

Responde SOLO el JSON: {"terms": ["término1", "término2", ...]}`;

            // ⏱️ TIMEOUT PROTECTOR: 4 segundos máximo para el rewriter.
            // Si la API tarda más (429, congestión), caemos instantáneamente al mecánico.
            const rewriterTimeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Rewriter timeout (4s)')), 4000)
            );

            const rewriterCall = this._rewriterModel.generateContent({
                contents: [{ role: "user", parts: [{ text: rewriterPrompt }] }]
            });

            const result = await Promise.race([rewriterCall, rewriterTimeout]);

            const responseText = result.response.candidates[0].content.parts[0].text;
            const parsed = JSON.parse(responseText);

            if (parsed.terms && Array.isArray(parsed.terms) && parsed.terms.length > 0) {
                // Limpiamos: solo palabras sueltas, sin espacios internos, lowercase
                const cleanTerms = parsed.terms
                    .map(t => t.trim().toLowerCase().replace(/[^a-záéíóúñü0-9]/gi, ''))
                    .filter(t => t.length >= 2)
                    .slice(0, 10);

                console.log(`🧠 Rewriter IA: Extraídos ${cleanTerms.length} términos clínicos → [${cleanTerms.join(', ')}]`);
                return cleanTerms;
            }

            console.warn("⚠️ Rewriter: Respuesta IA sin términos válidos. Fallback mecánico.");
            return null;

        } catch (error) {
            console.warn(`⚠️ Rewriter IA falló (${error.message}). Fallback a extracción mecánica.`);
            return null; // Fallback silencioso: el sistema sigue funcionando con el método mecánico
        }
    }

    /**
     * Construye un query vectorial (tsquery) adaptado a medicina.
     * MODO CLÁSICO (Mecánico) - Se usa como fallback si el Rewriter falla.
     * @param {string|string[]} textOrTerms - Texto bruto O array de términos pre-procesados por la IA
     * @param {string} target - Enfoque del examen
     */
    _buildFtsQuery(textOrTerms, target) {
        let words;

        // 🧠 RUTA INTELIGENTE: Si recibimos un array, la IA ya hizo el trabajo duro
        if (Array.isArray(textOrTerms)) {
            words = [...textOrTerms];
            // Solo inyectamos fuentes si la IA no las incluyó ya
            const hasSourceTerms = words.some(w => ['harrison', 'washington', 'nts', 'gpc', 'rm', 'ley', 'cto', 'amir'].includes(w));
            if (!hasSourceTerms) {
                if (target === "SERUMS") words.push("nts", "rm");
                if (target === "ENAM") words.push("gpc", "harrison");
                if (target === "RESIDENTADO") words.push("harrison", "washington");
            }
            words = [...new Set(words)].slice(0, 10); // Capacidad aumentada: 10 términos
            if (words.length === 0) return "";
            return words.join(' | ');
        }

        // 🔧 RUTA MECÁNICA (Fallback): Extracción clásica por Regex
        if (!textOrTerms) return "";
        words = textOrTerms.toLowerCase()
            .replace(/[.,/#!$%^&*;:{}=\-_`~()¿?¡!]/g, "")
            .split(/\s+/);

        // 🚨 SALVAVIDAS MÉDICO: Lista de acrónimos intocables (menores a 4 letras)
        const medicalAcronyms = ['tb', 'tbc', 'dm', 'vih', 'hta', 'rcp', 'ekg', 'uci', 'pcr', 'itu', 'ira', 'eda', 'tec', 'acv', 'icc', 'rm', 'nts', 'gpc'];

        // 🧹 STOPWORDS MÉDICAS: Palabras genéricas que NO aportan valor en búsquedas FTS
        const medicalStopwords = [
            // Sujetos genéricos
            'paciente', 'mujer', 'varon', 'hombre', 'niño', 'niña', 'adulto', 'menor', 'mayor',
            // Verbos/acciones genéricas
            'presenta', 'acude', 'refiere', 'manifiesta', 'indica', 'muestra', 'tiene', 'dice',
            'encuentra', 'observa', 'realiza', 'solicita', 'requiere', 'necesita',
            // Descriptivos temporales/numéricos
            'años', 'dias', 'horas', 'semanas', 'meses', 'tiempo', 'desde', 'hace',
            // Conectores y artículos largos
            'cual', 'como', 'para', 'esta', 'este', 'estos', 'estas', 'segun', 'sobre',
            'entre', 'tras', 'ante', 'bajo', 'durante', 'mediante', 'siendo', 'cuyo',
            // Contexto clínico genérico
            'examen', 'fisico', 'inicial', 'manejo', 'tratamiento', 'diagnostico',
            'antecedentes', 'antecedente', 'cuadro', 'clinico', 'clinica', 'historia',
            // Descriptivos vagos
            'intensa', 'intenso', 'severa', 'severo', 'aguda', 'agudo', 'borrosa',
            'leve', 'moderada', 'moderado', 'cronica', 'cronico',
            // Preposiciones que pasan el filtro de 4+ chars
            'para', 'pero', 'porque', 'cuando', 'donde', 'como', 'tambien', 'ademas'
        ];

        // Filtramos: (≥4 letras O acrónimo médico) Y NO es stopword
        words = words.filter(word =>
            (word.length >= 4 || medicalAcronyms.includes(word)) &&
            !medicalStopwords.includes(word)
        );

        // Inyectamos términos clave según el target
        if (target === "SERUMS") words.push("Resolucion_Ministerial", "ley", "nts", "rm");
        if (target === "ENAM") words.push("gpc", "washington", "harrison", "cto", "nts", "rm");
        if (target === "RESIDENTADO") words.push("harrison", "washington", "amir", "cto");

        // Quitamos duplicados y limitamos a 10 términos (AUMENTADO de 6 → 10)
        words = [...new Set(words)].slice(0, 10);

        if (words.length === 0) return "";

        // Unimos las palabras con "|" (OR) para el tsquery de Postgres
        return words.join(' | ');
    }

    /**
     * 🚀 BÚSQUEDA INTELIGENTE (V4): Usa el Rewriter IA para preguntas extensas.
     * Para preguntas cortas (<80 chars), usa la ruta mecánica clásica (velocidad).
     * Para preguntas largas (≥80 chars), activa la IA para extraer términos óptimos.
     */
    async searchContextSmart(queryText, limit = 8, filters = {}) {
        const target = (filters.target || "").toUpperCase();
        const messageLength = (queryText || "").length;

        let tsQueryString;

        // 🧠 DECISIÓN: ¿Activar el Rewriter IA?
        if (messageLength >= 80) {
            console.log(`🧠 RAG Agentic: Pregunta extensa detectada (${messageLength} chars). Activando Rewriter IA...`);
            const smartTerms = await this._extractSmartTerms(queryText, target);

            if (smartTerms && smartTerms.length > 0) {
                // ✅ RUTA INTELIGENTE: Usamos los términos de la IA
                tsQueryString = this._buildFtsQuery(smartTerms, target);
                console.log(`🧠 RAG Agentic (${target}): Query Inteligente → [${tsQueryString}]`);
            } else {
                // ⚠️ FALLBACK: El rewriter falló, usamos la ruta mecánica clásica
                tsQueryString = this._buildFtsQuery(queryText, target);
                console.log(`🔧 RAG Fallback (${target}): Query Mecánico → [${tsQueryString}]`);
            }
        } else {
            // ⚡ RUTA RÁPIDA: Pregunta corta, no necesita IA
            tsQueryString = this._buildFtsQuery(queryText, target);
            console.log(`⚡ RAG Rápido (${target}): Query Mecánico → [${tsQueryString}]`);
        }

        if (!tsQueryString) return "";

        return this._executeFtsSearch(tsQueryString, target, limit);
    }

    /**
     * Búsqueda clásica (mantiene retrocompatibilidad con generación Admin).
     */
    async searchContext(queryText, limit = 8, filters = {}) {
        const target = (filters.target || "").toUpperCase();
        const tsQueryString = this._buildFtsQuery(queryText, target);

        if (!tsQueryString) return "";

        console.log(`🔍 RAG FTS (${target}): Query Vectorial -> [${tsQueryString}]`);

        return this._executeFtsSearch(tsQueryString, target, limit);
    }

    /**
     * Motor FTS compartido (evita duplicar la query SQL).
     * @private
     */
    async _executeFtsSearch(tsQueryString, target, limit) {
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