const express = require('express');
const router = express.Router();

// --- Importar Controladores ---
// --- Importar Controladores ---
const { coursesController, analyticsController, authController, chatController, usageController, adminController, quizController } = require('../../application/controllers');

// --- Importar Middleware ---
const { auth, optionalAuth, adminOnly } = require('../middleware/authMiddleware');
const usageMiddleware = require('../middleware/usageMiddleware');
const { authLimiter } = require('../config/rateLimiters');

// ======================
// 🔗 RUTAS API
// ======================

// ✅ NUEVO: Admin Dashboard (Stats Maestras)
router.get('/admin/dashboard-stats', auth, adminOnly, adminController.getDashboardStats);

router.post('/admin/run-ai', auth, adminOnly, adminController.runAiAnalysis);

// ✅ RUTAS DE PAGOS (Mercado Pago)
const paymentRoutes = require('./paymentRoutes');
router.use('/payment', paymentRoutes);

// ✅ RUTAS DE BIBLIOTECA (Favoritos/Guardados)
const libraryRoutes = require('./libraryRoutes');
router.use('/library', libraryRoutes);

// --- Rutas de Control de Acceso (Uso Gratuito) ---
router.post('/usage/verify', auth, usageController.checkAccess); // ✅ NUEVO

// --- Rutas de Autenticación (Prefijo /api/auth) ---
router.post('/auth/login', authLimiter, authController.login);
router.post('/auth/register', authLimiter, authController.register);
router.get('/auth/me', auth, authController.getMe);
router.put('/auth/change-password', auth, authController.changePassword);
router.post('/auth/forgot-password', authLimiter, authController.forgotPassword); // ✅ NUEVO
router.post('/auth/sync', authLimiter, authController.syncUser); // ✅ NUEVO: Sync de Google
router.get('/auth/verify-email', authController.verifyEmail);
router.post('/auth/users/:id/reset-password', auth, adminOnly, authController.adminResetPassword);

// --- Rutas de Chat (Prefijo /api/chat) ---
router.post('/chat', auth, usageMiddleware, chatController.processMessage); // ✅ Middleware aplicado
router.get('/chat/conversations', auth, chatController.getUserConversations);
router.get('/chat/conversations/:id', auth, chatController.getConversationMessages);
router.put('/chat/conversations/:id', auth, chatController.updateConversationTitle);
router.delete('/chat/conversations/:id', auth, chatController.deleteConversation);
router.post('/chat/train-model', auth, adminOnly, chatController.trainModel);

// --- Rutas Públicas ---
router.get('/buscar', optionalAuth, coursesController.searchCourses);
router.get('/careers', coursesController.getCareers);
router.get('/courses', coursesController.getCourses);

router.get('/topics', coursesController.getTopics);
router.get('/books', coursesController.getBooks);

// ✅ RUTAS DE CONTENIDO DESTACADO (Analytics)
router.get('/analytics/featured-books', analyticsController.getFeaturedBooks);
router.get('/analytics/featured-courses', analyticsController.getFeaturedCourses);

// ✅ NUEVO: Rutas para obtener detalles por ID
router.get('/careers/:id', coursesController.getCareerById);
router.get('/courses/:id', coursesController.getCourseById);
router.get('/topics/:id', coursesController.getTopicById);

// --- Rutas CRUD Protegidas para el Panel de Administración ---
router.get('/students', auth, adminOnly, coursesController.getStudents);
// --- Configuración de Multer para Carga de Imágenes ---
const multer = require('multer');
const path = require('path'); // Necesario para path.extname
// ✅ CONFIGURACIÓN MULTER: Usar memoria en lugar de disco
// Para Supabase, necesitamos el buffer en memoria, no un archivo en disco.
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // ✅ AUMENTADO: 50MB límite para evitar errores con imágenes grandes
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Solo se permiten imágenes (JPG, PNG, WebP)'));
    }
});

// --- Rutas CRUD Protegidas para el Panel de Administración ---
router.get('/students', auth, adminOnly, coursesController.getStudents);

// ✅ LÓGICA ESPECIAL PARA LIBROS, CARRERAS Y CURSOS (con subida de archivos)
const mediaEntities = ['book', 'career', 'course'];

mediaEntities.forEach(entity => {
    const plural = entity === 'career' ? 'careers' : `${entity}s`;
    router.post(`/${plural}`, auth, adminOnly, upload.single('coverImage'), (req, res) => coursesController.createEntity(req, res, entity));
    router.put(`/${plural}/:id`, auth, adminOnly, upload.single('coverImage'), (req, res) => coursesController.updateEntity(req, res, entity));
    router.delete(`/${plural}/:id`, auth, adminOnly, (req, res) => coursesController.deleteEntity(req, res, entity));
});

// Entidades simples (sin subida de archivos)
const simpleEntities = ['student', 'topic'];
simpleEntities.forEach(entity => {
    const plural = `${entity}s`;
    router.post(`/${plural}`, auth, adminOnly, (req, res) => coursesController.createEntity(req, res, entity));
    router.put(`/${plural}/:id`, auth, adminOnly, (req, res) => coursesController.updateEntity(req, res, entity));
    router.delete(`/${plural}/:id`, auth, adminOnly, (req, res) => coursesController.deleteEntity(req, res, entity));
});

// --- Rutas de Analytics ---
router.get('/analytics', auth, adminOnly, analyticsController.getAnalytics);
// ✅ SOLUCIÓN DEFINITIVA: Gracias al bindeo en el controlador, ahora podemos pasar el método directamente. Es más limpio.
router.get('/analytics/trends', auth, adminOnly, analyticsController.getSearchTrends);
// ✅ SOLUCIÓN: Añadir la nueva ruta para las tendencias de interacción.
router.get('/analytics/interaction-trends', auth, adminOnly, (req, res) => analyticsController.analyticsService.getInteractionTrends(req.query.days).then(data => res.json(data)).catch(err => res.status(500).json({ error: err.message })));
router.get('/analytics/time-series', auth, adminOnly, analyticsController.getTimeSeriesData); // Deprecated generic
router.get('/analytics/courses-time-series', auth, adminOnly, analyticsController.getCourseTimeSeriesData); // ✅ NUEVO
router.get('/analytics/topics-time-series', auth, adminOnly, analyticsController.getTopicTimeSeriesData); // ✅ NUEVO
router.get('/analytics/predictions', auth, adminOnly, analyticsController.getPopularCoursePrediction);
router.get('/analytics/ai', auth, adminOnly, analyticsController.getAIAnalytics); // ✅ NUEVO: KPIs de IA
router.get('/analytics/feedback', auth, adminOnly, analyticsController.getFeedback);
router.post('/analytics/feedback', auth, analyticsController.recordFeedback);
// ✅ NUEVO: Ruta para registrar una vista de página.
router.post('/analytics/view', auth, analyticsController.recordView.bind(analyticsController));

// --- Rutas Internas (para servicios de ML) ---
router.get('/internal/analytics-data', analyticsController.getAnalyticsForML);
router.get('/internal/ml-data', coursesController.getDataForML);

// --- Rutas de Quiz (Gamificación) ---
router.post('/quiz/start', auth, quizController.startQuiz);
router.post('/quiz/submit', auth, quizController.submitScore);
router.get('/quiz/stats', auth, quizController.getStats);
router.get('/quiz/leaderboard', auth, quizController.getLeaderboard);

module.exports = router;
