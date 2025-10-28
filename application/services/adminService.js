const fs = require('fs').promises;
const path = require('path');

const DB_PATHS = {
    career: path.join(__dirname, '../../infrastructure/database/careers.json'),
    course: path.join(__dirname, '../../infrastructure/database/courses.json'),
    section: path.join(__dirname, '../../infrastructure/database/sections.json'),
    instructor: path.join(__dirname, '../../infrastructure/database/instructors.json'),
    topic: path.join(__dirname, '../../infrastructure/database/topics.json'),
    book: path.join(__dirname, '../../infrastructure/database/books.json'), // ✅ AÑADIR ESTA LÍNEA
};

class AdminService {

    async _readFile(entityType) {
        const filePath = DB_PATHS[entityType];
        if (!filePath) throw new Error(`Tipo de entidad desconocido: ${entityType}`);
        try {
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') return []; // Si el archivo no existe, devuelve un array vacío
            throw error;
        }
    }

    async _writeFile(entityType, data) {
        const filePath = DB_PATHS[entityType];
        if (!filePath) throw new Error(`Tipo de entidad desconocido: ${entityType}`);
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    }

    async getAll(entityType) {
        return await this._readFile(entityType);
    }

    async getById(entityType, id) {
        const allItems = await this.getAll(entityType);
        const item = allItems.find(i => i.id === id);
        if (!item) throw new Error(`Elemento de tipo '${entityType}' con ID '${id}' no encontrado.`);
        return item;
    }
    async create(entityType, newData) {
        if (!newData.name && entityType !== 'section') {
            throw new Error('El nombre es un campo obligatorio.');
        }

        const allItems = await this._readFile(entityType);

        // Generar un ID único
        const newId = `${entityType.toUpperCase()}_${Date.now()}`;
        const newItem = { id: newId, ...newData };

        allItems.push(newItem);
        await this._writeFile(entityType, allItems);

        return newItem;
    }

    async update(entityType, id, updatedData) {
        const allItems = await this._readFile(entityType);
        const itemIndex = allItems.findIndex(item => item.id === id);

        if (itemIndex === -1) {
            throw new Error(`Elemento de tipo '${entityType}' con ID '${id}' no encontrado.`);
        }

        // Fusionar los datos antiguos con los nuevos, manteniendo el ID original
        allItems[itemIndex] = { ...allItems[itemIndex], ...updatedData };

        await this._writeFile(entityType, allItems);
        return allItems[itemIndex];
    }

    async delete(entityType, id) {
        let allItems = await this._readFile(entityType);
        const initialLength = allItems.length;

        // Filtrar para eliminar el item
        allItems = allItems.filter(item => item.id !== id);

        if (allItems.length === initialLength) {
            throw new Error(`Elemento de tipo '${entityType}' con ID '${id}' no encontrado para eliminar.`);
        }

        // Si es una carrera, curso, docente o tema, verificar si está en uso en alguna sección
        if (['career', 'course', 'instructor'].includes(entityType)) {
            const sections = await this._readFile('section');
            const isInUse = sections.some(section => {
                if (entityType === 'career') return section.careerIds.includes(id);
                if (entityType === 'course') return section.courseId === id;
                if (entityType === 'instructor') return section.instructorId === id;
                return false;
            });
            if (isInUse) {
                // Podríamos lanzar un error, pero por simplicidad, solo advertimos.
                // En una app real, se podría impedir la eliminación.
                console.warn(`ADVERTENCIA: El elemento '${id}' sigue en uso en 'sections.json'.`);
            }
        }

        await this._writeFile(entityType, allItems);
        return { success: true };
    }
}

module.exports = AdminService;