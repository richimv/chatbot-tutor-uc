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
        // ✅ SOLUCIÓN: Propiedades para almacenar los sets de nombres.
        this.courseNames = new Set();
        this.topicNames = new Set();
        this.careerNames = new Set();
        this.instructorNames = new Set();

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

        // Poblar los sets de nombres individuales
        courses.forEach(c => this.courseNames.add(normalizeText(c.name)));
        topics.forEach(t => this.topicNames.add(normalizeText(t.name)));
        careers.forEach(c => this.careerNames.add(normalizeText(c.name)));
        instructors.forEach(i => this.instructorNames.add(normalizeText(i.name)));
        const bookTitles = books.map(b => normalizeText(b.title));

        // El knowledgeBase general sigue siendo útil para validaciones rápidas.
        this.knowledgeBase = new Set([
            ...this.courseNames,
            ...this.topicNames,
            ...this.careerNames,
            ...this.instructorNames,
            ...bookTitles,
        ].filter(Boolean));

        console.log(`✅ Base de conocimiento local cargada con ${this.knowledgeBase.size} entidades.`);
        return this.knowledgeBase;
    }
}

module.exports = KnowledgeBaseRepository;