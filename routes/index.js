const express = require('express');
const router = express.Router();

// Home page route
router.get('/', (req, res) => {
    res.render('index', { title: 'Bus Booking System' });
});

module.exports = router; 