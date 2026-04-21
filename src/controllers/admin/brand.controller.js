const Brand = require('../../models/Brand');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');
const { getPaginationOptions, buildPaginationMeta } = require('../../utils/pagination');

const createBrand = asyncHandler(async (req, res) => {
  const brand = await Brand.create(req.body);
  ApiResponse.success(res, { brand }, 'Brand created', 201);
});

const getBrands = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = getPaginationOptions(req.query);
  const { search, isActive, } = req.query;

  const filter = {};
  if (search) filter.name = { $regex: search, $options: 'i' };
  if (isActive !== undefined) filter.isActive = isActive === 'true';

  const [brands, total] = await Promise.all([
    Brand.find(filter).sort(sort).skip(skip).limit(limit),
    Brand.countDocuments(filter),
  ]);

  ApiResponse.paginated(res, brands, buildPaginationMeta(total, page, limit));
});

const updateBrand = asyncHandler(async (req, res) => {
  const brand = await Brand.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!brand) throw new ApiError(404, 'Brand not found');
  ApiResponse.success(res, { brand }, 'Brand updated');
});

const deleteBrand = asyncHandler(async (req, res) => {
  const brand = await Brand.findByIdAndDelete(req.params.id);
  if (!brand) throw new ApiError(404, 'Brand not found');
  ApiResponse.success(res, {}, 'Brand deleted');
});

module.exports = { createBrand, getBrands, updateBrand, deleteBrand };
