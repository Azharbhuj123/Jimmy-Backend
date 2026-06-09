const mongoose = require('mongoose');
require('dotenv').config();
const Product = require('./src/models/Product');

async function cleanFakeProducts() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const toDelete = [
    // Apple Watch category headers
    { name: "Ultra (1st Gen)",        deviceType: "apple_watch" },
    { name: "Ultra (2nd Gen) ~ 2024", deviceType: "apple_watch" },
    { name: "Ultra (2nd Gen) ~ 2023", deviceType: "apple_watch" },
    { name: "SE (3rd Gen)",           deviceType: "apple_watch" },
    { name: "SE (2nd Gen)",           deviceType: "apple_watch" },
    { name: "Series 11",              deviceType: "apple_watch" },
    { name: "Series 10",              deviceType: "apple_watch" },
    { name: "Series 9",               deviceType: "apple_watch" },
    { name: "Series 8",               deviceType: "apple_watch" },
    { name: "Series 7",               deviceType: "apple_watch" },
    { name: "Series 6",               deviceType: "apple_watch" },
    // Samsung section divider header
    { slug: "s23" },
    // Pixel column label header
    { slug: "new-carrier-locked" },
    { slug: "new-unlocked" },
  ];

  for (const filter of toDelete) {
    const result = await Product.deleteMany(filter);
    if (result.deletedCount > 0) {
      console.log(`✅ Deleted ${result.deletedCount} fake product(s):`, filter);
    }
  }
  
  console.log("Cleanup done.");
  process.exit(0);
}

cleanFakeProducts();
