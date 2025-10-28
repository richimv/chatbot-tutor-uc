const fs = require('fs').promises;
const path = require('path');

// Definimos las rutas a todos nuestros archivos de "base de datos"
const COURSES_PATH = path.join(__dirname, '../../infrastructure/database/courses.json');
const SECTIONS_PATH = path.join(__dirname, '../../infrastructure/database/sections.json');
const CAREERS_PATH = path.join(__dirname, '../../infrastructure/database/careers.json');
const INSTRUCTORS_PATH = path.join(__dirname, '../../infrastructure/database/instructors.json');
const TOPICS_PATH = path.join(__dirname, '../../infrastructure/database/topics.json');
const BOOKS_PATH = path.join(__dirname, '../../infrastructure/database/books.json'); // Nueva ruta para libros

class CourseRepository {
    constructor() {
        this.unifiedCourses = []; // Aquí guardaremos la vista unificada de los datos
        this.loadData();
    }

    async loadData() {
        try {
            // 1. Cargar todos los archivos JSON en paralelo
            const [coursesData, sectionsData, careersData, instructorsData, topicsData, booksData] = await Promise.all([
                fs.readFile(COURSES_PATH, 'utf8'),
                fs.readFile(SECTIONS_PATH, 'utf8'),
                fs.readFile(CAREERS_PATH, 'utf8'),
                fs.readFile(INSTRUCTORS_PATH, 'utf8'),
                fs.readFile(TOPICS_PATH, 'utf8'),
                fs.readFile(BOOKS_PATH, 'utf8') // Cargar libros
            ]);

            const courses = JSON.parse(coursesData);
            const sections = JSON.parse(sectionsData);
            const careers = JSON.parse(careersData);
            const instructors = JSON.parse(instructorsData);
            const topics = JSON.parse(topicsData);
            const books = JSON.parse(booksData); // Parsear libros

            // 2. Crear mapas para búsquedas rápidas (más eficiente que `find`)
            const coursesMap = new Map(courses.map(c => [c.id, c]));
            const careersMap = new Map(careers.map(c => [c.id, c.name]));
            const instructorsMap = new Map(instructors.map(i => [i.id, i.name]));
            const topicsMap = new Map(topics.map(t => [t.id, { name: t.name, resources: t.resources }]));
            const booksMap = new Map(books.map(b => [b.id, b])); // Mapa para libros

            // 3. Construir la vista unificada
            this.unifiedCourses = sections.map(section => {
                const courseInfo = coursesMap.get(section.courseId);
                if (!courseInfo) return null; // Si una sección apunta a un curso que no existe

                const courseTopics = (courseInfo.topicIds || []).map(id => topicsMap.get(id)).filter(Boolean);
                const courseBooks = (courseInfo.bookIds || []).map(id => booksMap.get(id)).filter(Boolean); // Obtener libros del curso

                return {
                    id: section.id, // Usamos el ID de la sección como identificador único
                    courseId: courseInfo.id,
                    nombre: courseInfo.name,
                    descripcion: courseInfo.description,
                    // ✅ CORRECCIÓN: Usar 'topics' y asegurarse de que exista
                    temas: courseTopics.map(t => t.name), 
                    // Mapear los IDs de carrera a sus nombres
                    carreras: section.careerIds.map(id => careersMap.get(id)).filter(Boolean),
                    docente: instructorsMap.get(section.instructorId) || 'No asignado',
                    horario: section.schedule.map(s => `${s.day} ${s.startTime}-${s.endTime}`).join(', '),
                    libros: courseBooks, // Añadir libros a la vista unificada
                    materiales: {
                        pdfs: courseTopics.flatMap(t => t.resources?.pdfs || []),
                        links: courseTopics.flatMap(t => t.resources?.links || [])
                    }
                };
            }).filter(Boolean); // Eliminar cualquier nulo

            console.log(`📚 CourseRepository: ${this.unifiedCourses.length} secciones de curso unificadas y cargadas.`);

        } catch (error) {
            console.error('❌ Error fatal cargando datos del repositorio:', error);
            this.unifiedCourses = [];
        }
    }

    async findAll() {
        return this.unifiedCourses;
    }

