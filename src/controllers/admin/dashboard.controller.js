const User = require("../../models/User");
const Order = require("../../models/Order");
const Product = require("../../models/Product");
const { getPayoutAnalytics } = require("../../services/pricing.service");
const ApiResponse = require("../../utils/ApiResponse");
const asyncHandler = require("../../utils/asyncHandler");

const getDashboard = asyncHandler(async (req, res) => {
  const range = req.query.range || "weekly";
  const excludedStatuses = [
    "label_sent",
    "shipped",
    "received",
    "inspected",
    "paid",
  ];

  const [
    totalUsers,
    totalOrders,
    payoutAgg,
    pendingPaymentCount,
    recentOrders,
    ordersByStatus,
    dailyPayout,
    // topProducts,
  ] = await Promise.all([
    User.countDocuments({ role: "user" }),
    Order.countDocuments(),

    // Total paid out (admin already paid)
    Order.aggregate([
      {
        $match: {
          status: { $nin: excludedStatuses },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$totalCalculatedPrice" },
        },
      },
    ]),

    // Pending payments (inspected but not yet paid)
    Order.countDocuments({
      status: "inspected",
      paymentStatus: { $ne: "sent" },
    }),

    Order.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("userId", "name email")
      .populate("items.productId", "name carrier"),

    Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),

    getPayoutAnalytics(range),

    // Top products by payout
    // Order.aggregate([
    //   { $match: { status: "paid" } },
    //   { $unwind: "$items" },
    //   {
    //     $group: {
    //       _id: "$items.productId",
    //       totalPayout: { $sum: "$items.calculatedPrice" },
    //       totalOrders: { $sum: 1 },
    //     },
    //   },
    //   { $sort: { totalPayout: -1 } },
    //   { $limit: 5 },
    //   {
    //     $lookup: {
    //       from: "products",
    //       localField: "_id",
    //       foreignField: "_id",
    //       as: "product",
    //     },
    //   },
    //   { $unwind: "$product" },
    //   {
    //     $project: {
    //       productName: "$product.name",
    //       totalPayout: { $round: ["$totalPayout", 2] },
    //       totalOrders: 1,
    //     },
    //   },
    // ]),
  ]);

  const labelNotSent = payoutAgg[0]?.total || 0;

  ApiResponse.success(
    res,
    {
      stats: {
        totalUsers,
        totalOrders,
        labelNotSent: parseFloat(labelNotSent.toFixed(2)),
        pendingPayments: pendingPaymentCount,
      },
      ordersByStatus: ordersByStatus.reduce(
        (acc, s) => ({ ...acc, [s._id]: s.count }),
        {},
      ),
      recentOrders,
      dailyPayout,
      // topProducts,
    },
    "Dashboard data fetched",
  );
});

module.exports = { getDashboard };
