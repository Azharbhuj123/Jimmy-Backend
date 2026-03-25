const mongoose = require('mongoose');

const selectedOptionSchema = new mongoose.Schema(
  {
    stepKey: { type: String, required: true },
    stepTitle: { type: String, required: true },
    optionLabel: { type: String, required: true },
    optionValue: { type: String, required: true },
    priceModifier: { type: Number, default: 0 },
    modifierType: { type: String, enum: ['fixed', 'percentage'], default: 'fixed' },
  },
  { _id: false }
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    changedAt: { type: Date, default: Date.now },
    note: { type: String },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    selectedOptions: [selectedOptionSchema],
    basePrice: {
      type: Number,
      required: true,
    },
    calculatedPrice: {
      type: Number,
      required: true,
    },
    priceBreakdown: {
      type: mongoose.Schema.Types.Mixed, // detailed breakdown
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'received', 'inspected', 'paid'],
      default: 'pending',
    },
    statusHistory: [statusHistorySchema],
    userDetails: {
      name: String,
      email: String,
      phone: String,
      address: String,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Auto-generate order number
orderSchema.pre('save', async function (next) {
  if (!this.orderNumber) {
    const count = await mongoose.model('Order').countDocuments();
    this.orderNumber = `ORD-${Date.now()}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);
