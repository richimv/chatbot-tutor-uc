const db = require('../../infrastructure/database/db');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// ==========================================
// 🛡️ CONFIGURACIÓN BLINDADA DE RUTAS
// ==========================================
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
            // Usamos 'this' para llamar al helper interno
            const self = new AdminController(); // Truco para contexto en express si se pierde

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

            const [usersRes, premiumRes, searchesRes, chatsRes, topCoursesRes, topBooksRes] = await Promise.all([
                db.query('SELECT COUNT(*) as count FROM users'),
                db.query("SELECT COUNT(*) as count FROM users WHERE subscription_status = 'active'"),
                db.query('SELECT COUNT(*) as count FROM search_history'),
                db.query('SELECT COUNT(*) as count FROM chat_messages'),
                // Top 5 Cursos Reales (Page Views)
                db.query(`SELECT c.name, COUNT(*) as visits FROM page_views pv JOIN courses c ON pv.entity_id = c.id WHERE pv.entity_type = 'course' GROUP BY c.name ORDER BY visits DESC LIMIT 5`),
                // Top 5 Libros Reales (Page Views)
                db.query(`SELECT r.title as name, COUNT(*) as visits FROM page_views pv JOIN resources r ON pv.entity_id = r.id WHERE pv.entity_type = 'book' GROUP BY r.title ORDER BY visits DESC LIMIT 5`)
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
                    totalChatMessages: parseInt(chatsRes.rows[0].count)
                },
                charts: {
                    topCourses: topCoursesRes.rows,
                    topBooks: topBooksRes.rows
                },
                ai: aiTrends // <--- Aquí inyectamos la magia
            };

            res.json(stats);

        } catch (error) {
            console.error('❌ Error crítico en Dashboard:', error);
            res.status(500).json({ error: 'Error interno.' });
        }
    }
}

// Exportamos una instancia para poder usar 'this' correctamente si es necesario
// O mejor, ajustamos las rutas para llamar a los métodos de la instancia.
const controller = new AdminController();

// BINDING: Truco para no perder el contexto 'this' al pasarlo como callback en router
module.exports = {
    getDashboardStats: controller.getDashboardStats.bind(controller),
    runAiAnalysis: controller.runAiAnalysis.bind(controller)
};