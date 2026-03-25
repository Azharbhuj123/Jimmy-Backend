const Product = require('../models/Product');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { getPaginationOptions, buildPaginationMeta } = require('../utils/pagination');

const getProducts = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = getPaginationOptions(req.query);
  const { search, categoryId, brandId, minPrice, maxPrice } = req.query;

  const filter = { isActive: true };
  if (search) filter.name = { $regex: search, $options: 'i' };
  if (categoryId) filter.categoryId = categoryId;
  if (brandId) filter.brandId = brandId;
  if (minPrice || maxPrice) {
    filter.basePrice = {};
    if (minPrice) filter.basePrice.$gte = parseFloat(minPrice);
    if (maxPrice) filter.basePrice.$lte = parseFloat(maxPrice);
  }

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('categoryId', 'name slug')
      .populate('brandId', 'name slug logo')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .select('-totalOrders -totalPayout'),
    Product.countDocuments(filter),
  ]);

  ApiResponse.paginated(res, products, buildPaginationMeta(total, page, limit));
});

const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, isActive: true })
    .populate('categoryId', 'name slug')
    .populate('brandId', 'name slug logo');
  if (!product) throw new ApiError(404, 'Product not found');
  ApiResponse.success(res, { product });
});

const getProductBySlug = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug, isActive: true })
    .populate('categoryId', 'name slug')
    .populate('brandId', 'name slug logo');
  if (!product) throw new ApiError(404, 'Product not found');
  ApiResponse.success(res, { product });
});

module.exports = { getProducts, getProduct, getProductBySlug };
