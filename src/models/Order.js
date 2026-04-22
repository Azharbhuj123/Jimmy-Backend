const mongoose = require("mongoose");

const selectedOptionSchema = new mongoose.Schema(
  {
    stepKey: { type: String, required: true },
    stepTitle: { type: String, required: true },
    optionLabel: { type: String, required: true },
    optionValue: { type: String, required: true },
    priceModifier: { type: Number, default: 0 },
    modifierType: {
      type: String,
      enum: ["fixed", "percentage"],
      default: "fixed",
    },
  },
  { _id: false },
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    changedAt: { type: Date, default: Date.now },
    note: { type: String },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { _id: false },
);

const shippingDetailsSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    phone: { type: String, trim: true },
    addressLine1: { type: String, trim: true },
    addressLine2: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    zipCode: { type: String, trim: true },
    country: { type: String, trim: true, default: "US" },
    labelUrl: { type: String, trim: true },
    trackingNumber: { type: String, trim: true },
    courier: { type: String, trim: true }, // UPS, FedEx, USPS, etc.
    shippedAt: { type: Date },
  },
  { _id: false },
);

const pickupDetailsSchema = new mongoose.Schema(
  {
    time: { type: String, trim: true },
    phone: { type: String, trim: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "Driver" },
  },
  { _id: false },
);

// Per-item breakdown inside a multi-product order
const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    productName: { type: String },
    selectedOptions: [selectedOptionSchema],
    basePrice: { type: Number, required: true },
    calculatedPrice: { type: Number, required: true },
    priceBreakdown: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: true },
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    guest_email: { type: String, trim: true },

    // ── Multi-product support ─────────────────────────────────────────────────
    items: [orderItemSchema],

    // Totals across all items
    totalBasePrice: { type: Number, required: true },
    totalCalculatedPrice: { type: Number, required: true },

    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "label_sent",
        "shipped",
        "received",
        "inspected",
        "ready_to_pay",
        "paid",
        "cancelled",
      ],
      default: "pending",
    },
    statusHistory: [statusHistorySchema],

    // ── Fulfillment type  ─────────────────────
    fulfillmentType: {
      type: String,
      enum: ["shipping", "pickup"],
      default: "shipping",
    },
    shippingDetails: shippingDetailsSchema,
    pickupDetails: pickupDetailsSchema,

    // ── Payment (admin sends manually) ───────────────────────────────────────
    paymentMethod: {
      type: String,
      enum: ["zelle", "paypal", "check"],
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "sent", "failed"],
      default: "pending",
    },
    transactionId: { type: String, trim: true },
    paidAt: { type: Date },

    // ── User snapshot  ─────────────────────────────
    userDetails: {
      name: String,
      email: String,
      phone: String,
      address: String,
      preferredContact: {
        type: String,
        enum: ["email", "phone", "text"],
        default: "email",
      },
      city: String,
      state: String,
    },

    notes: { type: String, trim: true },
    internalNotes: { type: String, trim: true },
    flags: [{ type: String, trim: true }],
  },
  { timestamps: true },
);

// Auto-generate order number
orderSchema.pre("save", async function (next) {
  if (!this.orderNumber) {
    const count = await mongoose.model("Order").countDocuments();
    this.orderNumber = `ORD-${Date.now()}-${String(count + 1).padStart(4, "0")}`;
  }
  next();
});

module.exports = mongoose.model("Order", orderSchema);
