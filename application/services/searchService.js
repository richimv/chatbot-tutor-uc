const CourseRepository = require('../../domain/repositories/courseRepository');
const AnalyticsService = require('../../domain/services/analyticsService');
const PythonMLService = require('../../domain/services/pythonMLService'); // Servicio principal de ML
const TopicRepository = require('../../domain/repositories/topicRepository'); // Importar repositorio de temas
const relatedCoursePredictor = require('../../domain/predictors/relatedCoursePredictor'); // Predictor de JS como fallback
const CareerRepository = require('../../domain/repositories/careerRepository'); // ✅ 1. Importar repositorio de carreras
const { normalizeText } = require('../../domain/utils/textUtils');

class SearchService {
    constructor() {
        this.courseRepository = new CourseRepository();
        this.analyticsService = new AnalyticsService();
        this.topicRepository = new TopicRepository();
        // ✅ 2. Añadir el repositorio de carreras al constructor
        this.careerRepository = new CareerRepository();
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
        console.log(`🚀 SearchService: Iniciando búsqueda para "${query}"`);

        // ✅ OPTIMIZACIÓN: Cargar todos los datos necesarios una sola vez al principio.
        // Esto evita múltiples llamadas a la BD en los flujos de fallback.
        const allCourses = await this.getAllCourses();
        const allTopics = await this.getAllTopics();
        const allCareers = await this.getAllCareers();
        const allDataForPredictor = { courses: allCourses, topics: allTopics, careers: allCareers };

        // 1. Determinar la intención de la búsqueda
        const isEducationalQuery = this.isEducationalQuery(query);
        
        // 2. Obtener resultados directos de la base de datos. Node.js es el motor de búsqueda principal.
        let directResults = await this.courseRepository.search(query);

        // ✅ SOLUCIÓN: Invertir el orden. Primero, la búsqueda más inteligente por categoría.
        // Esta búsqueda usa Levenshtein y es tolerante a errores como "ingenieriaa".
        if (directResults.length === 0 && query.length > 4) { // Evitar búsquedas muy cortas
            console.log(`... Intentando buscar por categoría de carrera (tolerante a errores): "${query}"`);
            const coursesByCategory = await this.courseRepository.findByCareerCategory(query);
            if (coursesByCategory.length > 0) {
                console.log(`✅ Encontrados ${coursesByCategory.length} cursos en carreras que coinciden con "${query}"`);
                directResults = coursesByCategory;
            }
        }

        // ✅ MEJORA DE BÚSQUEDA POR CARRERA: Si no hay resultados, verificar si la búsqueda coincide con una carrera.
        // Esto ahora actúa como un fallback si la búsqueda por categoría no funcionó.
        if (directResults.length === 0) {
            console.log('... Búsqueda estricta sin resultados. Intentando buscar por nombre de carrera...');
            const careerResults = await this.courseRepository.findByCareerName(query);
            if (careerResults.length > 0) {
                console.log(`✅ Encontrados ${careerResults.length} cursos para la carrera "${query}"`);
                directResults = careerResults;
            }
        }

        // Guardar los resultados directos antes de la búsqueda ampliada.
        const directResultsFromDB = [...directResults];
        const directResultsIds = directResultsFromDB.map(course => course.id);

        // ✅ MEJORA: Búsqueda ampliada si no hay resultados directos.
        // Si la búsqueda estricta no devuelve nada, usamos el predictor de JS para una búsqueda más flexible.
        if (directResults.length === 0) {
            console.log('... Búsqueda estricta sin resultados. Realizando búsqueda ampliada.');
            directResults = relatedCoursePredictor.predict(query, [], allDataForPredictor); // Los resultados ahora son los de la búsqueda ampliada.
        }
        
        // 3. Obtener recomendaciones del servicio de ML.
        // Se le pasa la consulta y los IDs de los resultados directos para que tenga contexto.
        let recommendations;

        try {
            const mlResponse = await PythonMLService.getRecommendations(query, directResultsIds);
            recommendations = {
                relatedCourses: mlResponse.relatedCourses || [],
                relatedTopics: mlResponse.relatedTopics || []
            };
        } catch (mlError) {
            console.warn(`⚠️ El servicio de ML de Python no está disponible o falló: ${mlError.message}. Usando predictor de JS como fallback.`);
            // El fallback de JS también genera recomendaciones basadas en la consulta.
            // ✅ REFACTOR: Reutilizar los datos ya cargados.
            
            // ✅ MEJORA UX: Si el ML falló, mostramos las mejores coincidencias aunque ya estén en los resultados.
            // Para ello, llamamos al predictor con una lista de exclusión vacía.
            // Esto asegura que el usuario siempre vea alguna recomendación de curso.
            const fallbackCourses = relatedCoursePredictor.predict(query, [], allDataForPredictor);

            const fallbackTopics = require('../../domain/predictors/relatedTopicPredictor').predict(query, allTopics);
            recommendations = { relatedCourses: fallbackCourses, relatedTopics: fallbackTopics };
        }

        // 4. Registrar la búsqueda en analytics.
        const userId = user ? user.id : null;
        await this.analyticsService.recordSearchWithIntent(query, directResults, isEducationalQuery, userId);

        return {
            searchQuery: query,
            results: directResults,
            totalResults: directResults.length,
            recommendations: recommendations,
            isEducationalQuery: isEducationalQuery
        };
    }

    isEducationalQuery(query) {
        // ✅ SOLUCIÓN: Ampliar la lista de palabras clave para detectar más tipos de preguntas conceptuales.
        // Esto asegura que frases como "podrías decirme el concepto de..." o "cuál es la historia de..."
        // se marquen correctamente como 'isEducationalQuery'.
        const educationalKeywords = [
            'que es', 
            'como funciona', 
            'explica', 
            'explicame', 
            'dime que es',
            'diferencia entre', 
            'definicion de', 
            'concepto de', 
            'historia de', 
            'cual es', 
            'cuales son', 
            'podrias decirme', 
            'quisiera saber'];
        const normalizedQuery = normalizeText(query);
        return educationalKeywords.some(keyword => normalizedQuery.startsWith(keyword));
    }
}

module.exports = SearchService;
