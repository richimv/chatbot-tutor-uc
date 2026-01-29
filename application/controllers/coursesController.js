const SearchService = require('../../domain/services/searchService');
const AdminService = require('../../domain/services/adminService'); // Importar el nuevo servicio
const GeminiService = require('../../domain/services/mlService'); // ✅ RENOMBRADO: Para evitar conflictos.
const supabase = require('../../infrastructure/config/supabaseClient'); // ✅ IMPORTAR CLIENTE SUPABASE
const fs = require('fs');
const path = require('path');

class CoursesController {
    constructor(searchService, adminService) {
        this.searchService = searchService;
        this.adminService = adminService;

        // ✅ SOLUCIÓN: Bindeo explícito de todos los métodos para mantener el contexto 'this'.
        this.getAllCourses = this.getAllCourses.bind(this);
        this.searchCourses = this.searchCourses.bind(this);
        this.getCareers = this.getCareers.bind(this);
        this.getCourses = this.getCourses.bind(this);

        this.getStudents = this.getStudents.bind(this);
        this.getTopics = this.getTopics.bind(this);
        this.getBooks = this.getBooks.bind(this);
        this.getCourseDescription = this.getCourseDescription.bind(this);
        // this.getTopicDescription = this.getTopicDescription.bind(this); // ❌ REMOVED: Feature deprecated
        this.createEntity = this.createEntity.bind(this);
        this.updateEntity = this.updateEntity.bind(this);
        this.deleteEntity = this.deleteEntity.bind(this);
        this.getDataForML = this.getDataForML.bind(this);

        // ✅ FIX: Bind new detail methods
        this.getCareerById = this.getCareerById.bind(this);
        this.getCourseById = this.getCourseById.bind(this);
        this.getTopicById = this.getTopicById.bind(this);
    }
    async getAllCourses(req, res) {
        // Este método sigue siendo útil para obtener la lista completa sin formato de búsqueda
        try {
            const courses = await this.searchService.getAllCourses();
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
            const finalResponse = await this.searchService.searchCourses(query, req.user);
            res.json(finalResponse);
        } catch (error) {
            console.error('❌ Controlador Error búsqueda:', error);
            res.status(500).json({ error: 'Error al buscar cursos' });
        }
    }

    async getCareers(req, res) {
        try {
            const careers = await this.adminService.getAll('career');
            res.json(careers);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener las carreras' });
        }
    }

    async getCourses(req, res) {
        try {
            const courses = await this.adminService.getAll('course');
            res.json(courses);
        } catch (error) {
            console.error('Error in getCourses:', error);
            res.status(500).json({ error: `Error al obtener los cursos base: ${error.message}` });
        }
    }



    // ✅ NUEVO: Controlador para obtener alumnos.
    async getStudents(req, res) {
        try {
            const students = await this.adminService.getAll('student');
            res.json(students);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener los alumnos' });
        }
    }

    async getTopics(req, res) {
        try {
            const topics = await this.adminService.getAll('topic');
            res.json(topics);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener los temas' });
        }
    }

    // ✅ NUEVO: Métodos para obtener entidades por ID (para páginas de detalle)


    async getCareerById(req, res) {
        try {
            const id = parseInt(req.params.id, 10);
            const career = await this.adminService.getById('career', id);

            if (!career) return res.status(404).json({ error: 'Carrera no encontrada' });

            // ✅ FIX: Fetch courses related to this career
            // We use the search service or directly the repository to find courses by career name
            // Since we have searchService, let's use it or adminService's repo if accessible.
            // Accessing repo directly via adminService (a bit hacky but efficient for now)
            const courseRepo = this.adminService._getRepository('course');

            // We need a method to find by career. Using explicit ID search now.
            const courses = await courseRepo.findByCareerId(career.id);

            career.courses = courses;

            res.json(career);
        } catch (error) {
            console.error('Error in getCareerById:', error);
            res.status(500).json({ error: `Error al obtener la carrera: ${error.message}` });
        }
    }

    async getCourseById(req, res) {
        try {
            const id = parseInt(req.params.id, 10);

            // 1. Obtener curso con temas y materiales (gracias al nuevo repositorio)
            const course = await this.adminService.getById('course', id);

            if (!course) return res.status(404).json({ error: 'Curso no encontrado' });



            res.json(course);
        } catch (error) {
            console.error('Error in getCourseById:', error);
            res.status(500).json({ error: `Error al obtener el curso: ${error.message}` });
        }
    }

    async getTopicById(req, res) {
        try {
            const id = parseInt(req.params.id, 10);
            const topic = await this.adminService.getById('topic', id);
            if (!topic) return res.status(404).json({ error: 'Tema no encontrado' });
            res.json(topic);
        } catch (error) {
            console.error('Error in getTopicById:', error);
            res.status(500).json({ error: `Error al obtener el tema: ${error.message}` });
        }
    }

