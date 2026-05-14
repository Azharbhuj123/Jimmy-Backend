const mongoose = require("mongoose");
const Product = require("../models/Product");
require("dotenv").config();

const listActiveAppleProducts = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || "mongodb://localhost:27017/jimmy";
    await mongoose.connect(mongoURI);
    
    const appleBrandId = "69ca573f346c7d0cd39a2e53";
    const activeProducts = await Product.find({ 
      brandId: appleBrandId,
      isActive: true
    }).select("name isActive");

    console.log(`Found ${activeProducts.length} active Apple products:`);
    activeProducts.forEach(p => console.log(`- ${p.name}`));
    
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

listActiveAppleProducts();