    async findById(id) {
        return this.unifiedCourses.find(course => course.id === id);
    }

    _normalizeText(text) {
        if (!text) return '';
        return text
            .toString()
            .normalize('NFD') // Separa los caracteres de sus acentos
            .replace(/[\u0300-\u036f]/g, '') // Elimina los acentos
            .toLowerCase();
    }

    // Función para extraer términos de búsqueda (palabras normalizadas y sus raíces comunes)
    _getSearchTerms(text) {
        const normalized = this._normalizeText(text);
        // Palabras de relleno comunes que no aportan significado a la búsqueda
        const fillerWords = new Set(['un', 'una', 'el', 'la', 'los', 'las', 'de', 'del', 'a', 'en', 'y', 'o', 'es', 'que', 'se', 'para', 'por', 'con']);
        
        // ✅ CORRECCIÓN: Tratar los números romanos como términos de búsqueda válidos.
        const romanNumerals = new Set(['i', 'ii', 'iii', 'iv', 'v', 'vi']);

        const terms = new Set();
        // ✅ OPTIMIZACIÓN: Usar un objeto de configuración para las reglas de stemming.
        const STEM_RULES = {
            'program': 'program', 'deriv': 'deriv', 'calcul': 'calcul', 'ingenier': 'ingenier',
            'sistem': 'sistem', 'econom': 'econom', 'financier': 'financier', 'derech': 'derech',
            'psicolog': 'psicolog', 'red': 'red', 'comunicac': 'comunicac', 'market': 'market',
            'estadist': 'estadist', 'algoritm': 'algoritm', 'estructur': 'estructur'
        };

        normalized.split(' ').forEach(word => {
            // ✅ CORRECCIÓN: Permitir palabras cortas si son números romanos.
            if ((word.length > 2 || romanNumerals.has(word)) && !fillerWords.has(word)) {
                terms.add(word); // Añadir la palabra normalizada original

                for (const prefix in STEM_RULES) {
                    if (word.startsWith(prefix)) {
                        terms.add(STEM_RULES[prefix]);
                        break; // Asumimos una regla por palabra
                    }
                }
            }
            // ✅ MEJORA: Añadir términos relacionados con programación
            if (['algoritmo', 'algoritmica', 'estructuras', 'datos', 'poo', 'objetos'].includes(word)) {
                terms.add('program'); // Si se busca 'algoritmos', también debe coincidir con 'programacion'
            }
        });
        return terms;
    }

