const mongoose = require('mongoose');
require('dotenv').config();
const SheetConfig = require('./src/models/SheetConfig');

async function checkIphoneConfig() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/jimmy");
  const config = await SheetConfig.findOne({ deviceType: 'iphone' });
  console.log("iPhone Config modelColumn:", config.modelColumn);
  process.exit(0);
}

checkIphoneConfig();
