const SearchService = require('../../domain/services/searchService');
const AdminService = require('../../domain/services/adminService'); // Importar el nuevo servicio
const GeminiService = require('../../domain/services/mlService'); // ✅ RENOMBRADO: Para evitar conflictos.
const supabase = require('../../infrastructure/config/supabaseClient'); // ✅ IMPORTAR CLIENTE SUPABASE
const mediaController = require('./mediaController'); // ✅ NUEVO: Para subida centralizada a GCS
const DriveService = require('../../domain/services/driveService'); // ✅ NUEVO: Para extracción de miniaturas
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
        this.getMedicalBooks = this.getMedicalBooks.bind(this); // ✅ NUEVO
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
        this.getResourceById = this.getResourceById.bind(this); // ✅ NUEVO
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
            if (error.code === 'ENOTFOUND' || error.syscall === 'getaddrinfo') {
                console.warn('⚠️ Fallo de conexión al obtener cursos: Red inestable.');
            } else {
                console.error('Error in getCourses:', error);
            }
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

    async getResourceById(req, res) {
        try {
            const id = parseInt(req.params.id, 10);
            const resource = await this.adminService.getById('book', id);
            if (!resource) return res.status(404).json({ error: 'Recurso no encontrado' });
            res.json(resource);
        } catch (error) {
            console.error('Error in getResourceById:', error);
            res.status(500).json({ error: `Error al obtener el recurso: ${error.message}` });
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
            const { type } = req.query; // ✅ Soporte para filtrado
            const books = await this.adminService.getAll('book', { type });
            res.json(books);
        } catch (error) {
            if (error.code === 'ENOTFOUND' || error.syscall === 'getaddrinfo') {
                console.warn('⚠️ Fallo de conexión al obtener libros: Red inestable.');
            } else {
                console.error('❌ Error al obtener los libros:', error);
            }
            res.status(500).json({ message: 'Error al obtener los libros' });
        }
    }

    async getMedicalBooks(req, res) {
        try {
            // Usamos repo directo via adminService (consistente con otros métodos 'hacky' pero efectivos del controlador)
            const bookRepo = this.adminService._getRepository('book');

            // ✅ CORRECCIÓN PROFESIONAL: 
            // En lugar de adivinar carreras individuales (Enfermería, Medicina, etc.),
            // filtramos directamente por el ÁREA DE ESTUDIO "Ciencias de la Salud".
            // Esto incluye automáticamente Obstetricia, Nutrición, etc.
            const areaKeywords = ['Ciencias de la Salud'];

            // ✅ Aumento de límite para mostrar todo el catálogo actual (36+) y futuro cercano.
            // Idealmente esto debería ser paginado en el futuro.
            const books = await bookRepo.findByArea(areaKeywords, 100);
            res.json(books);
        } catch (error) {
            console.error('❌ Error al obtener libros de medicina:', error);
            res.status(500).json({ message: 'Error al obtener libros de medicina' });
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

    /**
     * ✅ NUEVO: Procesa una URL para detectar si es de Drive y extraer su miniatura de forma persistente.
     * @param {string} url - La URL del recurso.
     * @param {string} currentImageUrl - La imagen actual o recién subida manualmente.
     * @returns {Promise<string|null>} - La nueva URL de la imagen (GCS).
     */
    async _handleDriveThumbnail(url, currentImageUrl) {
        // 1. Si ya se subió una imagen manual en este request, NO sobreescribir.
        if (currentImageUrl) return currentImageUrl;
        if (!url) return null;
 
        // 2. Extraer ID de archivo de Drive
        const fileId = DriveService.extractFileId(url);
        if (!fileId) return null;
 
        try {
            console.log(`📡 [Drive] Detectado recurso de Drive (${fileId}). Intentando extraer miniatura...`);
            const thumbData = await DriveService.downloadThumbnailBuffer(fileId);
            
            if (thumbData && thumbData.buffer) {
                // Persistir en GCS (Optimizado a WebP)
                const persistentUrl = await mediaController.uploadBuffer(
                    thumbData.buffer,
                    `${fileId}.jpg`,
                    thumbData.mimeType,
                    'thumbnails'
                );
                console.log(`✅ [Drive] Miniatura extraída y persistida: ${persistentUrl}`);
                return persistentUrl;
            }
        } catch (error) {
            console.warn(`⚠️ [Drive] Error extrayendo miniatura para ${fileId}:`, error.message);
        }
        return null;
    }
 
    // --- Métodos CRUD Genéricos para el Panel de Administración ---

    async createEntity(req, res, entityType) {
        try {
            // ✅ LÓGICA MEJORADA: Si se crea un instructor o alumno, devolver la contraseña temporal.
            if (entityType === 'student') {
                return this.createInstructorOrStudent(req, res, entityType);
            }

            // ✅ LÓGICA REHECHA: La creación de una entidad ahora solo se encarga de crearla.
            // Se ha eliminado por completo la llamada a GeminiService desde aquí, ya que era incorrecta.

            // ✅ MANEJO DE ARCHIVOS: SUBIDA CENTRALIZADA A GCS
            if (req.file) {
                const folderMap = {
                    'book': 'recursos',
                    'course': 'cursos',
                    'career': 'carreras',
                    'resource': 'recursos',
                    'other': 'recursos'
                };
                const subFolder = folderMap[entityType] || 'recursos';

                if (['book', 'course', 'career', 'resource', 'other'].includes(entityType)) {
                    try {
                        // Usar el controlador de medios para subir a Google Cloud Storage
                        req.body.image_url = await mediaController.uploadFile(req.file, subFolder);
                    } catch (err) {
                        console.error('❌ Error subiendo a GCS en creación:', err);
                        // No bloqueamos la creación por una imagen, pero informamos en consola
                    }
                }
            }

            // ✅ CRITICAL BUGFIX: Parsear arrays enviados corre FormData (strings JSON)
            if (typeof req.body.bookIds === 'string') {
                try { req.body.bookIds = JSON.parse(req.body.bookIds); } catch (e) { req.body.bookIds = []; }
            }
            if (typeof req.body.careerIds === 'string') {
                try { req.body.careerIds = JSON.parse(req.body.careerIds); } catch (e) { req.body.careerIds = []; }
            }
            // ✅ NUEVO: Parsear topicIds (usado para recursos)
            if (typeof req.body.topicIds === 'string') {
                try { req.body.topicIds = JSON.parse(req.body.topicIds); } catch (e) { req.body.topicIds = []; }
            }
            // ✅ NUEVO: Parsear courseIds (usado para recursos)
            if (typeof req.body.courseIds === 'string') {
                try { req.body.courseIds = JSON.parse(req.body.courseIds); } catch (e) { req.body.courseIds = []; }
            }
            // ✅ NUEVO: Parsear is_premium (FormData envía strings)
            if (req.body.is_premium !== undefined) {
                req.body.is_premium = req.body.is_premium === 'true';
            }
            
            // ✅ NUEVO: Fallback para recursos visuales (infografías)
            // Si no hay URL pero hay imagen, la imagen ES el recurso.
            if (entityType === 'book' && (!req.body.url || req.body.url.trim() === '')) {
                if (req.body.image_url) {
                    req.body.url = req.body.image_url;
                }
            }
 
            // ✅ NUEVO: EXTRACCIÓN AUTOMÁTICA DE MINIATURA (Drive)
            if (entityType === 'book' && req.body.url) {
                const driveThumb = await this._handleDriveThumbnail(req.body.url, req.body.image_url);
                if (driveThumb) req.body.image_url = driveThumb;
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

            // ✅ MANEJO DE ARCHIVOS: SUBIDA CENTRALIZADA A GCS (Update)
            // ✅ GESTIÓN DE IMÁGENES GCS (si existe archivo o se mandó borrar)
            const shouldDelete = req.body.deleteImage === 'true' || (req.body.image_url === '' && req.method === 'PUT');

            if (req.file || shouldDelete) {
                // 1. Obtener item actual para limpieza
                const oldItem = await this.adminService.getById(entityType, entityId);
                const currentImg = oldItem?.image_url;

                if (req.file) {
                    try {
                        // Borrar antigua si existe
                        if (currentImg) await mediaController.deleteFile(currentImg);
                        
                        // Subir nueva versión a GCS (Auto-optimizada a WebP)
                        const folderMap = {
                            'book': 'recursos',
                            'course': 'cursos',
                            'career': 'carreras',
                            'resource': 'recursos'
                        };
                        const subFolder = folderMap[entityType] || 'recursos';
                        req.body.image_url = await mediaController.uploadFile(req.file, subFolder);
                    } catch (err) {
                        console.error('❌ Error gestionando imagen GCS en actualización:', err);
                    }
                } else if (shouldDelete) {
                    // CASO: Borrado explícito o flag vacío
                    if (currentImg) await mediaController.deleteFile(currentImg);
                    req.body.image_url = null;
                }
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
            // ✅ NUEVO: Parsear topicIds
            if (typeof req.body.topicIds === 'string') {
                try {
                    req.body.topicIds = JSON.parse(req.body.topicIds);
                } catch (e) {
                    console.error('Error parsing topicIds:', e);
                    req.body.topicIds = []; // Fallback seguro
                }
            }
            // ✅ NUEVO: Parsear courseIds
            if (typeof req.body.courseIds === 'string') {
                try {
                    req.body.courseIds = JSON.parse(req.body.courseIds);
                } catch (e) {
                    console.error('Error parsing courseIds:', e);
                    req.body.courseIds = []; // Fallback seguro
                }
            }
            // ✅ NUEVO: Parsear is_premium (FormData envía strings)
            if (req.body.is_premium !== undefined) {
                req.body.is_premium = req.body.is_premium === 'true';
            }

            // ✅ NUEVO: Fallback para recursos visuales (infografías) en UPDATE
            if (entityType === 'book' && (!req.body.url || req.body.url.trim() === '')) {
                if (req.body.image_url) {
                    req.body.url = req.body.image_url;
                }
            }
 
            // ✅ NUEVO: EXTRACCIÓN AUTOMÁTICA DE MINIATURA (Drive Update)
            if (entityType === 'book' && req.body.url) {
                const driveThumb = await this._handleDriveThumbnail(req.body.url, req.body.image_url);
                if (driveThumb) req.body.image_url = driveThumb;
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

            // ✅ CLEANUP: Borrar imagen de GCS si existe
            const oldItem = await this.adminService.getById(entityType, entityId);
            if (oldItem && oldItem.image_url) {
                try {
                    await mediaController.deleteFile(oldItem.image_url);
                } catch (err) {
                    console.error('Error deleting image on entity delete:', err);
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