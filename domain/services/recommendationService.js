const CourseRepository = require('../repositories/courseRepository');
const AnalyticsRepository = require('../repositories/analyticsRepository');

class RecommendationService {
    constructor(courseRepository) { // ✅ CORRECCIÓN: Aceptar courseRepository como dependencia
        this.courseRepo = courseRepository;
        this.analyticsRepo = new AnalyticsRepository();
        
        // Mapeo de relaciones entre conceptos
        this.conceptRelations = {
            'python': ['programación', 'algoritmos', 'estructuras de datos', 'poo', 'web development'],
            'java': ['programación', 'poo', 'android', 'aplicaciones empresariales'],
            'matemáticas': ['cálculo', 'álgebra', 'estadística', 'física', 'lógica'],
            'cálculo': ['matemáticas', 'derivadas', 'integrales', 'física'],
            'base de datos': ['sql', 'modelado', 'normalización', 'big data', 'data mining'],
            'redes': ['protocolos', 'seguridad', 'internet', 'comunicaciones', 'osi'],
            'inteligencia artificial': ['machine learning', 'redes neuronales', 'python', 'algoritmos'],
            'programación': ['python', 'java', 'c++', 'algoritmos', 'estructuras de datos']
        };
    }

    // Generar recomendaciones basadas en consulta actual
    async generateRecommendations(query, currentResults) {
        const allCourses = await this.courseRepo.findAll();
        const recommendations = new Set();
        const searchTrends = await this.analyticsRepo.getSearchTrends(10);

        // 1. Recomendaciones por conceptos relacionados
        await this.addConceptBasedRecommendations(query, currentResults, recommendations);
        
        // 2. Recomendaciones por tendencias populares
        await this.addTrendBasedRecommendations(searchTrends, currentResults, recommendations);
        
        // 3. Recomendaciones por carrera
        this.addCareerBasedRecommendations(currentResults, allCourses, recommendations);

        return Array.from(recommendations).slice(0, 4); // Máximo 4 recomendaciones
    }

    // Recomendaciones basadas en conceptos relacionados
    async addConceptBasedRecommendations(query, allCourses, currentResults, recommendations) {
        const normalizedQuery = this.courseRepo._normalizeText(query);
        // Usar un bucle for...of para poder usar await
        for (const [concept, relatedConcepts] of Object.entries(this.conceptRelations)) {
            if (normalizedQuery.includes(concept)) {
                for (const relatedConcept of relatedConcepts) {
                    const foundCourses = await this.courseRepo.search(relatedConcept);
                    foundCourses.forEach(course => {
                        if (!this.isAlreadyInResults(course, currentResults)) {
                            recommendations.add(course);
                        }
                    });
                }
            }
        }
    }

    // Recomendaciones basadas en tendencias
    async addTrendBasedRecommendations(trends, currentResults, recommendations) {
        // Usar un bucle for...of para poder usar await
        for (const trend of trends) {
            const foundCourses = await this.courseRepo.search(trend.query);
            foundCourses.forEach(foundCourse => {
                if (!this.isAlreadyInResults(foundCourse, currentResults) && trend.count > 2) {
                    recommendations.add(foundCourse);
                }
            });
        }
    }

    // Recomendaciones por carrera
    addCareerBasedRecommendations(currentResults, allCourses, recommendations) {
        if (currentResults.length > 0) {
            const mainCareer = currentResults[0].carrera;
            allCourses.forEach(course => {
                if (course.carrera === mainCareer && 
                    !this.isAlreadyInResults(course, currentResults)) {
                    recommendations.add(course);
                }
            });
        };
    }

    // Verificar si el curso ya está en resultados
    isAlreadyInResults(course, currentResults) {
        return currentResults.some(result => result.id === course.id);
    }

    // Generar mensaje de sugerencias
    async getSuggestionMessage(query, results) {
        if (results.length === 0) return '';

        const recommendations = await this.generateRecommendations(query, results);
        
        if (recommendations.length === 0) return '';

        const suggestionText = recommendations.map(course => 
            `• **${course.nombre}** - ${course.carrera}`
        ).join('\n');

        return `\n\n💡 **Basado en tu búsqueda, también te podría interesar:**\n${suggestionText}`;
    }

    // Obtener cursos frecuentemente buscados juntos
    async getFrequentlySearchedTogether(courseName) {
        const trends = await this.analyticsRepo.getSearchTrends(20);
        const relatedCourses = new Set();
        
        trends.forEach(trend => {
            if (trend.query.toLowerCase().includes(courseName.toLowerCase())) {
                // Buscar otros cursos en la misma tendencia
                trends.forEach(otherTrend => {
                    if (otherTrend.query !== trend.query && otherTrend.count > 1) {
                        relatedCourses.add(otherTrend.query);
                    }
                });
            }
        });

        return Array.from(relatedCourses).slice(0, 3);
    }
}

module.exports = RecommendationService;