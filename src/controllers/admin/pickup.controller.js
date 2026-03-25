const Order = require('../../models/Order');
const Driver = require('../../models/Driver');
const User = require('../../models/User');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');
const { getPaginationOptions, buildPaginationMeta } = require('../../utils/pagination');
const { sendPickupScheduledEmail, sendStatusUpdateEmail } = require('../../services/email.service');

// GET /admin/pickups
const getPickups = asyncHandler(async (req, res) => {
    const { page, limit, skip, sort } = getPaginationOptions(req.query);
    const { status, driverId } = req.query;

    const filter = { fulfillmentType: 'pickup' };
    if (status) filter.status = status;
    if (driverId) filter['pickupDetails.driverId'] = driverId;

    const [orders, total] = await Promise.all([
        Order.find(filter)
            .populate('userId', 'name email phone')
            .populate('items.productId', 'name')
            .populate('pickupDetails.driverId', 'name phone')
            .sort(sort)
            .skip(skip)
            .limit(limit),
        Order.countDocuments(filter),
    ]);

    ApiResponse.paginated(res, orders, buildPaginationMeta(total, page, limit));
});

// PUT /admin/pickups/:id/assign-driver
const assignDriver = asyncHandler(async (req, res) => {
    const { driverId, date, timeSlot, notes } = req.body;

    if (!driverId) throw new ApiError(400, 'driverId is required');

    const driver = await Driver.findById(driverId);
    if (!driver) throw new ApiError(404, 'Driver not found');
    if (!driver.isActive) throw new ApiError(400, 'Driver is inactive');

    const order = await Order.findOne({ _id: req.params.id, fulfillmentType: 'pickup' });
    if (!order) throw new ApiError(404, 'Pickup order not found');

    order.pickupDetails = {
        ...(order.pickupDetails?.toObject?.() || order.pickupDetails || {}),
        driverId,
        date: date ? new Date(date) : order.pickupDetails?.date,
        timeSlot: timeSlot || order.pickupDetails?.timeSlot,
        notes: notes || order.pickupDetails?.notes,
    };

    order.status = 'confirmed';
    order.statusHistory.push({
        status: 'confirmed',
        note: `Driver assigned: ${driver.name}. Pickup on ${date || 'TBD'} ${timeSlot || ''}`.trim(),
        changedAt: new Date(),
        changedBy: req.user._id,
    });

    await order.save();

    // Email user (non-blocking)
    const user = await User.findById(order.userId);
    if (user) sendPickupScheduledEmail(order, user).catch(() => { });

    ApiResponse.success(res, { order }, 'Driver assigned and user notified');
});

// PUT /admin/pickups/:id/status
const updatePickupStatus = asyncHandler(async (req, res) => {
    const { status, note } = req.body;
    const allowedStatuses = ['confirmed', 'received', 'inspected', 'paid'];

    if (!allowedStatuses.includes(status)) {
        throw new ApiError(400, `Status must be one of: ${allowedStatuses.join(', ')}`);
    }

    const order = await Order.findOne({ _id: req.params.id, fulfillmentType: 'pickup' });
    if (!order) throw new ApiError(404, 'Pickup order not found');

    const previousStatus = order.status;
    order.status = status;
    order.statusHistory.push({
        status,
        note,
        changedAt: new Date(),
        changedBy: req.user._id,
    });

    await order.save();

    if (previousStatus !== status) {
        const user = await User.findById(order.userId);
        if (user) sendStatusUpdateEmail(order, user, note).catch(() => { });
    }

    ApiResponse.success(res, { order }, `Pickup status updated to "${status}"`);
});

// ── Driver CRUD ───────────────────────────────────────────────────────────────

const createDriver = asyncHandler(async (req, res) => {
    const driver = await Driver.create(req.body);
    ApiResponse.success(res, { driver }, 'Driver created', 201);
});

const getDrivers = asyncHandler(async (req, res) => {
    const { isActive } = req.query;
    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    const drivers = await Driver.find(filter).sort({ name: 1 });
    ApiResponse.success(res, { drivers });
});

const updateDriver = asyncHandler(async (req, res) => {
    const driver = await Driver.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
    });
    if (!driver) throw new ApiError(404, 'Driver not found');
    ApiResponse.success(res, { driver }, 'Driver updated');
});

const deleteDriver = asyncHandler(async (req, res) => {
    const driver = await Driver.findByIdAndDelete(req.params.id);
    if (!driver) throw new ApiError(404, 'Driver not found');
    ApiResponse.success(res, {}, 'Driver deleted');
});

module.exports = {
    getPickups,
    assignDriver,
    updatePickupStatus,
    createDriver,
    getDrivers,
    updateDriver,
    deleteDriver,
};