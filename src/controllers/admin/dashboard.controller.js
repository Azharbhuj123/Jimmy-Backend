const User = require('../../models/User');
const Order = require('../../models/Order');
const Product = require('../../models/Product');
const { getDailyPayoutAnalytics } = require('../../services/pricing.service');
const ApiResponse = require('../../utils/ApiResponse');
const asyncHandler = require('../../utils/asyncHandler');

const getDashboard = asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days) || 30;

  const [
    totalUsers,
    totalOrders,
    payoutAgg,
    pendingPaymentCount,
    recentOrders,
    ordersByStatus,
    dailyPayout,
    topProducts,
  ] = await Promise.all([
    User.countDocuments({ role: 'user' }),
    Order.countDocuments(),

    // Total paid out (admin already paid)
    Order.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$totalCalculatedPrice' } } },
    ]),

    // Pending payments (inspected but not yet paid)
    Order.countDocuments({ status: 'inspected', paymentStatus: { $ne: 'sent' } }),

    Order.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('userId', 'name email')
      .populate('items.productId', 'name'),

    Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),

    getDailyPayoutAnalytics(days),

    // Top products by payout
    Order.aggregate([
      { $match: { status: 'paid' } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          totalPayout: { $sum: '$items.calculatedPrice' },
          totalOrders: { $sum: 1 },
        },
      },
      { $sort: { totalPayout: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },
      {
        $project: {
          productName: '$product.name',
          totalPayout: { $round: ['$totalPayout', 2] },
          totalOrders: 1,
        },
      },
    ]),
  ]);

  const totalPayout = payoutAgg[0]?.total || 0;

  ApiResponse.success(
    res,
    {
      stats: {
        totalUsers,
        totalOrders,
        totalPayout: parseFloat(totalPayout.toFixed(2)),
        pendingPayments: pendingPaymentCount,
      },
      ordersByStatus: ordersByStatus.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
      recentOrders,
      dailyPayout,
      topProducts,
    },
    'Dashboard data fetched'
  );
});

module.exports = { getDashboard };