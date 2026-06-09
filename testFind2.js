const mongoose = require('mongoose');
require('dotenv').config();
const Product = require('./src/models/Product');

async function testFind() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/jimmy");

  const parsed = {
    name: "Galaxy Z Fold 4",
    storage: "N/A",
    carrier: "Unlocked"
  };

  const namePart = parsed.name.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "");
  const storagePart = parsed.storage && parsed.storage !== "N/A" ? parsed.storage.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "") : "";
  const carrierPart = parsed.carrier && parsed.carrier !== "N/A" ? parsed.carrier.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "") : "";
  const expectedSlug = [namePart, storagePart, carrierPart].filter(Boolean).join("-");

  console.log(`[DEBUG] findProductInDB expectedSlug: '${expectedSlug}'`);
  
  const bySlug = await Product.findOne({ slug: expectedSlug });
  console.log(`[DEBUG] findProductInDB bySlug found:`, !!bySlug);
  if (bySlug) {
      console.log("Returned bySlug:", bySlug.name);
  } else {
      console.log("NOT FOUND BY SLUG!");
  }

  process.exit(0);
}

testFind();
