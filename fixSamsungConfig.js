const mongoose = require('mongoose');
require('dotenv').config();
const SheetConfig = require('./src/models/SheetConfig');

async function fixSamsung() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/jimmy");
    const config = await SheetConfig.findOne({ deviceType: 'samsung' });
    if (config) {
      config.conditionColumns.forEach(col => {
        if (col.label === 'NEW') { col.shipColIndex = 9; col.pickupColIndex = 16; }
        if (col.label === 'A') { col.shipColIndex = 10; col.pickupColIndex = 17; }
        if (col.label === 'B') { col.shipColIndex = 11; col.pickupColIndex = 18; }
        if (col.label === 'C') { col.shipColIndex = 12; col.pickupColIndex = 19; }
        if (col.label === 'D') { col.shipColIndex = 13; col.pickupColIndex = 20; }
      });
      await config.save();
      console.log("✅ Successfully updated Samsung SheetConfig!");
    } else {
      console.log("❌ Samsung config not found in DB.");
    }
  } catch (error) {
    console.error("Error updating:", error);
  } finally {
    process.exit(0);
  }
}

fixSamsung();
