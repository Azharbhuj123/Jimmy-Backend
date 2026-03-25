const FAQ = require('../../models/FAQ');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');

const createFAQ = asyncHandler(async (req, res) => {
  const faq = await FAQ.create(req.body);
  ApiResponse.success(res, { faq }, 'FAQ created', 201);
});

const getFAQs = asyncHandler(async (req, res) => {
  const { search, category, isActive } = req.query;
  const filter = {};
  if (search) filter.question = { $regex: search, $options: 'i' };
  if (category) filter.category = category;
  if (isActive !== undefined) filter.isActive = isActive === 'true';

  const faqs = await FAQ.find(filter).sort({ order: 1, createdAt: -1 });
  ApiResponse.success(res, { faqs });
});

const updateFAQ = asyncHandler(async (req, res) => {
  const faq = await FAQ.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!faq) throw new ApiError(404, 'FAQ not found');
  ApiResponse.success(res, { faq }, 'FAQ updated');
});

const deleteFAQ = asyncHandler(async (req, res) => {
  const faq = await FAQ.findByIdAndDelete(req.params.id);
  if (!faq) throw new ApiError(404, 'FAQ not found');
  ApiResponse.success(res, {}, 'FAQ deleted');
});

module.exports = { createFAQ, getFAQs, updateFAQ, deleteFAQ };
