const { normalizeText } = require('../utils/textUtils');
// ✅ CORRECCIÓN: Importar los repositorios de base de datos en lugar de leer archivos.
const CourseRepository = require('./courseRepository');
const TopicRepository = require('./topicRepository');
const CareerRepository = require('./careerRepository');
const InstructorRepository = require('./instructorRepository');
const BookRepository = require('./bookRepository'); // ✅ SOLUCIÓN: Importar el repositorio de libros.
const SectionRepository = require('./sectionRepository'); // ✅ SOLUCIÓN: Importar el repositorio de secciones.

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
        this.sectionRepo = new SectionRepository(); // ✅ SOLUCIÓN: Instanciar el repositorio de secciones.
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
    /**
     * Busca entidades conocidas dentro de un texto.
     * Útil para pre-cargar contexto antes de llamar al LLM.
     * Soporta coincidencias parciales (ej. "Anatomía" -> "Anatomía Humana").
     */
    findEntitiesInText(text) {
        const normalizedText = normalizeText(text);
        const matches = {
            courses: [],
            topics: [],
            careers: []
        };

        // Palabras comunes a ignorar para evitar falsos positivos masivos
        const stopWords = ['de', 'la', 'el', 'en', 'y', 'que', 'los', 'las', 'un', 'una', 'sobre', 'para', 'con', 'por', 'hablame', 'dime', 'cuentame', 'explica', 'saber', 'temas', 'curso', 'carrera'];

        // Extraer palabras clave del texto del usuario (tokens > 3 letras y no stopWords)
        const tokens = normalizedText.split(/\s+/).filter(word => word.length > 3 && !stopWords.includes(word));

        // Helper para buscar coincidencias
        const findInSet = (set, targetArray) => {
            set.forEach(entityName => {
                // 1. Coincidencia Exacta (la entidad completa está en el texto)
                if (normalizedText.includes(entityName)) {
                    targetArray.push(entityName);
                    return;
                }

                // 2. Coincidencia Parcial por Palabras Clave
                // Si alguna palabra clave del usuario está contenida en el nombre de la entidad.
                // Ej: Usuario dice "Anatomía" -> Token "anatomia" -> Coincide con "anatomia humana"

                // ✅ CORRECCIÓN CRÍTICA: Filtrar también las partes del nombre de la entidad.
                // Evita que "de" en "Bases de Datos" coincida con "Derivadas" (que contiene "de").
                const entityNameParts = entityName.split(/\s+/).filter(part => part.length > 3 && !stopWords.includes(part));

                const hasMatch = tokens.some(token =>
                    entityNameParts.some(part => part.includes(token) || token.includes(part))
                );

                if (hasMatch) {
                    targetArray.push(entityName);
                }
            });
        };

        findInSet(this.courseNames, matches.courses);
        findInSet(this.topicNames, matches.topics);
        findInSet(this.careerNames, matches.careers);

        // Eliminar duplicados (Set -> Array)
        matches.courses = [...new Set(matches.courses)];
        matches.topics = [...new Set(matches.topics)];
        matches.careers = [...new Set(matches.careers)];

        return matches;
    }
}

module.exports = KnowledgeBaseRepository;