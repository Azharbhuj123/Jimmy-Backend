const User = require("../../models/User");
const Order = require("../../models/Order");
const Product = require("../../models/Product");
const { getPayoutAnalytics } = require("../../services/pricing.service");
const ApiResponse = require("../../utils/ApiResponse");
const asyncHandler = require("../../utils/asyncHandler");

const getDashboard = asyncHandler(async (req, res) => {
  const range = req.query.range || "weekly";

  // Today's date range (midnight to midnight)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  // Current month date range
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthEnd = new Date();
  monthEnd.setHours(23, 59, 59, 999);

  const [
    scheduledPickupToday,
    enRoute,
    delivered,
    needInspection,
    awaitingPayment,
    ordersPaid,
    salesAgg,
    recentOrders,
    ordersByStatus,
    dailyPayout,
  ] = await Promise.all([
    // 1. Orders scheduled for pickup today (pickup orders with label_sent, scheduled today)
    Order.countDocuments({
      fulfillmentType: "pickup",
      status: "label_sent",
      createdAt: { $gte: todayStart, $lte: todayEnd },
    }),

    // 2. Orders En Route (shipped)
    Order.countDocuments({ status: "shipped" }),

    // 3. Orders Delivered (received by warehouse)
    Order.countDocuments({ status: "received" }),

    // 4. Orders Need Inspection (received but not yet inspected)
    Order.countDocuments({ status: "received" }),

    // 5. Orders Awaiting Payment (ready_to_pay or inspected with pending payment)
    Order.countDocuments({
      status: { $in: ["ready_to_pay", "inspected"] },
      paymentStatus: { $ne: "sent" },
    }),

    // 6. Orders Paid
    Order.countDocuments({ status: "paid" }),

    // 7. Sales for the Month (sum of paid orders this calendar month)
    Order.aggregate([
      {
        $match: {
          status: "paid",
          updatedAt: { $gte: monthStart, $lte: monthEnd },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$totalCalculatedPrice" },
        },
      },
    ]),

    Order.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("userId", "name email")
      .populate("items.productId", "name carrier"),

    Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),

    getPayoutAnalytics(range),
  ]);

  const salesForMonth = salesAgg[0]?.total || 0;

  ApiResponse.success(
    res,
    {
      stats: {
        scheduledPickupToday,
        enRoute,
        delivered,
        needInspection,
        awaitingPayment,
        ordersPaid,
        salesForMonth: parseFloat(salesForMonth.toFixed(2)),
      },
      ordersByStatus: ordersByStatus.reduce(
        (acc, s) => ({ ...acc, [s._id]: s.count }),
        {},
      ),
      recentOrders,
      dailyPayout,
    },
    "Dashboard data fetched",
  );
});

module.exports = { getDashboard };
