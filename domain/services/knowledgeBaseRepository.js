const fs = require('fs').promises;
const path = require('path');
const { normalizeText } = require('../utils/textUtils');

const DB_PATHS = {
    courses: path.join(__dirname, '../../infrastructure/database/courses.json'),
    topics: path.join(__dirname, '../../infrastructure/database/topics.json'),
    careers: path.join(__dirname, '../../infrastructure/database/careers.json'),
    instructors: path.join(__dirname, '../../infrastructure/database/instructors.json'),
};

/**
 * Repositorio para cargar y acceder a una base de conocimiento local
 * con todas las entidades nombradas del sistema.
 */
class KnowledgeBaseRepository {
    constructor() {
        this.knowledgeBase = null;
    }

    async _readFile(filePath) {
        try {
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') return [];
            throw error;
        }
    }

    async load() {
        if (this.knowledgeBase) return this.knowledgeBase;

        const [courses, topics, careers, instructors] = await Promise.all([
            this._readFile(DB_PATHS.courses),
            this._readFile(DB_PATHS.topics),
            this._readFile(DB_PATHS.careers),
            this._readFile(DB_PATHS.instructors),
        ]);

        this.knowledgeBase = new Set([
            ...courses.map(c => normalizeText(c.name)),
            ...topics.map(t => normalizeText(t.name)),
            ...careers.map(c => normalizeText(c.name)),
            ...instructors.map(i => normalizeText(i.name)),
        ].filter(Boolean));

        console.log(`✅ Base de conocimiento local cargada con ${this.knowledgeBase.size} entidades.`);
        return this.knowledgeBase;
    }
}

module.exports = KnowledgeBaseRepository;