const fetch = require('node-fetch');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000';

class PythonMLService {
    /**
     * Obtiene un paquete completo de recomendaciones y predicciones del servicio de Python.
     * @param {string} query La consulta del usuario.
     * @param {Array<string>} directResultsIds IDs de los cursos encontrados directamente.
     * @returns {Promise<object>} Un objeto con popularCourse, popularTopic y relatedCourses.
     */
    static async getRecommendations(query, directResultsIds) {
        try {
            console.log(`🧠 Llamando al servicio de Python ML para la query: "${query}"`);
            const response = await fetch(`${ML_SERVICE_URL}/recommendations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query, directResultsIds }),
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`El servicio de ML respondió con status ${response.status}: ${errorBody}`);
            }

            return await response.json();
        } catch (error) {
            console.error('❌ Error al contactar el servicio de Python ML:', error.message);
            // Devolver un objeto vacío o con valores por defecto para no romper la aplicación
            return { popularCourse: null, popularTopic: null, relatedCourses: [] };
        }
    }
}

module.exports = PythonMLService;
