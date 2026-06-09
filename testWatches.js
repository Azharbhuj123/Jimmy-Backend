const mongoose = require('mongoose');
const { syncSheetData } = require('./src/services/spreadsheetService');
const SheetConfig = require('./src/models/SheetConfig');
require('dotenv').config();

async function testWatches() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/jimmy");

  const config = await SheetConfig.findOne({ deviceType: 'apple_watch' });
  if (config) {
      console.log("Syncing Apple Watches...");
      await syncSheetData(config);
      console.log("Done!");
  } else {
      console.log("No config found for apple_watch");
  }

  process.exit(0);
}

testWatches();
