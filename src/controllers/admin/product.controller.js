const Product = require('../../models/Product');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');
const { getPaginationOptions, buildPaginationMeta } = require('../../utils/pagination');
const { getProductAnalytics } = require('../../services/pricing.service');

const createProduct = asyncHandler(async (req, res) => {
  const product = await Product.create(req.body);
  await product.populate(['brandId']);
  ApiResponse.success(res, { product }, 'Product created', 201);
});

const getProducts = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = getPaginationOptions(req.query);
  const { search, categoryId, brandId, isActive, minPrice, maxPrice } = req.query;

  const filter = {};
  if (search) filter.name = { $regex: search, $options: 'i' };
  if (categoryId) filter.categoryId = categoryId;
  if (brandId) filter.brandId = brandId;
  if (isActive !== undefined) filter.isActive = isActive === 'true';
  if (minPrice || maxPrice) {
    filter.basePrice = {};
    if (minPrice) filter.basePrice.$gte = parseFloat(minPrice);
    if (maxPrice) filter.basePrice.$lte = parseFloat(maxPrice);
  }

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('brandId', 'name slug')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Product.countDocuments(filter),
  ]);

  ApiResponse.paginated(res, products, buildPaginationMeta(total, page, limit));
});

const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id)
    .populate('brandId', 'name slug');
  if (!product) throw new ApiError(404, 'Product not found');
  ApiResponse.success(res, { product });
});

const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!product) throw new ApiError(404, 'Product not found');
  ApiResponse.success(res, { product }, 'Product updated');
});

const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');
  ApiResponse.success(res, {}, 'Product deleted');
});

// ─── Step management ─────────────────────────────────────────────────────────

const addStep = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');
  product.steps.push(req.body);
  await product.save();
  ApiResponse.success(res, { product }, 'Step added');
});

const updateStep = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');
  const step = product.steps.id(req.params.stepId);
  if (!step) throw new ApiError(404, 'Step not found');
  Object.assign(step, req.body);
  await product.save();
  ApiResponse.success(res, { product }, 'Step updated');
});

const deleteStep = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');
  product.steps = product.steps.filter((s) => s._id.toString() !== req.params.stepId);
  await product.save();
  ApiResponse.success(res, { product }, 'Step removed');
});

// ─── Analytics ───────────────────────────────────────────────────────────────

const getAnalytics = asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const data = await getProductAnalytics(req.params.id, days);
  ApiResponse.success(res, data, 'Product analytics fetched');
});

module.exports = {
  createProduct,
  getProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  addStep,
  updateStep,
  deleteStep,
  getAnalytics,
};
