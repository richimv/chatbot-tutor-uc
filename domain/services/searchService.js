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

        // Guardar los resultados directos antes de la búsqueda ampliada.
        const directResultsFromDB = [...finalResults];
        const directResultsIds = directResultsFromDB.map(course => course.id);

        // 4. Búsqueda ampliada (fallback): Solo si no se encontró NADA.
        // Esto es para conceptos como "POO", no para "ingenieriaa".
        if (finalResults.length === 0 && query.length > 3) {
            console.log('... Búsqueda sin resultados. Realizando búsqueda ampliada para un concepto.');
            finalResults = relatedCoursePredictor.predict(query, [], allDataForPredictor);
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
        await this.analyticsService.recordSearchWithIntent(query, finalResults, isEducationalQuery, userId);

        return {
            searchQuery: query,
            results: finalResults,
            totalResults: finalResults.length,
            recommendations: recommendations,
            isEducationalQuery: isEducationalQuery
        };
    }

    isEducationalQuery(query) {
        // ✅ MEJORA: Lista ampliada de palabras clave que indican una consulta educativa
        const educationalKeywords = [
            // Conceptos académicos
            'qué es', 'cómo', 'por qué', 'para qué', 'cuándo', 'dónde',
            'explica', 'explicación', 'definición', 'concepto',

            // Materiales y recursos de estudio
            'libro', 'pdf', 'material', 'recurso', 'guía', 'manual',
            'apuntes', 'bibliografía', 'lectura',

            // Cursos y temas académicos
            'curso', 'materia', 'asignatura', 'tema', 'tópico', 'unidad',
            'lección', 'capítulo', 'módulo',

            // Institucional
            'carrera', 'programa', 'malla', 'curricular', 'plan de estudios',
            'créditos', 'semestre', 'ciclo',

            // Personas académicas
            'profesor', 'docente', 'instructor', 'maestro', 'catedrático',

            // Actividades académicas
            'clase', 'horario', 'examen', 'evaluación', 'tarea', 'trabajo',
            'práctica', 'laboratorio', 'taller', 'seminario',

            // Conceptos de aprendizaje
            'aprender', 'estudiar', 'entender', 'comprender', 'resolver',
            'ejercicio', 'problema', 'ejemplo', 'demostración'
        ];

        const queryLowerCase = query.toLowerCase();
        if (educationalKeywords.some(keyword => queryLowerCase.includes(keyword))) {
            return true;
        }

        // 2. ✅ MEJORA: Comprobar si la búsqueda coincide con una entidad educativa conocida.
        // Si el usuario busca "Calculo 1" o "Profesor X", es una consulta educativa.
        if (this.analyticsService && this.analyticsService.classifySearchTerm) {
            const classification = this.analyticsService.classifySearchTerm(query);
            // Si NO es 'General', significa que es un Curso, Tema, Carrera o Docente -> Es Educativo.
            if (classification !== 'General') {
                return true;
            }
        }

        return false;
    }
}

module.exports = SearchService;
