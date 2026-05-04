const mongoose = require("mongoose");

// Step option schema — each option within a step
const stepOptionSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    value: { type: String, trim: true },
    subtext: { type: String, trim: true },
    shipPriceModifier: { type: Number, required: true, default: 0 }, // +/- amount OR multiplier
    pickupPriceModifier: { type: Number, required: true, default: 0 }, // +/- amount OR multiplier
    modifierType: {
      type: String,
      enum: ["fixed", "percentage"],
      default: "fixed",
    },
    description: { type: String, trim: true },
  },
  { _id: true },
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
  { _id: true },
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
    },
    carrier: {
      type: String,
      // required: [true, "Product carrier is required"],
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
    // categoryId: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "Category",
    // },
    brandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      required: [true, "Brand is required"],
    },
    sku: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    basePrice: {
      type: Number,
      required: [true, "Base price is required"],
      min: [0, "Base price cannot be negative"],
    },
    avgResaleValue: {
      type: Number,
      default: 0,
      min: [0, "Resale value cannot be negative"],
    },
    pricingType: {
      type: String,
      enum: ["dynamic", "matrix"],
      default: "dynamic",
    },
    basePrice: {
      type: Number,
      required: [
        function () {
          return this.pricingType !== "matrix";
        },
        "Base price is required",
      ],
      min: [0, "Base price cannot be negative"],
      default: 0,
    },
    pricingMatrix: [
      {
        variant: { type: String, required: true, trim: true, lowercase: true },
        type: { type: String, required: true, trim: true, lowercase: true },
        condition: {
          type: String,
          required: true,
          trim: true,
          lowercase: true,
        },
        price: { type: Number, required: true, min: 0 },
      },
    ],
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
    stock: {
      type: Number,
      default: 0,
      min: [0, "Stock cannot be negative"],
    },
  },
  { timestamps: true },
);

productSchema.index({
  "pricingMatrix.variant": 1,
  "pricingMatrix.type": 1,
  "pricingMatrix.condition": 1,
});

productSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug =
      this.name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^\w-]/g, "") +
      "-" +
      Date.now();
  }
  next();
});

module.exports = mongoose.model("Product", productSchema);
