const User = require('../../models/User');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');
const { getPaginationOptions, buildPaginationMeta } = require('../../utils/pagination');

const getUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = getPaginationOptions(req.query);
  const { search, isActive } = req.query;

  const filter = { role: 'user' };
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }
  if (isActive !== undefined) filter.isActive = isActive === 'true';

  const [users, total] = await Promise.all([
    User.find(filter).sort(sort).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  ApiResponse.paginated(res, users, buildPaginationMeta(total, page, limit));
});

const getUser = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, role: 'user' });
  if (!user) throw new ApiError(404, 'User not found');

  // Include order summary
  const Order = require('../../models/Order');
  const [totalOrders, totalSpent] = await Promise.all([
    Order.countDocuments({ userId: user._id }),
    Order.aggregate([
      { $match: { userId: user._id, status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$calculatedPrice' } } },
    ]),
  ]);

  ApiResponse.success(res, {
    user,
    stats: {
      totalOrders,
      totalSpent: totalSpent[0]?.total || 0,
    },
  });
});

const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findOneAndDelete({ _id: req.params.id, role: 'user' });
  if (!user) throw new ApiError(404, 'User not found');
  ApiResponse.success(res, {}, 'User deleted');
});

const toggleUserStatus = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, role: 'user' });
  if (!user) throw new ApiError(404, 'User not found');
  user.isActive = !user.isActive;
  await user.save();
  ApiResponse.success(res, { user }, `User ${user.isActive ? 'activated' : 'deactivated'}`);
});

module.exports = { getUsers, getUser, deleteUser, toggleUserStatus };
