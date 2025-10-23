const CourseRepository = require('../../domain/repositories/courseRepository');
const AnalyticsService = require('../../domain/services/analyticsService');
const RecommendationService = require('../../domain/services/recommendationService');

class SearchService {
    constructor(analyticsService) { // ✅ CORRECCIÓN: Aceptar analyticsService como dependencia
        this.courseRepository = new CourseRepository();
        this.analyticsService = analyticsService; // Usar la instancia recibida
        this.recommendationService = new RecommendationService(this.courseRepository); // ✅ CORRECCIÓN: Pasar la dependencia
    }

    async searchCourses(query) {
        try {
            console.log('🔍 SearchService: Buscando:', query);
            
            if (!query || query.trim() === '') {
                const allCourses = await this.getAllCourses();
                return {
                    results: allCourses,
                    suggestions: '',
                    totalResults: allCourses.length,
                    searchQuery: ''
                };
            }

            let results = await this.courseRepository.search(query);
            
            // REGISTRAR EN ANALYTICS CON INTENCIÓN
            await this.analyticsService.recordSearchWithIntent(query, results);
            
            // GENERAR SUGERENCIAS INTELIGENTES
            const suggestions = await this.recommendationService.getSuggestionMessage(query, results);
            
            // ✅ LÓGICA REFACTORIZADA: Determinar la intención primero, independientemente de los resultados.
            const intent = this.analyticsService.inferIntentFromQuery(query);
            const isEducationalQuery = (intent === 'duda_teorica' || intent === 'consulta_general');

            // Si la búsqueda inicial no arrojó resultados, intentar una búsqueda más amplia por concepto.
            if (results.length === 0) {
                console.log('🧠 Búsqueda educativa detectada. Intentando búsqueda por concepto...');
                
                // ✅ LÓGICA REFACTORIZADA: Extraer el concepto clave de forma más robusta.
                const fillerWords = [
                    'quiero', 'ejercicios', 'libro', 'libros', 'sobre', 'para', 'que', 'sirve', 'una', 'un', 'el', 'la', 'los', 'las', 
                    'qué', 'es', 'explicame', 'cómo', 'funciona', 'necesito', 'información', 'dame', 'acerca', 'del', 'tema'
                ];
                
                const words = query.toLowerCase().split(' ');
                const conceptWords = words.filter(word => !fillerWords.includes(word));
                const concept = conceptWords.join(' ').trim();
                
                console.log(`💡 Concepto extraído: "${concept}"`);
                
                if (concept) {
                    // Realizar una segunda búsqueda solo con el concepto clave.
                    const relatedCourses = await this.courseRepository.search(concept);
                    results = relatedCourses; // Usar estos resultados si se encuentran.
                }
            }

            return {
                results,
                suggestions,
                totalResults: results.length,
                searchQuery: query,
                // La bandera ahora es verdadera si la intención es educativa, incluso si se encontraron cursos.
                isEducationalQuery,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Error buscando cursos:', error);
            throw new Error('Error en búsqueda: ' + error.message);
        }
    }

    async getAllCourses() {
        try {
            const courses = await this.courseRepository.findAll();
            console.log('📊 SearchService: Cursos encontrados:', courses.length);
            return courses;
        } catch (error) {
            console.error('❌ Error en SearchService.getAllCourses:', error);
            throw new Error('Error obteniendo cursos: ' + error.message);
        }
    }

    async getCourseById(id) {
        try {
            console.log('🔍 SearchService: Buscando curso ID:', id);
            const course = await this.courseRepository.findById(id);
            if (!course) {
                throw new Error('Curso no encontrado');
            }
            return course;
        } catch (error) {
            console.error('❌ Error en SearchService.getCourseById:', error);
            throw error;
        }
    }

    async addCourse(courseData) {
        try {
            console.log('➕ SearchService: Agregando curso:', courseData.nombre);
            
            if (!courseData.nombre || !courseData.carrera) {
                throw new Error('Nombre y carrera son obligatorios');
            }

            const newCourse = await this.courseRepository.create(courseData);
            console.log('✅ SearchService: Curso agregado exitosamente');
            return newCourse;
        } catch (error) {
            console.error('❌ Error en SearchService.addCourse:', error);
            throw error;
        }
    }

    async updateCourse(id, courseData) {
        try {
            console.log('✏️ SearchService: Actualizando curso ID:', id);
            const updatedCourse = await this.courseRepository.update(id, courseData);
            if (!updatedCourse) {
                throw new Error('Curso no encontrado para actualizar');
            }
            console.log('✅ SearchService: Curso actualizado exitosamente');
            return updatedCourse;
        } catch (error) {
            console.error('❌ Error en SearchService.updateCourse:', error);
            throw error;
        }
    }

    async deleteCourse(id) {
        try {
            console.log('🗑️ SearchService: Eliminando curso ID:', id);
            const deletedCourse = await this.courseRepository.delete(id);
            if (!deletedCourse) {
                throw new Error('Curso no encontrado para eliminar');
            }
            console.log('✅ SearchService: Curso eliminado exitosamente');
            return deletedCourse;
        } catch (error) {
            console.error('❌ Error en SearchService.deleteCourse:', error);
            throw error;
        }
    }

    // Obtener analytics para el dashboard
    async getSearchAnalytics() {
        try {
            return await this.analyticsService.getCompleteAnalytics();
        } catch (error) {
            console.error('❌ Error obteniendo analytics:', error);
            throw new Error('Error obteniendo analytics');
        }
    }
}

module.exports = SearchService;