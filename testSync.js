const mongoose = require("mongoose");
const { syncSpreadsheetData } = require("./src/services/spreadsheetService");
const SheetConfig = require("./src/models/SheetConfig");
require("dotenv").config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  // Only test samsung
  await SheetConfig.updateMany({ deviceType: { $ne: 'samsung' } }, { isActive: false });
  
  console.log("Running Samsung sync...");
  await syncSpreadsheetData();
  
  // Re-enable all
  await SheetConfig.updateMany({}, { isActive: true });
  
  console.log("Done!");
  process.exit();
}

run();
