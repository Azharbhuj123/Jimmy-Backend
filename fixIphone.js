const mongoose = require('mongoose');
require('dotenv').config();
const SheetConfig = require('./src/models/SheetConfig');

async function fixIphone() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/jimmy");
  const config = await SheetConfig.findOne({ deviceType: 'iphone' });
  if (config) {
      config.modelColumn = 1;
      await config.save();
      console.log("Fixed iphone modelColumn to 1");
  }
  process.exit(0);
}

fixIphone();
