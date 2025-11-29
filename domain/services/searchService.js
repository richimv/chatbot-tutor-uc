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



        // ✅ LÓGICA RESTAURADA Y SIMPLIFICADA: Se realiza una única llamada a la base de datos.
        // La función `search_courses` ahora es lo suficientemente robusta para manejar búsquedas
        // de cursos, temas y docentes de forma correcta.
        let directResults = await this.courseRepository.search(query);

        // ✅ SOLUCIÓN: Restaurar el fallback para búsqueda por categoría de carrera.
        // Si la búsqueda principal (curso, tema, docente) no arroja resultados,
        // se intenta una búsqueda tolerante a errores por nombre de carrera (ej: "ingenieriaa").
        if (directResults.length === 0 && query.length > 3 && !query.includes(' ')) {
            console.log('... Búsqueda principal sin resultados. Intentando por categoría de carrera.');
            directResults = await this.courseRepository.findByCareerCategory(query);
        }

        let finalResults = directResults;

        // 4. Búsqueda ampliada (fallback): Solo si no se encontró NADA.
        // Esto es para conceptos como "POO", "el cuerpo humano", no para "ingenieriaa".
        if (finalResults.length === 0 && query.length > 3) {
            console.log('... Búsqueda sin resultados. Realizando búsqueda ampliada para un concepto.');
            finalResults = relatedCoursePredictor.predict(query, [], allDataForPredictor);
        }

        // ✅ CORRECCIÓN: Calcular IDs DESPUÉS de búsqueda ampliada
        const directResultsIds = finalResults.map(course => course.id);

        // 3. Obtener recomendaciones del servicio de ML.
        // Se le pasa la consulta y los IDs de los resultados directos para que tenga contexto.
        let recommendations;

        try {
            const mlResponse = await PythonMLService.getRecommendations(query, directResultsIds);

            if (!mlResponse) {
                throw new Error('El servicio de Python devolvió null (no disponible).');
            }

            console.log('🐍 Respuesta de Python ML:', JSON.stringify(mlResponse, null, 2));
            recommendations = {
                relatedCourses: mlResponse.relatedCourses || [],
                relatedTopics: mlResponse.relatedTopics || []
            };
            console.log(`📦 Python ML usado. Cursos: ${recommendations.relatedCourses.length}, Temas: ${recommendations.relatedTopics.length}`);
        } catch (mlError) {
            console.warn(`⚠️ El servicio de ML de Python no está disponible o falló: ${mlError.message}. Usando predictor de JS como fallback.`);

            // ✅ MEJORA: Llamar al predictor con TODOS los parámetros necesarios
            const fallbackCourses = relatedCoursePredictor.predict(query, directResultsIds, allDataForPredictor);

            // ✅ CORRECCIÓN CRÍTICA: Pasar directResultsIds y allData al predictor de temas
            const relatedTopicPredictor = require('../../domain/predictors/relatedTopicPredictor');
            const fallbackTopics = relatedTopicPredictor.predict(query, allTopics, directResultsIds, allDataForPredictor);

            console.log(`📦 Fallback JS usado. Cursos: ${fallbackCourses.length}, Temas: ${fallbackTopics.length}`);
            recommendations = { relatedCourses: fallbackCourses, relatedTopics: fallbackTopics };
        }

        // ✅ CORRECCIÓN CRÍTICA: Asegurar que el servicio de analítica tenga los datos cargados
        // para poder clasificar correctamente la consulta (ej. detectar 'Carrera').
        if (this.analyticsService && this.analyticsService.ensureReady) {
            await this.analyticsService.ensureReady();
        }

        // 1. Determinar la intención de la búsqueda usando clasificación centralizada
        const isEducationalQuery = this.analyticsService.isQueryEducational(query);

        // 4. Registrar la búsqueda en analytics.
        const userId = user ? user.id : null;
        await this.analyticsService.recordSearchWithIntent(query, finalResults, isEducationalQuery, userId);

        return {
            searchQuery: query,
            results: finalResults,
            totalResults: finalResults.length,
            recommendations: recommendations,
            isEducationalQuery: isEducationalQuery,
            queryClassification: this.analyticsService?.classifySearchTerm ? this.analyticsService.classifySearchTerm(query) : 'General'
        };
    }

}

module.exports = SearchService;
