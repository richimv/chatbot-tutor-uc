// ✅ CORRECCIÓN CRÍTICA: Refactorizar AdminService para usar repositorios de Supabase
// en lugar de archivos JSON locales. Esto asegura que todos los datos provengan
// de la misma fuente y tengan un formato consistente.

// Importar todos los repositorios necesarios
const CareerRepository = require('../../domain/repositories/careerRepository');
const CourseRepository = require('../../domain/repositories/courseRepository');
const SectionRepository = require('../../domain/repositories/sectionRepository');
const TopicRepository = require('../../domain/repositories/topicRepository');
const BookRepository = require('../../domain/repositories/bookRepository');
const UserRepository = require('../../domain/repositories/userRepository'); // ✅ AÑADIDO

class AdminService {
    constructor() {
        // Instanciar todos los repositorios
        this.repositories = {
            career: new CareerRepository(),
            course: new CourseRepository(),
            section: new SectionRepository(),
            topic: new TopicRepository(),
            book: new BookRepository(),
            user: new UserRepository(), // ✅ AÑADIDO
        };
    }

    // Método auxiliar para obtener el repositorio correcto
    _getRepository(entityType) {
        const repo = this.repositories[entityType];
        if (!repo) {
            throw new Error(`Tipo de entidad desconocido: ${entityType}`);
        }
        return repo;
    }

    async getAll(entityType) {
        // ✅ LÓGICA MEJORADA: Si es instructor o student, usar el repo de usuarios.
        if (entityType === 'instructor' || entityType === 'student') {
            return this.repositories.user.findByRole(entityType);
        }

        const repo = this._getRepository(entityType);
        const items = await repo.findAll(); // Asumiendo que findAll existe en los repositorios
        return items; // Los repositorios ya deben devolver el 'id' numérico correcto.
    }

    async getById(entityType, id) {
        const repo = this._getRepository(entityType);
        const item = await repo.findById(id);
        return item; // Los repositorios ya deben devolver el 'id' numérico correcto.
    }

    async create(entityType, newData) {
        // ✅ LÓGICA MEJORADA: Crear usuarios con el rol correcto.
        if (entityType === 'instructor' || entityType === 'student') {
            const { name, email } = newData;
            const tempPassword = Math.random().toString(36).slice(-8);
            console.log(`🔑 Contraseña temporal generada para ${email}: ${tempPassword}`);
            const newUser = await this.repositories.user.create(email, tempPassword, name, entityType);
            return { ...newUser, tempPassword };
        }

        const repo = this._getRepository(entityType);
        const createdItem = await repo.create(newData);
        return createdItem;
    }

    async update(entityType, id, updatedData) {
        // ✅ LÓGICA MEJORADA: Actualizar datos de usuario.
        if (entityType === 'instructor' || entityType === 'student') {
            const { name, email } = updatedData;
            return this.repositories.user.update(id, { name, email, role: entityType });
        }

        const repo = this._getRepository(entityType);
        const updatedItem = await repo.update(id, updatedData);
        return updatedItem;
    }

    async delete(entityType, id) {
        // ✅ SOLUCIÓN: Añadir 'student' a la condición para que use el repositorio de usuarios.
        // El repositorio de usuarios ya contiene la lógica correcta para eliminar un usuario por su ID.
        if (entityType === 'instructor' || entityType === 'student') {
            return this.repositories.user.delete(id);
        }

        const repo = this._getRepository(entityType);
        // o en un servicio de validación más complejo. Por ahora, solo delegamos la eliminación.
        await repo.delete(id);
        return { success: true }; // O el resultado que devuelva el repo
    }
}

module.exports = AdminService;