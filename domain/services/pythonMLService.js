const axios = require('axios');

const PYTHON_SERVICE_URL = 'http://localhost:5000';

class PythonMLService {
    /**
     * Obtiene un paquete completo de recomendaciones y predicciones del servicio de Python.
     * @param {string} query La consulta del usuario.
     * @param {Array<string>} directResultsIds IDs de los cursos encontrados directamente.
     * @returns {Promise<object>} Un objeto con relatedCourses y relatedTopics.
     */
    static async getRecommendations(query, directResultsIds) {
        try {
            const response = await axios.post(`${PYTHON_SERVICE_URL}/api/recommendations`, {
                query: query,
                directResultsIds: directResultsIds
            });
            return response.data;
        } catch (error) {
            // ✅ MEJORA: Simplificar el log de error para no inundar la consola.
            const reason = error.code === 'ECONNREFUSED' ? 'Conexión rechazada. ¿Está corriendo el servicio de Python en el puerto 5000?' : error.message;
            console.error(`❌ No se pudo contactar al servicio de ML: ${reason}`);
            return null; // Retornar null en lugar de lanzar error
        }
    }

    /**
     * Obtiene las predicciones de tendencias (curso/tema más popular) del servicio de Python.
     * @returns {Promise<object>} Un objeto con popularCourse y popularTopic.
     */
    static async getTrends(days = 30) {
        try {
            console.log(`🧠 Llamando al servicio de Python ML para obtener tendencias de popularidad (Last ${days} days).`);
            const response = await axios.get(`${PYTHON_SERVICE_URL}/api/trends`, { params: { days } });
            return response.data;
        } catch (error) {
            const reason = error.code === 'ECONNREFUSED' ? 'Conexión rechazada. ¿Está corriendo el servicio de Python en el puerto 5000?' : error.message;
            console.error(`❌ No se pudo contactar al servicio de tendencias de ML: ${reason}`);
            return null; // Retornar null en lugar de lanzar error
        }
    }
}

module.exports = PythonMLService;
