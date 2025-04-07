const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

// Show payment form
router.get('/checkout/:bookingId', protect, paymentController.showPaymentForm);

// Process payment
router.post('/process/:bookingId', protect, paymentController.processPayment);

// Stripe webhook (no auth required)
router.post('/webhook', express.raw({ type: 'application/json' }), paymentController.handleWebhook);

module.exports = router; 