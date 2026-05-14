const mongoose = require("mongoose");
const Product = require("../models/Product");
require("dotenv").config();

const reorderApples = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || "mongodb://localhost:27017/jimmy";
    await mongoose.connect(mongoURI);
    console.log("Connected to MongoDB...");

    const appleBrandId = "69ca573f346c7d0cd39a2e53";
    const products = await Product.find({ 
      brandId: appleBrandId,
      isActive: true
    });

    console.log(`Found ${products.length} active Apple products.`);

    const getStorageWeight = (storage) => {
      if (!storage) return 0;
      const s = storage.toLowerCase();
      if (s.includes("tb")) return parseInt(s) * 1024;
      if (s.includes("gb")) return parseInt(s);
      return parseInt(s) || 0;
    };

    const getModelWeight = (name) => {
      const n = name.toLowerCase();
      let version = 0;
      
      // Extract main version number
      const match = n.match(/iphone (\d+)/);
      if (match) {
        version = parseInt(match[1]);
      } else if (n.includes("se")) {
        if (n.includes("3rd") || n.includes("2022")) version = 13.5; // Between 13 and 14
        else version = 11.5; // SE 2nd
      }

      // Sub-model weights
      let subWeight = 0;
      if (n.includes("pro max")) subWeight = 4;
      else if (n.includes("pro")) subWeight = 3;
      else if (n.includes("plus")) subWeight = 2;
      else subWeight = 1;

      return { version, subWeight };
    };

    // Custom sorting
    products.sort((a, b) => {
      const weightA = getModelWeight(a.name);
      const weightB = getModelWeight(b.name);

      // 1. Version descending (Higher version first)
      if (weightA.version !== weightB.version) {
        return weightB.version - weightA.version;
      }

      // 2. Sub-model descending (Pro Max first)
      if (weightA.subWeight !== weightB.subWeight) {
        return weightB.subWeight - weightA.subWeight;
      }

      // 3. Carrier (Unlocked first)
      const carrierA = (a.carrier || "").toLowerCase();
      const carrierB = (b.carrier || "").toLowerCase();
      if (carrierA.includes("unlocked") && !carrierB.includes("unlocked")) return -1;
      if (!carrierA.includes("unlocked") && carrierB.includes("unlocked")) return 1;

      // 4. Storage descending (Largest first)
      const storageA = getStorageWeight(a.storage);
      const storageB = getStorageWeight(b.storage);
      return storageB - storageA;
    });

    console.log("Reordering products...");
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      product.displayOrder = i + 1; // 1, 2, 3... (Ascending order means 1 is first)
      await product.save();
      if (i < 5 || i > products.length - 6) {
        console.log(`[${product.displayOrder}] ${product.name} | ${product.carrier} | ${product.storage}`);
      }
    }

    console.log("-----------------------------------------");
    console.log("Reordering Complete.");
    console.log(`Total updated: ${products.length}`);
    console.log("-----------------------------------------");
    
    process.exit(0);
  } catch (error) {
    console.error("Error reordering products:", error);
    process.exit(1);
  }
};

reorderApples();
