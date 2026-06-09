const mongoose = require('mongoose');
require('dotenv').config();
const { syncSheetByDeviceType } = require('./src/services/spreadsheetService');

async function syncSamsung() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/jimmy");
    console.log("Starting Samsung sync...");
    await syncSheetByDeviceType('samsung');
    console.log("✅ Samsung sync completed!");
  } catch (error) {
    console.error("Error during sync:", error);
  } finally {
    process.exit(0);
  }
}

syncSamsung();
