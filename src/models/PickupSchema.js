const mongoose = require("mongoose");

const pickupDetailsSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    phone: { type: String, trim: true },
    addressLine1: { type: String, trim: true },
    addressLine2: { type: String, trim: true },
    zipCode: { type: String, trim: true },
    pickupDate: { type: Date, trim: true },
    time: { type: String, trim: true },
    phone: { type: String, trim: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "Driver" },
  },
  { _id: false },
);


module.exports = pickupDetailsSchema;