    async search(query) {
        const normalizedQuery = this._normalizeText(query);
        const querySearchTerms = this._getSearchTerms(query); // Usar la nueva función para obtener términos de búsqueda

        if (querySearchTerms.size === 0) {
            // Si la búsqueda solo contiene palabras de relleno, no devolvemos nada para evitar resultados irrelevantes.
            return [];
        }

        // ✅ OPTIMIZACIÓN: Centralizar los pesos de la puntuación para fácil ajuste.
        const SCORE_WEIGHTS = {
            EXACT_CAREER_MATCH: 1000,
            FULL_QUERY_IN_CAREER: 200,
            FULL_QUERY_IN_NAME: 150,
            FULL_QUERY_IN_TOPICS: 90,
            EXACT_NAME_TERM: 30,
            CALCULO_I_ALIAS: 30,
            EXACT_TOPIC_TERM: 20,
            EXACT_CAREER_TERM: 15,
            SUBSTRING_NAME: 10,
            SUBSTRING_TOPIC: 8,
            SUBSTRING_CAREER: 5,
        };

        const scoredCourses = this.unifiedCourses.map(course => {
            let score = 0;
            
            const normalizedNombre = this._normalizeText(course.nombre);
            // ✅ CORRECCIÓN: Ahora `carreras` es un array
            const normalizedCarreras = course.carreras.map(c => this._normalizeText(c)).join(' ');
            // ✅ CORRECCIÓN: Usar `temas` (que ya mapeamos desde `topics`)
            const normalizedTemas = course.temas.map(t => this._normalizeText(t)).join(' ');

            // Convertir el contenido del curso a términos de búsqueda para una comparación más robusta
            const courseNombreSearchTerms = this._getSearchTerms(course.nombre);
            // ✅ CORRECCIÓN: Unir el array de carreras
            const courseCarreraSearchTerms = this._getSearchTerms(course.carreras.join(' '));
            const courseTemasSearchTerms = this._getSearchTerms(course.temas.join(' '));

            // --- Puntuación por presencia de palabras clave ---
            querySearchTerms.forEach(term => {
                // Coincidencia exacta de término en el nombre del curso (mayor peso)
                if (courseNombreSearchTerms.has(term)) {
                    score += SCORE_WEIGHTS.EXACT_NAME_TERM;
                } else if (normalizedNombre.includes(term)) { // Coincidencia de subcadena en el nombre
                    score += SCORE_WEIGHTS.SUBSTRING_NAME;
                }

                // Coincidencia exacta de término en los temas del curso (peso medio)
                if (courseTemasSearchTerms.has(term)) {
                    score += SCORE_WEIGHTS.EXACT_TOPIC_TERM;
                } else if (normalizedTemas.includes(term)) { // Coincidencia de subcadena en los temas
                    score += SCORE_WEIGHTS.SUBSTRING_TOPIC;
                }

                // Coincidencia exacta de término en la carrera del curso (menor peso)
                if (courseCarreraSearchTerms.has(term)) {
                    score += SCORE_WEIGHTS.EXACT_CAREER_TERM;
                } else if (normalizedCarreras.includes(term)) { // Coincidencia de subcadena en la carrera
                    score += SCORE_WEIGHTS.SUBSTRING_CAREER;
                }
            });

            // --- Impulso por coincidencia de la consulta completa como subcadena ---
            // Esto da una gran prioridad a las búsquedas directas y específicas
            if (normalizedNombre.includes(normalizedQuery)) {
                score += SCORE_WEIGHTS.FULL_QUERY_IN_NAME;
            }
            
            // ✅ CORRECCIÓN: Verificar si la consulta coincide con alguna de las carreras
            const exactCareerMatch = course.carreras.some(c => this._normalizeText(c) === normalizedQuery);
            if (exactCareerMatch) {
                score += SCORE_WEIGHTS.EXACT_CAREER_MATCH;
            }
            // Si la búsqueda contiene el nombre de alguna de las carreras, damos un impulso alto.
            else if (normalizedCarreras.includes(normalizedQuery)) {
                score += SCORE_WEIGHTS.FULL_QUERY_IN_CAREER;
            }
            if (normalizedTemas.includes(normalizedQuery)) {
                score += SCORE_WEIGHTS.FULL_QUERY_IN_TOPICS;
            }

            // --- Manejo de casos específicos (ej. "Cálculo I" vs "calculo uno") ---
            const queryHasUnoOrOne = normalizedQuery.includes('uno') || normalizedQuery.includes('1');
            const courseNameHasI = normalizedNombre.includes('i') && normalizedNombre.includes('calculo'); // Asegura que sea "Cálculo I"
            if (queryHasUnoOrOne && courseNameHasI) {
                score += SCORE_WEIGHTS.CALCULO_I_ALIAS;
            }

            return { course, score };
        }).filter(item => item.score > 0); // Solo nos quedamos con los que tienen alguna coincidencia

        // Ordenamos los cursos de mayor a menor puntuación y devolvemos solo el objeto del curso.
        return scoredCourses.sort((a, b) => b.score - a.score).map(item => item.course);
    }

    // --- Métodos CRUD para SECCIONES ---

    /**
     * Crea una nueva sección de curso.
     * @param {object} sectionData - Datos completos de la sección.
     * @returns {Promise<object>} La nueva sección creada.
     */
    async createSection(sectionData) {
        const sections = JSON.parse(await fs.readFile(SECTIONS_PATH, 'utf8'));

        // Validaciones básicas (se pueden expandir)
        if (!sectionData.courseId) throw new Error("courseId es obligatorio para crear una sección.");
        if (!sectionData.careerIds || sectionData.careerIds.length === 0) throw new Error("careerIds es obligatorio para crear una sección.");
        // instructorId puede ser null, schedule puede ser vacío

        const newSection = {
            id: `SECTION_${Date.now()}`,
            courseId: sectionData.courseId,
            careerIds: sectionData.careerIds,
            instructorId: sectionData.instructorId || null,
            semester: sectionData.semester || "2024-2", // Default si no se provee
            schedule: sectionData.schedule || [], // Default si no se provee
            syllabusUrl: sectionData.syllabusUrl || null
        };

        sections.push(newSection);
        await fs.writeFile(SECTIONS_PATH, JSON.stringify(sections, null, 2), 'utf8');

        return newSection;
    }

