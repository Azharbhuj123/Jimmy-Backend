const mongoose = require("mongoose");
const Product = require("../models/Product");
require("dotenv").config();

const updateConditions = async () => {
  try {
    // Replace with your MongoDB URI
    const mongoURI = process.env.MONGODB_URI || "mongodb://localhost:27017/jimmy";
    await mongoose.connect(mongoURI);
    console.log("Connected to MongoDB...");

    const products = await Product.find({});
    console.log(`Found ${products.length} products. Updating conditions...`);

    let updatedCount = 0;

    for (const product of products) {
      let modified = false;

      if (!product.steps) continue;

      for (const step of product.steps) {
        if (step.key.toLowerCase() === "condition") {
          for (const option of step.options) {
            const label = option.label.toLowerCase();

            // 1. Brand New
            if (label === "brand new") {
              option.subtext = "Sealed in Box.";
              modified = true;
            }

            // 2. Mint Condition
            if (label === "mint condition") {
              option.subtext = "No scratches, like new.";
              modified = true;
            }

            // 3. Damaged Condition
            if (label === "damaged condition") {
              option.subtext = "Fully functional. Back glass must be in good condition for this pricing.";
              modified = true;
            }
          }
        }
      }

      if (modified) {
        await product.save();
        updatedCount++;
      }
    }

    console.log(`Successfully updated ${updatedCount} products.`);
    process.exit(0);
  } catch (error) {
    console.error("Error updating conditions:", error);
    process.exit(1);
  }
};

updateConditions();
