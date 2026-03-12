const express = require('express');
const router = express.Router();
const { analyticsController } = require('../../application/controllers'); // Import Instance, not Class
const { auth } = require('../middleware/authMiddleware');

// Heatmap Data
router.get('/heatmap', auth, analyticsController.getHeatmap);

// Diagnose Data con IA (Requiere Token Thinking)
const checkAILimits = require('../../application/middlewares/checkLimitsMiddleware');
router.post('/diagnostic', auth, checkAILimits('chat_standard'), analyticsController.getAIDiagnostic);

module.exports = router;
