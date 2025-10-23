const SearchService = require('../services/searchService');
const AnalyticsService = require('../../domain/services/analyticsService');

// ✅ CORRECCIÓN: Instanciar AnalyticsService aquí y pasarlo como dependencia
const analyticsService = new AnalyticsService();
const searchService = new SearchService(analyticsService);

class CoursesController {
    async getAllCourses(req, res) {
        try {
            const courses = await searchService.getAllCourses();
            console.log('📤 Controlador: Enviando todos los cursos');
            res.json(courses);
        } catch (error) {
            console.error('❌ Controlador Error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async searchCourses(req, res) {
        try {
            const query = req.query.q || '';
            // ✅ CORRECCIÓN: Llamar al servicio y devolver su resultado completo.
            // El servicio ya se encarga de registrar la analítica y detectar la intención.
            const searchResults = await searchService.searchCourses(query);
            console.log(`🔎 Controlador: Búsqueda "${query}" - ${searchResults.totalResults} resultados`);
            res.json(searchResults); // Ahora devuelve objeto con resultados + sugerencias
            
        } catch (error) {
            console.error('❌ Controlador Error búsqueda:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async getCourseById(req, res) {
        try {
            const course = await searchService.getCourseById(req.params.id);
            res.json(course);
        } catch (error) {
            console.error('❌ Controlador Error obteniendo curso:', error);
            res.status(404).json({ error: error.message });
        }
    }

    async addCourse(req, res) {
        try {
            const newCourse = await searchService.addCourse(req.body);
            console.log('✅ Controlador: Curso agregado:', newCourse.nombre);
            res.status(201).json({ 
                message: 'Curso agregado exitosamente', 
                curso: newCourse 
            });
        } catch (error) {
            console.error('❌ Controlador Error agregando curso:', error);
            res.status(400).json({ error: error.message });
        }
    }

    async updateCourse(req, res) {
        try {
            const updatedCourse = await searchService.updateCourse(req.params.id, req.body);
            console.log('✏️ Controlador: Curso actualizado:', updatedCourse.nombre);
            res.json({ 
                message: 'Curso actualizado exitosamente', 
                curso: updatedCourse 
            });
        } catch (error) {
            console.error('❌ Controlador Error actualizando curso:', error);
            res.status(400).json({ error: error.message });
        }
    }

    async deleteCourse(req, res) {
        try {
            const deletedCourse = await searchService.deleteCourse(req.params.id);
            console.log('🗑️ Controlador: Curso eliminado:', deletedCourse.nombre);
            res.json({ 
                message: 'Curso eliminado exitosamente', 
                curso: deletedCourse 
            });
        } catch (error) {
            console.error('❌ Controlador Error eliminando curso:', error);
            res.status(404).json({ error: error.message });
        }
    }

    // NUEVO: Obtener analytics de búsquedas
    async getSearchAnalytics(req, res) {
        try {
            const analytics = await searchService.getSearchAnalytics();
            console.log('📊 Controlador: Enviando analytics');
            res.json(analytics);
        } catch (error) {
            console.error('❌ Controlador Error analytics:', error);
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new CoursesController();