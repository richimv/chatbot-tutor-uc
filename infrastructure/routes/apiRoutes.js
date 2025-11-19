const express = require('express');
const router = express.Router();

// --- Importar Controladores ---
const { coursesController, analyticsController, authController, chatController } = require('../../application/controllers');

// --- Importar Middleware ---
const { auth, adminOnly } = require('../middleware/authMiddleware');
const { authLimiter } = require('../config/rateLimiters');

// ======================
// 🔗 RUTAS API
// ======================

// --- Rutas de Autenticación (Prefijo /api/auth) ---
router.post('/auth/login', authLimiter, authController.login);
router.post('/auth/register', authLimiter, authController.register);
router.get('/auth/me', auth, authController.getMe);
router.put('/auth/change-password', auth, authController.changePassword);
router.get('/auth/verify-email', authController.verifyEmail);
router.post('/auth/users/:id/reset-password', auth, adminOnly, authController.adminResetPassword);

// --- Rutas de Chat (Prefijo /api/chat) ---
router.post('/chat', auth, chatController.processMessage);
router.get('/chat/conversations', auth, chatController.getUserConversations);
router.get('/chat/conversations/:id', auth, chatController.getConversationMessages);
router.put('/chat/conversations/:id', auth, chatController.updateConversationTitle);
router.delete('/chat/conversations/:id', auth, chatController.deleteConversation);
router.post('/chat/train-model', auth, adminOnly, chatController.trainModel);

// --- Rutas Públicas ---
router.get('/buscar', coursesController.searchCourses);
router.get('/careers', coursesController.getCareers);
router.get('/courses', coursesController.getCourses);
router.get('/sections', coursesController.getSections);
router.get('/instructors', coursesController.getInstructors);
router.get('/topics', coursesController.getTopics);
router.get('/books', coursesController.getBooks);

// --- Rutas CRUD Protegidas para el Panel de Administración ---
router.get('/students', auth, adminOnly, coursesController.getStudents);
const entities = ['career', 'course', 'section', 'instructor', 'student', 'topic', 'book'];
entities.forEach(entity => {
    const plural = entity === 'career' ? 'careers' : `${entity}s`;
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
router.get('/analytics/predictions', auth, adminOnly, analyticsController.getPopularCoursePrediction);
router.get('/analytics/feedback', auth, adminOnly, analyticsController.getFeedback);
router.post('/analytics/feedback', auth, analyticsController.recordFeedback);
// ✅ NUEVO: Ruta para registrar una vista de página.
router.post('/analytics/view', auth, analyticsController.recordView.bind(analyticsController));

// --- Rutas Internas (para servicios de ML) ---
router.get('/internal/analytics-data', analyticsController.getAnalyticsForML);
router.get('/internal/ml-data', coursesController.getDataForML);

module.exports = router;
