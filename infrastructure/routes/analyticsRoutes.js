const express = require('express');
const router = express.Router();
const { analyticsController } = require('../../application/controllers'); // Import Instance, not Class
const { auth, optionalAuth, adminOnly } = require('../middleware/authMiddleware');

// Heatmap Data
router.get('/heatmap', auth, analyticsController.getHeatmap);

// ✅ NUEVO: Tráfico en Tiempo Real
router.post('/pulse', optionalAuth, analyticsController.recordPulse);
router.get('/real-time', auth, adminOnly, analyticsController.getRealTimeStats);

// Diagnose Data con IA (Requiere Token Thinking)
const checkAILimits = require('../../application/middlewares/checkLimitsMiddleware');
router.post('/diagnostic', auth, checkAILimits('chat_standard'), analyticsController.getAIDiagnostic);

module.exports = router;
