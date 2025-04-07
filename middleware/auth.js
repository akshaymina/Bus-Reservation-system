const jwt = require('jsonwebtoken');
const { User } = require('../models/user');

// Middleware to protect routes
exports.protect = async (req, res, next) => {
    try {
        let token;

        // Check if token exists in headers
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        // Check if token exists
        if (!token) {
            return res.status(401).json({ message: 'Not authorized to access this route' });
        }

        try {
            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Get user from token
            const user = await User.findByPk(decoded.id);
            if (!user) {
                return res.status(401).json({ message: 'User not found' });
            }

            // Check if user is active
            if (!user.isActive) {
                return res.status(401).json({ message: 'User account is deactivated' });
            }

            // Add user to request object
            req.user = user;
            next();
        } catch (error) {
            return res.status(401).json({ message: 'Not authorized to access this route' });
        }
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Middleware to restrict access to specific roles
exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ 
                message: `User role ${req.user.role} is not authorized to access this route` 
            });
        }
        next();
    };
}; 