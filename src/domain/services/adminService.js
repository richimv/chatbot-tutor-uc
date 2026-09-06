// ✅ COMBINACIÓN DE SERVICIOS: Gestor CRUD original + Funciones de Admin Dashboard
const adminRepository = require('../repositories/adminRepository');
const crypto = require('crypto');

// Importar todos los repositorios necesarios para el CRUD original
const CareerRepository = require('../../domain/repositories/careerRepository');
const CourseRepository = require('../../domain/repositories/courseRepository');
const TopicRepository = require('../../domain/repositories/topicRepository');
const BookRepository = require('../../domain/repositories/bookRepository');
const UserRepository = require('../../domain/repositories/userRepository');

function resolveSubscriptionConsistency(tier, status, expiresAt) {
    let finalTier = tier;
    let finalStatus = status;
    let finalExpiresAt = expiresAt;

    // Reglas de negocio:
    // Si el estado es 'pending' o 'expired', el tier DEBE ser 'free'
    if (finalStatus === 'pending' || finalStatus === 'expired') {
        finalTier = 'free';
        finalExpiresAt = null;
    } 
    // Si el tier es 'free', el estado DEBE ser 'pending' o 'expired' (nunca 'active')
    else if (finalTier === 'free') {
        if (finalStatus === 'active') {
            finalStatus = 'pending';
        }
        finalExpiresAt = null;
    }
    // Si el tier es 'basic' o 'advanced', el estado DEBE ser 'active'
    else if (finalTier === 'basic' || finalTier === 'advanced') {
        finalStatus = 'active';
        
        // Si no se proporcionó fecha de expiración, la calculamos (2 meses basic, 6 meses advanced)
        if (!finalExpiresAt) {
            const d = new Date();
            const months = finalTier === 'basic' ? 2 : 4;
            d.setMonth(d.getMonth() + months);
            finalExpiresAt = d;
        }
    }

    return {
        subscriptionTier: finalTier,
        subscriptionStatus: finalStatus,
        subscriptionExpiresAt: finalExpiresAt
    };
}


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
        // Simple in-memory locking mechanism to serialize calls for the same URL
        this.locks = new Map();
    }

    async _acquireLock(key) {
        while (this.locks.has(key)) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        this.locks.set(key, true);
    }

    _releaseLock(key) {
        this.locks.delete(key);
    }

    // ==========================================
    // 1. MÉTODOS CRUD GENÉRICOS (Requeridos por coursesController)
    // ==========================================

    _getRepository(entityType) {
        // ✅ MEJORA: Si es un rol de usuario, retornamos el repositorio de usuarios.
        if (['student', 'admin'].includes(entityType)) {
            return this.repositories.user;
        }

        const repo = this.repositories[entityType];
        if (!repo) {
            throw new Error(`Tipo de entidad desconocido: ${entityType}`);
        }
        return repo;
    }

    async getAll(entityType, options = {}) {
        if (['student', 'admin'].includes(entityType)) {
            return this.repositories.user.findByRole(entityType);
        }
        const repo = this._getRepository(entityType);
        const items = await repo.findAll(options);
        return items;
    }

    async getById(entityType, id) {
        if (['student', 'admin'].includes(entityType)) {
            return this.repositories.user.findById(id);
        }
        const repo = this._getRepository(entityType);
        const item = await repo.findById(id);
        return item;
    }

    async create(entityType, newData) {
        if (['student', 'admin'].includes(entityType)) {
            const { name, email, subscriptionTier, subscriptionStatus, subscriptionExpiresAt } = newData;
            
            // ✅ Persistencia inicial en repositorio (atómica y compatible con Google OAuth)
            let newUser = await this.repositories.user.create({
                id: null,
                email: email.toLowerCase(),
                name: name,
                role: entityType
            });

            // Si se definieron campos de suscripción en la creación manual, actualizamos al usuario
            if (newUser && newUser.id && (subscriptionTier || subscriptionStatus || subscriptionExpiresAt)) {
                newUser = await this.update(entityType, newUser.id, {
                    name,
                    email,
                    subscriptionTier,
                    subscriptionStatus,
                    subscriptionExpiresAt
                });
            }

            return newUser;
        }
        const repo = this._getRepository(entityType);
        const createdItem = await repo.create(newData);
        return createdItem;
    }

    async update(entityType, id, updatedData) {
        if (['student', 'admin'].includes(entityType)) {
            const { name, email, subscriptionTier, subscriptionStatus, subscriptionExpiresAt } = updatedData;
            
            const updatePayload = {
                name,
                email,
                role: entityType
            };

            let tier = subscriptionTier;
            let status = subscriptionStatus;
            let expiresAt = subscriptionExpiresAt;

            // Mapeo opcional de campos de suscripción si vienen en el request
            if (tier !== undefined || status !== undefined) {
                const currentUser = await this.repositories.user.findById(id);
                if (currentUser) {
                    // Si se pasó tier de pago pero el status no se definió o era inactivo/pendiente/expirado, lo forzamos a active
                    if (tier === 'basic' || tier === 'advanced') {
                        if (status === undefined || status === 'pending' || status === 'expired' || status === 'inactive') {
                            status = 'active';
                        }
                    }
                    // Si se pasó status de baja/pendiente/expirado pero el tier no se definió o era de pago, forzamos tier a free
                    if (status === 'pending' || status === 'expired' || status === 'inactive') {
                        if (tier === undefined || tier === 'basic' || tier === 'advanced') {
                            tier = 'free';
                        }
                    }

                    if (tier === undefined) tier = currentUser.subscriptionTier || currentUser.subscription_tier || 'free';
                    if (status === undefined) status = currentUser.subscriptionStatus || currentUser.subscription_status || 'inactive';
                    if (expiresAt === undefined) {
                        expiresAt = currentUser.subscriptionExpiresAt || currentUser.subscription_expires_at || null;
                    } else {
                        expiresAt = (expiresAt === '' || expiresAt === 'null') ? null : expiresAt;
                    }
                }
                
                const resolved = resolveSubscriptionConsistency(tier, status, expiresAt);
                updatePayload.subscriptionTier = resolved.subscriptionTier;
                updatePayload.subscriptionStatus = resolved.subscriptionStatus;
                updatePayload.subscriptionExpiresAt = resolved.subscriptionExpiresAt;
            } else if (expiresAt !== undefined) {
                updatePayload.subscriptionExpiresAt = (expiresAt === '' || expiresAt === 'null') ? null : expiresAt;
            }

            // ✅ FIDELIZACIÓN: Si el plan se activa manualmente (es decir, pasa a ser 'active'), reseteamos todos los consumos a cero
            if (updatePayload.subscriptionStatus === 'active') {
                updatePayload.usageCount = 0;
                updatePayload.dailyAiUsage = 0;
                updatePayload.dailyRagUsage = 0;
                updatePayload.dailyArenaUsage = 0;
                updatePayload.dailySimulatorUsage = 0;
                updatePayload.monthlyFlashcardsUsage = 0;
            }

            return this.repositories.user.update(id, updatePayload);
        }
        const repo = this._getRepository(entityType);
        const updatedItem = await repo.update(id, updatedData);
        return updatedItem;
    }

    async delete(entityType, id) {
        if (['student', 'admin'].includes(entityType)) {
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

    async getAllQuestions(domain, search, page = 1, limit = 100, caseFilter = 'all') {
        return await adminRepository.getAllQuestions(domain, search, page, limit, caseFilter);
    }

    async addSingleQuestion(data) {
        let expectedOptions = 4;
        if (data.target === 'RESIDENTADO') {
            expectedOptions = 5;
        } else if (['ASCENSO', 'NOMBRAMIENTO', 'ACCESO_CARGOS'].includes(data.target)) {
            expectedOptions = 3;
        }

        data.question_text = adminRepository.decodeHtmlEntities(data.question_text || '');
        data.explanation = adminRepository.decodeHtmlEntities(data.explanation || '');

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
        let expectedOptions = 4;
        if (data.target === 'RESIDENTADO') {
            expectedOptions = 5;
        } else if (['ASCENSO', 'NOMBRAMIENTO', 'ACCESO_CARGOS'].includes(data.target)) {
            expectedOptions = 3;
        }

        data.question_text = adminRepository.decodeHtmlEntities(data.question_text || '');
        data.explanation = adminRepository.decodeHtmlEntities(data.explanation || '');

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

    async syncResource(url, cleanTitle, resourceType, persistentThumbnailUrl, author, domain = 'medicine', isPremium = false, visible = true, openDirectly = false) {
        await this._acquireLock(url);
        try {
            const existing = await adminRepository.getResourceByUrl(url);

            if (existing) {
                const finalThumb = persistentThumbnailUrl || existing.image_url;
                await adminRepository.updateResource(existing.id, cleanTitle, resourceType, finalThumb, domain, isPremium, visible, openDirectly);
                return { action: 'updated' };
            } else {
                const resourceId = `RES_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
                const resultAuthor = author || 'Admin Hub';
                try {
                    await adminRepository.addResource(resourceId, cleanTitle, resultAuthor, url, resourceType, persistentThumbnailUrl, domain, isPremium, visible, openDirectly);
                    return { action: 'inserted' };
                } catch (dbError) {
                    // Si ocurre un error de llave duplicada (ej. código 23505 de PostgreSQL para unique_violation)
                    if (dbError.code === '23505') {
                        console.warn(`⚠️ Conflicto de inserción única para la URL: ${url}. Intentando actualizar en su lugar.`);
                        // Volver a consultar el recurso existente para obtener su ID
                        const retryExisting = await adminRepository.getResourceByUrl(url);
                        if (retryExisting) {
                            const finalThumb = persistentThumbnailUrl || retryExisting.image_url;
                            await adminRepository.updateResource(retryExisting.id, cleanTitle, resourceType, finalThumb, domain, isPremium, visible, openDirectly);
                            return { action: 'updated' };
                        }
                    }
                    throw dbError; // Si no es 23505 o no se encuentra el recurso, propagamos el error
                }
            }
        } finally {
            this._releaseLock(url);
        }
    }

    async saveBulkQuestionBankAdmin(questionsArray) {
        return await adminRepository.saveBulkQuestionBankAdmin(questionsArray);
    }

    async saveBulkCasesAdmin(casesArray) {
        return await adminRepository.saveBulkCasesAdmin(casesArray);
    }

    async getAllCases(domain, search, page, limit) {
        return await adminRepository.getAllCases(domain, search, page, limit);
    }

    async getCaseById(id) {
        return await adminRepository.getCaseById(id);
    }

    async createCase(data) {
        return await adminRepository.createCase(data);
    }

    async updateCase(id, data) {
        return await adminRepository.updateCase(id, data);
    }

    async deleteCase(id) {
        return await adminRepository.deleteCase(id);
    }

    async linkQuestionsToCase(caseId, questionIdsWithOrder) {
        return await adminRepository.linkQuestionsToCase(caseId, questionIdsWithOrder);
    }

    async unlinkQuestionFromCase(questionId) {
        return await adminRepository.unlinkQuestionFromCase(questionId);
    }
}

// ✅ IMPORTANTE: Se exporta LA INSTANCIA (Singleton) porque adminController e index.js esperan una instancia
module.exports = new AdminService();
