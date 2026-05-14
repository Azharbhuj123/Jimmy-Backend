const Pickup = require("../../models/Pickup");
const Order = require("../../models/Order");
const Driver = require("../../models/Driver");
const User = require("../../models/User");
const DriverLocation = require("../../models/DriverLocation");
const ApiResponse = require("../../utils/ApiResponse");
const ApiError = require("../../utils/ApiError");
const asyncHandler = require("../../utils/asyncHandler");
const {
  getPaginationOptions,
  buildPaginationMeta,
} = require("../../utils/pagination");
const {
  sendPickupScheduledEmail,
  sendStatusUpdateEmail,
  sendDriverAssignmentEmail,
} = require("../../services/email.service");
const { isStatusTransitionAllowed } = require("../../utils/status.helper");
const { v4: uuidv4 } = require("uuid");
const pickupService = require("../../services/pickup.service");


// Create a pickup from an order
const createPickup = asyncHandler(async (req, res) => {
  const {
    orderId,
    expectedResale,
    quotedPayout,
    pickupAddress,
    pickupLocation,
    pickupNotes,
    pickupFlags,
    urgency,
    timeSlot,
    category,
  } = req.body;

  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, "Order not found");

  const pickup = await Pickup.create({
    pickupId: `PU-${uuidv4().substring(0, 8).toUpperCase()}`,
    orderId,
    customerId: order.userId,
    quotedPayout,
    expectedResale,
    pickupAddress,
    pickupLocation: pickupLocation || { type: "Point", coordinates: [0, 0] },
    pickupNotes,
    pickupFlags,
    urgency,
    timeSlot,
    category,
  });

  ApiResponse.success(res, { pickup }, "Pickup created successfully", 201);
});

// Get all pickups
const getAllPickups = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = getPaginationOptions(req.query);
  const { status, urgency, category } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (urgency) filter.urgency = urgency;
  if (category) filter.category = category;

  const [pickups, total] = await Promise.all([
    Pickup.find(filter)
      .populate("customerId", "name email phone")
      .populate("orderId", "orderNumber")
      .populate("driverId", "name phone")
      .sort(sort || { "timeSlot.start": 1 })
      .skip(skip)
      .limit(limit),
    Pickup.countDocuments(filter),
  ]);

  ApiResponse.paginated(res, pickups, buildPaginationMeta(total, page, limit));
});

// Update pickup status
const updatePickupStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const pickup = await Pickup.findById(req.params.id);
  if (!pickup) throw new ApiError(404, "Pickup not found");

  if (!isStatusTransitionAllowed(pickup.status, status)) {
    throw new ApiError(
      400,
      `Cannot transition status from ${pickup.status} to ${status}`,
    );
  }

  pickup.status = status;
  await pickup.save();

  // Optionally notify customer
  const user = await User.findById(pickup.customerId);
  if (user && req.app.io) {
    req.app.io.emit("pickup:updated", pickup);
  }

  ApiResponse.success(res, { pickup }, `Pickup status updated to ${status}`);
});

// Assign driver manually
const assignDriver = asyncHandler(async (req, res) => {
  const { driverId, date, timeSlot, notes } = req.body;

  const pickup = await pickupService.assignDriverToPickup(
    req.params.id,
    driverId,
    { date, timeSlot, notes },
    req.app.io
  );

  if (!pickup) throw new ApiError(404, "Pickup not found");

  ApiResponse.success(res, { pickup }, "Driver assigned successfully");
});


// Auto-assign nearest available driver
const autoAssignDriver = asyncHandler(async (req, res) => {
  const pickup = await Pickup.findById(req.params.id);
  if (!pickup) throw new ApiError(404, "Pickup not found");

  if (!isStatusTransitionAllowed(pickup.status, "assigned")) {
    throw new ApiError(
      400,
      `Cannot auto-assign driver to pickup in status: ${pickup.status}`,
    );
  }

  const maxDistance = 50000; // 50km
  const nearestDrivers = await DriverLocation.find({
    location: {
      $near: {
        $geometry: pickup.pickupLocation,
        $maxDistance: maxDistance,
      },
    },
  }).limit(1);

  if (nearestDrivers.length === 0) {
    throw new ApiError(404, "No available drivers found nearby");
  }

  const driverId = nearestDrivers[0].driverId;
  pickup.driverId = driverId;
  pickup.status = "assigned";
  await pickup.save();

  if (req.app.io) {
    req.app.io.emit("pickup:updated", pickup);
  }

  ApiResponse.success(res, { pickup }, "Driver auto-assigned successfully");
});

// Metrics
const getMetrics = asyncHandler(async (req, res) => {
  const metrics = await Pickup.aggregate([
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$expectedResale" },
        totalPayouts: { $sum: "$quotedPayout" },
        totalProfit: { $sum: "$profit" },
        avgProfitPerPickup: { $avg: "$profit" },
        count: { $sum: 1 },
      },
    },
  ]);

  const result = metrics[0] || {
    totalRevenue: 0,
    totalPayouts: 0,
    totalProfit: 0,
    avgProfitPerPickup: 0,
    count: 0,
  };
  ApiResponse.success(res, result, "Metrics retrieved");
});

// Map Data
const getMapData = asyncHandler(async (req, res) => {
  const [assignedPickups, unassignedOrders, activeDrivers] = await Promise.all([
    Pickup.find({
      status: { $in: ["assigned", "en_route", "arrived", "picked_up"] },
    })
    .populate('orderId', 'orderNumber')
    .populate('customerId', 'name phone email'),

    Order.find({
      fulfillmentType: "pickup",
      status: "confirmed"
    }).select("status pickupDetails orderNumber userDetails"),

    DriverLocation.find().populate('driverId', 'name phone'),
  ]);

  // Combine into a single list of map items
  const pickups = [
    ...assignedPickups,
    ...unassignedOrders.map(o => ({
      _id: o._id,
      pickupId: o.orderNumber,
      status: "unassigned",
      pickupLocation: o.pickupDetails?.location,
      pickupAddress: o.pickupDetails?.addressLine1,
      orderId: { orderNumber: o.orderNumber },
      pickupDetails: o.pickupDetails,
      isOrder: true
    }))
  ];

  // Transform drivers to the format expected by the MapView
  const transformedDrivers = activeDrivers.map(dl => ({
    driverId: dl.driverId?._id || dl.driverId,
    driverName: dl.driverId?.name || "Active Driver",
    location: dl.location,
    lastSeen: dl.lastSeen,
  }));

  ApiResponse.success(
    res,
    { pickups, drivers: transformedDrivers },
    "Map data retrieved",
  );
});

module.exports = {
  createPickup,
  getAllPickups,
  updatePickupStatus,
  assignDriver,
  autoAssignDriver,
  getMetrics,
  getMapData,
};
