const Pickup = require("../models/Pickup");
const { v4: uuidv4 } = require("uuid");

const createPickupFromOrder = async (order, userDetails) => {
  const pickup = await Pickup.create({
    pickupId: `PU-${uuidv4().substring(0, 8).toUpperCase()}`,
    orderId: order._id,
    guest_email: order.guest_email,
    customerId: order.userId,
    pickupDetails: order.pickupDetails,
    totalCalculatedPrice: order.totalCalculatedPrice,
    quotedPayout: 0,
    expectedResale: 0,
    pickupAddress: order.shippingDetails?.address || "",
    pickupLocation: { type: "Point", coordinates: [0, 0] },
    pickupNotes: "Auto created from order",
    urgency: "asap",
    userDetails,
  });

  return pickup;
};

module.exports = {
  createPickupFromOrder,
};
