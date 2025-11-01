const CourseRepository = require('../../domain/repositories/courseRepository');
const AnalyticsService = require('../../domain/services/analyticsService');
const TopicRepository = require('../../domain/repositories/topicRepository'); // ✅ Importar TopicRepository
const CareerRepository = require('../../domain/repositories/careerRepository'); // ✅ Importar CareerRepository
const MLService = require('../../domain/services/mlService'); // ✅ 1. Importar MLService
const relatedCoursePredictor = require('../../domain/predictors/relatedCoursePredictor'); // ✅ Importar el predictor JS

class SearchService {
    constructor() {
        this.courseRepository = new CourseRepository();
        this.analyticsService = new AnalyticsService();
        this.topicRepository = new TopicRepository(); // ✅ Instanciar TopicRepository
        this.careerRepository = new CareerRepository(); // ✅ Instanciar CareerRepository
    }

    /**
     * Orquesta la lógica de búsqueda completa.
     * @param {string} query La consulta del usuario.
     * @returns {Promise<object>} Un objeto con los resultados y recomendaciones.
     */
    async searchCourses(query) {
        console.log(`🚀 SearchService: Iniciando búsqueda para "${query}"`);

        // ✅ PASO 1: Búsqueda Directa.
        let directResults = await this.courseRepository.search(query);

        // ✅ PASO 2: Búsqueda Ampliada (si la directa falla).
        // Usamos la lógica del predictor JS para realizar una búsqueda por palabras clave en todos los cursos.
        if (directResults.length === 0) {
            console.log('... Búsqueda directa sin resultados. Intentando búsqueda ampliada.');
            
            // ✅ SOLUCIÓN FINAL: El courseRepository.findAll() ya nos da los datos enriquecidos.
            // No es necesario reconstruir la lógica aquí.
            const enrichedCourses = await this.courseRepository.findAll();

            // La función predict ahora nos sirve como un motor de búsqueda por relevancia.
            // Le pasamos un array de IDs vacío porque no hay contexto.
            const lenientResults = relatedCoursePredictor.predict(query, [], enrichedCourses);
            // Mapeamos los resultados para que tengan la misma estructura que los de la búsqueda directa.
            directResults = lenientResults.map(course => enrichedCourses.find(c => c.name === course.name)).filter(Boolean);
        }

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