require("dotenv").config({ path: "d:/myProjects/jimmy-main-new/Jimmy-Backend/.env" });
const mongoose = require("mongoose");
const Product = require("d:/myProjects/jimmy-main-new/Jimmy-Backend/src/models/Product.js");

async function check() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb+srv://developerqasim0:z0T1n17Bq6HlR09W@cluster0.b99b5.mongodb.net/jimmy-db?retryWrites=true&w=majority");
  
  const products = await Product.find({ name: { $regex: /ipad/i } }).select("name deviceType");
  console.log("iPads:", products);

  const iphones = await Product.find({ name: { $regex: /iphone/i } }).select("name deviceType");
  console.log("iPhones count:", iphones.length, "Sample:", iphones.slice(0,2));

  process.exit(0);
}
check();
