const fs = require('fs').promises;
const path = require('path');

const DB_PATH = path.join(__dirname, '../../infrastructure/database/topics.json');

class TopicRepository {
    constructor() {
        // En una aplicación más grande, aquí se podría inicializar una conexión a una base de datos.
        // Para nuestro caso, solo necesitamos la ruta al archivo JSON.
    }

    /**
     * Lee y devuelve todos los temas desde el archivo topics.json.
     * @returns {Promise<Array<object>>} Una promesa que resuelve a un array de objetos de temas.
     */
    async findAll() {
        try {
            const data = await fs.readFile(DB_PATH, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            // Si el archivo no existe, es un error irrecuperable para este repositorio.
            console.error('❌ Error fatal: No se pudo leer topics.json.', error);
            throw new Error('No se pudieron cargar los datos de los temas.');
        }
    }
}

module.exports = TopicRepository;