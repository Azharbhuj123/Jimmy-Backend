const mongoose = require('mongoose');

// Step option schema — each option within a step
const stepOptionSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true },
    priceModifier: { type: Number, required: true, default: 0 }, // +/- amount OR multiplier
    modifierType: {
      type: String,
      enum: ['fixed', 'percentage'],
      default: 'fixed',
    },
    description: { type: String, trim: true },
  },
  { _id: true }
);

// Step schema — a configuration step like "Storage", "Color", "Condition"
const stepSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    key: { type: String, required: true, trim: true }, // unique key used in selectedOptions
    isRequired: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    options: [stepOptionSchema],
  },
  { _id: true }
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
    },
    brandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Brand',
      required: [true, 'Brand is required'],
    },
    basePrice: {
      type: Number,
      required: [true, 'Base price is required'],
      min: [0, 'Base price cannot be negative'],
    },
    steps: [stepSchema], // dynamic pricing steps
    images: [{ type: String }],
    isActive: {
      type: Boolean,
      default: true,
    },
    totalOrders: {
      type: Number,
      default: 0,
    },
    totalPayout: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

productSchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.slug = this.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '') + '-' + Date.now();
  }
  next();
});

module.exports = mongoose.model('Product', productSchema);
