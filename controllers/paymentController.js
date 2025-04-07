const Razorpay = require('razorpay');
const crypto = require('crypto');
const { Booking, Bus } = require('../models');

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Show payment form
exports.showPaymentForm = async (req, res) => {
    try {
        const booking = await Booking.findByPk(req.params.bookingId, {
            include: [{
                model: Bus,
                attributes: ['busNumber', 'source', 'destination', 'departureTime', 'arrivalTime']
            }]
        });

        if (!booking) {
            req.flash('error', 'Booking not found');
            return res.redirect('/bookings');
        }

        // Check if user has permission to view this booking
        if (booking.userId !== req.user.id && req.user.role !== 'admin') {
            req.flash('error', 'You do not have permission to view this booking');
            return res.redirect('/bookings');
        }

        // Check if booking is already paid
        if (booking.status === 'confirmed') {
            req.flash('error', 'This booking has already been paid for');
            return res.redirect(`/bookings/${booking.id}`);
        }

        // Create Razorpay order
        const order = await razorpay.orders.create({
            amount: booking.totalAmount * 100, // Razorpay expects amount in paise
            currency: 'INR',
            receipt: `booking_${booking.id}`,
            notes: {
                bookingId: booking.id,
                userId: req.user.id
            }
        });

        res.render('payments/checkout', {
            booking,
            order,
            razorpayKeyId: process.env.RAZORPAY_KEY_ID
        });
    } catch (error) {
        console.error('Error showing payment form:', error);
        req.flash('error', 'An error occurred while processing your payment');
        res.redirect(`/bookings/${req.params.bookingId}`);
    }
};

// Process payment
exports.processPayment = async (req, res) => {
    try {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
        const bookingId = req.params.bookingId;

        // Verify payment signature
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');

        if (expectedSignature === razorpay_signature) {
            // Payment successful, update booking status
            const booking = await Booking.findByPk(bookingId);
            if (!booking) {
                return res.status(404).json({ success: false, message: 'Booking not found' });
            }

            // Update booking status
            booking.status = 'confirmed';
            booking.paymentId = razorpay_payment_id;
            await booking.save();

            // Update bus seat layout
            const bus = await Bus.findByPk(booking.busId);
            const seatLayout = JSON.parse(bus.seatLayout);
            const bookedSeats = JSON.parse(booking.seats);
            
            bookedSeats.forEach(seatNumber => {
                if (seatLayout[seatNumber]) {
                    seatLayout[seatNumber].status = 'booked';
                }
            });

            bus.seatLayout = JSON.stringify(seatLayout);
            await bus.save();

            res.json({ success: true });
        } else {
            res.status(400).json({ success: false, message: 'Invalid payment signature' });
        }
    } catch (error) {
        console.error('Error processing payment:', error);
        res.status(500).json({ success: false, message: 'An error occurred while processing your payment' });
    }
};

// Handle Razorpay webhook
exports.handleWebhook = async (req, res) => {
    try {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        const signature = req.headers['x-razorpay-signature'];

        const shasum = crypto.createHmac('sha256', webhookSecret);
        shasum.update(JSON.stringify(req.body));
        const digest = shasum.digest('hex');

        if (signature === digest) {
            const event = req.body;

            if (event.event === 'payment.captured') {
                const paymentId = event.payload.payment.entity.id;
                const orderId = event.payload.payment.entity.order_id;
                const order = await razorpay.orders.fetch(orderId);
                const bookingId = order.notes.bookingId;

                // Update booking status
                const booking = await Booking.findByPk(bookingId);
                if (booking && booking.status !== 'confirmed') {
                    booking.status = 'confirmed';
                    booking.paymentId = paymentId;
                    await booking.save();

                    // Update bus seat layout
                    const bus = await Bus.findByPk(booking.busId);
                    const seatLayout = JSON.parse(bus.seatLayout);
                    const bookedSeats = JSON.parse(booking.seats);
                    
                    bookedSeats.forEach(seatNumber => {
                        if (seatLayout[seatNumber]) {
                            seatLayout[seatNumber].status = 'booked';
                        }
                    });

                    bus.seatLayout = JSON.stringify(seatLayout);
                    await bus.save();
                }
            }

            res.json({ received: true });
        } else {
            res.status(400).json({ error: 'Invalid signature' });
        }
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
}; 