const Order = require('../../models/Order');
const User = require('../../models/User');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');
const { getPaginationOptions, buildPaginationMeta } = require('../../utils/pagination');
const {
  sendStatusUpdateEmail,
  sendShippingLabelEmail,
  sendPaymentSentEmail,
} = require('../../services/email.service');

const VALID_STATUSES = ['pending', 'confirmed', 'label_sent', 'shipped', 'received', 'inspected', 'paid'];

// GET /admin/orders
const getOrders = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = getPaginationOptions(req.query);
  const { search, status, userId, startDate, endDate, fulfillmentType, paymentStatus } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (userId) filter.userId = userId;
  if (fulfillmentType) filter.fulfillmentType = fulfillmentType;
  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (search) filter.orderNumber = { $regex: search, $options: 'i' };
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('userId', 'name email phone')
      .populate('items.productId', 'name basePrice')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Order.countDocuments(filter),
  ]);

  ApiResponse.paginated(res, orders, buildPaginationMeta(total, page, limit));
});

// GET /admin/orders/:id
const getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('userId', 'name email phone')
    .populate('items.productId', 'name basePrice steps')
    .populate('pickupDetails.driverId', 'name phone');
  if (!order) throw new ApiError(404, 'Order not found');
  ApiResponse.success(res, { order });
});

// PUT /admin/orders/:id/status
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;

  if (!VALID_STATUSES.includes(status)) {
    throw new ApiError(400, `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found');

  const previousStatus = order.status;
  order.status = status;
  if (note) order.notes = note;

  order.statusHistory.push({
    status,
    note,
    changedAt: new Date(),
    changedBy: req.user._id,
  });

  await order.save();

  // Send email notification (non-blocking)
  if (previousStatus !== status) {
    const user = await User.findById(order.userId);
    if (user) sendStatusUpdateEmail(order, user, note).catch(() => { });
  }

  ApiResponse.success(res, { order }, `Order status updated to "${status}"`);
});

// PUT /admin/orders/:id/shipping
// Admin uploads shipping label (generated manually outside the system)
const updateShipping = asyncHandler(async (req, res) => {
  const { labelUrl, trackingNumber, courier } = req.body;

  if (!labelUrl || !trackingNumber || !courier) {
    throw new ApiError(400, 'labelUrl, trackingNumber, and courier are required');
  }

  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found');

  order.shippingDetails = {
    ...((order.shippingDetails || {}).toObject ? order.shippingDetails.toObject() : order.shippingDetails || {}),
    labelUrl,
    trackingNumber,
    courier,
  };

  order.status = 'label_sent';
  order.statusHistory.push({
    status: 'label_sent',
    note: `Shipping label created via ${courier}. Tracking: ${trackingNumber}`,
    changedAt: new Date(),
    changedBy: req.user._id,
  });

  await order.save();

  // Email user with label link (non-blocking)
  const user = await User.findById(order.userId);
  if (user) {
    sendShippingLabelEmail(order, user).catch(() => { });
  }

  ApiResponse.success(res, { order }, 'Shipping label saved and user notified');
});

// PUT /admin/orders/:id/pay
// Admin marks payment as sent (manual Zelle/PayPal transfer)
const markPaymentSent = asyncHandler(async (req, res) => {
  const { paymentMethod, transactionId } = req.body;

  const validMethods = ['zelle', 'paypal', 'apple_pay', 'venmo', 'check'];
  if (!validMethods.includes(paymentMethod)) {
    throw new ApiError(400, `Invalid paymentMethod. Must be one of: ${validMethods.join(', ')}`);
  }

  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found');

  if (order.paymentStatus === 'sent') {
    throw new ApiError(400, 'Payment has already been marked as sent for this order');
  }

  order.paymentMethod = paymentMethod;
  order.transactionId = transactionId;
  order.paymentStatus = 'sent';
  order.paidAt = new Date();
  order.status = 'paid';

  order.statusHistory.push({
    status: 'paid',
    note: `Payment sent via ${paymentMethod}${transactionId ? `. TXN: ${transactionId}` : ''}`,
    changedAt: new Date(),
    changedBy: req.user._id,
  });

  await order.save();

  // Notify user (non-blocking)
  const user = await User.findById(order.userId);
  if (user) sendPaymentSentEmail(order, user).catch(() => { });

  ApiResponse.success(res, { order }, 'Payment marked as sent and user notified');
});

module.exports = { getOrders, getOrder, updateOrderStatus, updateShipping, markPaymentSent };