    async _checkForScheduleConflict(newSection, existingSections) {
        if (!newSection.instructorId || !newSection.schedule || newSection.schedule.length === 0) {
            return; // No se puede verificar el conflicto sin instructor o sin horario
        }

        // Obtener todas las demás secciones asignadas al mismo instructor
        const instructorSections = existingSections.filter(
            s => s.instructorId === newSection.instructorId && s.id !== newSection.id
        );

        for (const newSlot of newSection.schedule) {
            for (const existingSection of instructorSections) {
                for (const existingSlot of existingSection.schedule) {
                    // Comprobar si los días son los mismos
                    if (newSlot.day === existingSlot.day) {
                        // Comprobar si hay solapamiento de tiempo
                        const newStart = newSlot.startTime;
                        const newEnd = newSlot.endTime;
                        const existingStart = existingSlot.startTime;
                        const existingEnd = existingSlot.endTime;

                        if (newStart < existingEnd && newEnd > existingStart) {
                            const course = (await fs.readFile(COURSES_PATH, 'utf8')).find(c => c.id === existingSection.courseId);
                            throw new Error(`Conflicto de horario para el docente. Ya tiene una clase (${course?.name || 'Otro curso'}) el ${existingSlot.day} de ${existingSlot.startTime} a ${existingSlot.endTime}.`);
                        }
                    }
                }
            }
        }
    }

    /**
     * Actualiza una sección de curso existente.
     */
    async updateSection(id, sectionData) {
        const sections = JSON.parse(await fs.readFile(SECTIONS_PATH, 'utf8'));
        const sectionIndex = sections.findIndex(s => s.id === id);
        if (sectionIndex === -1) return null;

        // Validar conflicto de horario antes de actualizar
        await this._checkForScheduleConflict({ ...sections[sectionIndex], ...sectionData }, sections);

        // Actualizar solo los campos provistos en sectionData
        sections[sectionIndex] = {
            ...sections[sectionIndex], // Mantener los campos existentes
            courseId: sectionData.courseId || sections[sectionIndex].courseId,
            careerIds: sectionData.careerIds || sections[sectionIndex].careerIds,
            instructorId: sectionData.instructorId !== undefined ? sectionData.instructorId : sections[sectionIndex].instructorId,
            semester: sectionData.semester || sections[sectionIndex].semester,
            schedule: sectionData.schedule || sections[sectionIndex].schedule,
            syllabusUrl: sectionData.syllabusUrl !== undefined ? sectionData.syllabusUrl : sections[sectionIndex].syllabusUrl
        };

        await fs.writeFile(SECTIONS_PATH, JSON.stringify(sections, null, 2), 'utf8');
        return sections[sectionIndex];
    }

    /**
     * Elimina una sección de curso.
     */
    async deleteSection(id) {
        const sections = JSON.parse(await fs.readFile(SECTIONS_PATH, 'utf8'));
        const sectionIndex = sections.findIndex(s => s.id === id);
        if (sectionIndex === -1) return null;

        const [deletedSection] = sections.splice(sectionIndex, 1);
        await fs.writeFile(SECTIONS_PATH, JSON.stringify(sections, null, 2), 'utf8');

        return deletedSection;
    }

    // --- Métodos CRUD para CARRERAS ---

    async createCareer(careerData) {
        const careers = JSON.parse(await fs.readFile(CAREERS_PATH, 'utf8'));
        if (!careerData.name) throw new Error("El nombre de la carrera es obligatorio.");

        const newCareer = {
            id: `CAREER_${Date.now()}`,
            name: careerData.name,
            curriculumUrl: careerData.curriculumUrl || ""
        };
        careers.push(newCareer);
        await fs.writeFile(CAREERS_PATH, JSON.stringify(careers, null, 2), 'utf8');
        return newCareer;
    }

