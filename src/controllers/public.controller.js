const FAQ = require("../models/FAQ");
const Blog = require("../models/Blog");
const Category = require("../models/Category");
const Brand = require("../models/Brand");
const Product = require("../models/Product");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { uploadToS3 } = require("../services/upload.service");
const {
  getPaginationOptions,
  buildPaginationMeta,
} = require("../utils/pagination");
const { calculatePrice } = require("../services/pricing.service");
const { sendSellRequestEmail, sendSellRequestConfirmationEmail } = require("../services/email.service");

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
  if (search) filter.title = { $regex: search, $options: "i" };
  const blogs = await Blog.find(filter)
    .populate("author", "name")
    .sort({ publishedAt: -1 })
    .select("-content");
  ApiResponse.success(res, { blogs });
});

const getBlog = asyncHandler(async (req, res) => {
  const blog = await Blog.findOneAndUpdate(
    { slug: req.params.slug, isPublished: true },
    { $inc: { views: 1 } },
    { new: true },
  ).populate("author", "name");
  if (!blog) throw new ApiError(404, "Blog post not found");
  ApiResponse.success(res, { blog });
});

const getCategories = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = getPaginationOptions(req.query);
  const { search, isActive } = req.query;

  const filter = { isActive: true };
  if (search && search !== "All Items")
    filter.name = { $regex: search, $options: "i" };
  if (isActive !== undefined) filter.isActive = isActive === "true";

  const [categories, total] = await Promise.all([
    Category.find(filter).sort(sort).skip(skip).limit(limit),
    Category.countDocuments(filter),
  ]);

  ApiResponse.paginated(
    res,
    categories,
    buildPaginationMeta(total, page, limit),
  );
});

const getAllCategories = asyncHandler(async (req, res) => {
  const filter = { isActive: true };
  const categories = await Category.find(filter, "name image").lean();
  ApiResponse.success(res, categories);
});

const getBrands = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = getPaginationOptions(req.query);
  const { search, isActive, categoryId } = req.query;

  const filter = {};

  // 1. Search Logic
  if (search && search.trim() !== "") {
    filter.name = { $regex: search, $options: "i" };
  }

  // 2. Active Status Logic
  if (isActive !== undefined && isActive !== "") {
    filter.isActive = isActive === "true";
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
    Brand.find(filter).sort(sort).skip(skip).limit(limit),
    Brand.countDocuments(filter),
  ]);

  ApiResponse.paginated(res, brands, buildPaginationMeta(total, page, limit));
});

const uploadFile = asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file) throw new ApiError(400, "No file uploaded");
  const s3Url = await uploadToS3(file.buffer, file.originalname, "images");
  ApiResponse.success(res, { url: s3Url }, "File uploaded successfully", 200);
});

const calculateOrderPrice = asyncHandler(async (req, res) => {
  const { productId, selectedOptions } = req.body;
  const result = await calculatePrice(productId, selectedOptions);
  ApiResponse.success(res, result, "Price calculated");
});

// POST /upload-multiple - Upload up to 3 images
const uploadFiles = asyncHandler(async (req, res) => {
  const files = req.files;
  if (!files || files.length === 0) throw new ApiError(400, "No files uploaded");
  if (files.length > 3) throw new ApiError(400, "Maximum 3 images allowed");

  const urls = await Promise.all(
    files.map((file) => uploadToS3(file.buffer, file.originalname, "images")),
  );

  ApiResponse.success(res, { urls }, "Files uploaded successfully", 200);
});

// POST /manual-products
const createManualProduct = asyncHandler(async (req, res) => {
  const {
    brandId,
    category,
    model,
    storage,
    carrier,
    condition,
    askingPrice,
    images,
  } = req.body;

  if (!model || !askingPrice) {
    throw new ApiError(400, "Model name and asking price are required");
  }

  const price = parseFloat(askingPrice);
  if (isNaN(price) || price <= 0) {
    throw new ApiError(400, "Asking price must be a positive number");
  }

  const product = await Product.create({
    name: model,
    brandId: brandId || null,
    storage: storage || "",
    carrier: carrier || "",
    basePrice: price,
    images: Array.isArray(images) ? images : [],
    steps: [],
    isManual: true,
    isActive: true,
  });

  return ApiResponse.success(
    res,
    {
      _id: product._id,
      name: product.name,
      images: product.images,
      basePrice: product.basePrice,
      storage: product.storage,
      carrier: product.carrier,
      isManual: true,
    },
    "Manual product created",
    201,
  );
});

// POST /sell-request
const submitSellRequest = asyncHandler(async (req, res) => {
  const { deviceDetails, quotedPrice, userDetails } = req.body;

  if (!deviceDetails || !userDetails || !userDetails.name || !userDetails.email) {
    throw new ApiError(400, "Device details and user details (Name, Email) are required.");
  }

  const adminEmail = "developerdesignz123@gmail.com";
  
  await Promise.all([
    sendSellRequestEmail(adminEmail, {
      deviceDetails,
      quotedPrice,
      userDetails
    }),
    sendSellRequestConfirmationEmail(userDetails.email, {
      deviceDetails,
      quotedPrice,
      userDetails
    })
  ]);

  return ApiResponse.success(
    res,
    null,
    "Request submitted successfully",
    200
  );
});

module.exports = {
  getFAQs,
  getBlogs,
  getBlog,
  getCategories,
  getBrands,
  uploadFile,
  uploadFiles,
  calculateOrderPrice,
  getAllCategories,
  createManualProduct,
  submitSellRequest,
};
