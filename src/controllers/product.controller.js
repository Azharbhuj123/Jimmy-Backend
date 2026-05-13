const mongoose = require("mongoose");
const Product = require("../models/Product");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

const {
  getPaginationOptions,
  buildPaginationMeta,
} = require("../utils/pagination");
const Order = require("../models/Order");
const Category = require("../models/Category");

const getProducts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, brandId, activeTab } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  /**
   * 1. BUILD DYNAMIC QUERY
   */
  const query = { isActive: true };
  const andConditions = [];

  // Filter by Search Input
  if (search && search.trim() !== "") {
    andConditions.push({
      $or: [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ],
    });
  }

  // Filter by Active Tab (Keyword matching)
  if (activeTab && activeTab !== "undefined" && activeTab !== "Other Phones") {
    // Clean "Sell " prefix if it exists to get core keywords like "iPad" or "Samsung"
    const tabKeyword = activeTab.replace(/sell/i, "").trim();

    andConditions.push({
      $or: [
        { name: { $regex: tabKeyword, $options: "i" } },
        { description: { $regex: tabKeyword, $options: "i" } },
      ],
    });
  }

  // Apply combined conditions if any exist
  if (andConditions.length > 0) {
    query.$and = andConditions;
  }

  // Filter by Brand ID (Direct match)
  if (brandId && brandId !== "undefined") {
    query.brandId = new mongoose.Types.ObjectId(brandId);
  }

  /**
   * 2. BADGE LOGIC DATA
   * (Optimized to run before main query)
   */
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Get Top 10 Fast Selling IDs
  const recentSales = await Order.aggregate([
    { $match: { createdAt: { $gte: sevenDaysAgo } } },
    { $unwind: "$items" },
    { $group: { _id: "$items.productId", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);
  const fastSellingIds = recentSales.map((item) => item._id.toString());

  // Get Top 10 Most Popular Product IDs
  const popularProducts = await Product.find({ isActive: true })
    .sort({ totalOrders: -1 })
    .limit(10)
    .select("_id");
  const popularIds = popularProducts.map((p) => p._id.toString());

  /**
   * 3. EXECUTE MAIN QUERY WITH UNIQUE GROUPING
   */
  // Calculate total unique products (grouped by name and brandId)
  const totalResult = await Product.aggregate([
    { $match: query },
    { $group: { _id: { name: "$name", brandId: "$brandId" } } },
    { $count: "total" },
  ]);
  const total = totalResult[0]?.total || 0;

  // Fetch unique products with representation
  const products = await Product.aggregate([
    { $match: query },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: { name: "$name", brandId: "$brandId" },
        doc: { $first: "$$ROOT" },
      },
    },
    { $replaceRoot: { newRoot: "$doc" } },
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: parseInt(limit) },
  ]);

  // Populate brand info for aggregation results
  const populatedProducts = await Product.populate(products, {
    path: "brandId",
    select: "name",
  });

  /**
   * 4. MAP BADGES
   */
  const productsWithBadges = populatedProducts.map((product) => {
    const badges = [];
    const idStr = product._id.toString();

    if (popularIds.includes(idStr)) badges.push("Most Popular");
    if (fastSellingIds.includes(idStr)) badges.push("Sells Fastest");

    return { ...product, badges };
  });

  /**
   * 5. SEND RESPONSE
   */
  return ApiResponse.paginated(
    res,
    productsWithBadges,
    buildPaginationMeta(total, parseInt(page), parseInt(limit)),
    "Products fetched successfully",
  );
});

const searchProducts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search } = req.query;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  if (!search) {
    return ApiResponse.paginated(
      res,
      [],
      buildPaginationMeta(0, pageNum, limitNum),
      "Products fetched successfully",
    );
  }

  // Escape special regex characters to prevent injection
  const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const searchRegex = new RegExp(escapedSearch, "i");

  // 1. Run badge queries in parallel with main search for performance
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [recentSales, popularProducts, searchResults] = await Promise.all([
    // Fast selling products (last 7 days)
    Order.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      { $unwind: "$items" },
      { $group: { _id: "$items.productId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),

    // Most popular products
    Product.find({ isActive: true })
      .sort({ totalOrders: -1 })
      .limit(10)
      .select("_id"),

    // 2. Main search aggregation — lookup brand & category, then search across all names
    Product.aggregate([
      // Base filter: only active products with steps
      { $match: { isActive: true, steps: { $ne: [] } } },

      // Lookup brand details
      {
        $lookup: {
          from: "brands",
          localField: "brandId",
          foreignField: "_id",
          as: "brand",
        },
      },
      { $unwind: { path: "$brand", preserveNullAndEmptyArrays: true } },

      // Lookup category details
      {
        $lookup: {
          from: "categories",
          localField: "categoryId",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },

      // Search across product name, description, brand name, and category name
      {
        $match: {
          $or: [
            { name: { $regex: searchRegex } },
            { description: { $regex: searchRegex } },
            { "brand.name": { $regex: searchRegex } },
            { "category.name": { $regex: searchRegex } },
          ],
        },
      },

      // Collapse variants into unique base models
      {
        $group: {
          _id: { name: "$name", brandId: "$brandId" },
          doc: { $first: "$$ROOT" },
        },
      },
      { $replaceRoot: { newRoot: "$doc" } },

      // Use $facet for count + paginated data in a single query
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [
            { $sort: { totalOrders: -1, createdAt: -1 } },
            { $skip: skip },
            { $limit: limitNum },
            {
              $project: {
                name: 1,
                slug: 1,
                description: 1,
                basePrice: 1,
                images: 1,
                totalOrders: 1,
                steps: 1,
                createdAt: 1,
                brandId: {
                  _id: "$brand._id",
                  name: "$brand.name",
                },
                categoryId: {
                  _id: "$category._id",
                  name: "$category.name",
                },
              },
            },
          ],
        },
      },
    ]),
  ]);

  const fastSellingIds = recentSales.map((item) => item._id.toString());
  const popularIds = popularProducts.map((p) => p._id.toString());

  // 3. Extract results from $facet
  const total = searchResults[0]?.metadata[0]?.total || 0;
  const products = searchResults[0]?.data || [];

  // 4. Map badges to the results
  const productsWithBadges = products.map((product) => {
    const badges = [];
    const idStr = product._id.toString();

    if (popularIds.includes(idStr)) badges.push("Most Popular");
    if (fastSellingIds.includes(idStr)) badges.push("Sells Fastest");

    return { ...product, badges };
  });

  // 5. Send Response
  return ApiResponse.paginated(
    res,
    productsWithBadges,
    buildPaginationMeta(total, pageNum, limitNum),
    "Products fetched successfully",
  );
});

