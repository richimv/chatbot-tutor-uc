const fs = require('fs').promises;
const path = require('path');

const CAREERS_DB_PATH = path.join(__dirname, '../../infrastructure/database/careers.json');

/**
 * Repositorio para manejar las operaciones de datos de las carreras.
 */
class CareerRepository {

    /**
     * Lee y parsea el archivo JSON de carreras.
     * @returns {Promise<Array>} Un array de objetos de carrera.
     * @private
     */
    async _readData() {
        try {
            const data = await fs.readFile(CAREERS_DB_PATH, 'utf8');
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

module.exports = CareerRepository;