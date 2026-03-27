const db = require('../../infrastructure/database/db');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const AnalyticsService = require('../../domain/services/analyticsService'); // ✅ NUEVO
const trainingRepository = require('../../infrastructure/repositories/trainingRepository');
const MLService = require('../../domain/services/mlService');
const mediaController = require('./mediaController'); // ✅ NUEVO: Para subida de imágenes a GCS

// ==========================================
// 🛡️ CONFIGURACIÓN BLINDADA DE RUTAS
// ==========================================
const isWindows = process.platform === 'win32';
// process.cwd() obtiene la carpeta raíz donde ejecutas "npm run dev"
const ROOT_DIR = process.cwd();
const DATA_DIR = path.join(ROOT_DIR, 'data_dump');
const ML_SCRIPT = path.join(ROOT_DIR, 'ml_service', 'run_batch.py');
const PREDICTIONS_FILE = path.join(DATA_DIR, 'ai_predictions.json');
const PYTHON_PATH = isWindows
    ? 'C:/Python313/python.exe'  // Tu ruta local
    : 'python3';

// Asegurar carpeta temporal
if (!fs.existsSync(DATA_DIR)) {
    console.log('📁 Creando carpeta data_dump en:', DATA_DIR);
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

class AdminController {
    constructor() {
        this.analyticsService = new AnalyticsService(); // ✅ Instancia para KPIs de tráfico
    }

    /**
     * Helper para exportar tablas a CSV para que Python las lea
     */
    async _exportTableToCSV(tableName, fileName, columns = '*') {
        const res = await db.query(`SELECT ${columns} FROM ${tableName}`);
        if (res.rows.length === 0) return;

        const headers = Object.keys(res.rows[0]).join(',');
        const rows = res.rows.map(row =>
            Object.values(row).map(val => {
                if (val === null) return '';

                // NUEVO: Si es fecha, convertir a ISO (formato universal)
                if (val instanceof Date) {
                    return `"${val.toISOString()}"`;
                }
                // Limpiar saltos de línea y comillas para CSV simple
                const cleanVal = String(val).replace(/"/g, '""').replace(/\n/g, ' ');
                return `"${cleanVal}"`;
            }).join(',')
        ).join('\n');

        fs.writeFileSync(path.join(DATA_DIR, fileName), `${headers}\n${rows}`);
    }

    /**
     * 🧠 Endpoint: Trigger para ejecutar el análisis de IA
     * Genera CSVs -> Ejecuta Python -> Python guarda JSON
     */
    async runAiAnalysis(req, res) {
        try {
            // --- 🚨 INICIO DE DEBUGGING 🚨 ---
            console.log('📍 [DEBUG] Controlador runAiAnalysis activado');
            console.log('📍 [DEBUG] Directorio actual del archivo (__dirname):', __dirname);
            console.log('📍 [DEBUG] Ruta calculada para ROOT_DIR:', ROOT_DIR);
            console.log('📍 [DEBUG] Ruta calculada para DATA_DIR:', DATA_DIR);
            console.log('📍 [DEBUG] ¿Existe DATA_DIR?:', fs.existsSync(DATA_DIR));
            // ---------------------------------

            console.log('🤖 Iniciando proceso Batch de IA...');

            // 1. Exportar datos frescos a CSV
            // Exportamos Search History (Querys) y Courses (Nombres)
            await this._exportTableToCSV('search_history', 'search_history.csv', 'query, created_at');
            await this._exportTableToCSV('courses', 'courses.csv', 'id, name');
            await this._exportTableToCSV('resources', 'resources.csv', 'id, title');

            console.log(`🐍 Ejecutando script: ${ML_SCRIPT}`);

            // 2. Spawn Python
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

    /**
     * 📊 Obtiene estadísticas maestras para el Dashboard.
     * Lee SQL + JSON de IA
     */
    async getDashboardStats(req, res) {
        try {
            // console.log('⚡ Dashboard Stats solicitados...');

            const [usersRes, premiumRes, searchesRes, chatsRes, topCoursesRes, topBooksRes, uniqueVisitorsCount] = await Promise.all([
                db.query('SELECT COUNT(*) as count FROM users'),
                db.query("SELECT COUNT(*) as count FROM users WHERE subscription_status = 'active'"),
                db.query('SELECT COUNT(*) as count FROM search_history'),
                db.query('SELECT COUNT(*) as count FROM chat_messages'),
                // Top 5 Cursos Reales (Page Views)
                db.query(`SELECT c.name, COUNT(*) as visits FROM page_views pv JOIN courses c ON pv.entity_id = c.id WHERE pv.entity_type = 'course' GROUP BY c.name ORDER BY visits DESC LIMIT 5`),
                // Top 5 Recursos (Desglosado por tipo y filtrado por entidad)
                db.query(`
                    SELECT 
                        r.title || ' (' || r.resource_type || ')' as name, 
                        COUNT(*) as visits 
                    FROM page_views pv 
                    JOIN resources r ON pv.entity_id = r.id 
                    WHERE pv.entity_type = r.resource_type
                    GROUP BY r.title, r.resource_type 
                    ORDER BY visits DESC 
                    LIMIT 5
                `),
                this.analyticsService.getUniqueVisitorsCount(1) // ✅ NUEVO: Visitas de hoy
            ]);

            // 📥 Leer predicciones de IA desde el archivo JSON (si existe)
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
                    totalUsers: parseInt(usersRes.rows[0].count),
                    premiumUsers: parseInt(premiumRes.rows[0].count),
                    estimatedRevenue: parseInt(premiumRes.rows[0].count) * 9.90, // KPI Financiero
                    totalSearches: parseInt(searchesRes.rows[0].count),
                    totalChatMessages: parseInt(chatsRes.rows[0].count),
                    uniqueVisitors: uniqueVisitorsCount
                },
                charts: {
                    topCourses: topCoursesRes.rows,
                    topResources: topBooksRes.rows // ✅ RENOMBRADO: De topBooks a topResources
                },
                ai: aiTrends
            };

            res.json(stats);

        } catch (error) {
            console.error('❌ Error crítico en Dashboard:', error);
            res.status(500).json({ error: 'Error interno.' });
        }
    }

    /**
     * POST /api/admin/questions/bulk
     * Endpoint para importar preguntas masivas vía JSON
     */
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

    /**
     * POST /api/admin/questions/generate-ai
     * Endpoint para generar un set de 5 preguntas empleando Retrieval Augmented Generation (RAG)
     */
    async generateAiQuestions(req, res) {
        try {
            /**
             * domain:     Dominio global del banco (medicine | english | general_trivia).
             *             Seleccionado por el admin en el dropdown "Dominio" del modal.
             * studyAreas: Áreas de estudio médicas seleccionadas con checkboxes (Pediatría, Cardiología...).
             *             Se pasan como string al prompt de la IA para indicar sobre qué generar.
             */
            const { target, domain, studyAreas, career } = req.body;
            if (!target || !studyAreas) {
                return res.status(400).json({ error: 'Faltan parámetros: target y studyAreas son requeridos.' });
            }

            const difficulty = 'Senior';

            const resolvedDomain = domain || 'medicine'; // Fallback seguro si el front no envía domain
            console.log(`🧠 Admin solicitó lote RAG: ${target}, ${difficulty}, Áreas: ${studyAreas}, Domain: ${resolvedDomain}, Carrera: ${career || 'N/A'}`);

            // 1. Generar preguntas con Gemini 2.5 Flash Lite — studyAreas para el contexto, domain para la BD
            // Pasamos: target, difficulty, studyAreas, career, amount=5, tier='lite', domain=resolvedDomain
            const generatedQuestions = await MLService.generateRAGQuestions(target, difficulty, studyAreas, career, 5, 'lite', resolvedDomain);

            if (!generatedQuestions || !Array.isArray(generatedQuestions)) {
                throw new Error("El formato devuelto por la IA no corresponde a un Array válido.");
            }

            // 2. Inyectar masivamente en base de datos
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

    /**
     * GET /api/admin/questions
     * Obtiene una lista filtrada por dominio y búsqueda para el panel.
     */
    async getAllQuestions(req, res) {
        try {
            const { domain, search } = req.query;
            let query = `
                SELECT id, question_text, domain, target, career, topic, subtopic, difficulty, created_at, options, correct_option_index as correct_answer, explanation, explanation_image_url, image_url, visual_support_recommendation
                FROM question_bank 
            `;
            const params = [];
            const conditions = [];

            if (domain && domain !== 'all') {
                params.push(domain);
                conditions.push(`domain = $${params.length}`);
            }

            if (search) {
                params.push(`%${search}%`);
                conditions.push(`(question_text ILIKE $${params.length} OR topic ILIKE $${params.length} OR subtopic ILIKE $${params.length})`);
            }

            if (conditions.length > 0) {
                query += ` WHERE ` + conditions.join(' AND ');
            }

            query += ` ORDER BY created_at DESC LIMIT 1000`; // Aumentamos límite para búsquedas profundas

            const result = await db.query(query, params);
            res.json(result.rows);
        } catch (error) {
            console.error('Error fetching questions:', error);
            res.status(500).json({ error: 'Error interno obteniendo preguntas.' });
        }
    }

    /**
     * POST /api/admin/question
     * Añade una sola pregunta.
     */
    async addSingleQuestion(req, res) {
        try {
            // ✅ DEFENSA: FormData envía "null" o "undefined" como strings.
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

            // Validaciones básicas
            if (!q.question_text || !q.options || q.correct_answer === undefined || !q.domain) {
                return res.status(400).json({ error: 'Faltan campos obligatorios' });
            }

            // Validar longitud de opciones según Target
            const expectedOptions = (q.target === 'RESIDENTADO') ? 5 : 4;
            if (!Array.isArray(q.options) || q.options.length !== expectedOptions) {
                return res.status(400).json({ error: `El target ${q.target} requiere exactamente ${expectedOptions} opciones.` });
            }

            // Hash único
            const rawString = `${q.topic}-${q.question_text}-${JSON.stringify(q.options)}`;
            const hash = crypto.createHash('md5').update(rawString).digest('hex');

            // ✅ SUBIDA DE IMÁGENES A GCS (si existen)
            if (req.files) {
                // 1. Imagen del ENUNCIADO
                if (req.files['questionImage'] && req.files['questionImage'][0]) {
                    try {
                        q.image_url = await mediaController.uploadFile(req.files['questionImage'][0], 'questions');
                    } catch (err) {
                        console.error('Error uploading question image:', err);
                    }
                }

                // 2. Imagen de la EXPLICACIÓN
                if (req.files['explanationImage'] && req.files['explanationImage'][0]) {
                    try {
                        q.explanation_image_url = await mediaController.uploadFile(req.files['explanationImage'][0], 'explanations');
                    } catch (err) {
                        console.error('Error uploading explanation image:', err);
                    }
                }
            }

            const insertQuery = `
                INSERT INTO question_bank (
                    question_text, options, correct_option_index, explanation, explanation_image_url, 
                    domain, target, career, topic, subtopic, difficulty, image_url, question_hash, visual_support_recommendation
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                RETURNING id;
            `;
            const values = [
                q.question_text,
                JSON.stringify(q.options),
                q.correct_answer,
                q.explanation || '',
                q.explanation_image_url || null,
                q.domain,
                q.target || null,
                q.career || null,
                q.topic || 'General',
                q.subtopic || null, 
                q.difficulty || 'Senior',
                q.image_url || null,
                hash,
                q.visual_support_recommendation || null
            ];

            const result = await db.query(insertQuery, values);
            res.json({ success: true, message: 'Pregunta añadida existosamente', id: result.rows[0].id });
        } catch (error) {
            console.error('Error adding single question:', error);
            res.status(500).json({ error: 'Error del servidor al añadir pregunta.' });
        }
    }

    /**
     * PUT /api/admin/question/:id
     * Actualiza una pregunta existente.
     */
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

            // Validar longitud de opciones según Target (Nivel Senior)
            const expectedOptions = (q.target === 'RESIDENTADO') ? 5 : 4;
            if (!Array.isArray(q.options) || q.options.length !== expectedOptions) {
                // Si por alguna razón llegan menos, no bloqueamos el update pero avisamos en consola y evitamos romper la integridad
                console.warn(`⚠️ Mismatch de opciones en update: Expected ${expectedOptions}, got ${q.options.length}`);
            }

            // Hash único (en caso se haya modificado la pregunta u opciones)
            const rawString = `${q.topic}-${q.question_text}-${JSON.stringify(q.options)}`;
            const hash = crypto.createHash('md5').update(rawString).digest('hex');

            // ✅ SUBIDA DE IMÁGENES A GCS (si existen o se eliminan)
            const shouldDeleteQ = q.deleteQuestionImage === 'true' || q.image_url === '';
            const shouldDeleteE = q.deleteExplanationImage === 'true' || q.explanation_image_url === '';

            if (req.files || shouldDeleteQ || shouldDeleteE) {
                // Obtener datos actuales para limpieza
                const oldData = await db.query('SELECT image_url, explanation_image_url FROM question_bank WHERE id = $1', [id]);
                const currentQuestionImg = oldData.rows[0]?.image_url;
                const currentExplanationImg = oldData.rows[0]?.explanation_image_url;

                // 1. Imagen del ENUNCIADO
                if (req.files && req.files['questionImage'] && req.files['questionImage'][0]) {
                    try {
                        if (currentQuestionImg) await mediaController.deleteFile(currentQuestionImg);
                        q.image_url = await mediaController.uploadFile(req.files['questionImage'][0], 'questions');
                    } catch (err) {
                        console.error('Error updating question image:', err);
                    }
                } else if (shouldDeleteQ) {
                    if (currentQuestionImg) await mediaController.deleteFile(currentQuestionImg);
                    q.image_url = null;
                }

                // 2. Imagen de la EXPLICACIÓN
                if (req.files && req.files['explanationImage'] && req.files['explanationImage'][0]) {
                    try {
                        if (currentExplanationImg) await mediaController.deleteFile(currentExplanationImg);
                        q.explanation_image_url = await mediaController.uploadFile(req.files['explanationImage'][0], 'explanations');
                    } catch (err) {
                        console.error('Error updating explanation image:', err);
                    }
                } else if (shouldDeleteE) {
                    if (currentExplanationImg) await mediaController.deleteFile(currentExplanationImg);
                    q.explanation_image_url = null;
                }
            }

            const updateQuery = `
                UPDATE question_bank 
                SET question_text = $1, options = $2, correct_option_index = $3, 
                    explanation = $4, explanation_image_url = $5, domain = $6, 
                    target = $7, career = $8, topic = $9, subtopic = $10, difficulty = $11, image_url = $12, question_hash = $13, visual_support_recommendation = $14
                WHERE id = $15
                RETURNING id;
            `;
            const values = [
                q.question_text,
                JSON.stringify(q.options),
                q.correct_answer,
                q.explanation || '',
                q.explanation_image_url || null,
                q.domain,
                q.target || null,
                q.career || null,
                q.topic || 'General',
                q.subtopic || null, 
                q.difficulty || 'Senior',
                q.image_url || null,
                hash,
                q.visual_support_recommendation || null,
                id
            ];

            const result = await db.query(updateQuery, values);
            if (result.rowCount === 0) return res.status(404).json({ error: 'Pregunta no encontrada.' });

            res.json({ success: true, message: 'Pregunta actualizada exitosamente.' });
        } catch (error) {
            console.error('Error updating single question:', error);
            res.status(500).json({ error: 'Error del servidor al actualizar pregunta.' });
        }
    }

    /**
     * DELETE /api/admin/question/:id
     * Elimina una pregunta.
     */
    async deleteSingleQuestion(req, res) {
        try {
            const { id } = req.params;

            // ✅ LIMPIEZA DE GCS: Obtener URLs antes de borrar el registro
            const qData = await db.query('SELECT image_url, explanation_image_url FROM question_bank WHERE id = $1', [id]);
            if (qData.rows.length > 0) {
                const { image_url, explanation_image_url } = qData.rows[0];
                if (image_url) await mediaController.deleteFile(image_url);
                if (explanation_image_url) await mediaController.deleteFile(explanation_image_url);
            }

            const result = await db.query('DELETE FROM question_bank WHERE id = $1 RETURNING id', [id]);
            if (result.rowCount === 0) return res.status(404).json({ error: 'Pregunta no encontrada.' });

            res.json({ success: true, message: 'Pregunta eliminada exitosamente.' });
        } catch (error) {
            console.error('Error deleting single question:', error);
            res.status(500).json({ error: 'Error del servidor al eliminar pregunta.' });
        }
    }
}

// Exportamos una instancia para poder usar 'this' correctamente si es necesario
// O mejor, ajustamos las rutas para llamar a los métodos de la instancia.
const controller = new AdminController();

// BINDING: Truco para no perder el contexto 'this' al pasarlo como callback en router
module.exports = {
    getDashboardStats: controller.getDashboardStats.bind(controller),
    runAiAnalysis: controller.runAiAnalysis.bind(controller),
    bulkInjectQuestions: controller.bulkInjectQuestions.bind(controller),
    generateAiQuestions: controller.generateAiQuestions.bind(controller), // ✅ Rutina RAG añadida
    getAllQuestions: controller.getAllQuestions.bind(controller),
    addSingleQuestion: controller.addSingleQuestion.bind(controller),
    updateSingleQuestion: controller.updateSingleQuestion.bind(controller),
    deleteSingleQuestion: controller.deleteSingleQuestion.bind(controller)
};