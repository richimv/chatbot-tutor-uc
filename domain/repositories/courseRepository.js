const fs = require('fs').promises;
const path = require('path');
const { normalizeText } = require('../utils/textUtils');
const { PorterStemmerEs, stopwords } = require('natural'); // ✅ 1. Importar 'stopwords'

const DB_PATHS = {
    courses: path.join(__dirname, '../../infrastructure/database/courses.json'),
    sections: path.join(__dirname, '../../infrastructure/database/sections.json'),
    careers: path.join(__dirname, '../../infrastructure/database/careers.json'),
    topics: path.join(__dirname, '../../infrastructure/database/topics.json'),
    instructors: path.join(__dirname, '../../infrastructure/database/instructors.json'),
};

// ✅ 2. Crear un conjunto de stopwords para búsquedas rápidas.
const spanishStopwords = new Set(stopwords.es);

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
        // ✅ SOLUCIÓN: El mapa de secciones debe agrupar por courseId.
        const sectionsByCourseId = new Map();
        sections.forEach(section => {
            if (!sectionsByCourseId.has(section.courseId)) {
                sectionsByCourseId.set(section.courseId, []);
            }
            sectionsByCourseId.get(section.courseId).push(section);
        });

        const careersMap = new Map(careers.map(c => [c.id, c.name]));
        const topicsMap = new Map(topics.map(t => [t.id, t.name]));
        const instructorsMap = new Map(instructors.map(i => [i.id, i.name]));

        // 3. ✅ SOLUCIÓN: Iterar sobre los CURSOS como base, no las secciones.
        // Esto garantiza que todos los cursos sean buscables, tengan o no una sección.
        const unifiedData = courses.map(course => {
            const courseTopics = (course.topicIds || []).map(id => topicsMap.get(id)).filter(Boolean);
            const courseSections = sectionsByCourseId.get(course.id) || [];

            return {
                // Usamos el ID del curso como identificador principal para la búsqueda.
                courseId: course.id,
                name: course.name,
                code: course.code,
                topics: courseTopics,
                // Las carreras ahora se derivan de todas las secciones de ese curso.
                careers: [...new Set(courseSections.flatMap(s => s.careerIds.map(id => careersMap.get(id)).filter(Boolean)))],
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

        // ✅ 3. Función auxiliar para procesar texto: filtrar stopwords, aplicar stemming y normalizar.
        const processTextToStems = (text) => {
            if (!text) return [];
            return text.split(' ')
                .filter(word => word && !spanishStopwords.has(normalizeText(word))) // Filtrar stopwords
                // ✅ CORRECCIÓN CRÍTICA: Stemming ANTES de normalizar para manejar acentos.
                .map(word => normalizeText(PorterStemmerEs.stem(word))); 
        };

        const queryStems = processTextToStems(query);
        
        // --- FASE 1: Búsqueda Híbrida (Frase Exacta + Palabras Clave) ---
        const scoredResults = allItems.map(item => {
            const normalizedItemName = normalizeText(item.name || '');
            const topicNames = (item.topics || []).map(t => normalizeText(t));
            let score = 0;

            // ✅ Prioridad 1 (Máxima): Coincidencia exacta con un nombre de tema.
            if (topicNames.includes(normalizedQuery)) {
                score += 100; // Puntuación muy alta para garantizar la prioridad.
            }

            // ✅ Prioridad 2: Coincidencia de frase exacta en el nombre del curso.
            if (normalizedItemName.includes(normalizedQuery)) {
                score += 50;
            }

            // ✅ Prioridad 3: Puntuación por palabras clave (stems).
            const allContentText = [item.name || '', (item.careers || []).join(' '), (item.topics || []).join(' ')].join(' ');
            const allContentStems = new Set(processTextToStems(allContentText));
            
            let matchedStems = 0;
            queryStems.forEach(stem => {
                if (allContentStems.has(stem)) matchedStems++;
            });

            // Solo añadir puntuación por palabras clave si hay al menos una coincidencia.
            if (matchedStems > 0) {
                // Bonus significativo si TODAS las palabras clave de la búsqueda están presentes.
                if (queryStems.length > 1 && matchedStems === queryStems.length) {
                    score += 20;
                }
                score += matchedStems; // Añadir el número de coincidencias individuales.
            }

            return { ...item, score };
        // ✅ SOLUCIÓN DEFINITIVA: Establecer un umbral de puntuación mínimo.
        // Esto elimina el "ruido" de cursos con coincidencias muy débiles.
        }).filter(item => item.score > 5);

        // Eliminar duplicados y ordenar por score final
        const uniqueResults = Array.from(new Map(scoredResults.map(item => [item.courseId, item])).values());
        return uniqueResults.sort((a, b) => b.score - a.score);
    }
}

module.exports = CourseRepository;