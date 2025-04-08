const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Booking, Bus } = require('../models');

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

        // Create Stripe payment intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: booking.totalAmount * 100, // Convert to cents
            currency: 'usd',
            metadata: {
                bookingId: booking.id,
                userId: req.user.id
            }
        });

        res.render('payments/checkout', {
            booking,
            clientSecret: paymentIntent.client_secret,
            stripePublicKey: process.env.STRIPE_PUBLIC_KEY
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
        const { bookingId } = req.params;
        const { paymentIntentId } = req.body;

        const booking = await Booking.findByPk(bookingId);
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        // Verify payment intent
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.status === 'succeeded') {
            // Update booking status
            booking.status = 'confirmed';
            booking.paymentId = paymentIntentId;
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

            return res.json({ success: true });
        } else {
            return res.status(400).json({ error: 'Payment failed' });
        }
    } catch (error) {
        console.error('Error processing payment:', error);
        return res.status(500).json({ error: 'Error processing payment' });
    }
};

// Handle Stripe webhook
exports.handleWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error('Webhook Error:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'payment_intent.succeeded':
            const paymentIntent = event.data.object;
            const bookingId = paymentIntent.metadata.bookingId;

            try {
                const booking = await Booking.findByPk(bookingId);
                if (booking && booking.status !== 'confirmed') {
                    booking.status = 'confirmed';
                    booking.paymentId = paymentIntent.id;
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
            } catch (error) {
                console.error('Error updating booking status:', error);
            }
            break;
            
        case 'payment_intent.payment_failed':
            // Handle failed payment
            break;
            
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
}; 