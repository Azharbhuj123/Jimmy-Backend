const mongoose = require("mongoose");
const Product = require("../models/Product");
require("dotenv").config();

const deactivateOldIphones = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || "mongodb://localhost:27017/jimmy";
    await mongoose.connect(mongoURI);
    console.log("Connected to MongoDB...");

    // We define what we WANT to keep. iPhone 12 and newer.
    const allowedModels = ["12", "13", "14", "15", "16", "17"];
    const allowedSE = ["se (3rd", "se 3", "2022"];

    const appleBrandId = "69ca573f346c7d0cd39a2e53";
    const products = await Product.find({ 
      $or: [
        { brandId: appleBrandId },
        { name: /iPhone/i }
      ]
    });

    console.log(`Found ${products.length} total Apple products.`);

    let deactivatedCount = 0;
    let keptCount = 0;

    for (const product of products) {
      const name = product.name.toLowerCase();
      
      // Check if it's one of the allowed newer iPhone models (12+)
      const isNewerIphone = allowedModels.some(model => name.includes(`iphone ${model}`));
      // Check if it's a newer SE model (3rd gen / 2022+)
      const isNewerSE = allowedSE.some(model => name.includes(model));

      const isNewer = isNewerIphone || isNewerSE;
      
      if (!isNewer) {
        // It's an older model
        product.isActive = false;
        await product.save();
        deactivatedCount++;
        console.log(`Deactivated: ${product.name}`);
      } else {
        // Ensure it is active if it's a newer model
        product.isActive = true;
        await product.save();
        keptCount++;
        console.log(`Kept Active: ${product.name}`);
      }
    }

    console.log("-----------------------------------------");
    console.log(`Deactivation Complete.`);
    console.log(`Kept Active: ${keptCount} (iPhone 12+)`);
    console.log(`Deactivated: ${deactivatedCount} (Older than iPhone 12)`);
    console.log("-----------------------------------------");
    
    process.exit(0);
  } catch (error) {
    console.error("Error deactivating products:", error);
    process.exit(1);
  }
};

deactivateOldIphones();
