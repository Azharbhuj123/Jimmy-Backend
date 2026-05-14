/**
 * One-time migration: Set displayOrder for all products
 * Run: node set_display_order.cjs
 */
const mongoose = require("mongoose");
require("dotenv").config();

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

// Model priority: lower = shows first
const MODEL_ORDER = [
  "iPhone 17 Pro Max",
  "iPhone 17 Pro",
  "iPhone 17 Air",
  "iPhone 17",
  "iPhone 17E",
  "iPhone 16 Pro Max",
  "iPhone 16 Pro",
  "iPhone 16 Plus",
  "iPhone 16",
  "iPhone 16E",
  "iPhone 15 Pro Max",
  "iPhone 15 Pro",
  "iPhone 15 Plus",
  "iPhone 15",
  "iPhone 14 Pro Max",
  "iPhone 14 Pro",
  "iPhone 14 Plus",
  "iPhone 14",
  "iPhone 13 Pro Max",
  "iPhone 13 Pro",
  "iPhone 13 Mini",
  "iPhone 13",
  "iPhone 12 Pro Max",
  "iPhone 12 Pro",
  "iPhone 12 Mini",
  "iPhone 12",
  "iPhone 11 Pro Max",
  "iPhone 11 Pro",
  "iPhone 11",
  "iPhone SE (3rd Gen)",
  "SE (2020)",
  "iPhone XS Max",
  "iPhone XS",
  "iPhone XR",
  "iPhone X",
];

async function run() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("Connected!");

  const Product = mongoose.connection.collection("products");

  // Get all products
  const allProducts = await Product.find({}).toArray();
  console.log(`Total products: ${allProducts.length}`);

  let updated = 0;

  for (const product of allProducts) {
    const modelIndex = MODEL_ORDER.indexOf(product.name);
    // If not found in our list, put it at the end
    const modelPriority = modelIndex !== -1 ? modelIndex : MODEL_ORDER.length;

    // Within same model: Unlocked (0) before Locked (1)
    const carrierPriority = product.carrier === "Unlocked" ? 0 : 1;

    // Within same model+carrier: largest storage first
    let storageGB = 0;
    if (product.storage) {
      if (product.storage.includes("TB")) {
        storageGB = parseFloat(product.storage) * 1024;
      } else {
        storageGB = parseFloat(product.storage);
      }
    }
    // Invert storage so larger = smaller number (shows first)
    const storagePriority = 10000 - storageGB;

    // Combine into a single displayOrder value
    // modelPriority * 100000 + carrierPriority * 10000 + storagePriority
    const displayOrder =
      modelPriority * 100000 + carrierPriority * 10000 + storagePriority;

    await Product.updateOne(
      { _id: product._id },
      { $set: { displayOrder: displayOrder } }
    );
    updated++;
  }

  console.log(`\n✅ Updated ${updated} products with displayOrder`);

  // Verify: show first 20
  const sorted = await Product.find({})
    .sort({ displayOrder: 1 })
    .limit(20)
    .toArray();

  console.log("\n=== Top 20 products (sorted) ===");
  sorted.forEach((p, i) => {
    console.log(
      `${i + 1}. ${p.name} | ${p.storage} | ${p.carrier} | order: ${p.displayOrder}`
    );
  });

  await mongoose.disconnect();
  console.log("\nDone!");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