    async getBooks(req, res) {
        try {
            const books = await this.adminService.getAll('book'); // ✅ CORREGIDO: Usar adminService
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
            const course = await this.adminService.getById('course', courseId);
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

    /*
    async getTopicDescription(req, res) {
       // ❌ DEPRECATED: Topic pages no longer exist.
       res.status(404).json({ error: 'Endpoint deprecated' });
    }
    */

    // --- Métodos CRUD Genéricos para el Panel de Administración ---

    async createEntity(req, res, entityType) {
        try {
            // ✅ LÓGICA MEJORADA: Si se crea un instructor o alumno, devolver la contraseña temporal.
            if (entityType === 'student') {
                return this.createInstructorOrStudent(req, res, entityType);
            }

            // ✅ LÓGICA REHECHA: La creación de una entidad ahora solo se encarga de crearla.
            // Se ha eliminado por completo la llamada a GeminiService desde aquí, ya que era incorrecta.

            // ✅ MANEJO DE ARCHIVOS: SUBIDA A SUPABASE (Creación)
            // ✅ MANEJO DE ARCHIVOS: SUBIDA A LOCAL (Creación)
            if (req.file) {
                const folderMap = {
                    'book': 'libros',
                    'course': 'cursos',
                    'career': 'carreras'
                };
                const subFolder = folderMap[entityType] || 'uploads';

                if (['book', 'course', 'career'].includes(entityType)) {
                    // Asegurar directorio
                    const uploadDir = path.join(__dirname, '../../presentation/public/assets', subFolder);
                    if (!fs.existsSync(uploadDir)) {
                        fs.mkdirSync(uploadDir, { recursive: true });
                    }

                    const fileName = `${Date.now()}-${req.file.originalname.replace(/[^a-z0-9.]/gi, '_').toLowerCase()}`;
                    const fullPath = path.join(uploadDir, fileName);

                    fs.writeFileSync(fullPath, req.file.buffer);

                    // URL Relativa
                    req.body.image_url = `assets/${subFolder}/${fileName}`;
                } else {
                    // Fallback
                }
            }

            // ✅ CRITICAL BUGFIX: Parsear arrays enviados corre FormData (strings JSON)
            if (typeof req.body.bookIds === 'string') {
                try { req.body.bookIds = JSON.parse(req.body.bookIds); } catch (e) { req.body.bookIds = []; }
            }
            if (typeof req.body.careerIds === 'string') {
                try { req.body.careerIds = JSON.parse(req.body.careerIds); } catch (e) { req.body.careerIds = []; }
            }

            const newItem = await this.adminService.create(entityType, req.body);
            res.status(201).json(newItem);
        } catch (error) {
            // Si adminService.create falla, se salta directamente a este bloque, evitando la llamada a la IA.
            res.status(400).json({ error: error.message });
        }
    }

    // ✅ NUEVO: Método específico para manejar la creación de usuarios y la contraseña temporal.
    async createInstructorOrStudent(req, res, role) {
        try {
            const newUser = await this.adminService.create(role, req.body);
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
                this.adminService.getAll('course'),
                this.adminService.getAll('topic')
            ]);
            res.json({ courses, topics });
        } catch (error) {
            console.error('❌ Error al obtener datos para el servicio de ML:', error);
            res.status(500).json({ error: 'No se pudieron obtener los datos para ML.' });
        }
    }

