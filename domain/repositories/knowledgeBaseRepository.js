const { normalizeText } = require('../utils/textUtils');
// ✅ CORRECCIÓN: Importar los repositorios de base de datos en lugar de leer archivos.
const CourseRepository = require('./courseRepository');
const TopicRepository = require('./topicRepository');
const CareerRepository = require('./careerRepository');
const InstructorRepository = require('./instructorRepository');
const BookRepository = require('./bookRepository'); // ✅ SOLUCIÓN: Importar el repositorio de libros.

/**
 * Repositorio para cargar y acceder a una base de conocimiento local
 * con todas las entidades nombradas del sistema.
 */
class KnowledgeBaseRepository {
    constructor() {
        this.knowledgeBase = null;
        // Instanciar los repositorios que usaremos para cargar los datos.
        this.courseRepo = new CourseRepository();
        this.topicRepo = new TopicRepository();
        this.careerRepo = new CareerRepository();
        this.instructorRepo = new InstructorRepository();
        this.bookRepo = new BookRepository(); // ✅ SOLUCIÓN: Instanciar el repositorio de libros.
    }

    async load() {
        if (this.knowledgeBase) return this.knowledgeBase;

        // Cargar todas las entidades directamente desde la base de datos usando sus repositorios.
        const [courses, topics, careers, instructors, books] = await Promise.all([
            this.courseRepo.findAll(),
            this.topicRepo.findAll(),
            this.careerRepo.findAll(),
            this.instructorRepo.findAll(),
            this.bookRepo.findAll(), // ✅ SOLUCIÓN: Cargar también los libros.
        ]);

        this.knowledgeBase = new Set([
            ...courses.map(c => normalizeText(c.name)),
            ...topics.map(t => normalizeText(t.name)),
            ...careers.map(c => normalizeText(c.name)),
            ...instructors.map(i => normalizeText(i.name)),
            ...books.map(b => normalizeText(b.title)), // ✅ SOLUCIÓN: Añadir títulos de libros a la KB.
        ].filter(Boolean));

        console.log(`✅ Base de conocimiento local cargada con ${this.knowledgeBase.size} entidades.`);
        return this.knowledgeBase;
    }
}

module.exports = KnowledgeBaseRepository;