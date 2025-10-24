const CourseRepository = require('../repositories/courseRepository');
const PythonMLService = require('./pythonMLService'); // ✅ Importamos el nuevo servicio

class RecommendationService {
    constructor(courseRepository) {
        this.courseRepository = courseRepository;
    }

    /**
     * Genera un mensaje de sugerencia inteligente basado en la consulta y los resultados directos.
     * Ahora obtiene las sugerencias del servicio de ML en Python.
     * @param {string} query La consulta original del usuario.
     * @param {Array<object>} directResults Los cursos encontrados directamente por la búsqueda.
     * @returns {Promise<string>} Un mensaje con sugerencias formateado en Markdown.
     */
    async getSuggestionMessage(query, directResults) {
        const directResultIds = directResults.map(c => c.id);

        // 1. ✅ Llamar al servicio de Python para obtener todas las recomendaciones
        const recommendations = await PythonMLService.getRecommendations(query, directResultIds);

        let suggestions = [];

        // 2. ✅ Formatear las sugerencias recibidas del servicio de Python
        if (recommendations.relatedCourses && recommendations.relatedCourses.length > 0) {
            suggestions.push(`Cursos que también podrían interesarte: **${recommendations.relatedCourses.join(', ')}**`);
        }

        if (recommendations.relatedTopics && recommendations.relatedTopics.length > 0) {
            suggestions.push(`Temas que puedes explorar: **${recommendations.relatedTopics.join(', ')}**`);
        }

        if (recommendations.popularCourse && recommendations.popularCourse.predictedCourse && recommendations.popularCourse.confidence > 0.6) {
            suggestions.push(`El curso más buscado actualmente es: **${recommendations.popularCourse.predictedCourse}**`);
        }

        if (recommendations.popularTopic && recommendations.popularTopic.predictedTopic && recommendations.popularTopic.confidence > 0.6) {
            suggestions.push(`Un tema muy popular es: **${recommendations.popularTopic.predictedTopic}**`);
        }

        // 3. ✅ Devolver el mensaje final
        if (suggestions.length > 0) {
            return suggestions.join('. ');
        } else {
            return "Explora nuestros cursos o pregunta al Tutor IA.";
        }
    }
}

module.exports = RecommendationService;