const express = require('express');
const cors = require('cors');
const path = require('path');
// ✅ AÑADIR ESTA LÍNEA AL INICIO PARA CARGAR EL ARCHIVO .ENV
require('dotenv').config(); 
const coursesController = require('../../application/controllers/coursesController');
const chatController = require('../../application/controllers/chatController');
const analyticsController = require('../../application/controllers/analyticsController');

class Server {
    constructor() {
        console.log('🚀 Inicializando Server...');
        
        this.app = express();
        this.port = process.env.PORT || 3000;
        
        // ✅ CATCH GLOBAL PARA ERRORES NO MANEJADOS
        process.on('uncaughtException', (error) => {
            console.error('💥 UNCAUGHT EXCEPTION:', error);
            console.error('💥 Stack:', error.stack);
        });
        
        process.on('unhandledRejection', (reason, promise) => {
            console.error('💥 UNHANDLED REJECTION at:', promise, 'reason:', reason);
        });
        
        // ✅ 1. Configurar middlewares esenciales primero
        this.configureMiddleware();
        // ✅ 2. Servir archivos estáticos (CSS, JS, imágenes) desde la carpeta 'public'
        this.app.use(express.static(path.join(__dirname, '../../presentation/public')));
        // ✅ 3. Configurar las rutas de la API y de las páginas
        this.configureRoutes();
    }

     configureMiddleware() {
        console.log('🔧 Configurando middleware...');
        
        // ✅ CORS SIMPLIFICADO
        this.app.use(cors());
        
        // ✅ EXPRESS.JSON MÍNIMO Y SEGURO
        this.app.use(express.json({
            limit: '1mb',
            verify: (req, res, buf) => {
                req.rawBody = buf.toString();
            }
        }));
        
        // ✅ MIDDLEWARE DE LOG SIMPLIFICADO
        this.app.use((req, res, next) => {
            if (req.method === 'POST' && req.path === '/api/chat') {
                console.log('📥 CHAT REQUEST:', {
                    method: req.method,
                    path: req.path,
                    body: req.body,
                    rawBody: req.rawBody
                });
            }
            next();
        });
    }

    configureRoutes() {
         console.log('🔧 Configurando rutas...');
       // ✅ RUTA /api/chat CON CHATCONTROLLER REACTIVADO
    this.app.post('/api/chat', (req, res) => {
        console.log('🎯 /api/chat - Iniciando procesamiento...');
        
        // ✅ VERIFICACIÓN MÍNIMA
        // La validación se ha movido al controlador para ser más flexible con el historial
        // if (!req.body || !req.body.message) {
        //     console.log('❌ Body inválido:', req.body);
        //     return res.status(400).json({ error: 'Message requerido' });
        // }
        
        console.log('✅ Body válido, llamando chatController...');
        
        try {
            // ✅ VERIFICAR QUE chatController EXISTE
            if (!chatController || typeof chatController.processMessage !== 'function') {
                console.error('❌ chatController no disponible');
                return res.status(500).json({ 
                    respuesta: 'Error: Sistema temporalmente no disponible'
                });
            }
            
            console.log('🔍 chatController disponible, procesando...');
            return chatController.processMessage(req, res);
            
        } catch (error) {
            console.error('💥 ERROR en chatController:', error);
            return res.status(500).json({ 
                respuesta: 'Lo siento, hubo un error interno. Por favor, intenta nuevamente.'
            });
        }
    });

    // ======================
    // 🔗 RUTAS API
    // ======================
    
    // Cursos (PMV1)
    this.app.get('/api/cursos', coursesController.getAllCourses);
    this.app.get('/api/buscar', coursesController.searchCourses);
    // Las rutas de administración de cursos se mantienen para el panel de administración
    this.app.get('/api/curso/:id', coursesController.getCourseById); 
    this.app.post('/api/add-curso', coursesController.addCourse); 
    this.app.put('/api/edit-curso/:id', coursesController.updateCourse); 
    this.app.delete('/api/delete-curso/:id', coursesController.deleteCourse); 

    this.app.post('/api/train-model', chatController.trainModel);

        // Analytics (NUEVO)
        this.app.get('/api/analytics', analyticsController.getAnalytics);
        this.app.get('/api/analytics/trends', analyticsController.getSearchTrends);
        this.app.get('/api/analytics/predictions', analyticsController.getPopularCoursePrediction);
        this.app.post('/api/analytics/feedback', analyticsController.recordFeedback);

        // ======================
        // 🌐 RUTAS FRONTEND
        // ======================
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../../presentation/public/index.html'));
        });

        this.app.get('/admin', (req, res) => {
            res.sendFile(path.join(__dirname, '../../presentation/public/admin.html'));
        });

        // Ruta para servir el componente de chat
        this.app.get('/chat', (req, res) => {
            res.sendFile(path.join(__dirname, '../../presentation/public/chat.html'));
        });

        // Manejar rutas no encontradas
        this.app.get('*', (req, res) => {
            res.status(404).json({ error: 'Ruta no encontrada' });
        });
    }

start() {
        this.app.listen(this.port, () => {
            console.log('🚀 Servidor iniciado - DEBUG MODE');
            console.log(`📡 http://localhost:${this.port}`);
            console.log('🔧 Solo /api/chat básico habilitado');
        });
    }
}


module.exports = Server;

// Iniciar servidor
if (require.main === module) {
    const server = new Server();
    server.start();
}