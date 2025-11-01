const fs = require('fs').promises;
const path = require('path');

const SECTIONS_DB_PATH = path.join(__dirname, '../../infrastructure/database/sections.json');

/**
 * Repositorio para manejar las operaciones de datos de las secciones.
 */
class SectionRepository {

    /**
     * Lee y parsea el archivo JSON de secciones.
     * @returns {Promise<Array>} Un array de objetos de sección.
     * @private
     */
    async _readData() {
        try {
            const data = await fs.readFile(SECTIONS_DB_PATH, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') return []; // Si el archivo no existe, devuelve un array vacío.
            throw error;
        }
    }

    async findAll() {
        return await this._readData();
    }
}

module.exports = SectionRepository;