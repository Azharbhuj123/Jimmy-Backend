const mongoose = require("mongoose");

const intakeSchema = new mongoose.Schema(
  {
    internal_id: {
      type: String,
      unique: true,
    },
    device_info: {
      name: { type: String, required: true, trim: true },
      capacity: { type: String, required: true, trim: true }, // e.g., 256GB
      carrier_status: { type: String, required: true, trim: true }, // e.g., Unlocked
      imei: { type: String, trim: true, default: "" }, // For direct IMEI lookup
    },
    imei_screenshot_url: {
      type: String,
      trim: true,
      default: "",
    },
    battery_info: {
      health_percentage: { type: Number, min: 0, max: 100, default: 100 },
      cycle_count: { type: Number, min: 0, default: 0 },
    },
    physical_condition: {
      condition: {
        type: String,
        enum: ["Mint", "Excellent", "Good", "Fair", "Cracked", "Heavy Wear"],
        required: true,
      },
      cosmetic_notes: { type: String, trim: true, default: "" },
    },
    functional_testing: {
      face_id: { type: Boolean, default: true },
      cameras: { type: Boolean, default: true },
      speakers: { type: Boolean, default: true },
      charging: { type: Boolean, default: true },
      cellular: { type: Boolean, default: true },
      wifi: { type: Boolean, default: true },
      buttons: { type: Boolean, default: true },
    },
    acquisition_info: {
      purchase_price: { type: Number, required: true, min: 0 },
      payment_method: {
        type: String,
        enum: ["Cash", "Zelle", "Venmo", "Apple Pay", "Cash App"],
        required: true,
      },
    },
    // Optional seller contact info (for repricing notifications)
    client_email: { type: String, trim: true, default: "" },
    client_name: { type: String, trim: true, default: "" },
    tracking: {
      employee: { type: String, trim: true, default: "Unassigned Employee" },
      lead_source: { type: String, trim: true, default: "Walk-in" },
      listed_where: { type: String, trim: true, default: "Unlisted" },
      acquisition_location: { type: String, trim: true, default: "Storefront" },
      freeform_notes: { type: String, trim: true, default: "" },
    },
    order_status: {
      type: String,
      enum: [
        "Unassigned",
        "Assigned",
        "Driver En Route",
        "Arrived",
        "Device Inspected",
        "Payment Sent",
        "Completed",
        "Failed Pickup",
        "No Show",
        "Counteroffer Needed",
      ],
      default: "Unassigned",
    },
  },
  { timestamps: true }
);

// Auto-generate unique internal tracking ID (e.g. QC-10482)
intakeSchema.pre("save", async function (next) {
  if (!this.internal_id) {
    const count = await mongoose.model("Intake").countDocuments();
    // Start at 10001 to ensure 5 digit format QC-XXXXX
    this.internal_id = `QC-${String(count + 10000 + 1)}`;
  }
  next();
});

module.exports = mongoose.model("Intake", intakeSchema);
