const CourseRepository = require('../../domain/repositories/courseRepository');
const AnalyticsService = require('../../domain/services/analyticsService');

const TopicRepository = require('../../domain/repositories/topicRepository'); // Importar repositorio de temas
const CareerRepository = require('../../domain/repositories/careerRepository');
const BookRepository = require('../../domain/repositories/bookRepository'); // ✅ NUEVO: Repositorio de Libros
const { normalizeText } = require('../../domain/utils/textUtils');

class SearchService {
    constructor() {
        this.courseRepository = new CourseRepository();
        this.analyticsService = new AnalyticsService();
        this.topicRepository = new TopicRepository();
        this.careerRepository = new CareerRepository();
        this.bookRepository = new BookRepository(); // ✅ NUEVO
    }
    // Nota: Para un desacoplamiento completo, estos repositorios deberían ser inyectados
    // en el constructor en lugar de ser instanciados aquí.

    async getAllCourses() {
        return await this.courseRepository.findAll();
    }

    async getAllTopics() {
        return await this.topicRepository.findAll();
    }

    async getAllCareers() {
        // Usar la instancia del constructor en lugar de crear una nueva.
        return await this.careerRepository.findAll();
    }

    async searchCourses(query, user = null) {
        console.log(`🚀 SearchService: Iniciando búsqueda UNIFICADA para "${query}"`);

        // 1. Búsqueda Paralela: Libros y Cursos
        // Intencionalmente ignoramos errores individuales para que uno no rompa al otro.
        const [bookResults, courseResults] = await Promise.all([
            this.bookRepository.search(query).catch(err => { console.error('Error searching books:', err); return []; }),
            this.courseRepository.search(query).catch(err => { console.error('Error searching courses:', err); return []; })
        ]);

        // 2. Normalización y Tagging
        const books = bookResults.map(b => ({ ...b, type: b.resource_type || 'book' }));
        const courses = courseResults.map(c => ({ ...c, type: 'course' }));

        // 3. Fallback Mejorado: Búsqueda por Categoría/Carrera (Smart Context)
        let finalCourses = courses;

        // Si la búsqueda directa trajo pocos resultados o es una query compuesta ("medicina humana")
        if (finalCourses.length < 3 && query.length > 3) {
            // Intentar buscar cursos que pertenezcan a una carrera que coincida con la query
            // Eliminamos la restricción de espacios para permitir "Medicina Humana"
            const careerCourses = await this.courseRepository.findByCareerCategory(query);

            if (careerCourses.length > 0) {
                // Fusionar evitando duplicados
                const currentIds = new Set(finalCourses.map(c => c.id));
                const newCourses = careerCourses
                    .filter(c => !currentIds.has(c.id))
                    .map(c => ({ ...c, type: 'course', _matchType: 'career_context' }));

                finalCourses = [...finalCourses, ...newCourses];
            }
        }

        // 4. Combinar Resultados (Libros arriba, luego Cursos)
        // Esto cumple con "Libros y cursos, segun a la busqueda".
        const finalResults = [...books, ...finalCourses];

        // 5. ML Recommendations (ELIMINADO: Era redundante con la búsqueda principal)
        // El usuario reportó que "Related Resources" solo repetía información o daba resultados de baja calidad.
        // Se ha pivoteado la estrategia para usar ML en "Deep Question Answering".
        let recommendations = null;

        // 6. Analytics
        if (this.analyticsService && this.analyticsService.ensureReady) {
            await this.analyticsService.ensureReady();
        }
        const isEducationalQuery = this.analyticsService.isQueryEducational(query);
        const userId = user ? user.id : null;

        // Registramos la búsqueda
        if (finalResults.length > 0 || isEducationalQuery) {
            await this.analyticsService.recordSearchWithIntent(query, finalCourses.slice(0, 5), isEducationalQuery, userId);
        }

        return {
            searchQuery: query,
            results: finalResults, // Array mezclado de {type: 'book', ...} y {type: 'course', ...}
            totalResults: finalResults.length,
            recommendations: recommendations,
            isEducationalQuery: isEducationalQuery,
            queryClassification: this.analyticsService?.classifySearchTerm ? this.analyticsService.classifySearchTerm(query) : 'General'
        };
    }

}

module.exports = SearchService;
