const axios = require('axios');

// ✅ CORRECCIÓN CRÍTICA:
// Usar la variable de entorno (para Render) o fallback a localhost (para tu PC).
// IMPORTANTE: Sin barra '/' al final para evitar doble barra en la petición.
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:5000';

class PythonMLService {
    /**
     * Obtiene un paquete completo de recomendaciones y predicciones del servicio de Python.
     * @param {string} query La consulta del usuario.
     * @param {Array<string>} directResultsIds IDs de los cursos encontrados directamente.
     * @returns {Promise<object>} Un objeto con relatedCourses y relatedTopics.
     */
    static async getRecommendations(query, directResultsIds) {
        try {
            // console.log(`🔌 Conectando a ML Service en: ${PYTHON_SERVICE_URL}/api/recommendations`);
            const response = await axios.post(`${PYTHON_SERVICE_URL}/api/recommendations`, {
                query: query,
                directResultsIds: directResultsIds
            });
            return response.data;
        } catch (error) {
            const reason = error.code === 'ECONNREFUSED'
                ? `Conexión rechazada. ¿Está corriendo el servicio en ${PYTHON_SERVICE_URL}?`
                : error.message;
            console.error(`❌ No se pudo contactar al servicio de ML: ${reason}`);
            return null;
        }
    }

    /**
     * Obtiene las predicciones de tendencias (curso/tema más popular) del servicio de Python.
     * @returns {Promise<object>} Un objeto con popularCourse y popularTopic.
     */
    static async getTrends(days = 30) {
        try {
            console.log(`🧠 Llamando a Python ML (${PYTHON_SERVICE_URL}) para tendencias (Last ${days} days).`);
            const response = await axios.get(`${PYTHON_SERVICE_URL}/api/trends`, { params: { days } });
            return response.data;
        } catch (error) {
            const reason = error.code === 'ECONNREFUSED'
                ? `Conexión rechazada. ¿Está corriendo el servicio en ${PYTHON_SERVICE_URL}?`
                : error.message;
            console.error(`❌ No se pudo contactar al servicio de tendencias de ML: ${reason}`);
            return null;
        }
    }
}

module.exports = PythonMLService;