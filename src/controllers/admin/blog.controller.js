const Blog = require('../../models/Blog');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');
const { getPaginationOptions, buildPaginationMeta } = require('../../utils/pagination');

const createBlog = asyncHandler(async (req, res) => {
  const blog = await Blog.create({ ...req.body, author: req.user._id });
  await blog.populate('author', 'name email');
  ApiResponse.success(res, { blog }, 'Blog created', 201);
});

const getBlogs = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = getPaginationOptions(req.query);
  const { search, isPublished, tag } = req.query;

  const filter = {};
  if (search) filter.title = { $regex: search, $options: 'i' };
  if (isPublished !== undefined) filter.isPublished = isPublished === 'true';
  if (tag) filter.tags = tag.toLowerCase();

  const [blogs, total] = await Promise.all([
    Blog.find(filter)
      .populate('author', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Blog.countDocuments(filter),
  ]);

  ApiResponse.paginated(res, blogs, buildPaginationMeta(total, page, limit));
});

const updateBlog = asyncHandler(async (req, res) => {
  const blog = await Blog.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  }).populate('author', 'name email');
  if (!blog) throw new ApiError(404, 'Blog not found');
  ApiResponse.success(res, { blog }, 'Blog updated');
});

const deleteBlog = asyncHandler(async (req, res) => {
  const blog = await Blog.findByIdAndDelete(req.params.id);
  if (!blog) throw new ApiError(404, 'Blog not found');
  ApiResponse.success(res, {}, 'Blog deleted');
});

module.exports = { createBlog, getBlogs, updateBlog, deleteBlog };
