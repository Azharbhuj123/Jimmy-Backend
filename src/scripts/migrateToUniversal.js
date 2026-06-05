const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });
const Product = require("../models/Product");

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/quickycell"; // Use environment var

mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log("Connected to MongoDB");
  migrate();
}).catch(err => {
  console.error("MongoDB connection error:", err);
  process.exit(1);
});

async function migrate() {
  try {
    console.log("Starting migration...");
    
    // Step 1: Set deviceType = 'iphone' for all existing products
    const updateResult = await Product.updateMany(
      { deviceType: { $exists: false } },
      { $set: { deviceType: 'iphone' } }
    );
    console.log(`Set deviceType='iphone' for ${updateResult.modifiedCount} products.`);

    // Step 2: Set sheetRowKey from existing name + storage + carrier
    const iphones = await Product.find({ deviceType: 'iphone' });
    let updatedRowKeys = 0;
    for (const p of iphones) {
      const storagePart = p.storage || '';
      const carrierPart = p.carrier || '';
      const key = `${p.name} ${storagePart} ${carrierPart}`.trim().replace(/\s+/g, " ");
      if (p.sheetRowKey !== key) {
        p.sheetRowKey = key;
        await p.save();
        updatedRowKeys++;
      }
    }
    console.log(`Set sheetRowKey for ${updatedRowKeys} products.`);

    console.log("Migration complete!");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}
