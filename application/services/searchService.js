const CourseRepository = require('../../domain/repositories/courseRepository');
const AnalyticsService = require('../../domain/services/analyticsService');
const RecommendationService = require('../../domain/services/recommendationService');

class SearchService {
    constructor() {
        this.courseRepository = new CourseRepository();
        this.analyticsService = new AnalyticsService();
        this.recommendationService = new RecommendationService();
    }

    async searchCourses(query) {
        console.log(`🔍 Servicio: Buscando cursos para "${query}"`);

        // 1. Delegar la búsqueda inteligente al repositorio.
        const results = await this.courseRepository.search(query);

        // 2. Obtener todos los datos (ya cacheados por el repo) para las recomendaciones.
        const allUnifiedCourses = await this.courseRepository.findAll();

        // 3. Preparar IDs para exclusión en recomendaciones.
        const directCourseIds = [...new Set(
            results.filter(r => r.score >= 10).map(r => r.courseId)
        )];

        // 4. Obtener recomendaciones LOCALMENTE.
        const recommendations = this.recommendationService.getRecommendations(query, directCourseIds, allUnifiedCourses);

        // 5. Registrar en analytics.
        await this.analyticsService.recordSearchWithIntent(query, results);

        // 6. Devolver la respuesta completa.
        const intent = this.analyticsService.inferIntentFromQuery(query);
        const isEducationalQuery = intent === 'duda_teorica';

        return {
            results: results,
            totalResults: results.length,
            searchQuery: query,
            isEducationalQuery: isEducationalQuery,
            recommendations: recommendations
        };
    }
}

module.exports = SearchService;