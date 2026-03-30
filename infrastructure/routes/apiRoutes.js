const express = require('express');
const router = express.Router();

// --- Importar Controladores ---
// --- Importar Controladores ---
const { coursesController, analyticsController, authController, chatController, usageController, adminController, quizController, userPreferencesController, mediaController
} = require('../../application/controllers');

// --- Importar Middleware ---
const { auth, optionalAuth, adminOnly } = require('../middleware/authMiddleware');
const usageMiddleware = require('../middleware/usageMiddleware');
const checkAILimits = require('../../application/middlewares/checkLimitsMiddleware'); // ✅ NUEVO LÍMITE DE PRECIOS
const { authLimiter } = require('../config/rateLimiters');

// ======================
// 🔗 CONFIGURACIÓN DE CARGA (Multer)
// ======================
const multer = require('multer');
const path = require('path');
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) return cb(null, true);
        cb(new Error('Solo se permiten imágenes (JPG, PNG, WebP)'));
    }
});

// ======================
// 🔗 RUTAS API
// ======================

// ✅ NUEVO: Admin Dashboard (Stats Maestras)
router.get('/admin/dashboard-stats', auth, adminOnly, adminController.getDashboardStats);

router.post('/admin/run-ai', auth, adminOnly, adminController.runAiAnalysis);
router.post('/admin/questions/bulk', auth, adminOnly, adminController.bulkInjectQuestions); // ✅ NUEVO: Inyección Masiva
router.post('/admin/questions/generate-ai', auth, adminOnly, adminController.generateAiQuestions); // --- Gestión de Banco de Preguntas (Admin) ---
router.get('/admin/questions', auth, adminOnly, adminController.getAllQuestions);
router.post('/admin/question', auth, adminOnly, upload.fields([{ name: 'questionImage', maxCount: 1 }, { name: 'explanationImage', maxCount: 1 }]), adminController.addSingleQuestion);
router.put('/admin/question/:id', auth, adminOnly, upload.fields([{ name: 'questionImage', maxCount: 1 }, { name: 'explanationImage', maxCount: 1 }]), adminController.updateSingleQuestion);
router.delete('/admin/question/:id', auth, adminOnly, adminController.deleteSingleQuestion);
router.post('/admin/drive/sync-folder', auth, adminOnly, adminController.syncDriveFolder); // ✅ NUEVO: Scanner de Drive

// ✅ RUTAS DE PAGOS (Mercado Pago)
const paymentRoutes = require('./paymentRoutes');
router.use('/payment', paymentRoutes);

// ✅ NUEVO: PROXY DE MEDIOS (Google Drive & GCS)
router.get('/media/explanation/:id', optionalAuth, (req, res) => mediaController.serveExplanationImage(req, res));
router.get('/media/resource/:id', optionalAuth, (req, res) => mediaController.serveResourceImage(req, res));
router.get('/media/preview', auth, adminOnly, (req, res) => mediaController.serveGCSPreview(req, res));
router.get('/media/gcs', optionalAuth, (req, res) => mediaController.serveGCSGeneral(req, res));
router.get('/media/drive-thumbnail', optionalAuth, (req, res) => mediaController.serveDriveThumbnail(req, res)); // ✅ Nuevo proxy Drive

// ✅ RUTAS DE BIBLIOTECA (Favoritos/Guardados)
const libraryRoutes = require('./libraryRoutes');
router.use('/library', libraryRoutes);

// --- Rutas de Control de Acceso (Uso Gratuito) ---
router.post('/usage/verify', auth, usageController.checkAccess); // ✅ NUEVO
router.get('/usage/check-ai-limits', auth, checkAILimits('monthly_flashcards'), (req, res) => {
    req.usageType = null;
    return res.json({ allowed: true });
}); // ✅ NUEVO: Validación pasiva de saldos sin gastarlos

// --- Rutas de Preferencias de Usuario (Multi-Simulador) ---
router.get('/users/preferences', auth, (req, res) => userPreferencesController.getPreferences(req, res));
router.post('/users/preferences', auth, (req, res) => userPreferencesController.savePreferences(req, res));

// --- Rutas de Autenticación (Prefijo /api/auth) ---
router.post('/auth/login', authLimiter, authController.login);
router.post('/auth/register', authLimiter, authController.register);
router.get('/auth/me', auth, authController.getMe);
router.put('/auth/change-password', auth, authController.changePassword);
router.post('/auth/forgot-password', authLimiter, authController.forgotPassword); // ✅ NUEVO
router.post('/auth/sync', authLimiter, authController.syncUser); // ✅ NUEVO: Sync de Google
router.get('/auth/verify-email', authController.verifyEmail);
router.post('/auth/users/:id/reset-password', auth, adminOnly, authController.adminResetPassword);
router.delete('/auth/delete-account', auth, authController.deleteAccount); // ✅ NUEVO: Eliminar cuenta

// --- Rutas de Chat (Prefijo /api/chat) ---
// SE AGREGA checkAILimits('chat_standard') ANTES DE PROCESS MESSAGE
router.post('/chat', auth, usageMiddleware, checkAILimits('chat_standard'), chatController.processMessage); // ✅ Middleware aplicado
router.get('/chat/conversations', auth, chatController.getUserConversations);
router.get('/chat/conversations/:id', auth, chatController.getConversationMessages);
router.put('/chat/conversations/:id', auth, chatController.updateConversationTitle);
router.delete('/chat/conversations/:id', auth, chatController.deleteConversation);
router.post('/chat/train-model', auth, adminOnly, chatController.trainModel);

