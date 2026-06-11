const Order = require("../../models/Order");
const Product = require("../../models/Product");
const User = require("../../models/User");
const ApiResponse = require("../../utils/ApiResponse");
const ApiError = require("../../utils/ApiError");
const asyncHandler = require("../../utils/asyncHandler");
const {
  getPaginationOptions,
  buildPaginationMeta,
} = require("../../utils/pagination");
const {
  sendStatusUpdateEmail,
  sendShippingLabelEmail,
  sendPaymentSentEmail,
  sendOrderCreatedEmail,
} = require("../../services/email.service");
const { calculateMultiPrice } = require("../../services/pricing.service");
const pickupService = require("../../services/pickup.service");

const VALID_STATUSES = [
  "pending",
  "confirmed",
  "label_sent",
  "shipped",
  "received",
  "inspected",
  "ready_to_pay",
  "paid",
  "paid",
  "cancelled",
];

// POST /admin/orders
const createOrder = asyncHandler(async (req, res) => {
  const {
    items,
    fulfillmentType,
    shippingDetails,
    pickupDetails,
    notes,
    guest_email,
    preferredContact,
    paymentMethod,
    status,
    driverId,
  } = req.body;

  if (!Array.isArray(items) || !items.length) {
    throw new ApiError(400, "items must be a non-empty array");
  }

  // Calculate prices for all items
  const priceResult = await calculateMultiPrice(items, fulfillmentType);

  // Build order items
  const orderItems = priceResult.items.map((r) => ({
    productId: r.productId,
    productName: r.productName,
    storage: r.storage,
    carrier: r.carrier,
    selectedOptions: r.enrichedOptions,
    basePrice: r.basePrice,
    calculatedPrice: r.calculatedPrice,
    priceBreakdown: r.priceBreakdown,
  }));

  let userDetails = {
    name: shippingDetails?.name || pickupDetails?.name || "Third Party User",
    email: guest_email || "",
    phone:
      fulfillmentType === "shipping"
        ? shippingDetails?.phone
        : pickupDetails?.phone || "",
    preferredContact: preferredContact || "email",
    city: shippingDetails?.city || "",
    state: shippingDetails?.state || "",
  };

  const order = await Order.create({
    userId: null, // Admin created, no user id unless linked
    guest_email: guest_email || "",
    items: orderItems,
    totalBasePrice: priceResult.totalBasePrice,
    totalCalculatedPrice: priceResult.totalCalculatedPrice,
    fulfillmentType: fulfillmentType || "shipping",
    shippingDetails:
      fulfillmentType === "shipping" ? shippingDetails : undefined,
    pickupDetails: fulfillmentType === "pickup" ? pickupDetails : undefined,
    notes,
    userDetails,
    paymentMethod,
    status: status || "pending",
    isManual: true,
    statusHistory: [
      { status: status || "pending", note: "Order placed manually by Admin" },
    ],
  });

  let pickup = null;
  // If order is pickup, create pickup record
  if (fulfillmentType === "pickup") {
    pickup = await pickupService.createPickupFromOrder(order, userDetails);
    if (driverId) {
      await pickupService.assignDriverToPickup(
        pickup._id,
        driverId,
        {
          date: pickupDetails?.pickupDate,
          timeSlot: pickupDetails?.time,
          notes: notes,
        },
        req.app.io,
      );
    }
  }

  // Increment totalOrders on each product (non-blocking)
  const productIds = [
    ...new Set(orderItems.map((i) => i.productId.toString())),
  ];
  Product.updateMany(
    { _id: { $in: productIds } },
    { $inc: { totalOrders: 1 } },
  ).catch(() => {});

  // Send confirmation email (non-blocking)
  if (guest_email) {
    sendOrderCreatedEmail(order, null).catch(() => {});
  }

  ApiResponse.success(
    res,
    { order, pickup },
    "Order created successfully",
    201,
  );
});

// GET /admin/orders
const getOrders = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = getPaginationOptions(req.query);
  const {
    search,
    status,
    userId,
    startDate,
    endDate,
    fulfillmentType,
    paymentStatus,
    isManual,
  } = req.query;

  const filter = {};
  if (isManual === "true") filter.isManual = true;
  else if (isManual === "false") filter.isManual = false;

  if (status) filter.status = status;
  if (userId) filter.userId = userId;
  if (fulfillmentType) filter.fulfillmentType = fulfillmentType;
  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (search) {
    filter.$or = [
      { orderNumber: { $regex: search, $options: "i" } },
      { "userDetails.email": { $regex: search, $options: "i" } },
      { "userDetails.name": { $regex: search, $options: "i" } },
    ];
  }
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate("userId", "name email phone")
      .populate("items.productId", "name basePrice")
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
    .populate("userId", "name email phone")
    .populate("items.productId", "name basePrice steps storage carrier")
    .populate("pickupDetails.driverId", "name phone");
  if (!order) throw new ApiError(404, "Order not found");
  ApiResponse.success(res, { order });
});