    async updateCareer(id, careerData) {
        const careers = JSON.parse(await fs.readFile(CAREERS_PATH, 'utf8'));
        const index = careers.findIndex(c => c.id === id);
        if (index === -1) return null;

        careers[index] = {
            ...careers[index],
            name: careerData.name || careers[index].name,
            curriculumUrl: careerData.curriculumUrl !== undefined ? careerData.curriculumUrl : careers[index].curriculumUrl
        };
        await fs.writeFile(CAREERS_PATH, JSON.stringify(careers, null, 2), 'utf8');
        return careers[index];
    }

    async deleteCareer(id) {
        const careers = JSON.parse(await fs.readFile(CAREERS_PATH, 'utf8'));
        const index = careers.findIndex(c => c.id === id);
        if (index === -1) return null;
        const [deleted] = careers.splice(index, 1);
        await fs.writeFile(CAREERS_PATH, JSON.stringify(careers, null, 2), 'utf8');
        return deleted;
    }

    // --- Métodos CRUD para CURSOS BASE ---

    async createCourse(courseData) {
        const courses = JSON.parse(await fs.readFile(COURSES_PATH, 'utf8'));
        if (!courseData.name) throw new Error("El nombre del curso es obligatorio.");
        if (!courseData.code) throw new Error("El código del curso es obligatorio.");

        const newCourse = {
            id: `COURSE_${Date.now()}`,
            code: courseData.code,
            name: courseData.name,
            description: courseData.description || "",
            topicIds: courseData.topicIds || []
            // bookIds se actualiza por separado si es necesario
        };
        courses.push(newCourse);
        await fs.writeFile(COURSES_PATH, JSON.stringify(courses, null, 2), 'utf8');
        return newCourse;
    }

    async updateCourse(id, courseData) {
        const courses = JSON.parse(await fs.readFile(COURSES_PATH, 'utf8'));
        const index = courses.findIndex(c => c.id === id);
        if (index === -1) return null;

        courses[index] = {
            ...courses[index],
            code: courseData.code || courses[index].code,
            name: courseData.name || courses[index].name,
            description: courseData.description !== undefined ? courseData.description : courses[index].description,
            topicIds: courseData.topicIds || courses[index].topicIds,
            bookIds: courseData.bookIds || courses[index].bookIds // Permitir actualizar los libros asociados
        };
        await fs.writeFile(COURSES_PATH, JSON.stringify(courses, null, 2), 'utf8');
        return courses[index];
    }

    async deleteCourse(id) {
        const courses = JSON.parse(await fs.readFile(COURSES_PATH, 'utf8'));
        const index = courses.findIndex(c => c.id === id);
        if (index === -1) return null;
        const [deleted] = courses.splice(index, 1);

        // Opcional: Eliminar referencias a este curso en las secciones (buena práctica)
        const sections = JSON.parse(await fs.readFile(SECTIONS_PATH, 'utf8'));
        const updatedSections = sections.filter(s => s.courseId !== id);
        if (sections.length !== updatedSections.length) {
            await fs.writeFile(SECTIONS_PATH, JSON.stringify(updatedSections, null, 2), 'utf8');
        }

        await fs.writeFile(COURSES_PATH, JSON.stringify(courses, null, 2), 'utf8');
        return deleted;
    }

    // --- Métodos CRUD para INSTRUCTORES ---

    async createInstructor(instructorData) {
        const instructors = JSON.parse(await fs.readFile(INSTRUCTORS_PATH, 'utf8'));
        if (!instructorData.name) throw new Error("El nombre del instructor es obligatorio.");
        if (!instructorData.email) throw new Error("El email del instructor es obligatorio.");

        const newInstructor = {
            id: `INST_${Date.now()}`,
            name: instructorData.name,
            email: instructorData.email
        };
        instructors.push(newInstructor);
        await fs.writeFile(INSTRUCTORS_PATH, JSON.stringify(instructors, null, 2), 'utf8');
        return newInstructor;
    }