const getMostPopularProducts = asyncHandler(async (req, res) => {
  // Fetch top 4 unique products sorted by totalOrders
  const products = await Product.aggregate([
    { $match: { isActive: true } },
    { $sort: { totalOrders: -1 } },
    {
      $group: {
        _id: { name: "$name", brandId: "$brandId" },
        doc: { $first: "$$ROOT" },
      },
    },
    { $replaceRoot: { newRoot: "$doc" } },
    { $sort: { totalOrders: -1 } },
    { $limit: 4 },
    {
      $project: {
        name: 1,
        basePrice: 1,
        badges: 1,
        images: 1,
        brandId: 1,
      },
    },
  ]);

  // Populate brand info
  const populatedProducts = await Product.populate(products, {
    path: "brandId",
    select: "name",
  });

  // 2. Add the "Most Popular" badge manually to each
  // since this specific API is dedicated to them
  const productsWithBadges = populatedProducts.map((product) => ({
    ...product,
    badges: ["Most Popular"],
  }));

  // 3. Return using your success structure
  return ApiResponse.success(
    res,
    productsWithBadges,
    "Most popular products retrieved successfully",
  );
});

const getMostPopularCategories = asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;

  // Aggregate orders: unwind items → lookup product to get categoryId → group by category
  const popularCategories = await Order.aggregate([
    { $unwind: "$items" },
    {
      $lookup: {
        from: "products",
        localField: "items.productId",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: "$product" },
    { $match: { "product.isActive": true } },
    {
      $group: {
        _id: "$product.categoryId",
        totalOrders: { $sum: 1 },
      },
    },
    { $sort: { totalOrders: -1 } },
    { $limit: parseInt(limit) },
    {
      $lookup: {
        from: "categories",
        localField: "_id",
        foreignField: "_id",
        as: "category",
      },
    },
    { $unwind: "$category" },
    { $match: { "category.isActive": true } },
    {
      $project: {
        _id: "$category._id",
        name: "$category.name",
        slug: "$category.slug",
        image: "$category.image",
        totalOrders: 1,
      },
    },
  ]);

  return ApiResponse.success(
    res,
    popularCategories,
    "Popular categories fetched successfully",
  );
});

const getMostPopularProductsName = asyncHandler(async (req, res) => {
  const products = await Product.aggregate([
    { $match: { isActive: true } },
    { $sort: { totalOrders: -1 } },
    {
      $group: {
        _id: { name: "$name", brandId: "$brandId" },
        name: { $first: "$name" },
      },
    },
    { $project: { _id: 0, name: 1 } },
    { $sort: { name: 1 } },
  ]);

  return ApiResponse.success(
    res,
    products,
    "Most popular products retrieved successfully",
  );
});

const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({
    _id: req.params.id,
    isActive: true,
  }).populate("brandId", "name slug logo");
  if (!product) throw new ApiError(404, "Product not found");
  ApiResponse.success(res, product);
});

const getProductBySlug = asyncHandler(async (req, res) => {
  const product = await Product.findOne({
    slug: req.params.slug,
    isActive: true,
  }).populate("brandId", "name slug logo");
  if (!product) throw new ApiError(404, "Product not found");
  ApiResponse.success(res, { product });
});

const getGroupedProductBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  // 1. Find the reference product by slug to get the base name
  const referenceProduct = await Product.findOne({
    _id: slug,
    isActive: true,
  }).populate("brandId", "name slug logo");
  if (!referenceProduct) throw new ApiError(404, "Product not found");

  // 2. Find all products with the same base name
  const allVariants = await Product.find({
    name: referenceProduct.name,
    brandId: referenceProduct.brandId,
    isActive: true,
  }).lean();

  // 3. Extract and sort unique storage options
  const storageOptions = [...new Set(allVariants.map((p) => p.storage))]
    .filter(Boolean)
    .sort((a, b) => {
      const getVal = (s) => {
        const num = parseInt(s);
        return s.toLowerCase().includes("tb") ? num * 1024 : num;
      };
      return getVal(a) - getVal(b);
    });

  // 4. Send response
  return ApiResponse.success(
    res,
    {
      name: referenceProduct.name,
      storageOptions,
      products: allVariants,
      referenceProduct,
    },
    "Grouped products fetched successfully",
  );
});

module.exports = {
  getProducts,
  getProduct,
  searchProducts,
  getProductBySlug,
  getGroupedProductBySlug,
  getMostPopularProducts,
  getMostPopularCategories,
  getMostPopularProductsName,
};
