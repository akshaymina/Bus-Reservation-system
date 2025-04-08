const express = require('express');
const router = express.Router();
const { User, Bus, Booking } = require('../models');
const { protect, admin } = require('../middleware/auth');

// Get all users (admin only)
router.get('/users', protect, admin, async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: { exclude: ['password'] }
        });
        
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get user by ID (admin only)
router.get('/users/:id', protect, admin, async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id, {
            attributes: { exclude: ['password'] }
        });
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        res.json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update user (admin only)
router.put('/users/:id', protect, admin, async (req, res) => {
    try {
        const { name, email, role, isActive } = req.body;
        
        const user = await User.findByPk(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Update user fields
        if (name) user.name = name;
        if (email) user.email = email;
        if (role) user.role = role;
        if (isActive !== undefined) user.isActive = isActive;
        
        await user.save();
        
        res.json({ message: 'User updated successfully', user });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete user (admin only)
router.delete('/users/:id', protect, admin, async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        await user.destroy();
        
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get dashboard stats (admin only)
router.get('/dashboard', protect, admin, async (req, res) => {
    try {
        const totalUsers = await User.count();
        const totalBuses = await Bus.count();
        const totalBookings = await Booking.count();
        const confirmedBookings = await Booking.count({ where: { status: 'confirmed' } });
        const pendingBookings = await Booking.count({ where: { status: 'pending' } });
        const cancelledBookings = await Booking.count({ where: { status: 'cancelled' } });
        
        // Calculate total revenue
        const bookings = await Booking.findAll({
            where: { status: 'confirmed' },
            attributes: ['totalAmount']
        });
        
        const totalRevenue = bookings.reduce((sum, booking) => sum + booking.totalAmount, 0);
        
        res.json({
            totalUsers,
            totalBuses,
            totalBookings,
            confirmedBookings,
            pendingBookings,
            cancelledBookings,
            totalRevenue
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router; 