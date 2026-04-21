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
    query.brandId = brandId;
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
   * 3. EXECUTE MAIN QUERY
   */
  const total = await Product.countDocuments(query);
  const products = await Product.find(query)
    .populate("brandId", "name")
    .populate("categoryId", "name")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

  /**
   * 4. MAP BADGES
   */
  const productsWithBadges = products.map((product) => {
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
  // 1. Fetch top 4 products sorted by totalOrders
  // We filter by isActive: true to ensure we don't show disabled products
  const products = await Product.find({ isActive: true })
    .select("name basePrice badges images")
    .sort({ totalOrders: -1 })
    .limit(4)
    .populate("brandId", "name") // Optional: includes brand name
    .lean();

  // 2. Add the "Most Popular" badge manually to each
  // since this specific API is dedicated to them
  const productsWithBadges = products.map((product) => ({
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
  const products = await Product.find({ isActive: true })
    .select("name")
    .sort({ totalOrders: -1 })
    .lean();

  return ApiResponse.success(
    res,
    products,
    "Most popular products retrieved successfully",
  );
});

const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, isActive: true })
    .populate("categoryId", "name slug")
    .populate("brandId", "name slug logo");
  if (!product) throw new ApiError(404, "Product not found");
  ApiResponse.success(res, product);
});

const getProductBySlug = asyncHandler(async (req, res) => {
  const product = await Product.findOne({
    slug: req.params.slug,
    isActive: true,
  })
    .populate("categoryId", "name slug")
    .populate("brandId", "name slug logo");
  if (!product) throw new ApiError(404, "Product not found");
  ApiResponse.success(res, { product });
});

module.exports = {
  getProducts,
  getProduct,
  searchProducts,
  getProductBySlug,
  getMostPopularProducts,
  getMostPopularCategories,
  getMostPopularProductsName,
};
