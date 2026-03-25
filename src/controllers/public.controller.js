const FAQ = require('../models/FAQ');
const Blog = require('../models/Blog');
const Category = require('../models/Category');
const Brand = require('../models/Brand');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const getFAQs = asyncHandler(async (req, res) => {
  const { category } = req.query;
  const filter = { isActive: true };
  if (category) filter.category = category;
  const faqs = await FAQ.find(filter).sort({ order: 1 });
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
  const categories = await Category.find({ isActive: true }).sort({ name: 1 });
  ApiResponse.success(res, { categories });
});

const getBrands = asyncHandler(async (req, res) => {
  const brands = await Brand.find({ isActive: true }).sort({ name: 1 });
  ApiResponse.success(res, { brands });
});

module.exports = { getFAQs, getBlogs, getBlog, getCategories, getBrands };
