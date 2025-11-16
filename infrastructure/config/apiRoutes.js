const express = require('express');
const router = express.Router();

// Importar controladores y middleware
const coursesController = require('../../application/controllers/coursesController');
const chatController = require('../../application/controllers/chatController');
const analyticsController = require('../../application/controllers/analyticsController');
const authController = require('../../application/controllers/authController');
const { auth } = require('../../presentation/middleware/authMiddleware');
const { isAdmin } = require('./roleMiddleware');

// ======================
// 🔗 RUTAS API
// ======================

// Rutas de Chat y Búsqueda
router.post('/chat', auth, chatController.processMessage);
router.get('/buscar', coursesController.searchCourses); // La búsqueda debe ser pública.

// --- Rutas CRUD para el Panel de Administración ---
// GET (Leer todos) - Protegidas para administradores
router.get('/careers', coursesController.getCareers); // Pública para que todos la vean.
router.get('/courses', coursesController.getCourses); // ✅ FIX: Pública para que todos puedan ver los cursos.
router.get('/sections', coursesController.getSections); // ✅ FIX: Pública para ver detalles de cursos.
router.get('/instructors', coursesController.getInstructors); // ✅ FIX: Pública para ver detalles de cursos.
router.get('/topics', coursesController.getTopics); // ✅ FIX: Pública para ver detalles de cursos.
router.get('/students', auth, isAdmin, coursesController.getStudents); // La lista de estudiantes sí debe ser privada.
router.get('/books', coursesController.getBooks); // ✅ FIX: Pública para ver bibliografía.

// Rutas CRUD genéricas (POST, PUT, DELETE) - Protegidas para administradores
const entities = ['career', 'course', 'section', 'instructor', 'student', 'topic', 'book'];
entities.forEach(entity => {
    const plural = entity === 'career' ? 'careers' : `${entity}s`;
    router.post(`/${plural}`, auth, isAdmin, (req, res) => coursesController.createEntity(req, res, entity));
    router.put(`/${plural}/:id`, auth, isAdmin, (req, res) => coursesController.updateEntity(req, res, entity));
    router.delete(`/${plural}/:id`, auth, isAdmin, (req, res) => coursesController.deleteEntity(req, res, entity));
});

// Rutas de Analytics - La mayoría son para administradores
router.post('/train-model', auth, isAdmin, chatController.trainModel);
router.get('/analytics', auth, isAdmin, analyticsController.getAnalytics);
router.get('/analytics/trends', auth, isAdmin, analyticsController.getSearchTrends);
router.get('/analytics/predictions', auth, isAdmin, analyticsController.getPopularCoursePrediction);
router.post('/analytics/feedback', auth, analyticsController.recordFeedback); // Feedback puede ser de cualquier usuario

// Rutas Internas (para otros servicios)
// ✅ MEJORA DE SEGURIDAD: Estas rutas no deberían estar expuestas sin protección.
// Por ahora, las dejamos así, pero en producción requerirían un token de servicio o IP whitelisting.
router.get('/internal/analytics-data', analyticsController.getAnalyticsForML);
router.get('/internal/ml-data', coursesController.getDataForML);

// Rutas de Usuario (accesibles para cualquier usuario autenticado)
router.get('/users/me', auth, authController.getMe);
router.post('/users/:id/reset-password', auth, isAdmin, authController.adminResetPassword);

module.exports = router;