const mongoose = require('mongoose');

const pickupSchema = new mongoose.Schema(
  {
    pickupId: {
      type: String,
      required: true,
      unique: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: ['unassigned', 'assigned', 'en_route', 'completed', 'failed'],
      default: 'unassigned',
    },
    pickupLocation: {
      type: {
        type: String,
        enum: ['Point'],
        // required: true,
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        // required: true,
      },
    },
    pickupAddress: {
      type: String,
      // required: true,
    },
    pickupNotes: {
      type: String,
    },
    pickupFlags: {
      type: [String],
      enum: ['meet_at_police_station', 'customer_negotiating', 'high_risk', 'repeat_seller'],
    },
    quotedPayout: {
      type: Number,
      required: true,
    },
    expectedResale: {
      type: Number,
      required: true,
    },
    profit: {
      type: Number,
    },
    urgency: {
      type: String,
      enum: ['asap', 'scheduled', 'late'],
      default: 'asap',
    },
    timeSlot: {
      start: Date,
      end: Date,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
    },
  },
  { timestamps: true }
);

pickupSchema.index({ pickupLocation: '2dsphere' });

pickupSchema.pre('save', function (next) {
  if (this.expectedResale != null && this.quotedPayout != null) {
    this.profit = this.expectedResale - this.quotedPayout;
  }
  next();
});

module.exports = mongoose.model('Pickup', pickupSchema);
