const { Bus } = require('../models/bus');
const { Op } = require('sequelize');

// Get all buses with optional filtering
exports.getAllBuses = async (req, res) => {
    try {
        const { 
            source, 
            destination, 
            date, 
            busType, 
            minFare, 
            maxFare,
            page = 1,
            limit = 10
        } = req.query;

        // Build filter conditions
        const where = {};
        if (source) where.source = { [Op.iLike]: `%${source}%` };
        if (destination) where.destination = { [Op.iLike]: `%${destination}%` };
        if (busType) where.busType = busType;
        if (minFare || maxFare) {
            where.fare = {};
            if (minFare) where.fare[Op.gte] = parseFloat(minFare);
            if (maxFare) where.fare[Op.lte] = parseFloat(maxFare);
        }
        if (date) {
            const searchDate = new Date(date);
            searchDate.setHours(0, 0, 0, 0);
            const nextDay = new Date(searchDate);
            nextDay.setDate(nextDay.getDate() + 1);
            where.departureTime = {
                [Op.gte]: searchDate,
                [Op.lt]: nextDay
            };
        }

        // Get buses with pagination
        const offset = (page - 1) * limit;
        const { count, rows } = await Bus.findAndCountAll({
            where,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['departureTime', 'ASC']]
        });

        res.json({
            success: true,
            count,
            totalPages: Math.ceil(count / limit),
            currentPage: parseInt(page),
            buses: rows
        });
    } catch (error) {
        console.error('Error fetching buses:', error);
        res.status(500).json({ message: 'Error fetching buses', error: error.message });
    }
};

// Get a single bus by ID
exports.getBusById = async (req, res) => {
    try {
        const bus = await Bus.findByPk(req.params.id);
        
        if (!bus) {
            return res.status(404).json({ message: 'Bus not found' });
        }

        res.json({ success: true, bus });
    } catch (error) {
        console.error('Error fetching bus:', error);
        res.status(500).json({ message: 'Error fetching bus', error: error.message });
    }
};

// Create a new bus (admin only)
exports.createBus = async (req, res) => {
    try {
        const {
            busNumber,
            busName,
            source,
            destination,
            departureTime,
            arrivalTime,
            totalSeats,
            fare,
            busType
        } = req.body;

        // Check if bus number already exists
        const existingBus = await Bus.findOne({ where: { busNumber } });
        if (existingBus) {
            return res.status(400).json({ message: 'Bus number already exists' });
        }

        // Create new bus
        const bus = await Bus.create({
            busNumber,
            busName,
            source,
            destination,
            departureTime,
            arrivalTime,
            totalSeats,
            fare,
            busType
        });

        res.status(201).json({
            success: true,
            message: 'Bus created successfully',
            bus
        });
    } catch (error) {
        console.error('Error creating bus:', error);
        res.status(500).json({ message: 'Error creating bus', error: error.message });
    }
};

// Update a bus (admin only)
exports.updateBus = async (req, res) => {
    try {
        const bus = await Bus.findByPk(req.params.id);
        
        if (!bus) {
            return res.status(404).json({ message: 'Bus not found' });
        }

        // Update bus fields
        const {
            busNumber,
            busName,
            source,
            destination,
            departureTime,
            arrivalTime,
            totalSeats,
            fare,
            busType,
            isActive
        } = req.body;

        if (busNumber) bus.busNumber = busNumber;
        if (busName) bus.busName = busName;
        if (source) bus.source = source;
        if (destination) bus.destination = destination;
        if (departureTime) bus.departureTime = departureTime;
        if (arrivalTime) bus.arrivalTime = arrivalTime;
        if (totalSeats) bus.totalSeats = totalSeats;
        if (fare) bus.fare = fare;
        if (busType) bus.busType = busType;
        if (isActive !== undefined) bus.isActive = isActive;

        await bus.save();

        res.json({
            success: true,
            message: 'Bus updated successfully',
            bus
        });
    } catch (error) {
        console.error('Error updating bus:', error);
        res.status(500).json({ message: 'Error updating bus', error: error.message });
    }
};

// Delete a bus (admin only)
exports.deleteBus = async (req, res) => {
    try {
        const bus = await Bus.findByPk(req.params.id);
        
        if (!bus) {
            return res.status(404).json({ message: 'Bus not found' });
        }

        // Check if bus has any bookings
        const bookings = await bus.getBookings();
        if (bookings.length > 0) {
            return res.status(400).json({ 
                message: 'Cannot delete bus with existing bookings. Deactivate instead.' 
            });
        }

        await bus.destroy();

        res.json({
            success: true,
            message: 'Bus deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting bus:', error);
        res.status(500).json({ message: 'Error deleting bus', error: error.message });
    }
};

// Get bus seat layout
exports.getBusSeatLayout = async (req, res) => {
    try {
        const bus = await Bus.findByPk(req.params.id);
        
        if (!bus) {
            return res.status(404).json({ message: 'Bus not found' });
        }

        res.json({
            success: true,
            seatLayout: bus.seatLayout
        });
    } catch (error) {
        console.error('Error fetching bus seat layout:', error);
        res.status(500).json({ message: 'Error fetching bus seat layout', error: error.message });
    }
};

// Update bus seat layout (admin only)
exports.updateBusSeatLayout = async (req, res) => {
    try {
        const bus = await Bus.findByPk(req.params.id);
        
        if (!bus) {
            return res.status(404).json({ message: 'Bus not found' });
        }

        const { seatLayout } = req.body;
        
        if (!seatLayout) {
            return res.status(400).json({ message: 'Seat layout is required' });
        }

        bus.seatLayout = seatLayout;
        await bus.save();

        res.json({
            success: true,
            message: 'Bus seat layout updated successfully',
            seatLayout: bus.seatLayout
        });
    } catch (error) {
        console.error('Error updating bus seat layout:', error);
        res.status(500).json({ message: 'Error updating bus seat layout', error: error.message });
    }
}; 