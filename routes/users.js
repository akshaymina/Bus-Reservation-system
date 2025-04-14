const express = require('express');
const router = express.Router();
const { User } = require('../models');
const { protect } = require('../middleware/auth');

// Add any user-specific routes here that aren't related to authentication
// For example: user preferences, user settings, etc.

module.exports = router; 