    async updateInstructor(id, instructorData) {
        const instructors = JSON.parse(await fs.readFile(INSTRUCTORS_PATH, 'utf8'));
        const index = instructors.findIndex(i => i.id === id);
        if (index === -1) return null;

        instructors[index] = {
            ...instructors[index],
            name: instructorData.name || instructors[index].name,
            email: instructorData.email || instructors[index].email
        };
        await fs.writeFile(INSTRUCTORS_PATH, JSON.stringify(instructors, null, 2), 'utf8');
        return instructors[index];
    }

    async deleteInstructor(id) {
        const instructors = JSON.parse(await fs.readFile(INSTRUCTORS_PATH, 'utf8'));
        const index = instructors.findIndex(i => i.id === id);
        if (index === -1) return null;
        const [deleted] = instructors.splice(index, 1);
        await fs.writeFile(INSTRUCTORS_PATH, JSON.stringify(instructors, null, 2), 'utf8');
        return deleted;
    }

    // --- Métodos CRUD para TEMAS ---

    async createTopic(topicData) {
        const topics = JSON.parse(await fs.readFile(TOPICS_PATH, 'utf8'));
        if (!topicData.name) throw new Error("El nombre del tema es obligatorio.");

        const newTopic = {
            id: `TOPIC_${Date.now()}`,
            name: topicData.name,
            resources: topicData.resources || { pdfs: [], links: [] }
        };
        topics.push(newTopic);
        await fs.writeFile(TOPICS_PATH, JSON.stringify(topics, null, 2), 'utf8');
        return newTopic;
    }

    async updateTopic(id, topicData) {
        const topics = JSON.parse(await fs.readFile(TOPICS_PATH, 'utf8'));
        const index = topics.findIndex(t => t.id === id);
        if (index === -1) return null;

        topics[index] = {
            ...topics[index],
            name: topicData.name || topics[index].name,
            resources: topicData.resources !== undefined ? topicData.resources : topics[index].resources
        };
        await fs.writeFile(TOPICS_PATH, JSON.stringify(topics, null, 2), 'utf8');
        return topics[index];
    }

    async deleteTopic(id) {
        const topics = JSON.parse(await fs.readFile(TOPICS_PATH, 'utf8'));
        const index = topics.findIndex(t => t.id === id);
        if (index === -1) return null;
        const [deleted] = topics.splice(index, 1);
        await fs.writeFile(TOPICS_PATH, JSON.stringify(topics, null, 2), 'utf8');
        return deleted;
    }

    // --- Métodos CRUD para LIBROS ---

    async createBook(bookData) {
        const books = JSON.parse(await fs.readFile(BOOKS_PATH, 'utf8'));
        if (!bookData.title || !bookData.author || !bookData.url) {
            throw new Error("Título, autor y URL son obligatorios para crear un libro.");
        }

        const newBook = {
            id: `BOOK_${Date.now()}`,
            title: bookData.title,
            author: bookData.author,
            url: bookData.url
        };
        books.push(newBook);
        await fs.writeFile(BOOKS_PATH, JSON.stringify(books, null, 2), 'utf8');
        return newBook;
    }

    async updateBook(id, bookData) {
        const books = JSON.parse(await fs.readFile(BOOKS_PATH, 'utf8'));
        const index = books.findIndex(b => b.id === id);
        if (index === -1) return null;

        books[index] = {
            ...books[index],
            title: bookData.title || books[index].title,
            author: bookData.author || books[index].author,
            url: bookData.url || books[index].url
        };
        await fs.writeFile(BOOKS_PATH, JSON.stringify(books, null, 2), 'utf8');
        return books[index];
    }

    async deleteBook(id) {
        const books = JSON.parse(await fs.readFile(BOOKS_PATH, 'utf8'));
        const index = books.findIndex(b => b.id === id);
        if (index === -1) return null;

        const [deleted] = books.splice(index, 1);
        await fs.writeFile(BOOKS_PATH, JSON.stringify(books, null, 2), 'utf8');
        // Aquí también podríamos limpiar las referencias en `courses.json`
        return deleted;
    }
}

module.exports = CourseRepository;