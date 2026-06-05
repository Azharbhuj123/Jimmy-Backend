const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });
const SheetConfig = require("../models/SheetConfig");

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/quickycell"; // Use environment var

mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log("Connected to MongoDB");
  seed();
}).catch(err => {
  console.error("MongoDB connection error:", err);
  process.exit(1);
});

const defaultConfigs = [
  {
    deviceType: "iphone",
    sheetName: "iPhone Pricing",
    spreadsheetId: "1P2Q3R4S5T6U7V8W9X0Y1Z2A3B4C5D6E7F8G9H0I1J2K", // MUST BE UPDATED BY ADMIN
    dataRange: "A2:V323",
    modelColumn: 0,
    hasStorage: true,
    hasCarrier: true,
    conditionStepKey: "Condition",
    conditionColumns: [
      { label: "NEW", shipColIndex: 9, pickupColIndex: 16 },
      { label: "Grade A", shipColIndex: 10, pickupColIndex: 17 },
      { label: "Grade B", shipColIndex: 11, pickupColIndex: 18 },
      { label: "Grade C", shipColIndex: 12, pickupColIndex: 19 },
      { label: "Grade D", shipColIndex: 13, pickupColIndex: 20 },
      // DOA ignored as per instructions
    ],
    isActive: true
  },
  {
    deviceType: "ipad",
    sheetName: "iPad Pricing",
    spreadsheetId: "1P2Q3R4S5T6U7V8W9X0Y1Z2A3B4C5D6E7F8G9H0I1J2K",
    dataRange: "A2:N100", // example range
    modelColumn: 0,
    hasStorage: true,
    hasCarrier: false,
    conditionStepKey: "Condition",
    conditionColumns: [
      { label: "Grade A", shipColIndex: 2, pickupColIndex: 9 },
      { label: "Grade B", shipColIndex: 3, pickupColIndex: 10 },
      { label: "Grade C", shipColIndex: 4, pickupColIndex: 11 },
      { label: "Grade D", shipColIndex: 5, pickupColIndex: 12 },
    ],
    isActive: true
  },
  {
    deviceType: "pixel",
    sheetName: "Pixel Pricing",
    spreadsheetId: "1P2Q3R4S5T6U7V8W9X0Y1Z2A3B4C5D6E7F8G9H0I1J2K",
    dataRange: "A2:N100",
    modelColumn: 0,
    hasStorage: false, // Pixel config could vary
    hasCarrier: false,
    conditionStepKey: "Condition",
    conditionColumns: [
      { label: "Sealed", shipColIndex: 1, pickupColIndex: 6 },
      { label: "Open", shipColIndex: 2, pickupColIndex: 7 },
      { label: "A / HSO", shipColIndex: 3, pickupColIndex: 8 },
      { label: "B+ Grade", shipColIndex: 4, pickupColIndex: 9 },
    ],
    isActive: true
  },
  {
    deviceType: "samsung",
    sheetName: "Samsung Pricing",
    spreadsheetId: "1P2Q3R4S5T6U7V8W9X0Y1Z2A3B4C5D6E7F8G9H0I1J2K",
    dataRange: "A2:P200",
    modelColumn: 0,
    hasStorage: true,
    hasCarrier: true,
    conditionStepKey: "Condition",
    conditionColumns: [
      { label: "NEW", shipColIndex: 2, pickupColIndex: 9 },
      { label: "A", shipColIndex: 3, pickupColIndex: 10 },
      { label: "B", shipColIndex: 4, pickupColIndex: 11 },
      { label: "C", shipColIndex: 5, pickupColIndex: 12 },
      { label: "D", shipColIndex: 6, pickupColIndex: 13 },
    ],
    isActive: true
  },
  {
    deviceType: "apple_watch",
    sheetName: "Apple Watch Pricing",
    spreadsheetId: "1P2Q3R4S5T6U7V8W9X0Y1Z2A3B4C5D6E7F8G9H0I1J2K",
    dataRange: "A2:N100",
    modelColumn: 0,
    hasStorage: false, // Using size in name or separate
    hasCarrier: false,
    conditionStepKey: "Condition",
    conditionColumns: [
      { label: "Sealed", shipColIndex: 2, pickupColIndex: 7 },
      { label: "Open", shipColIndex: 3, pickupColIndex: 8 },
      { label: "A / HSO", shipColIndex: 4, pickupColIndex: 9 },
      { label: "B Grade", shipColIndex: 5, pickupColIndex: 10 },
    ],
    isActive: true
  }
];

async function seed() {
  try {
    console.log("Seeding SheetConfigs...");
    
    // In actual usage, the spreadsheetId needs to be a real Google Sheet ID.
    // If there's an existing config, keep its spreadsheetId.
    for (const conf of defaultConfigs) {
      const existing = await SheetConfig.findOne({ deviceType: conf.deviceType });
      if (existing) {
        conf.spreadsheetId = existing.spreadsheetId;
        await SheetConfig.updateOne({ deviceType: conf.deviceType }, conf);
        console.log(`Updated config for ${conf.deviceType}`);
      } else {
        await SheetConfig.create(conf);
        console.log(`Created config for ${conf.deviceType}`);
      }
    }

    console.log("Seeding complete!");
    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }
}
