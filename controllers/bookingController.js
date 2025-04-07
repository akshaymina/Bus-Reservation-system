const { Bus, Booking, User } = require('../models');
const { Op } = require('sequelize');

// Get all bookings (with filters for admin)
exports.getAllBookings = async (req, res) => {
    try {
        const { status, startDate, endDate, busId, userId, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const where = {};
        
        // Add filters if provided
        if (status) where.status = status;
        if (busId) where.busId = busId;
        if (userId) where.userId = userId;
        if (startDate && endDate) {
            where.createdAt = {
                [Op.between]: [new Date(startDate), new Date(endDate)]
            };
        }

        // If user is not admin, only show their bookings
        if (req.user.role !== 'admin') {
            where.userId = req.user.id;
        }

        const { count, rows: bookings } = await Booking.findAndCountAll({
            where,
            include: [
                { model: Bus, attributes: ['busNumber', 'source', 'destination', 'departureTime', 'arrivalTime'] },
                { model: User, attributes: ['name', 'email'] }
            ],
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.render('bookings/index', {
            bookings,
            currentPage: parseInt(page),
            totalPages: Math.ceil(count / limit),
            filters: req.query
        });
    } catch (error) {
        console.error('Error fetching bookings:', error);
        req.flash('error', 'Error fetching bookings');
        res.redirect('/');
    }
};

// Get booking by ID
exports.getBookingById = async (req, res) => {
    try {
        const booking = await Booking.findByPk(req.params.id, {
            include: [
                { model: Bus, attributes: ['busNumber', 'source', 'destination', 'departureTime', 'arrivalTime', 'fare'] },
                { model: User, attributes: ['name', 'email'] }
            ]
        });

        if (!booking) {
            req.flash('error', 'Booking not found');
            return res.redirect('/bookings');
        }

        // Check if user has permission to view this booking
        if (req.user.role !== 'admin' && booking.userId !== req.user.id) {
            req.flash('error', 'You do not have permission to view this booking');
            return res.redirect('/bookings');
        }

        res.render('bookings/show', { booking });
    } catch (error) {
        console.error('Error fetching booking:', error);
        req.flash('error', 'Error fetching booking details');
        res.redirect('/bookings');
    }
};

// Show booking form
exports.showBookingForm = async (req, res) => {
    try {
        const bus = await Bus.findByPk(req.query.busId);
        if (!bus) {
            req.flash('error', 'Bus not found');
            return res.redirect('/buses');
        }

        // Check if bus has available seats
        if (bus.totalSeats <= bus.bookedSeats) {
            req.flash('error', 'Sorry, this bus is fully booked');
            return res.redirect(`/buses/${bus.id}`);
        }

        const seatLayout = JSON.parse(bus.seatLayout || '{}');
        res.render('bookings/new', { bus, seatLayout });
    } catch (error) {
        console.error('Error showing booking form:', error);
        req.flash('error', 'Error loading booking form');
        res.redirect('/buses');
    }
};

// Create new booking
exports.createBooking = async (req, res) => {
    try {
        const { busId, seats, passengerDetails } = req.body;
        const bus = await Bus.findByPk(busId);

        if (!bus) {
            req.flash('error', 'Bus not found');
            return res.redirect('/buses');
        }

        // Validate seat availability
        const selectedSeats = JSON.parse(seats);
        const seatLayout = JSON.parse(bus.seatLayout || '{}');
        
        // Check if selected seats are available
        for (const seatNumber of selectedSeats) {
            if (seatLayout[seatNumber] === 'booked') {
                req.flash('error', `Seat ${seatNumber} is already booked`);
                return res.redirect(`/buses/${busId}`);
            }
        }

        // Create booking
        const booking = await Booking.create({
            userId: req.user.id,
            busId,
            seats: selectedSeats,
            passengerDetails: JSON.parse(passengerDetails),
            totalAmount: selectedSeats.length * bus.fare,
            status: 'pending'
        });

        // Update bus seat layout and booked seats count
        selectedSeats.forEach(seatNumber => {
            seatLayout[seatNumber] = 'booked';
        });
        
        await bus.update({
            seatLayout: JSON.stringify(seatLayout),
            bookedSeats: bus.bookedSeats + selectedSeats.length
        });

        req.flash('success', 'Booking created successfully');
        res.redirect(`/bookings/${booking.id}`);
    } catch (error) {
        console.error('Error creating booking:', error);
        req.flash('error', 'Error creating booking');
        res.redirect('/buses');
    }
};

// Cancel booking
exports.cancelBooking = async (req, res) => {
    try {
        const booking = await Booking.findByPk(req.params.id);
        
        if (!booking) {
            req.flash('error', 'Booking not found');
            return res.redirect('/bookings');
        }

        // Check if user has permission to cancel this booking
        if (req.user.role !== 'admin' && booking.userId !== req.user.id) {
            req.flash('error', 'You do not have permission to cancel this booking');
            return res.redirect('/bookings');
        }

        // Check if booking can be cancelled (e.g., not too close to departure)
        const bus = await Bus.findByPk(booking.busId);
        const hoursUntilDeparture = (new Date(bus.departureTime) - new Date()) / (1000 * 60 * 60);
        
        if (hoursUntilDeparture < 2) {
            req.flash('error', 'Bookings can only be cancelled at least 2 hours before departure');
            return res.redirect(`/bookings/${booking.id}`);
        }

        // Update booking status
        await booking.update({ status: 'cancelled' });

        // Update bus seat layout and booked seats count
        const seatLayout = JSON.parse(bus.seatLayout || '{}');
        const bookedSeats = JSON.parse(booking.seats);
        
        bookedSeats.forEach(seatNumber => {
            seatLayout[seatNumber] = 'available';
        });

        await bus.update({
            seatLayout: JSON.stringify(seatLayout),
            bookedSeats: bus.bookedSeats - bookedSeats.length
        });

        req.flash('success', 'Booking cancelled successfully');
        res.redirect(`/bookings/${booking.id}`);
    } catch (error) {
        console.error('Error cancelling booking:', error);
        req.flash('error', 'Error cancelling booking');
        res.redirect('/bookings');
    }
}; 