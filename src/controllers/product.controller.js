const Product = require('../models/Product');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { getPaginationOptions, buildPaginationMeta } = require('../utils/pagination');
const Order = require('../models/Order');




const getProducts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, brandId } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // 1. Build the Dynamic Query Object
  const query = { isActive: true, steps: { $ne: [] } };

  // Search by Product Name (Case-insensitive partial match)
  if (search) {
    query.name = { $regex: search, $options: "i" };
  }

  // Filter by Brand ID
  if (brandId && brandId !== 'undefined') {
    query.brandId = brandId;
  }

  // 2. Badge Logic Data (Fast Selling & Popular)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Get Top 10 Recent Product IDs from Orders
  const recentSales = await Order.aggregate([
    { $match: { createdAt: { $gte: sevenDaysAgo } } },
    { $unwind: "$items" },
    { $group: { _id: "$items.productId", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);
  const fastSellingIds = recentSales.map(item => item._id.toString());

  // Get Top 10 Most Popular Product IDs
  const popularProducts = await Product.find({ isActive: true })
    .sort({ totalOrders: -1 })
    .limit(10)
    .select('_id');
  const popularIds = popularProducts.map(p => p._id.toString());

  // 3. Execute Main Query with Pagination
  const total = await Product.countDocuments(query);
  const products = await Product.find(query)
    .populate('brandId', 'name') // Optional: get brand details
    .populate('categoryId', 'name')
    .sort({ createdAt: -1 }) // Show newest first
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

  // 4. Map Badges to the results
  const productsWithBadges = products.map(product => {
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
    buildPaginationMeta(total, parseInt(page), parseInt(limit)),
    "Products fetched successfully"
  );
});


const getMostPopularProducts = asyncHandler(async (req, res) => {
  // 1. Fetch top 4 products sorted by totalOrders
  // We filter by isActive: true to ensure we don't show disabled products
  const products = await Product.find({ isActive: true })
    .select("name basePrice badges images")
    .sort({ totalOrders: -1 })
    .limit(4)
    .populate('brandId', 'name') // Optional: includes brand name
    .lean();

  // 2. Add the "Most Popular" badge manually to each 
  // since this specific API is dedicated to them
  const productsWithBadges = products.map(product => ({
    ...product,
    badges: ["Most Popular"]
  }));

  // 3. Return using your success structure
  return ApiResponse.success(
    res,
    productsWithBadges,
    "Most popular products retrieved successfully"
  );
});




const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, isActive: true })
    .populate('categoryId', 'name slug')
    .populate('brandId', 'name slug logo');
  if (!product) throw new ApiError(404, 'Product not found');
  ApiResponse.success(res, product);
});

const getProductBySlug = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug, isActive: true })
    .populate('categoryId', 'name slug')
    .populate('brandId', 'name slug logo');
  if (!product) throw new ApiError(404, 'Product not found');
  ApiResponse.success(res, { product });
});

module.exports = { getProducts, getProduct, getProductBySlug, getMostPopularProducts };
