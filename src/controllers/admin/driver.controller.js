const Driver = require('../../models/Driver');
const Pickup = require('../../models/Pickup');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');
const { sendDriverWelcomeEmail } = require('../../services/email.service');

// Generate a random 8-character alphanumeric password
const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let pwd = '';
    for (let i = 0; i < 8; i++) {
        pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pwd;
};

const createDriver = asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!email) throw new ApiError(400, 'Driver email is required');

    // Generate and attach password before saving
    const plainPassword = generatePassword();
    const driver = await Driver.create({ ...req.body, password: plainPassword });

    // Send welcome email with credentials (non-blocking)
    sendDriverWelcomeEmail(driver, plainPassword).catch(() => {});

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

// Driver workload
const getDriverWorkload = asyncHandler(async (req, res) => {
    const workload = await Pickup.aggregate([
        {
            $match: {
                driverId: { $ne: null }
            }
        },
        {
            $group: {
                _id: '$driverId',
                assignedCount: { $sum: { $cond: [{ $eq: ['$status', 'assigned'] }, 1, 0] } },
                enRouteCount: { $sum: { $cond: [{ $eq: ['$status', 'en_route'] }, 1, 0] } },
                totalActive: { $sum: { $cond: [{ $in: ['$status', ['assigned', 'en_route']] }, 1, 0] } },
            }
        },
        {
            $lookup: {
                from: 'drivers',
                localField: '_id',
                foreignField: '_id',
                as: 'driverInfo'
            }
        },
        {
            $unwind: {
                path: '$driverInfo',
                    preserveNullAndEmptyArrays: true
            }
        },
        {
            $project: {
                driverId: '$_id',
                name:  '$driverInfo.name',
                phone: '$driverInfo.phone',
                email: '$driverInfo.email',
                assignedCount: 1,
                enRouteCount: 1,
                totalActive: 1
            }
        },
        {
            $sort: { totalActive: -1 }
        }
    ]);

    ApiResponse.success(res, workload, 'Driver workload retrieved');
});

module.exports = {
    createDriver,
    getDrivers,
    updateDriver,
    deleteDriver,
    getDriverWorkload
};
