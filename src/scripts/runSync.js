const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });
const { syncSpreadsheetData } = require("../services/spreadsheetService");
const SheetConfig = require("../models/SheetConfig");

async function run() {
  try {
    const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/quickycell";
    await mongoose.connect(uri);

    // Disable all first
    await SheetConfig.updateMany({}, { isActive: false });
    // Enable only pixel and samsung
    await SheetConfig.updateOne({ deviceType: "pixel" }, { isActive: true, hasStorage: true, hasCarrier: true });
    await SheetConfig.updateOne({ deviceType: "samsung" }, { isActive: true, hasStorage: true, hasCarrier: true });

    console.log("Configs updated. Running sync for Pixel and Samsung...");
    await syncSpreadsheetData();
    console.log("Sync complete!");

    // Re-enable others
    await SheetConfig.updateMany({}, { isActive: true });
    process.exit(0);
  } catch (error) {
    console.error("Sync failed:", error);
    process.exit(1);
  }
}

run();
