const Pickup = require("../models/Pickup");
const Driver = require("../models/Driver");
const { v4: uuidv4 } = require("uuid");
const {
  sendDriverAssignmentEmail,
  sendPickupScheduledEmail,
} = require("./email.service");

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

const assignDriverToPickup = async (pickupId, driverId, scheduleData = {}, io = null) => {
  const pickup = await Pickup.findById(pickupId)
    .populate("orderId", "orderNumber totalCalculatedPrice items")
    .populate("customerId", "name email");
  
  if (!pickup) return null;

  const driver = await Driver.findById(driverId);
  if (!driver) return pickup; // Or throw error

  const { date, timeSlot, notes } = scheduleData;

  // Update driver assignment
  pickup.driverId = driverId;
  pickup.status = "assigned";

  // Persist schedule details
  if (!pickup.pickupDetails) pickup.pickupDetails = {};
  if (date) pickup.pickupDetails.pickupDate = new Date(date);
  if (timeSlot) pickup.pickupDetails.time = timeSlot;
  if (notes) pickup.pickupNotes = notes;
  
  pickup.pickupDetails.driverId = driverId;
  pickup.markModified("pickupDetails");
  
  await pickup.save();

  // ── Emit realtime event ────────────────────────────────────────
  if (io) {
    io.emit("pickup:updated", pickup);
  }

  // ── Email driver (non-blocking) ────────────────────────────────
  if (driver.email) {
    sendDriverAssignmentEmail(driver, pickup).catch(() => {});
  }

  // ── Email customer (non-blocking) ─────────────────────────────
  const customerEmail = pickup.userDetails?.email || pickup.guest_email;
  if (customerEmail) {
    sendPickupScheduledEmail(
      {
        orderNumber: pickup.orderId?.orderNumber || pickup.pickupId,
        pickupDetails: {
          date: date || pickup.pickupDetails?.pickupDate,
          timeSlot: timeSlot || pickup.pickupDetails?.time,
          address: pickup.pickupAddress,
          notes: notes || pickup.pickupNotes,
        },
        userDetails: pickup.userDetails,
        guest_email: pickup.guest_email,
      },
      pickup.customerId,
    ).catch(() => {});
  }

  return pickup;
};

module.exports = {
  createPickupFromOrder,
  assignDriverToPickup,
};
