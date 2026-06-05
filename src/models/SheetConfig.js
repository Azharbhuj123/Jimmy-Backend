const mongoose = require("mongoose");

const sheetConfigSchema = new mongoose.Schema(
  {
    deviceType: {
      type: String,
      required: true,
      enum: ["iphone", "ipad", "pixel", "samsung", "apple_watch"],
      unique: true,
    }, // "iphone" | "ipad" | "pixel" | "samsung" | "apple_watch"
    sheetName: { type: String, required: true }, // e.g. "iPhone Pricing"
    spreadsheetId: { type: String, required: true },
    dataRange: { type: String, required: true }, // e.g. "A2:V323"
    modelColumn: { type: Number, required: true }, // 0-indexed col index for model name
    hasStorage: { type: Boolean, default: true },
    hasCarrier: { type: Boolean, default: false },
    conditionStepKey: { type: String, default: "Condition" },
    // Column map: condition label → { ship: colIndex, pickup: colIndex }
    conditionColumns: [
      {
        label: { type: String, required: true }, // e.g. "Grade A"
        shipColIndex: { type: Number, required: true },
        pickupColIndex: { type: Number, required: true },
      },
    ],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("SheetConfig", sheetConfigSchema);
