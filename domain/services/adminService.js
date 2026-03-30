// ✅ COMBINACIÓN DE SERVICIOS: Gestor CRUD original + Funciones de Admin Dashboard
const adminRepository = require('../repositories/adminRepository');
const crypto = require('crypto');

// Importar todos los repositorios necesarios para el CRUD original
const CareerRepository = require('../../domain/repositories/careerRepository');
const CourseRepository = require('../../domain/repositories/courseRepository');
const TopicRepository = require('../../domain/repositories/topicRepository');
const BookRepository = require('../../domain/repositories/bookRepository');
const UserRepository = require('../../domain/repositories/userRepository');

class AdminService {
    constructor() {
        // Instanciar todos los repositorios para la gestión de contenido
        this.repositories = {
            career: new CareerRepository(),
            course: new CourseRepository(),
            topic: new TopicRepository(),
            book: new BookRepository(),
            user: new UserRepository(),
        };
    }

    // ==========================================
    // 1. MÉTODOS CRUD GENÉRICOS (Requeridos por coursesController)
    // ==========================================

    _getRepository(entityType) {
        const repo = this.repositories[entityType];
        if (!repo) {
            throw new Error(`Tipo de entidad desconocido: ${entityType}`);
        }
        return repo;
    }

    async getAll(entityType, options = {}) {
        if (entityType === 'student') {
            return this.repositories.user.findByRole(entityType);
        }
        const repo = this._getRepository(entityType);
        const items = await repo.findAll(options);
        return items;
    }

    async getById(entityType, id) {
        const repo = this._getRepository(entityType);
        const item = await repo.findById(id);
        return item;
    }

    async create(entityType, newData) {
        if (entityType === 'student') {
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
        if (entityType === 'student') {
            const { name, email } = updatedData;
            return this.repositories.user.update(id, { name, email, role: entityType });
        }
        const repo = this._getRepository(entityType);
        const updatedItem = await repo.update(id, updatedData);
        return updatedItem;
    }

    async delete(entityType, id) {
        if (entityType === 'student') {
            return this.repositories.user.delete(id);
        }
        const repo = this._getRepository(entityType);
        await repo.delete(id);
        return { success: true };
    }

    // ==========================================
    // 2. MÉTODOS DEL PANEL DE ADMINISTRACIÓN (Requeridos por adminController)
    // ==========================================

    async getDashboardStats() {
        return await adminRepository.getOverallStats();
    }

    async generateExportData() {
        const searchHistory = await adminRepository.exportTableToCSVBuffer('search_history', 'query, created_at');
        const courses = await adminRepository.exportTableToCSVBuffer('courses', 'id, name');
        const resources = await adminRepository.exportTableToCSVBuffer('resources', 'id, title');

        return {
            search_history: searchHistory,
            courses: courses,
            resources: resources
        };
    }

    async getAllQuestions(domain, search) {
        return await adminRepository.getAllQuestions(domain, search);
    }

    async addSingleQuestion(data) {
        const expectedOptions = (data.target === 'RESIDENTADO') ? 5 : 4;
        if (!Array.isArray(data.options) || data.options.length !== expectedOptions) {
            throw new Error(`El target ${data.target} requiere exactamente ${expectedOptions} opciones.`);
        }

        const rawString = `${data.topic}-${data.question_text}-${JSON.stringify(data.options)}`;
        const hash = crypto.createHash('md5').update(rawString).digest('hex');
        
        data.hash = hash;
        return await adminRepository.addQuestion(data);
    }

    async getQuestionImages(id) {
        return await adminRepository.getQuestionImages(id);
    }

    async updateSingleQuestion(id, data) {
        const expectedOptions = (data.target === 'RESIDENTADO') ? 5 : 4;
        if (!Array.isArray(data.options) || data.options.length !== expectedOptions) {
            console.warn(`⚠️ Mismatch de opciones en update: Expected ${expectedOptions}, got ${data.options.length}`);
        }

        const rawString = `${data.topic}-${data.question_text}-${JSON.stringify(data.options)}`;
        const hash = crypto.createHash('md5').update(rawString).digest('hex');
        
        data.hash = hash;
        return await adminRepository.updateQuestion(id, data);
    }

    async deleteSingleQuestion(id) {
        return await adminRepository.deleteQuestion(id);
    }

    async syncResource(url, cleanTitle, resourceType, persistentThumbnailUrl, author) {
        const existing = await adminRepository.getResourceByUrl(url);

        if (existing) {
            const finalThumb = persistentThumbnailUrl || existing.image_url;
            await adminRepository.updateResource(existing.id, cleanTitle, resourceType, finalThumb);
            return { action: 'updated' };
        } else {
            const resourceId = `RES_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            const resultAuthor = author || 'Admin Hub';
            await adminRepository.addResource(resourceId, cleanTitle, resultAuthor, url, resourceType, persistentThumbnailUrl);
            return { action: 'inserted' };
        }
    }
}

// ✅ IMPORTANTE: Se exporta LA INSTANCIA (Singleton) porque adminController e index.js esperan una instancia
module.exports = new AdminService();
