const SearchService = require('../services/searchService');
const AnalyticsService = require('../../domain/services/analyticsService');
const AdminService = require('../services/adminService'); // Importar el nuevo servicio
const MLService = require('../../domain/services/mlService');

const analyticsService = new AnalyticsService();
const searchService = new SearchService(analyticsService);
const adminService = new AdminService(); // Instanciar el servicio de admin

class CoursesController {
    async getAllCourses(req, res) {
        // Este método sigue siendo útil para obtener la lista completa sin formato de búsqueda
        try {
            const courses = await searchService.getAllCourses();
            res.json(courses);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener los cursos' });
        }
    }

    async searchCourses(req, res) {
        try {
            const query = req.query.q;
            const results = await searchService.searchCourses(query);
            res.json(results);
        } catch (error) {
            console.error('❌ Controlador Error búsqueda:', error);
            res.status(500).json({ error: 'Error al buscar cursos' });
        }
    }

    async getCareers(req, res) {
        try {
            const careers = await adminService.getAll('career');
            res.json(careers);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener las carreras' });
        }
    }

    async getCourses(req, res) {
        try {
            const courses = await adminService.getAll('course');
            res.json(courses);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener los cursos base' });
        }
    }

    async getSections(req, res) {
        try {
            const sections = await adminService.getAll('section');
            res.json(sections);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener las secciones' });
        }
    }

    async getInstructors(req, res) {
        try {
            const instructors = await adminService.getAll('instructor');
            res.json(instructors);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener los docentes' });
        }
    }

    async getTopics(req, res) {
        try {
            const topics = await adminService.getAll('topic');
            res.json(topics);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener los temas' });
        }
    }

    async getBooks(req, res) {
        try {
            const books = await adminService.getAll('book'); // ✅ CORREGIDO: Usar adminService
            res.json(books);
        } catch (error) {
            res.status(500).json({ message: 'Error al obtener los libros' });
        }
    }

    async getTopicDescription(req, res) {
        try {
            const { id } = req.params;
            const topic = await adminService.getById('topic', id);
            if (!topic) {
                return res.status(404).json({ error: 'Tema no encontrado' });
            }
            const description = await MLService.generateTopicDescription(topic.name);
            res.json({ description });
        } catch (error) {
            res.status(500).json({ error: 'Error al generar la descripción del tema' });
        }
    }

    // --- Métodos CRUD Genéricos para el Panel de Administración ---

    async createEntity(req, res, entityType) {
        try {
            const newItem = await adminService.create(entityType, req.body);
            res.status(201).json(newItem);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async updateEntity(req, res, entityType) {
        try {
            const { id } = req.params;
            const updatedItem = await adminService.update(entityType, id, req.body);
            res.json(updatedItem);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async deleteEntity(req, res, entityType) {
        try {
            const { id } = req.params;
            await adminService.delete(entityType, id);
            res.status(204).send(); // 204 No Content
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
}

module.exports = new CoursesController();