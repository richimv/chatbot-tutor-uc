// const db = require('../../infrastructure/database/db'); // ❌ REMOVED: Clean Architecture enforcement
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const AnalyticsService = require('../../domain/services/analyticsService');
const trainingRepository = require('../../domain/repositories/trainingRepository');
const MLService = require('../../domain/services/mlService');
const adminService = require('../../domain/services/adminService'); // ✅ IMPORTANTE: Se inyecta capa de Negocio
const mediaController = require('./mediaController'); 

// ==========================================
// 🛡️ CONFIGURACIÓN BLINDADA DE RUTAS
// ==========================================
const isWindows = process.platform === 'win32';
const ROOT_DIR = process.cwd();
const DATA_DIR = path.join(ROOT_DIR, 'data_dump');
const ML_SCRIPT = path.join(ROOT_DIR, 'ml_service', 'run_batch.py');
const PREDICTIONS_FILE = path.join(DATA_DIR, 'ai_predictions.json');
const PYTHON_PATH = isWindows ? 'C:/Python313/python.exe' : 'python3';

if (!fs.existsSync(DATA_DIR)) {
    console.log('📁 Creando carpeta data_dump en:', DATA_DIR);
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

class AdminController {
    constructor() {
        this.analyticsService = new AnalyticsService(); 
    }

    async _exportTableToCSV(tableName, fileName, dataStr) {
        if (!dataStr) return;
        fs.writeFileSync(path.join(DATA_DIR, fileName), dataStr);
    }

    async runAiAnalysis(req, res) {
        try {
            console.log('🤖 Iniciando proceso Batch de IA...');

            // 1. Obtener CSVs preparados desde la capa de Dominio (AdminService)
            const exportData = await adminService.generateExportData();
            
            await this._exportTableToCSV('search_history', 'search_history.csv', exportData.search_history);
            await this._exportTableToCSV('courses', 'courses.csv', exportData.courses);
            await this._exportTableToCSV('resources', 'resources.csv', exportData.resources);

            console.log(`🐍 Ejecutando script: ${ML_SCRIPT}`);

            const pythonProcess = spawn(PYTHON_PATH, [ML_SCRIPT], { cwd: ROOT_DIR });

            pythonProcess.stdout.on('data', (data) => console.log(`[PY]: ${data}`));
            pythonProcess.stderr.on('data', (data) => console.error(`[PY ERROR]: ${data}`));

            pythonProcess.on('close', (code) => {
                if (code === 0) {
                    res.json({ success: true, message: 'Análisis de tendencias actualizado.' });
                } else {
                    res.status(500).json({ error: 'El script de IA terminó con errores.' });
                }
            });
        } catch (error) {
            console.error('Error ejecutando IA:', error);
            res.status(500).json({ error: 'Error interno ejecutando IA' });
        }
    }

    async getDashboardStats(req, res) {
        try {
            // Se invoca métricas robustamente abstraidas
            const dbStats = await adminService.getDashboardStats();
            const uniqueVisitorsCount = await this.analyticsService.getUniqueVisitorsCount(1);

            let aiTrends = null;
            if (fs.existsSync(PREDICTIONS_FILE)) {
                try {
                    const rawData = fs.readFileSync(PREDICTIONS_FILE, 'utf8');
                    aiTrends = JSON.parse(rawData);
                } catch (e) {
                    console.warn("No se pudo leer el JSON de IA:", e.message);
                }
            }

            const stats = {
                kpi: {
                    totalUsers: dbStats.usersCount,
                    premiumUsers: dbStats.premiumCount,
                    estimatedRevenue: dbStats.premiumCount * 9.90,
                    totalSearches: dbStats.searchesCount,
                    totalChatMessages: dbStats.chatsCount,
                    uniqueVisitors: uniqueVisitorsCount
                },
                charts: {
                    topCourses: dbStats.topCourses,
                    topResources: dbStats.topResources 
                },
                ai: aiTrends
            };

            res.json(stats);
        } catch (error) {
            console.error('❌ Error crítico en Dashboard:', error);
            res.status(500).json({ error: 'Error interno.' });
        }
    }

    async bulkInjectQuestions(req, res) {
        try {
            const questions = req.body;
            if (!Array.isArray(questions)) {
                return res.status(400).json({ error: 'El cuerpo debe ser un array JSON.' });
            }

            console.log(`📥 Administrador subiendo lote de ${questions.length} preguntas masivas...`);

            const result = await trainingRepository.saveBulkQuestionBankAdmin(questions);

            if (result.success) {
                res.json({ success: true, message: `Lote inyectado con éxito: ${result.inserted} preguntas`, count: result.inserted });
            } else {
                res.status(500).json({ error: 'Fallo al inyectar el lote.' });
            }

        } catch (error) {
            console.error('❌ Error en inyección masiva:', error);
            res.status(500).json({ error: 'Error del servidor procesando el lote.' });
        }
    }

    async generateAiQuestions(req, res) {
        try {
            const { target, domain, studyAreas, career } = req.body;
            if (!target || !studyAreas) {
                return res.status(400).json({ error: 'Faltan parámetros: target y studyAreas son requeridos.' });
            }

            const difficulty = 'Senior';
            const resolvedDomain = domain || 'medicine'; 
            console.log(`🧠 Admin solicitó lote RAG: ${target}, ${difficulty}, Áreas: ${studyAreas}, Domain: ${resolvedDomain}, Carrera: ${career || 'N/A'}`);

            const generatedQuestions = await MLService.generateRAGQuestions(target, difficulty, studyAreas, career, 5, 'lite', resolvedDomain);

            if (!generatedQuestions || !Array.isArray(generatedQuestions)) {
                throw new Error("El formato devuelto por la IA no corresponde a un Array válido.");
            }

            const result = await trainingRepository.saveBulkQuestionBankAdmin(generatedQuestions);

            if (result.success) {
                res.json({ success: true, message: `IA RAG ha Inyectado ${result.inserted} preguntas nuevas con éxito al Banco.`, count: result.inserted });
            } else {
                res.status(500).json({ error: 'Fallo al inyectar el lote generado por la IA en la BD.' });
            }
        } catch (error) {
            console.error('❌ Error en generador RAG Masivo Admin:', error);
            res.status(500).json({ error: error.message || 'Error del servidor procesando el RAG.' });
        }
    }

    async getAllQuestions(req, res) {
        try {
            const { domain, search } = req.query;
            const rows = await adminService.getAllQuestions(domain, search);
            res.json(rows);
        } catch (error) {
            console.error('Error fetching questions:', error);
            res.status(500).json({ error: 'Error interno obteniendo preguntas.' });
        }
    }

    async addSingleQuestion(req, res) {
        try {
            const sanitize = (val) => (val === 'null' || val === 'undefined' || val === '' || val === 'N/A') ? null : val;

            const q = {
                ...req.body,
                career: sanitize(req.body.career),
                subtopic: sanitize(req.body.subtopic),
                target: sanitize(req.body.target),
                topic: sanitize(req.body.topic) || 'General',
                explanation: sanitize(req.body.explanation) || ''
            };

            if (typeof q.options === 'string') {
                try { q.options = JSON.parse(q.options); } catch (e) { console.error('Error parsing options:', e); }
            }

            if (!q.question_text || !q.options || q.correct_answer === undefined || !q.domain) {
                return res.status(400).json({ error: 'Faltan campos obligatorios' });
            }

            if (req.files) {
                if (req.files['questionImage'] && req.files['questionImage'][0]) {
                    try { q.image_url = await mediaController.uploadFile(req.files['questionImage'][0], 'questions'); } 
                    catch (err) { console.error('Error uploading question image:', err); }
                }

                if (req.files['explanationImage'] && req.files['explanationImage'][0]) {
                    try { q.explanation_image_url = await mediaController.uploadFile(req.files['explanationImage'][0], 'explanations'); } 
                    catch (err) { console.error('Error uploading explanation image:', err); }
                }
            }

            const rowId = await adminService.addSingleQuestion(q);
            res.json({ success: true, message: 'Pregunta añadida existosamente', id: rowId });
        } catch (error) {
            console.error('Error adding single question:', error);
            res.status(500).json({ error: error.message || 'Error del servidor al añadir pregunta.' });
        }
    }

    async updateSingleQuestion(req, res) {
        try {
            const { id } = req.params;
            const sanitize = (val) => (val === 'null' || val === 'undefined' || val === '' || val === 'N/A') ? null : val;

            const q = {
                ...req.body,
                career: sanitize(req.body.career),
                subtopic: sanitize(req.body.subtopic),
                target: sanitize(req.body.target),
                topic: sanitize(req.body.topic) || 'General',
                difficulty: sanitize(req.body.difficulty) || 'Senior',
                explanation: sanitize(req.body.explanation) || ''
            };

            if (typeof q.options === 'string') {
                try { q.options = JSON.parse(q.options); } catch (e) { console.error('Error parsing options:', e); }
            }

            if (!q.question_text || !q.options || q.correct_answer === undefined || !q.domain) {
                return res.status(400).json({ error: 'Faltan campos obligatorios para actualizar' });
            }

            const shouldDeleteQ = q.deleteQuestionImage === 'true' || q.image_url === '';
            const shouldDeleteE = q.deleteExplanationImage === 'true' || q.explanation_image_url === '';

            if (req.files || shouldDeleteQ || shouldDeleteE) {
                const oldData = await adminService.getQuestionImages(id);
                const currentQuestionImg = oldData?.image_url;
                const currentExplanationImg = oldData?.explanation_image_url;

                if (req.files && req.files['questionImage'] && req.files['questionImage'][0]) {
                    try {
                        if (currentQuestionImg) await mediaController.deleteFile(currentQuestionImg);
                        q.image_url = await mediaController.uploadFile(req.files['questionImage'][0], 'questions');
                    } catch (err) { console.error('Error updating question image:', err); }
                } else if (shouldDeleteQ) {
                    if (currentQuestionImg) await mediaController.deleteFile(currentQuestionImg);
                    q.image_url = null;
                }

                if (req.files && req.files['explanationImage'] && req.files['explanationImage'][0]) {
                    try {
                        if (currentExplanationImg) await mediaController.deleteFile(currentExplanationImg);
                        q.explanation_image_url = await mediaController.uploadFile(req.files['explanationImage'][0], 'explanations');
                    } catch (err) { console.error('Error updating explanation image:', err); }
                } else if (shouldDeleteE) {
                    if (currentExplanationImg) await mediaController.deleteFile(currentExplanationImg);
                    q.explanation_image_url = null;
                }
            }

            const isUpdated = await adminService.updateSingleQuestion(id, q);
            if (!isUpdated) return res.status(404).json({ error: 'Pregunta no encontrada.' });

            res.json({ success: true, message: 'Pregunta actualizada exitosamente.' });
        } catch (error) {
            console.error('Error updating single question:', error);
            res.status(500).json({ error: 'Error del servidor al actualizar pregunta.' });
        }
    }

    async deleteSingleQuestion(req, res) {
        try {
            const { id } = req.params;

            const qData = await adminService.getQuestionImages(id);
            if (qData) {
                const { image_url, explanation_image_url } = qData;
                if (image_url) await mediaController.deleteFile(image_url);
                if (explanation_image_url) await mediaController.deleteFile(explanation_image_url);
            }

            const isDeleted = await adminService.deleteSingleQuestion(id);
            if (!isDeleted) return res.status(404).json({ error: 'Pregunta no encontrada.' });

            res.json({ success: true, message: 'Pregunta eliminada exitosamente.' });
        } catch (error) {
            console.error('Error deleting single question:', error);
            res.status(500).json({ error: 'Error del servidor al eliminar pregunta.' });
        }
    }

    async syncDriveFolder(req, res) {
        try {
            const { folderId, resourceType, author } = req.body;

            if (!folderId || !resourceType) {
                return res.status(400).json({ error: 'Faltan parámetros: folderId y resourceType son obligatorios.' });
            }

            console.log(`📂 [Admin] Iniciando sincronización de carpeta Drive: ${folderId} como ${resourceType}`);

            const DriveService = require('../../domain/services/driveService');
            const files = await DriveService.getFilesFromFolder(folderId);

            if (!files || files.length === 0) {
                return res.json({ success: true, message: 'La carpeta está vacía o no se encontraron archivos.', inserted: 0 });
            }

            let insertedCount = 0;
            let updatedCount = 0;

            for (const file of files) {
                const driveUrl = `https://drive.google.com/open?id=${file.id}`;
                const cleanTitle = file.name.replace(/\.[^/.]+$/, "");

                // ⚡️ NUEVO: Lógica de Persistencia de Miniatura en GCS con Fallback
                let persistentThumbnailUrl = null;
                try {
                    const thumbData = await DriveService.downloadThumbnailBuffer(file.id);
                    if (thumbData && thumbData.buffer) {
                        persistentThumbnailUrl = await mediaController.uploadBuffer(
                            thumbData.buffer, 
                            `${file.id}.jpg`, 
                            thumbData.mimeType, 
                            'thumbnails'
                        );
                    }
                } catch (thumbErr) {
                    console.warn(`⚠️ No se pudo persistir miniatura para ${file.name}:`, thumbErr.message);
                }

                // 🛡️ SI NO HAY MINIATURA (Falló Google o es un archivo pesado), NO ASIGNAMOS NADA.
                // El sistema ya maneja un diseño por defecto en el frontend si image_url es null.
                if (!persistentThumbnailUrl) {
                    console.log(`✨ Sin miniatura para: ${file.name} (se usará diseño por defecto UI)`);
                }

                const result = await adminService.syncResource(driveUrl, cleanTitle, resourceType, persistentThumbnailUrl, author);
                if (result.action === 'updated') updatedCount++;
                else insertedCount++;
            }

            res.json({
                success: true,
                message: `Sincronización completada. ${insertedCount} nuevos recursos añadidos, ${updatedCount} actualizados.`,
                inserted: insertedCount,
                updated: updatedCount
            });

        } catch (error) {
            console.error('❌ Error en sincronización de Drive:', error);
            res.status(500).json({ error: 'Error del servidor al sincronizar carpeta de Drive.' });
        }
    }
}

const controller = new AdminController();

module.exports = {
    getDashboardStats: controller.getDashboardStats.bind(controller),
    runAiAnalysis: controller.runAiAnalysis.bind(controller),
    bulkInjectQuestions: controller.bulkInjectQuestions.bind(controller),
    generateAiQuestions: controller.generateAiQuestions.bind(controller), 
    getAllQuestions: controller.getAllQuestions.bind(controller),
    addSingleQuestion: controller.addSingleQuestion.bind(controller),
    updateSingleQuestion: controller.updateSingleQuestion.bind(controller),
    deleteSingleQuestion: controller.deleteSingleQuestion.bind(controller),
    syncDriveFolder: controller.syncDriveFolder.bind(controller)
};