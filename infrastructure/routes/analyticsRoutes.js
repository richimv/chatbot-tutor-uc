const express = require('express');
const router = express.Router();
const { analyticsController } = require('../../application/controllers'); // Import Instance, not Class
const { auth } = require('../middleware/authMiddleware');

// Heatmap Data
router.get('/heatmap', auth, analyticsController.getHeatmap);

module.exports = router;
