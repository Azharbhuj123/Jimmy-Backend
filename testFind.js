const mongoose = require('mongoose');
require('dotenv').config();
const Product = require('./src/models/Product');

async function testFind() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/jimmy");
  
  const bySlug = await Product.findOne({ slug: "galaxy-z-fold-4-unlocked" });
  console.log("bySlug:", bySlug ? bySlug.name : "NOT FOUND");
  
  if (bySlug) {
      console.log("DeviceType:", bySlug.deviceType);
      console.log("Carrier:", bySlug.carrier);
  }

  process.exit(0);
}

testFind();
