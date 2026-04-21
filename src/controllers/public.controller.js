const FAQ = require('../models/FAQ');
const Blog = require('../models/Blog');
const Category = require('../models/Category');
const Brand = require('../models/Brand');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { uploadToS3 } = require('../services/upload.service');
const { getPaginationOptions, buildPaginationMeta } = require('../utils/pagination');
const { calculatePrice } = require('../services/pricing.service');

const getFAQs = asyncHandler(async (req, res) => {
  const { category } = req.query;
  const filter = { isActive: true };
  if (category) filter.category = category;
  const faqs = await FAQ.find(filter).sort({ order: 1 }).limit(20);
  ApiResponse.success(res, { faqs });
});

const getBlogs = asyncHandler(async (req, res) => {
  const { tag, search } = req.query;
  const filter = { isPublished: true };
  if (tag) filter.tags = tag.toLowerCase();
  if (search) filter.title = { $regex: search, $options: 'i' };
  const blogs = await Blog.find(filter)
    .populate('author', 'name')
    .sort({ publishedAt: -1 })
    .select('-content');
  ApiResponse.success(res, { blogs });
});

const getBlog = asyncHandler(async (req, res) => {
  const blog = await Blog.findOneAndUpdate(
    { slug: req.params.slug, isPublished: true },
    { $inc: { views: 1 } },
    { new: true }
  ).populate('author', 'name');
  if (!blog) throw new ApiError(404, 'Blog post not found');
  ApiResponse.success(res, { blog });
});

const getCategories = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = getPaginationOptions(req.query);
  const { search, isActive, } = req.query;

  const filter = { isActive: true };
  if (search && search !== 'All Items') filter.name = { $regex: search, $options: 'i' };
  if (isActive !== undefined) filter.isActive = isActive === 'true';

  const [categories, total] = await Promise.all([
    Category.find(filter).sort(sort).skip(skip).limit(limit),
    Category.countDocuments(filter),
  ]);

  ApiResponse.paginated(res, categories, buildPaginationMeta(total, page, limit));
});

const getAllCategories = asyncHandler(async (req, res) => {


  const filter = { isActive: true };
  const categories = await Category.find(filter,"name image").lean();
  ApiResponse.success(res, categories);

});






const getBrands = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = getPaginationOptions(req.query);
  const { search, isActive, categoryId } = req.query;

  const filter = {};

  // 1. Search Logic
  if (search && search.trim() !== "") {
    filter.name = { $regex: search, $options: 'i' };
  }

  // 2. Active Status Logic
  if (isActive !== undefined && isActive !== "") {
    filter.isActive = isActive === 'true';
  }

  /**
   * 3. CategoryId Fix
   * We check for:
   * - null/undefined
   * - Empty string ""
   * - Literal empty quotes string '""' (sent by some frontend states)
   * - The string "undefined" or "null"
   */
  if (
    categoryId && 
    categoryId !== "" && 
    categoryId !== '""' && 
    categoryId !== "undefined" && 
    categoryId !== "null"
  ) {
    filter.categoryId = categoryId;
  }

  const [brands, total] = await Promise.all([
    Brand.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Brand.countDocuments(filter),
  ]);

  ApiResponse.paginated(res, brands, buildPaginationMeta(total, page, limit));
});


const uploadFile = asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file) throw new ApiError(400, "No file uploaded");
  const s3Url = await uploadToS3(file.buffer, file.originalname, "images");
  ApiResponse.success(res, { url: s3Url }, 'File uploaded successfully', 200);
});

const calculateOrderPrice = asyncHandler(async (req, res) => {
  const { productId, selectedOptions } = req.body;
  const result = await calculatePrice(productId, selectedOptions);
  ApiResponse.success(res, result, 'Price calculated');
});



module.exports = { getFAQs, getBlogs, getBlog, getCategories, getBrands, uploadFile, calculateOrderPrice, getAllCategories };
