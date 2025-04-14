const express = require('express');
const router = express.Router();
const { User, Bus, Booking } = require('../models');
const { protect, isAdmin } = require('../middleware/auth');

// Admin dashboard - handle both / and /dashboard paths
router.get(['/', '/dashboard'], protect, isAdmin, async (req, res) => {
    try {
        const [users, buses, bookings] = await Promise.all([
            User.findAll(),
            Bus.findAll(),
            Booking.findAll({
                include: [
                    { model: User, as: 'user', attributes: ['firstName', 'lastName'] },
                    { model: Bus, as: 'bus', attributes: ['busName', 'busNumber'] }
                ],
                order: [['createdAt', 'DESC']],
                limit: 5
            })
        ]);

        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            users,
            buses,
            bookings,
            messages: {
                success: res.locals.success_msg,
                error: res.locals.error_msg || res.locals.error,
                info: res.locals.info_msg,
                warning: res.locals.warning_msg
            }
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        req.flash('error_msg', 'Error loading dashboard');
        res.redirect('/');
    }
});

// Bus management routes
router.get('/buses', protect, isAdmin, async (req, res) => {
    console.log('Accessing bus management');
    console.log('User:', req.session.user);
    try {
        const buses = await Bus.findAll();
        console.log('Buses:', buses);
        res.render('admin/buses', { 
            title: 'Manage Buses', 
            buses,
            messages: {
                success: res.locals.success_msg,
                error: res.locals.error_msg || res.locals.error,
                info: res.locals.info_msg,
                warning: res.locals.warning_msg
            }
        });
    } catch (error) {
        console.error('Buses error:', error);
        req.flash('error_msg', 'Error loading buses');
        res.redirect('/admin');
    }
});

// Get all users (admin only)
router.get('/users', protect, isAdmin, async (req, res) => {
    console.log('Accessing user management');
    console.log('User:', req.session.user);
    try {
        const users = await User.findAll({
            attributes: ['id', 'firstName', 'lastName', 'email', 'role', 'createdAt']
        });
        console.log('Users:', users);
        res.render('admin/users', { 
            title: 'Manage Users', 
            users,
            messages: {
                success: res.locals.success_msg,
                error: res.locals.error_msg || res.locals.error,
                info: res.locals.info_msg,
                warning: res.locals.warning_msg
            }
        });
    } catch (error) {
        console.error('Users error:', error);
        req.flash('error_msg', 'Error loading users');
        res.redirect('/admin');
    }
});

// Get all bookings (admin only)
router.get('/bookings', protect, isAdmin, async (req, res) => {
    console.log('Accessing booking management');
    console.log('User:', req.session.user);
    try {
        const bookings = await Booking.findAll({
            include: [
                { model: User, as: 'user' },
                { model: Bus, as: 'bus' }
            ],
            order: [['createdAt', 'DESC']]
        });
        console.log('Bookings:', bookings);
        res.render('admin/bookings', { 
            title: 'All Bookings', 
            bookings,
            messages: {
                success: res.locals.success_msg,
                error: res.locals.error_msg || res.locals.error,
                info: res.locals.info_msg,
                warning: res.locals.warning_msg
            }
        });
    } catch (error) {
        console.error('Bookings error:', error);
        req.flash('error_msg', 'Error loading bookings');
        res.redirect('/admin');
    }
});

// Add new bus
router.post('/buses', protect, isAdmin, async (req, res) => {
    try {
        const bus = await Bus.create({
            busNumber: req.body.busNumber,
            busType: req.body.busType,
            source: req.body.source,
            destination: req.body.destination,
            departureTime: req.body.departureTime,
            arrivalTime: req.body.arrivalTime,
            fare: req.body.fare,
            totalSeats: req.body.totalSeats,
            availableSeats: req.body.totalSeats
        });
        req.flash('success_msg', 'Bus added successfully');
        res.redirect('/admin/buses');
    } catch (error) {
        console.error('Add bus error:', error);
        req.flash('error_msg', 'Error adding bus');
        res.redirect('/admin/buses');
    }
});

// Update bus
router.put('/buses/:id', protect, isAdmin, async (req, res) => {
    try {
        const bus = await Bus.findByPk(req.params.id);
        if (!bus) {
            req.flash('error_msg', 'Bus not found');
            return res.redirect('/admin/buses');
        }

        await bus.update({
            busNumber: req.body.busNumber,
            busType: req.body.busType,
            source: req.body.source,
            destination: req.body.destination,
            departureTime: req.body.departureTime,
            arrivalTime: req.body.arrivalTime,
            fare: req.body.fare,
            totalSeats: req.body.totalSeats,
            availableSeats: req.body.totalSeats
        });

        req.flash('success_msg', 'Bus updated successfully');
        res.redirect('/admin/buses');
    } catch (error) {
        console.error('Update bus error:', error);
        req.flash('error_msg', 'Error updating bus');
        res.redirect('/admin/buses');
    }
});

// Delete bus
router.delete('/buses/:id', protect, isAdmin, async (req, res) => {
    try {
        const bus = await Bus.findByPk(req.params.id);
        if (!bus) {
            req.flash('error_msg', 'Bus not found');
            return res.redirect('/admin/buses');
        }

        await bus.destroy();
        req.flash('success_msg', 'Bus deleted successfully');
        res.redirect('/admin/buses');
    } catch (error) {
        console.error('Delete bus error:', error);
        req.flash('error_msg', 'Error deleting bus');
        res.redirect('/admin/buses');
    }
});

module.exports = router; 