const mongoose = require('mongoose');
require('dotenv').config();
const Product = require('./src/models/Product');

async function testSave() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/jimmy");
  
  const product = await Product.findOne({ name: "Galaxy S25 EDGE", carrier: "Locked" });
  if (!product) {
      console.log("Not found");
      process.exit(1);
  }
  console.log("Before save:");
  console.log(product.steps[0].options[0].shipPriceModifier); // Should be 0
  
  product.steps[0].options[0].shipPriceModifier = 999;
  product.markModified('steps');
  await product.save();
  
  console.log("After save:");
  const updatedProduct = await Product.findOne({ name: "Galaxy S25 EDGE", carrier: "Locked" });
  console.log(updatedProduct.steps[0].options[0].shipPriceModifier); // Should be 999
  
  process.exit(0);
}

testSave();
