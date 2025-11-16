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
            const response = await axios.post(`${PYTHON_SERVICE_URL}/recommendations`, {
                query: query,
                directResultsIds: directResultsIds
            });
            return response.data;
        } catch (error) {
            // ✅ MEJORA: Simplificar el log de error para no inundar la consola.
            const reason = error.code === 'ECONNREFUSED' ? 'Conexión rechazada. ¿Está corriendo el servicio de Python en el puerto 5000?' : error.message;
            console.error(`❌ No se pudo contactar al servicio de ML: ${reason}`);
            throw new Error('El servicio de recomendaciones de Python no está disponible.');
        }
    }

    /**
     * Obtiene las predicciones de tendencias (curso/tema más popular) del servicio de Python.
     * @returns {Promise<object>} Un objeto con popularCourse y popularTopic.
     */
    static async getTrends() {
        try {
            console.log(`🧠 Llamando al servicio de Python ML para obtener tendencias de popularidad.`);
            const response = await axios.get(`${PYTHON_SERVICE_URL}/analytics/trends`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`El servicio de ML respondió con status ${response.status} en /analytics/trends: ${errorBody}`);
            }

            return await response.json();
        } catch (error) {
            console.error('❌ Error al contactar el endpoint de tendencias del servicio de Python ML:', error.message);
            return { popularCourse: null, popularTopic: null };
        }
    }
}

module.exports = PythonMLService;
