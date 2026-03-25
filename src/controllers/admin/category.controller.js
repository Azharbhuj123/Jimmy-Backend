const Category = require('../../models/Category');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');
const { getPaginationOptions, buildPaginationMeta } = require('../../utils/pagination');

const createCategory = asyncHandler(async (req, res) => {
  const category = await Category.create(req.body);
  ApiResponse.success(res, { category }, 'Category created', 201);
});

const getCategories = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = getPaginationOptions(req.query);
  const { search, isActive } = req.query;

  const filter = {};
  if (search) filter.name = { $regex: search, $options: 'i' };
  if (isActive !== undefined) filter.isActive = isActive === 'true';

  const [categories, total] = await Promise.all([
    Category.find(filter).sort(sort).skip(skip).limit(limit),
    Category.countDocuments(filter),
  ]);

  ApiResponse.paginated(res, categories, buildPaginationMeta(total, page, limit));
});

const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!category) throw new ApiError(404, 'Category not found');
  ApiResponse.success(res, { category }, 'Category updated');
});

const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) throw new ApiError(404, 'Category not found');
  ApiResponse.success(res, {}, 'Category deleted');
});

module.exports = { createCategory, getCategories, updateCategory, deleteCategory };
