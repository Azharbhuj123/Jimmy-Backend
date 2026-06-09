const mongoose = require('mongoose');
require('dotenv').config();
const Product = require('./src/models/Product');

async function checkWatches() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/jimmy");

  const watches = await Product.find({ deviceType: 'apple_watch' }, 'name slug isActive');
  console.log(`Found ${watches.length} Apple Watches in DB:`);
  watches.forEach(w => console.log(`- [${w.isActive ? 'ACTIVE' : 'INACTIVE'}] ${w.name} (slug: ${w.slug})`));

  process.exit(0);
}

checkWatches();
