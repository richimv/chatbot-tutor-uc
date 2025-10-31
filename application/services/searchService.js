const CourseRepository = require('../../domain/repositories/courseRepository');
const AnalyticsService = require('../../domain/services/analyticsService');
const MLService = require('../../domain/services/mlService'); // ✅ 1. Importar MLService

class SearchService {
    constructor() {
        this.courseRepository = new CourseRepository();
        this.analyticsService = new AnalyticsService();
    }

    /**
     * Orquesta la lógica de búsqueda completa.
     * @param {string} query La consulta del usuario.
     * @returns {Promise<object>} Un objeto con los resultados y recomendaciones.
     */
    async searchCourses(query) {
        console.log(`🚀 SearchService: Iniciando búsqueda para "${query}"`);

        // 1. Realizar la búsqueda directa en la base de datos
        const directResults = await this.courseRepository.search(query);
        console.log(`🔍 Encontrados ${directResults.length} resultados directos.`);

        // 2. Registrar la búsqueda para analytics (sin esperar a que termine)
        // Se determina si es una pregunta para el chatbot
        const isEducationalQuery = this.isEducationalQuery(query);
        this.analyticsService.recordSearchWithIntent(query, directResults, isEducationalQuery ? 'duda_teorica' : 'consulta_general');

        // 3. Obtener recomendaciones del servicio de Machine Learning
        const directResultsIds = directResults.map(course => course.courseId);
        
        // ✅ 2. Usar MLService para obtener las recomendaciones desde Python
        const recommendations = await MLService.getRecommendations(query, directResultsIds);
        console.log('💡 Recomendaciones recibidas del servicio de ML:', recommendations);

        // 4. Formatear y devolver la respuesta final
        return {
            searchQuery: query,
            totalResults: directResults.length,
            results: directResults,
            recommendations: recommendations, // recommendations ya tiene el formato { relatedCourses, relatedTopics }
            isEducationalQuery: isEducationalQuery
        };
    }

    /**
     * Determina si una consulta parece ser una pregunta educativa en lugar de una búsqueda de curso.
     * @param {string} query La consulta del usuario.
     * @returns {boolean}
     */
    isEducationalQuery(query) {
        const questionWords = ['qué', 'que', 'cómo', 'como', 'cuál', 'cual', 'cuando', 'dónde', 'donde', 'por qué', 'explica', 'define'];
        const lowerCaseQuery = query.toLowerCase();
        // Considera una pregunta si termina en '?' o empieza con una palabra interrogativa y tiene más de 2 palabras.
        return lowerCaseQuery.endsWith('?') || (questionWords.some(word => lowerCaseQuery.startsWith(word)) && lowerCaseQuery.split(' ').length > 2);
    }

    async getAllCourses() {
        return await this.courseRepository.findAll();
    }
}

module.exports = SearchService;