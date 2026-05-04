const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      unique: true,
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
    image: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    defaultPricing: {
      baseMargin: { type: Number, default: 0 },
    },
    inspectionSteps: [
      {
        name: String,
        key: String,
        required: Boolean,
      }
    ],
    conditionGradingRules: [
      {
        condition: String,
        multiplier: Number,
      }
    ],
    payoutLogic: {
      formula: String,
    }
  },
  { timestamps: true }
);

categorySchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.slug = this.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  }
  next();
});

module.exports = mongoose.model('Category', categorySchema);
