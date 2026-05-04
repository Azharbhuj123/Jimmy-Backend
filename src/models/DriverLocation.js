const mongoose = require('mongoose');

const driverLocationSchema = new mongoose.Schema(
  {
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },
    lastSeen: {
      type: Date,
      default: Date.now,
      expires: 1800, // TTL index: Document expires after 1800 seconds (30 mins) of inactivity
    },
  },
  { timestamps: true }
);

driverLocationSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('DriverLocation', driverLocationSchema);
