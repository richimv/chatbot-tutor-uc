const SearchService = require('../services/searchService');
const AdminService = require('../services/adminService'); // Importar el nuevo servicio
const GeminiService = require('../../domain/services/mlService'); // ✅ RENOMBRADO: Para evitar conflictos.

const searchService = new SearchService();
const adminService = new AdminService();

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
            if (!query) {
                return res.status(400).json({ error: 'El parámetro de búsqueda "q" es requerido.' });
            }

            // ✅ PASAR EL USUARIO AL SERVICIO DE BÚSQUEDA
            // El servicio de búsqueda ahora orquesta todo: búsqueda, analytics y recomendaciones.
            const finalResponse = await searchService.searchCourses(query, req.user);
            res.json(finalResponse);
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
        console.error('❌ Error al obtener las secciones:', error);
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

    // ✅ NUEVO: Controlador para obtener alumnos.
    async getStudents(req, res) {
        try {
            const students = await adminService.getAll('student');
            res.json(students);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener los alumnos' });
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
        console.error('❌ Error al obtener los libros:', error);
        res.status(500).json({ message: 'Error al obtener los libros' });
    }
}

    async getCourseDescription(req, res) {
        try {
            // ✅ CORRECCIÓN: Convertir el ID de string a número.
            const courseId = parseInt(req.params.id, 10);
            // Usamos adminService que ya está instanciado y es consistente con getTopicDescription
            const course = await adminService.getById('course', courseId);
            if (!course) {
                return res.status(404).json({ error: 'Curso no encontrado' });
            }
            // Llamamos al servicio de ML para generar la descripción
            const description = await GeminiService.generateCourseDescription(course.name);
            res.json({ description });
        } catch (error) {
            res.status(500).json({ error: 'Error al generar la descripción del curso' });
        }
    }

    async getTopicDescription(req, res) {
        try {
            // ✅ CORRECCIÓN: Convertir el ID de string a número.
            const topicId = parseInt(req.params.id, 10);
            const topic = await adminService.getById('topic', topicId);
            if (!topic) {
                return res.status(404).json({ error: 'Tema no encontrado' });
            }
            const description = await GeminiService.generateTopicDescription(topic.name);
            res.json({ description });
        } catch (error) {
            res.status(500).json({ error: 'Error al generar la descripción del tema' });
        }
    }

    // --- Métodos CRUD Genéricos para el Panel de Administración ---

    async createEntity(req, res, entityType) {
        try {
            // ✅ LÓGICA MEJORADA: Si se crea un instructor o alumno, devolver la contraseña temporal.
            if (entityType === 'instructor' || entityType === 'student') {
                return this.createInstructorOrStudent(req, res, entityType);
            }

            // ✅ LÓGICA REHECHA: La creación de una entidad ahora solo se encarga de crearla.
            // Se ha eliminado por completo la llamada a GeminiService desde aquí, ya que era incorrecta.
            const newItem = await adminService.create(entityType, req.body);
            res.status(201).json(newItem);
        } catch (error) {
            // Si adminService.create falla, se salta directamente a este bloque, evitando la llamada a la IA.
            res.status(400).json({ error: error.message });
        }
    }

    // ✅ NUEVO: Método específico para manejar la creación de usuarios y la contraseña temporal.
    async createInstructorOrStudent(req, res, role) {
        try {
            const newUser = await adminService.create(role, req.body);
            res.status(201).json(newUser);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    // ✅ NUEVO: Endpoint para proveer datos consolidados al servicio de ML.
    async getDataForML(req, res) {
        try {
            // Usamos Promise.all para cargar todo en paralelo.
            const [courses, topics] = await Promise.all([
                adminService.getAll('course'),
                adminService.getAll('topic')
            ]);
            res.json({ courses, topics });
        } catch (error) {
            console.error('❌ Error al obtener datos para el servicio de ML:', error);
            res.status(500).json({ error: 'No se pudieron obtener los datos para ML.' });
        }
    }

    async updateEntity(req, res, entityType) {
        try {
            // ✅ CORRECCIÓN: Convertir el ID de string a número.
            const entityId = parseInt(req.params.id, 10);
            const updatedItem = await adminService.update(entityType, entityId, req.body);
            res.json(updatedItem);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async deleteEntity(req, res, entityType) {
        try {
            // ✅ CORRECCIÓN: Convertir el ID de string a número.
            const entityId = parseInt(req.params.id, 10);
            await adminService.delete(entityType, entityId);
            res.status(204).send(); // 204 No Content
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
}

module.exports = new CoursesController();