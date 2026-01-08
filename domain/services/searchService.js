const CourseRepository = require('../../domain/repositories/courseRepository');
const AnalyticsService = require('../../domain/services/analyticsService');
const PythonMLService = require('../../domain/services/pythonMLService'); // Servicio principal de ML
const TopicRepository = require('../../domain/repositories/topicRepository'); // Importar repositorio de temas
const relatedCoursePredictor = require('../../domain/predictors/relatedCoursePredictor'); // Predictor de JS como fallback
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
        const books = bookResults.map(b => ({ ...b, type: 'book' }));
        const courses = courseResults.map(c => ({ ...c, type: 'course' }));

        // 3. Fallback inteligente para Cursos (si no hay resultados directos)
        let finalCourses = courses;
        if (finalCourses.length === 0 && query.length > 3) {
            // Intento por categoría de carrera
            // Solo si no tiene espacios (palabra clave simple) para evitar falsos positivos largos
            if (!query.includes(' ')) {
                const careerCourses = await this.courseRepository.findByCareerCategory(query);
                if (careerCourses.length > 0) {
                    finalCourses = careerCourses.map(c => ({ ...c, type: 'course' }));
                }
            }
        }

        // 4. Combinar Resultados (Libros arriba, luego Cursos)
        // Esto cumple con "Libros y cursos, segun a la busqueda".
        const finalResults = [...books, ...finalCourses];

        // 5. ML Recommendations (Solo enviamos contexto de cursos para no romper el ML actual)
        let recommendations = null;
        try {
            const courseIds = finalCourses.map(c => c.id);
            // Solo pedimos recomendaciones si hay al menos un curso de contexto o si es una query larga
            if (courseIds.length > 0 || query.length > 4) {
                const mlResponse = await PythonMLService.getRecommendations(query, courseIds);
                if (mlResponse) {
                    recommendations = {
                        relatedCourses: mlResponse.relatedCourses || [],
                        relatedTopics: mlResponse.relatedTopics || []
                    };
                }
            }
        } catch (e) {
            console.warn('ML Service unavailable:', e.message);
        }

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