    async updateEntity(req, res, entityType) {
        try {
            // ✅ SOLUCIÓN: El ID es un UUID para usuarios (docentes/alumnos) pero un número para otras entidades.
            const entityId = (entityType === 'student')
                ? req.params.id
                : parseInt(req.params.id, 10);

            // ✅ MANEJO DE ARCHIVOS: SUBIDA A SUPABASE
            // ✅ MANEJO DE ARCHIVOS: SUBIDA A SISTEMA DE ARCHIVOS LOCAL (Assets)
            // Reemplaza la lógica anterior de Supabase para ahorrar ancho de banda.
            if (req.file) {
                // Mapeo de Entidad a Carpeta
                const folderMap = {
                    'book': 'libros',
                    'course': 'cursos',
                    'career': 'carreras'
                };
                const subFolder = folderMap[entityType] || 'uploads';

                // CASO 1: Subida de nueva imagen
                if (['book', 'course', 'career'].includes(entityType)) {
                    const oldItem = await this.adminService.getById(entityType, entityId);

                    // Borrar imagen anterior (Local o Supabase)
                    if (oldItem && oldItem.image_url) {
                        try {
                            const oldUrl = oldItem.image_url;
                            if (oldUrl.includes('supabase.co')) {
                                // Borrar de Supabase legacy
                                const oldPath = oldUrl.split('/portadas/')[1];
                                await supabase.storage.from('portadas').remove([oldPath]);
                            } else if (!oldUrl.startsWith('http')) {
                                // Borrar archivo local
                                // Asumimos URL relativa como "assets/cursos/foto.jpg"
                                const oldLocalPath = path.join(__dirname, '../../presentation/public', oldUrl);
                                if (fs.existsSync(oldLocalPath)) {
                                    fs.unlinkSync(oldLocalPath);
                                }
                            }
                        } catch (err) { console.error('Error deleting old image:', err); }
                    }

                    // Guardar nueva imagen localmente
                    const uploadDir = path.join(__dirname, '../../presentation/public/assets', subFolder);
                    if (!fs.existsSync(uploadDir)) {
                        fs.mkdirSync(uploadDir, { recursive: true });
                    }

                    const fileName = `${Date.now()}-${req.file.originalname.replace(/[^a-z0-9.]/gi, '_').toLowerCase()}`;
                    const fullPath = path.join(uploadDir, fileName);

                    fs.writeFileSync(fullPath, req.file.buffer);

                    // Guardar URL relativa en BD (accesible via http://domain/assets/...)
                    req.body.image_url = `assets/${subFolder}/${fileName}`;
                }
            } else if (['book', 'course', 'career'].includes(entityType) && req.body.deleteImage === 'true') {
                // CASO 2: Solicitud explícita de borrar imagen
                const oldItem = await this.adminService.getById(entityType, entityId);
                if (oldItem && oldItem.image_url) {
                    try {
                        const oldUrl = oldItem.image_url;
                        if (oldUrl.includes('supabase.co')) {
                            const oldPath = oldUrl.split('/portadas/')[1];
                            await supabase.storage.from('portadas').remove([oldPath]);
                        } else if (!oldUrl.startsWith('http')) {
                            const oldLocalPath = path.join(__dirname, '../../presentation/public', oldUrl);
                            if (fs.existsSync(oldLocalPath)) fs.unlinkSync(oldLocalPath);
                        }
                    } catch (err) { console.error(err); }
                }
                req.body.image_url = null; // Enviar NULL para borrar en BD
                delete req.body.image_url; // Wait, update handles undefined? No, explicit null is better if supported.
                // adminService.update filters undefined? Let's assume sending null updates it to null.
                req.body.image_url = null;
            }

            // ✅ CRITICAL BUGFIX: Cuando `FormData` envía arrays, los convierte en Strings JSON (e.g. "[1,2]").
            // Hay que parsearlos de vuelta a Array para que el servicio/ repositorio no falle (Error 500).
            if (typeof req.body.bookIds === 'string') {
                try {
                    req.body.bookIds = JSON.parse(req.body.bookIds);
                } catch (e) {
                    console.error('Error parsing bookIds:', e);
                    req.body.bookIds = []; // Fallback seguro
                }
            }
            if (typeof req.body.careerIds === 'string') {
                try {
                    req.body.careerIds = JSON.parse(req.body.careerIds);
                } catch (e) {
                    console.error('Error parsing careerIds:', e);
                    req.body.careerIds = []; // Fallback seguro
                }
            }

            const updatedItem = await this.adminService.update(entityType, entityId, req.body);
            res.json(updatedItem);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async deleteEntity(req, res, entityType) {
        try {
            // ✅ SOLUCIÓN: El ID es un UUID para usuarios (docentes/alumnos) pero un número para otras entidades.
            const entityId = (entityType === 'student')
                ? req.params.id
                : parseInt(req.params.id, 10);

            // ✅ CLEANUP: Borrar imagen de SUPABASE si es un libro
            // ✅ CLEANUP: Borrar imagen de SUPABASE si es un libro, curso o carrera
            if (['book', 'course', 'career'].includes(entityType)) {
                const oldItem = await this.adminService.getById(entityType, entityId);
                if (oldItem && oldItem.image_url) {
                    try {
                        const oldUrl = oldItem.image_url;
                        if (oldUrl.includes('supabase.co')) {
                            const oldPath = oldUrl.split('/portadas/')[1];
                            await supabase.storage.from('portadas').remove([oldPath]);
                        } else {
                            // Intento de borrado local legacy por si acaso
                            const oldPath = path.join(__dirname, '../../presentation/public', oldItem.image_url);
                            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
                        }
                    } catch (err) {
                        console.error('Error deleting image on entity delete:', err);
                    }
                }
            }

            await this.adminService.delete(entityType, entityId);
            res.status(204).send(); // 204 No Content
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
}

module.exports = CoursesController;