// --- Rutas Públicas ---
router.get('/buscar', optionalAuth, coursesController.searchCourses);
router.get('/careers', coursesController.getCareers);
router.get('/courses', coursesController.getCourses);

// --- Rutas de Demostración (Públicas) ---


router.get('/topics', coursesController.getTopics);
router.get('/books', coursesController.getBooks);
router.get('/resources', coursesController.getBooks); // ✅ Alias dinámico para todos los recursos (Categorías/Directorios)
router.get('/books/medical', coursesController.getMedicalBooks); // ✅ NUEVO: Libros de Medicina

// ✅ RUTAS DE CONTENIDO DESTACADO (Analytics)
router.get('/analytics/featured-books', analyticsController.getFeaturedBooks);
router.get('/analytics/featured-courses', analyticsController.getFeaturedCourses);

// ✅ NUEVO: Rutas para obtener detalles por ID
router.get('/careers/:id', coursesController.getCareerById);
router.get('/courses/:id', coursesController.getCourseById);
router.get('/topics/:id', coursesController.getTopicById);

// --- Rutas CRUD Protegidas para el Panel de Administración ---
router.get('/students', auth, adminOnly, coursesController.getStudents);

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
// ✅ NUEVO: Ruta para registrar una vista de página. (Accesible para invitados y registrados)
router.post('/analytics/view', optionalAuth, analyticsController.recordView.bind(analyticsController));

// --- Rutas Internas (para servicios de ML) ---
router.get('/internal/analytics-data', analyticsController.getAnalyticsForML);
router.get('/internal/ml-data', coursesController.getDataForML);

// --- Rutas de Quiz (Gamificación) ---
router.post('/quiz/start', auth, checkAILimits('simulator'), quizController.startQuiz);
router.post('/quiz/next-batch', auth, checkAILimits('simulator'), quizController.getNextBatch); // ✅ NUEVO
router.post('/quiz/submit', auth, quizController.submitScore); // Updated logic
router.get('/quiz/stats', optionalAuth, quizController.getStats);
router.get('/quiz/evolution', optionalAuth, quizController.getEvolution); // ✅ NEW endpoint
router.get('/quiz/leaderboard', auth, quizController.getLeaderboard);

// --- DECKS & FLASHCARDS ---
const DeckController = require('../../application/controllers/deckController');
// The original `quizController` from the main import is used for quiz routes.
// This `QuizController` import is specifically for legacy/review routes.
// const QuizController = require('../../application/controllers/quizController'); // Legacy for review

router.get('/decks', optionalAuth, DeckController.listDecks);
router.get('/decks/:deckId', optionalAuth, DeckController.getDeckById); // ✅ NUEVO: Fetch Single Deck
router.post('/decks', auth, DeckController.createDeck);
router.get('/decks/:deckId/cards/due', auth, DeckController.getDueCards);
router.get('/decks/:deckId/cards', optionalAuth, DeckController.listCards); // ✅ NUEVO
router.post('/decks/:deckId/cards', auth, DeckController.addCard); // ✅ NUEVO
router.post('/decks/:deckId/generate', auth, checkAILimits('monthly_flashcards'), DeckController.generateCards); // ✅✨ NUEVO: IA Gen
router.put('/decks/:deckId', auth, DeckController.updateDeck); // ✅ NUEVO: Rename
router.delete('/decks/:deckId', auth, DeckController.deleteDeck); // ✅ NUEVO
router.put('/decks/:deckId/cards/reorder', auth, DeckController.reorderCards); // ✅ NUEVO: Reorder
router.delete('/cards/batch', auth, DeckController.deleteBulkCards); // ✅ NUEVO: Batch Delete
router.put('/cards/:cardId', auth, DeckController.updateCard); // ✅ NUEVO
router.delete('/cards/:cardId', auth, DeckController.deleteCard); // ✅ NUEVO

// Legacy/Direct Review Routes (Mantenidos por compatibilidad, pero redirigidos a lógica de mazos si es necesario)
router.get('/training/flashcards/due', auth, quizController.getDueFlashcards); // Global due
router.post('/training/flashcards/review', auth, quizController.reviewFlashcard);
router.post('/training/flashcards/check-saved', auth, quizController.checkSavedFlashcards); // ✅ NUEVO
router.post('/training/flashcards/save-from-question', auth, quizController.saveFlashcardFromQuestion); // ✅ NUEVO

// --- Rutas de Quiz Battle (Arena / Arcade) ---
const quizGameController = require('../../application/controllers/quizGameController');
router.post('/arena/start', auth, checkAILimits('quiz_arena'), quizGameController.startGame);
router.post('/arena/questions', auth, quizGameController.getQuestions); // ✅ NUEVO: Fetch Background
router.post('/arena/submit', auth, quizGameController.submitScore);
router.get('/arena/ranking', optionalAuth, quizGameController.getRanking);
router.get('/arena/stats', auth, quizGameController.getUserStats);

// --- Rutas de Analytics Personalizados (Heatmap, etc) ---
const customAnalyticsRoutes = require('./analyticsRoutes');
router.use('/analytics', customAnalyticsRoutes);

module.exports = router;
