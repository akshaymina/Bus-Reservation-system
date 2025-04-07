const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Bus = sequelize.define('Bus', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    busNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    busName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    source: {
        type: DataTypes.STRING,
        allowNull: false
    },
    destination: {
        type: DataTypes.STRING,
        allowNull: false
    },
    departureTime: {
        type: DataTypes.DATE,
        allowNull: false
    },
    arrivalTime: {
        type: DataTypes.DATE,
        allowNull: false
    },
    totalSeats: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 40
    },
    seatLayout: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
        validate: {
            isValidSeatLayout(value) {
                // Validate that seatLayout is an object with seat numbers as keys
                if (typeof value !== 'object') {
                    throw new Error('Seat layout must be an object');
                }
                
                // Each seat should have a status property
                for (const seatNumber in value) {
                    if (!value[seatNumber].hasOwnProperty('status')) {
                        throw new Error(`Seat ${seatNumber} must have a status property`);
                    }
                    if (!['available', 'booked', 'blocked'].includes(value[seatNumber].status)) {
                        throw new Error(`Invalid status for seat ${seatNumber}`);
                    }
                }
            }
        }
    },
    fare: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    busType: {
        type: DataTypes.ENUM('AC', 'Non-AC', 'Sleeper', 'Semi-Sleeper'),
        allowNull: false
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    validate: {
        arrivalAfterDeparture() {
            if (this.arrivalTime <= this.departureTime) {
                throw new Error('Arrival time must be after departure time');
            }
        }
    },
    hooks: {
        beforeCreate: (bus) => {
            // Initialize seat layout if not provided
            if (!bus.seatLayout || Object.keys(bus.seatLayout).length === 0) {
                const layout = {};
                for (let i = 1; i <= bus.totalSeats; i++) {
                    layout[i] = {
                        status: 'available',
                        seatType: 'standard', // Can be 'standard', 'premium', etc.
                        price: bus.fare // Default price, can be modified for premium seats
                    };
                }
                bus.seatLayout = layout;
            }
        }
    }
});

// Instance method to get available seats
Bus.prototype.getAvailableSeats = function() {
    return Object.entries(this.seatLayout)
        .filter(([_, seat]) => seat.status === 'available')
        .map(([seatNumber]) => parseInt(seatNumber));
};

// Instance method to check if seats are available
Bus.prototype.areSeatsAvailable = function(seatNumbers) {
    return seatNumbers.every(seatNumber => 
        this.seatLayout[seatNumber] && 
        this.seatLayout[seatNumber].status === 'available'
    );
};

// Instance method to block seats
Bus.prototype.blockSeats = function(seatNumbers) {
    seatNumbers.forEach(seatNumber => {
        if (this.seatLayout[seatNumber]) {
            this.seatLayout[seatNumber].status = 'blocked';
        }
    });
    return this.save();
};

// Instance method to book seats
Bus.prototype.bookSeats = function(seatNumbers) {
    seatNumbers.forEach(seatNumber => {
        if (this.seatLayout[seatNumber]) {
            this.seatLayout[seatNumber].status = 'booked';
        }
    });
    return this.save();
};

// Instance method to unblock seats
Bus.prototype.unblockSeats = function(seatNumbers) {
    seatNumbers.forEach(seatNumber => {
        if (this.seatLayout[seatNumber]) {
            this.seatLayout[seatNumber].status = 'available';
        }
    });
    return this.save();
};

module.exports = { Bus }; 