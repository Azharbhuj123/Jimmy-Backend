const mongoose = require('mongoose');
require('dotenv').config();
const Product = require('./src/models/Product');

async function testRead() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/jimmy");
  
  const product = await Product.findOne({ name: "Galaxy S25 EDGE", carrier: "Locked" });
  if (!product) {
      console.log("Not found");
      process.exit(1);
  }
  console.log("Current DB state:");
  console.log("Name:", product.name);
  console.log("Carrier:", product.carrier);
  console.log("BasePrice:", product.basePrice);
  console.log("UpdatedAt:", product.updatedAt);
  console.log("shipPriceModifier for NEW:", product.steps[0].options.find(o=>o.label==='NEW').shipPriceModifier);
  
  process.exit(0);
}

testRead();
