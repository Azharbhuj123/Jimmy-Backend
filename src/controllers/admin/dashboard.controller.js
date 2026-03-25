const User = require('../../models/User');
const Order = require('../../models/Order');
const Product = require('../../models/Product');
const { getDailyRevenueAnalytics } = require('../../services/pricing.service');
const ApiResponse = require('../../utils/ApiResponse');
const asyncHandler = require('../../utils/asyncHandler');

const getDashboard = asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days) || 30;

  const [
    totalUsers,
    totalOrders,
    revenueAgg,
    recentOrders,
    ordersByStatus,
    dailyRevenue,
    topProducts,
  ] = await Promise.all([
    User.countDocuments({ role: 'user' }),
    Order.countDocuments(),
    Order.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$calculatedPrice' } } },
    ]),
    Order.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('userId', 'name email')
      .populate('productId', 'name'),
    Order.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    getDailyRevenueAnalytics(days),
    Order.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: '$productId', revenue: { $sum: '$calculatedPrice' }, orders: { $sum: 1 } } },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
      { $unwind: '$product' },
      { $project: { productName: '$product.name', revenue: 1, orders: 1 } },
    ]),
  ]);

  const totalPayout = revenueAgg[0]?.total || 0;

  ApiResponse.success(res, {
    stats: {
      totalUsers,
      totalOrders,
      totalPayout: parseFloat(totalPayout.toFixed(2)),
    },
    ordersByStatus: ordersByStatus.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
    recentOrders,
    dailyRevenue,
    topProducts,
  }, 'Dashboard data fetched');
});

module.exports = { getDashboard };
