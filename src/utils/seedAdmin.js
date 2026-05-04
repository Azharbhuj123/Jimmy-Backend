const User = require("../models/User");
const Product = require("../models/Product");
const mongoose = require("mongoose");

const seedProduct = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    await Product.deleteMany({
      name: "iPhone 17 Pro Max 256GB Unlocked",
    });

    const product = await Product.create({
      name: "iPhone 17 Pro Max 256GB Unlocked",
      description: "",
      categoryId: null,
      brandId: "69ca573f346c7d0cd39a2e53",
      pricingType: "matrix",
      basePrice: 0,
      isActive: true,
      images: [],
      steps: [],

      pricingMatrix: [
        // SHIPPING
        {
          variant: "brand new mobile",
          type: "shipping",
          condition: "new",
          price: 850,
        },
        {
          variant: "mint condition",
          type: "shipping",
          condition: "grade a",
          price: 833,
        },
        {
          variant: "slight wear and tear",
          type: "shipping",
          condition: "grade b",
          price: 816,
        },
        {
          variant: "heavy scrathes",
          type: "shipping",
          condition: "grade c",
          price: 642,
        },
        {
          variant: "damage like front glass break",
          type: "shipping",
          condition: "grade d",
          price: 459,
        },

        // PICKUP
        {
          variant: "brand new mobile",
          type: "pickup",
          condition: "new",
          price: 808,
        },
        {
          variant: "mint condition",
          type: "pickup",
          condition: "grade a",
          price: 791,
        },
        {
          variant: "slight wear and tear",
          type: "pickup",
          condition: "grade b",
          price: 775,
        },
        {
          variant: "heavy scrathes",
          type: "pickup",
          condition: "grade c",
          price: 610,
        },
        {
          variant: "damage like front glass break",
          type: "pickup",
          condition: "grade d",
          price: 436,
        },
      ],
    });

    console.log("✅ Product Seeded Successfully:", product._id);

    process.exit();
  } catch (error) {
    console.error("❌ Seed Error:", error);
    process.exit(1);
  }
};

const seedAdmin = async () => {
  try {
    // await seedProduct();
    const existing = await User.findOne({ role: "admin" });
    if (existing) {
      console.log("ℹ️  Admin account already exists, skipping seed.");
      return;
    }

    const email = process.env.ADMIN_EMAIL || "admin@example.com";
    const password = process.env.ADMIN_PASSWORD || "Admin@123456";
    const name = "Super Admin";

    await User.create({ name, email, password, role: "admin" });
    console.log(`✅ Admin seeded: ${email}`);
  } catch (err) {
    console.error("❌ Admin seed failed:", err.message);
  }
};

module.exports = seedAdmin;
