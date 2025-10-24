const fs = require('fs').promises;
const path = require('path');

class CourseRepository {
    constructor() {
        this.filePath = path.join(__dirname, '../../infrastructure/database/courses.json');
        this.courses = [];
        this.loadCourses();
    }

    async loadCourses() {
        try {
            const data = await fs.readFile(this.filePath, 'utf8');
            this.courses = JSON.parse(data);
            console.log(`📚 CourseRepository: ${this.courses.length} cursos cargados.`);
        } catch (error) {
            console.error('❌ Error cargando cursos:', error);
            this.courses = [];
        }
    }

    async saveCourses() {
        try {
            await fs.writeFile(this.filePath, JSON.stringify(this.courses, null, 2), 'utf8');
            console.log('💾 Cursos guardados exitosamente.');
        } catch (error) {
            console.error('❌ Error guardando cursos:', error);
            throw new Error('No se pudo guardar el curso.');
        }
    }

    async findAll() {
        return this.courses;
    }

    async findById(id) {
        return this.courses.find(course => course.id === id);
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
        
        const terms = new Set();
        normalized.split(' ').forEach(word => {
            if (word.length > 2 && !fillerWords.has(word)) {
                terms.add(word); // Añadir la palabra normalizada original

                // Añadir raíces comunes para mejorar la coincidencia morfológica
                if (word.startsWith('program')) terms.add('program'); // programar, programacion
                if (word.startsWith('deriv')) terms.add('deriv');     // derivar, derivadas
                if (word.startsWith('calcul')) terms.add('calcul');   // calculo, calcular
                if (word.startsWith('ingenier')) terms.add('ingenier'); // ingenieria, ingeniero
                if (word.startsWith('sistem')) terms.add('sistem');   // sistemas, sistematico
                if (word.startsWith('econom')) terms.add('econom');   // economia, economico
                if (word.startsWith('financier')) terms.add('financier'); // financiera, financiero
                if (word.startsWith('derech')) terms.add('derech');   // derecho, derechos
                if (word.startsWith('psicolog')) terms.add('psicolog'); // psicologia, psicologo
                if (word.startsWith('red')) terms.add('red');         // redes
                if (word.startsWith('comunicac')) terms.add('comunicac'); // comunicacion, comunicaciones
                if (word.startsWith('market')) terms.add('market');   // marketing
                if (word.startsWith('estadist')) terms.add('estadist'); // estadistica
                if (word.startsWith('algoritm')) terms.add('algoritm'); // algoritmo, algoritmos
                if (word.startsWith('estructur')) terms.add('estructur'); // estructura, estructuras
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

        const scoredCourses = this.courses.map(course => {
            let score = 0;
            
            const normalizedNombre = this._normalizeText(course.nombre);
            const normalizedCarrera = this._normalizeText(course.carrera);
            const normalizedTemas = course.temas.map(t => this._normalizeText(t)).join(' ');

            // Convertir el contenido del curso a términos de búsqueda para una comparación más robusta
            const courseNombreSearchTerms = this._getSearchTerms(course.nombre);
            const courseCarreraSearchTerms = this._getSearchTerms(course.carrera);
            const courseTemasSearchTerms = this._getSearchTerms(course.temas.join(' '));

            // --- Puntuación por presencia de palabras clave ---
            querySearchTerms.forEach(term => {
                // Coincidencia exacta de término en el nombre del curso (mayor peso)
                if (courseNombreSearchTerms.has(term)) {
                    score += 25;
                } else if (normalizedNombre.includes(term)) { // Coincidencia de subcadena en el nombre
                    score += 10;
                }

                // Coincidencia exacta de término en los temas del curso (peso medio)
                if (courseTemasSearchTerms.has(term)) {
                    score += 20;
                } else if (normalizedTemas.includes(term)) { // Coincidencia de subcadena en los temas
                    score += 8;
                }

                // Coincidencia exacta de término en la carrera del curso (menor peso)
                if (courseCarreraSearchTerms.has(term)) {
                    score += 15;
                } else if (normalizedCarrera.includes(term)) { // Coincidencia de subcadena en la carrera
                    score += 5;
                }
            });

            // --- Impulso por coincidencia de la consulta completa como subcadena ---
            // Esto da una gran prioridad a las búsquedas directas y específicas
            if (normalizedNombre.includes(normalizedQuery)) {
                score += 150; // Muy alto si la consulta completa está en el nombre
            }
            // Si la búsqueda es EXACTAMENTE el nombre de la carrera, damos un impulso masivo.
            if (normalizedCarrera === normalizedQuery) {
                score += 1000; // Impulso máximo para coincidencia exacta de carrera.
            } 
            // Si la búsqueda contiene el nombre de la carrera, damos un impulso alto.
            else if (normalizedCarrera.includes(normalizedQuery)) {
                score += 200; // Impulso alto si la consulta completa está en la carrera.
            }
            if (normalizedTemas.includes(normalizedQuery)) {
                score += 90; // Medio si la consulta completa está en los temas
            }

            // --- Manejo de casos específicos (ej. "Cálculo I" vs "calculo uno") ---
            const queryHasUnoOrOne = normalizedQuery.includes('uno') || normalizedQuery.includes('1');
            const courseNameHasI = normalizedNombre.includes('i') && normalizedNombre.includes('calculo'); // Asegura que sea "Cálculo I"
            if (queryHasUnoOrOne && courseNameHasI) {
                score += 30; // Impulso para esta coincidencia específica
            }

            return { course, score };
        }).filter(item => item.score > 0); // Solo nos quedamos con los que tienen alguna coincidencia

        // Ordenamos los cursos de mayor a menor puntuación y devolvemos solo el objeto del curso.
        return scoredCourses.sort((a, b) => b.score - a.score).map(item => item.course);
    }

    async create(courseData) {
        const newCourse = {
            id: Date.now().toString(),
            ...courseData
        };
        this.courses.push(newCourse);
        await this.saveCourses();
        return newCourse;
    }

    async update(id, courseData) {
        const index = this.courses.findIndex(course => course.id === id);
        if (index === -1) return null;
        this.courses[index] = { ...this.courses[index], ...courseData };
        await this.saveCourses();
        return this.courses[index];
    }

    async delete(id) {
        const index = this.courses.findIndex(course => course.id === id);
        if (index === -1) return null;
        const [deletedCourse] = this.courses.splice(index, 1);
        await this.saveCourses();
        return deletedCourse;
    }
}

module.exports = CourseRepository;