// PUT /admin/orders/:id/status
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;

  if (!VALID_STATUSES.includes(status)) {
    throw new ApiError(
      400,
      `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
    );
  }

  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, "Order not found");

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

  // Handle Stock Adjustment (Automatic)
  if (previousStatus !== status) {
    const isInWarehouse = (s) =>
      ["received", "inspected", "ready_to_pay", "paid"].includes(s);
    const wasIn = isInWarehouse(previousStatus);
    const isNowIn = isInWarehouse(status);

    if (!wasIn && isNowIn) {
      // Order just arrived/processed -> Increase Stock
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.productId, { $inc: { stock: 1 } });
      }
    } else if (wasIn && status === "cancelled") {
      // Order was in warehouse but now cancelled -> Decrease Stock
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { stock: -1 },
        });
      }
    }

    // Send email notification (non-blocking)
    const user = await User.findById(order.userId);
    if (user || order?.guest_email)
      sendStatusUpdateEmail(order, user, note).catch(() => {});
  }

  ApiResponse.success(res, { order }, `Order status updated to "${status}"`);
});

// PUT /admin/orders/:id/shipping
// Admin uploads shipping label (generated manually outside the system)
const updateShipping = asyncHandler(async (req, res) => {
  const { labelUrl, trackingNumber, courier } = req.body;

  if (!trackingNumber || !courier) {
    throw new ApiError(400, "trackingNumber, and courier are required");
  }

  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, "Order not found");

  order.shippingDetails = {
    ...((order.shippingDetails || {}).toObject
      ? order.shippingDetails.toObject()
      : order.shippingDetails || {}),
    labelUrl: labelUrl || "",
    trackingNumber,
    courier,
  };

  order.status = "label_sent";
  order.statusHistory.push({
    status: "label_sent",
    note: `Shipping label created via ${courier}. Tracking: ${trackingNumber}`,
    changedAt: new Date(),
    changedBy: req.user._id,
  });

  await order.save();

  // Email user with label link (non-blocking)
  const user = await User.findById(order.userId);
  if (user || order?.guest_email) {
    sendShippingLabelEmail(order, user).catch(() => {});
  }

  ApiResponse.success(res, { order }, "Shipping label saved and user notified");
});

// PUT /admin/orders/:id/pay
// Admin marks payment as sent (manual Zelle/PayPal transfer)
const markPaymentSent = asyncHandler(async (req, res) => {
  const { paymentMethod, transactionId } = req.body;

  const validMethods = ["zelle", "paypal", "apple_pay", "venmo", "check"];
  if (!validMethods.includes(paymentMethod)) {
    throw new ApiError(
      400,
      `Invalid paymentMethod. Must be one of: ${validMethods.join(", ")}`,
    );
  }

  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, "Order not found");

  if (order.paymentStatus === "sent") {
    throw new ApiError(
      400,
      "Payment has already been marked as sent for this order",
    );
  }

  order.paymentMethod = paymentMethod;
  order.transactionId = transactionId;
  order.paymentStatus = "sent";
  order.paidAt = new Date();
  order.status = "paid";

  order.statusHistory.push({
    status: "paid",
    note: `Payment sent via ${paymentMethod}${transactionId ? `. TXN: ${transactionId}` : ""}`,
    changedAt: new Date(),
    changedBy: req.user._id,
  });

  await order.save();

  // Notify user (non-blocking)
  const user = await User.findById(order.userId);
  if (user || order?.guest_email)
    sendPaymentSentEmail(order, user).catch(() => {});

  ApiResponse.success(
    res,
    { order },
    "Payment marked as sent and user notified",
  );
});

// PUT /admin/orders/:id/internal
const updateInternalDetails = asyncHandler(async (req, res) => {
  const { internalNotes, flags } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, "Order not found");

  if (internalNotes !== undefined) order.internalNotes = internalNotes;
  if (flags !== undefined) order.flags = flags;

  await order.save();
  ApiResponse.success(res, { order }, "Internal details updated");
});

const deleteOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, "Order not found");

  await Order.deleteOne({ _id: req.params.id });
  return ApiResponse.success(res, null, "Order deleted successfully");
});

module.exports = {
  createOrder,
  getOrders,
  getOrder,
  deleteOrder,
  updateOrderStatus,
  updateShipping,
  markPaymentSent,
  updateInternalDetails,
};
