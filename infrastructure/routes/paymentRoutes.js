const express = require('express');
const router = express.Router();
const paymentController = require('../../application/controllers/paymentController');
const authMiddleware = require('../../infrastructure/middleware/authMiddleware');

// Route to create a preference (requires auth)
router.post('/create-order', authMiddleware.auth, paymentController.createOrder);

// Webhook route (public, needed for Mercado Pago notification)
router.post('/webhook', paymentController.handleWebhook);

module.exports = router;
