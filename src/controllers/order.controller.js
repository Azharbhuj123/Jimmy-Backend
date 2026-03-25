const Order = require('../models/Order');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { calculatePrice } = require('../services/pricing.service');
const { sendOrderCreatedEmail } = require('../services/email.service');
const { getPaginationOptions, buildPaginationMeta } = require('../utils/pagination');
const Product = require('../models/Product');

const createOrder = asyncHandler(async (req, res) => {
  const { productId, selectedOptions, notes } = req.body;
  const user = req.user;

  // Calculate price using pricing engine
  const { basePrice, calculatedPrice, priceBreakdown, enrichedOptions, productName } =
    await calculatePrice(productId, selectedOptions);

  const order = await Order.create({
    userId: user._id,
    productId,
    selectedOptions: enrichedOptions,
    basePrice,
    calculatedPrice,
    priceBreakdown,
    notes,
    userDetails: {
      name: user.name,
      email: user.email,
      phone: user.phone,
    },
    statusHistory: [{ status: 'pending', note: 'Order placed by user' }],
  });

  await order.populate('productId', 'name');

  // Update product stats
  await Product.findByIdAndUpdate(productId, {
    $inc: { totalOrders: 1 },
  });

  // Send confirmation email (non-blocking)
  sendOrderCreatedEmail(order, user);

  ApiResponse.success(res, { order }, 'Order placed successfully', 201);
});

const getMyOrders = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = getPaginationOptions(req.query);
  const { status } = req.query;

  const filter = { userId: req.user._id };
  if (status) filter.status = status;

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('productId', 'name basePrice images')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Order.countDocuments(filter),
  ]);

  ApiResponse.paginated(res, orders, buildPaginationMeta(total, page, limit));
});

const getMyOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, userId: req.user._id })
    .populate('productId', 'name basePrice images steps');
  if (!order) throw new ApiError(404, 'Order not found');
  ApiResponse.success(res, { order });
});

const calculateOrderPrice = asyncHandler(async (req, res) => {
  const { productId, selectedOptions } = req.body;
  const result = await calculatePrice(productId, selectedOptions);
  ApiResponse.success(res, result, 'Price calculated');
});

module.exports = { createOrder, getMyOrders, getMyOrder, calculateOrderPrice };
