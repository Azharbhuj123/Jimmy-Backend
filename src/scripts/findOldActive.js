const mongoose = require("mongoose");
const Product = require("../models/Product");
require("dotenv").config();

const findActiveOlderApples = async () => {
  try {
    const mongoURI =
      process.env.MONGODB_URI || "mongodb://localhost:27017/jimmy";
    await mongoose.connect(mongoURI);

    const appleBrandId = "69ca573f346c7d0cd39a2e53";
    const allowedModels = ["12", "13", "14", "15", "16", "17", "se (3rd"];

    const activeApples = await Product.find({
      brandId: appleBrandId,
      isActive: true,
    });

    console.log(`Found ${activeApples.length} active Apple products.`);

    const olderApples = activeApples.filter((p) => {
      const name = p.name.toLowerCase();
      return !allowedModels.some((model) => name.includes(model));
    });

    console.log(`Found ${olderApples.length} active older Apple products:`);
    olderApples.forEach((p) => console.log(`- ${p.name} (ID: ${p._id})`));

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

findActiveOlderApples();
