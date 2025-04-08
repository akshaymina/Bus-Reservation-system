const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Show login form
router.get('/login', authController.showLogin);

// Show registration form
router.get('/register', authController.showRegister);

// Register a new user
router.post('/register', authController.register);

// Login user
router.post('/login', authController.login);

// Logout user
router.get('/logout', authController.logout);

// Protected routes
router.get('/profile', protect, authController.getProfile);
router.put('/profile', protect, authController.updateProfile);
router.put('/change-password', protect, authController.changePassword);

// Password reset routes
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password/:token', authController.resetPassword);

module.exports = router; 