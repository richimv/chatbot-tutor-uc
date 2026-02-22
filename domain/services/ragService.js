const db = require('../../infrastructure/database/db');
const { GoogleAuth } = require('google-auth-library');
const axios = require('axios');

// CONFIGURACIÓN VERTEX AI (REST API)
const project = process.env.GOOGLE_CLOUD_PROJECT;
const location = process.env.GOOGLE_CLOUD_LOCATION;
const modelId = 'text-embedding-004';
const apiEndpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${modelId}:predict`;

class RagService {
    constructor() {
        this.auth = new GoogleAuth({
            scopes: 'https://www.googleapis.com/auth/cloud-platform'
        });
        this.client = null;
    }

    async getAccessToken() {
        if (!this.client) {
            this.client = await this.auth.getClient();
        }
        const accessToken = await this.client.getAccessToken();
        return accessToken.token;
    }

    /**
     * Genera el embedding para un texto dado usando REST API directo.
     */
    async generateEmbedding(text) {
        try {
            const token = await this.getAccessToken();

            const response = await axios.post(
                apiEndpoint,
                {
                    instances: [
                        { content: text, task_type: 'RETRIEVAL_QUERY' }
                    ]
                },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            // La respuesta de predict tiene formato: { predictions: [ { embeddings: { values: [...] } } ] }
            // O a veces: { predictions: [ [0.1, 0.2...] ] } dependiendo del modelo.
            // Para text-embedding-004 suele ser: values

            if (response.data.predictions && response.data.predictions.length > 0) {
                const prediction = response.data.predictions[0];
                // Manejar variaciones de respuesta
                if (prediction.embeddings && prediction.embeddings.values) {
                    return prediction.embeddings.values;
                } else if (Array.isArray(prediction)) {
                    return prediction; // Formato antiguo
                } else if (prediction.values) {
                    return prediction.values;
                }
            }

            console.warn("⚠️ Respuesta inesperada de Vertex AI:", JSON.stringify(response.data));
            return null;

        } catch (error) {
            console.error("❌ Error generando embedding (REST):", error.response?.data || error.message);
            return null;
        }
    }

    /**
     * Busca documentos relevantes en Supabase (pgvector) con soporte de filtros (Hybrid Search).
     * @param {string} queryText - Pregunta o tema a buscar.
     * @param {number} limit - Cantidad de fragmentos a recuperar (default 3).
     * @param {object} filters - Filtros de metadatos opcionales (ej: { type: 'Norma Técnica' }).
     */
    async searchContext(queryText, limit = 3, filters = {}) {
        const embedding = await this.generateEmbedding(queryText);
        if (!embedding) return "";

        // Convertimos el array JS a formato vector pg
        const vectorStr = `[${embedding.join(',')}]`;
        const params = [vectorStr, limit];

        let filterClause = "";

        // Construcción dinámica de filtros JSONB
        // Si filters = { type: 'Norma Técnica' }, agregamos: AND metadata @> '{"type": "Norma Técnica"}'
        if (filters && Object.keys(filters).length > 0) {
            params.push(JSON.stringify(filters)); // $3
            filterClause = `AND metadata @> $3`;
        }

        const query = `
            SELECT content, metadata, 1 - (embedding <=> $1) as similarity
            FROM documents
            WHERE 1 - (embedding <=> $1) > 0.55 -- Umbral mínimo ligeramente más estricto
            ${filterClause}
            ORDER BY embedding <=> $1
            LIMIT $2;
        `;

        try {
            const res = await db.query(query, params);

            if (res.rows.length === 0) {
                console.log("ℹ️ RAG: Sin coincidencias relevantes (>0.55) o filtros muy estrictos.");
                return "";
            }

            // Concatenar el contenido encontrado para el prompt
            return res.rows.map(row => {
                const meta = row.metadata || {};
                const sourceInfo = `${meta.type || 'Documento'} - ${meta.title || meta.source || 'Desconocido'} (${meta.year || 'S/F'})`;
                return `--- CONTEXTO OFICIAL (${sourceInfo}) ---\n${row.content}`;
            }).join('\n\n');

        } catch (error) {
            console.warn("⚠️ RAG Search Falló:", error.message);
            return "";
        }
    }
}

module.exports = new RagService();
