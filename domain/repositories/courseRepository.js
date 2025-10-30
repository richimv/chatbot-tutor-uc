const fs = require('fs').promises;
const path = require('path');
const { normalizeText } = require('../utils/textUtils');

const DB_PATHS = {
    courses: path.join(__dirname, '../../infrastructure/database/courses.json'),
    sections: path.join(__dirname, '../../infrastructure/database/sections.json'),
    careers: path.join(__dirname, '../../infrastructure/database/careers.json'),
    topics: path.join(__dirname, '../../infrastructure/database/topics.json'),
    instructors: path.join(__dirname, '../../infrastructure/database/instructors.json'),
};

class CourseRepository {
    constructor() {
        this.unifiedData = null; // Caché para la vista unificada
    }

    async _loadAndUnifyData() {
        if (this.unifiedData) {
            return this.unifiedData;
        }

        // 1. Cargar todos los datos necesarios de la base de datos de archivos JSON.
        const [courses, sections, careers, topics, instructors] = await Promise.all([
            this._readFile(DB_PATHS.courses),
            this._readFile(DB_PATHS.sections),
            this._readFile(DB_PATHS.careers),
            this._readFile(DB_PATHS.topics),
            this._readFile(DB_PATHS.instructors),
        ]);

        // 2. Crear mapas para búsquedas eficientes (ID -> Objeto/Nombre).
        const coursesMap = new Map(courses.map(c => [c.id, c]));
        const careersMap = new Map(careers.map(c => [c.id, c.name]));
        const topicsMap = new Map(topics.map(t => [t.id, t.name]));
        const instructorsMap = new Map(instructors.map(i => [i.id, i.name]));

        // 3. Unificar los datos en una sola estructura fácil de buscar.
        const unifiedData = sections.map(section => {
            const course = coursesMap.get(section.courseId);
            if (!course) return null;

            const sectionCareers = section.careerIds.map(id => careersMap.get(id)).filter(Boolean);
            const courseTopics = (course.topicIds || []).map(id => topicsMap.get(id)).filter(Boolean);

            return {
                id: section.id,
                courseId: course.id,
                // ✅ CORRECCIÓN ARQUITECTURAL: Usar nombres de campo consistentes.
                name: course.name,
                code: course.code,
                careers: sectionCareers, // Mantener como array para el frontend
                topics: courseTopics,    // Mantener como array
                docente: instructorsMap.get(section.instructorId) || 'Por Asignar',
                horario: section.schedule,
            };
        }).filter(Boolean);

        this.unifiedData = unifiedData;
        return this.unifiedData;
    }

    async _readFile(filePath) {
        try {
            // Esta función auxiliar lee un archivo JSON de forma asíncrona.
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') return [];
            throw error;
        }
    }

    async findAll() {
        return await this._loadAndUnifyData();
    }

    async search(query) {
        const allItems = await this._loadAndUnifyData();
        const normalizedQuery = normalizeText(query);
        const queryWords = new Set(normalizedQuery.split(' ').filter(Boolean));
        
        const scoredResults = allItems.map(item => {
            // Normalizar todos los campos relevantes para la búsqueda.
            const courseNameNorm = normalizeText(item.name || '');
            const careerNamesNorm = normalizeText((item.careers || []).join(' '));
            const topicNamesNorm = normalizeText((item.topics || []).join(' '));

            let score = 0;
            // Puntuación alta si la frase completa está en el nombre.
            if (courseNameNorm.includes(normalizedQuery)) score += 10;

            // Puntuación por cada palabra de la búsqueda que coincida.
            queryWords.forEach(word => {
                if (courseNameNorm.includes(word)) score += 5; // Más peso al nombre del curso.
                if (careerNamesNorm.includes(word)) score += 3; // Peso medio a la carrera.
                if (topicNamesNorm.includes(word)) score += 2; // Peso menor a los temas.
            });

            // Devolvemos el objeto original con su puntuación.
            return { ...item, score };
        }).filter(item => item.score > 0);

        return scoredResults.sort((a, b) => b.score - a.score);
    }
}

module.exports = CourseRepository;