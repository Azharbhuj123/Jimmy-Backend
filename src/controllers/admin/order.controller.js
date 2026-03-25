const Order = require('../../models/Order');
const User = require('../../models/User');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');
const { getPaginationOptions, buildPaginationMeta } = require('../../utils/pagination');
const { sendOrderStatusUpdateEmail } = require('../../services/email.service');

const VALID_STATUSES = ['pending', 'confirmed', 'received', 'inspected', 'paid'];

const getOrders = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = getPaginationOptions(req.query);
  const { search, status, userId, productId, startDate, endDate } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (userId) filter.userId = userId;
  if (productId) filter.productId = productId;
  if (search) filter.orderNumber = { $regex: search, $options: 'i' };
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('userId', 'name email phone')
      .populate('productId', 'name basePrice')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Order.countDocuments(filter),
  ]);

  ApiResponse.paginated(res, orders, buildPaginationMeta(total, page, limit));
});

const getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('userId', 'name email phone')
    .populate('productId', 'name basePrice steps');
  if (!order) throw new ApiError(404, 'Order not found');
  ApiResponse.success(res, { order });
});

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

  order.statusHistory.push({ status, note, changedAt: new Date() });
  await order.save();

  // Trigger status update email
  const user = await User.findById(order.userId);
  if (user && previousStatus !== status) {
    await sendOrderStatusUpdateEmail(order, user);
  }

  ApiResponse.success(res, { order }, `Order status updated to "${status}"`);
});

module.exports = { getOrders, getOrder, updateOrderStatus };
