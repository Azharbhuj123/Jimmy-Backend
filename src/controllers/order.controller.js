const Order = require('../models/Order');
const Product = require('../models/Product');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { calculateMultiPrice, calculatePrice } = require('../services/pricing.service');
const { sendOrderCreatedEmail } = require('../services/email.service');
const { getPaginationOptions, buildPaginationMeta } = require('../utils/pagination');

// POST /orders/calculate-price
const calculateOrderPrice = asyncHandler(async (req, res) => {
  const { productId, selectedOptions } = req.body;
  const result = await calculatePrice(productId, selectedOptions);
  ApiResponse.success(res, result, 'Price calculated');
});

// POST /orders
const createOrder = asyncHandler(async (req, res) => {
  const { items, fulfillmentType, shippingDetails, pickupDetails, notes, guest_email } = req.body;
  const user = req?.user;

  if (!Array.isArray(items) || !items.length) {
    throw new ApiError(400, 'items must be a non-empty array');
  }

  // Calculate prices for all items
  const priceResult = await calculateMultiPrice(items);

  // Build order items
  const orderItems = priceResult.items.map((r) => ({
    productId: r.productId,
    productName: r.productName,
    selectedOptions: r.enrichedOptions,
    basePrice: r.basePrice,
    calculatedPrice: r.calculatedPrice,
    priceBreakdown: r.priceBreakdown,
  }));

  const order = await Order.create({
    userId: user ? user._id : null,
    guest_email: user ? "" : guest_email,
    items: orderItems,
    totalBasePrice: priceResult.totalBasePrice,
    totalCalculatedPrice: priceResult.totalCalculatedPrice,
    fulfillmentType: fulfillmentType || 'shipping',
    shippingDetails: fulfillmentType !== 'pickup' ? shippingDetails : undefined,
    pickupDetails: fulfillmentType === 'pickup' ? pickupDetails : undefined,
    notes,
    userDetails: {
      name: guest_email ? shippingDetails?.name : user.name,
      email: guest_email ? guest_email : user.email,
      phone: shippingDetails?.phone,
    },
    statusHistory: [{ status: 'pending', note: 'Order placed by user' }],
  });

  // Increment totalOrders on each product (non-blocking)
  const productIds = [...new Set(orderItems.map((i) => i.productId.toString()))];
  Product.updateMany({ _id: { $in: productIds } }, { $inc: { totalOrders: 1 } }).catch(() => { });

  // Send confirmation email (non-blocking)
  sendOrderCreatedEmail(order, user).catch(() => { });

  ApiResponse.success(res, { order }, 'Order placed successfully', 201);
});

// GET /orders
const getMyOrders = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = getPaginationOptions(req.query);
  const { status } = req.query;

  const filter = { userId: req.user._id };
  if (status) filter.status = status;

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('items.productId', 'name basePrice images')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Order.countDocuments(filter),
  ]);

  ApiResponse.paginated(res, orders, buildPaginationMeta(total, page, limit));
});

// GET /orders/:id
const getMyOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, userId: req.user._id }).populate(
    'items.productId',
    'name basePrice images steps'
  );
  if (!order) throw new ApiError(404, 'Order not found');
  ApiResponse.success(res, { order });
});

module.exports = { createOrder, getMyOrders, getMyOrder, calculateOrderPrice };