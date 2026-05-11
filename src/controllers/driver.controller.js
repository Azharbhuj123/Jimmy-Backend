const Driver = require("../models/Driver");
const Pickup = require("../models/Pickup");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { sendPasswordResetEmail } = require("../services/email.service");

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET);

// Driver Login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const driver = await Driver.findOne({ email }).select("+password");

  if (!driver || !(await driver.comparePassword(password))) {
    throw new ApiError(401, "Invalid email or password");
  }

  if (!driver.isActive) {
    throw new ApiError(403, "Account is deactivated");
  }

  const token = generateToken(driver._id);
  ApiResponse.success(res, { driver, token }, "Login successful");
});

// Helper to check if a time slot is in the future
const isFutureTimeSlot = (dateStr, timeSlot) => {
  if (!dateStr) return false;
  
  // Parse the YYYY-MM-DD string into a local date
  // Ensure we only take the date part if it's an ISO string
  const onlyDate = dateStr.toString().split("T")[0];
  const [y, m, d] = onlyDate.split("-").map(Number);
  const scheduledDate = new Date(y, m - 1, d); // local time
  const now = new Date();
  
  // Set times to midnight for date comparison
  const sDate = new Date(scheduledDate).setHours(0, 0, 0, 0);
  const nDate = new Date(now).setHours(0, 0, 0, 0);
  
  if (sDate > nDate) return true;
  if (sDate < nDate) return false;
  
  // If it's today, check the time slot
  if (sDate === nDate && timeSlot) {
    try {
      // Extract the start time (e.g., "11:00 PM" from "11:00 PM - 1:00 PM")
      const startTimeStr = timeSlot.split('-')[0].trim();
      const [time, modifier] = startTimeStr.split(' ');
      let [hours, minutes] = time.split(':').map(Number);
      
      if (modifier === 'PM' && hours < 12) hours += 12;
      if (modifier === 'AM' && hours === 12) hours = 0;
      
      const slotStartTime = new Date(now);
      slotStartTime.setHours(hours, minutes || 0, 0, 0);
      console.log(slotStartTime,now,"slotStartTime");
      
      // Add a small buffer (e.g., 30 mins) if needed, but for now strict
      return now < slotStartTime;
    } catch (e) {
      return false; // If we can't parse it, don't block today's ride
    }
  }


  
  return false;
};

// Get currently assigned pickups
const getAssignedPickup = asyncHandler(async (req, res) => {
  const pickups = await Pickup.find({
    driverId: req.driver._id,
    status: { $in: ["assigned", "en_route", "arrived", "picked_up"] },
  })
    .populate("orderId")
    .populate("customerId", "name phone email");

  ApiResponse.success(
    res, 
    { pickups }, 
    pickups.length > 0 ? "Assigned pickups retrieved" : "No active pickups assigned"
  );
});

// Update pickup status
const updateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const { id } = req.params;

  const pickup = await Pickup.findOne({ _id: id, driverId: req.driver._id });
  if (!pickup)
    throw new ApiError(404, "Pickup not found or not assigned to you");

  // Block starting a ride if it's scheduled for a future date/time
  if (status === "en_route" && (pickup.pickupDetails?.pickupDate || pickup.pickupDetails?.time)) {
    if (isFutureTimeSlot(pickup.pickupDetails.pickupDate, pickup.pickupDetails.time)) {
      throw new ApiError(400, "This ride is scheduled for a future time. You cannot start it yet.");
    }
  }

  pickup.status = status;
  await pickup.save();

  // Emit socket event for real-time tracking
  if (req.app.io) {
    req.app.io.emit("pickup:updated", pickup);
  }

  ApiResponse.success(res, { pickup }, `Status updated to ${status}`);
});

// Forgot Password for Driver
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const driver = await Driver.findOne({ email });
  if (!driver) {
    // Return success anyway to avoid email enumeration
    return ApiResponse.success(
      res,
      {},
      "If that email exists, a reset code has been sent.",
    );
  }

  const resetCode = Math.floor(10000 + Math.random() * 90000).toString();
  const hashedCode = crypto
    .createHash("sha256")
    .update(resetCode)
    .digest("hex");

  // Reuse resetPassword fields (need to ensure they are in the model)
  driver.resetPasswordCode = hashedCode;
  driver.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
  await driver.save({ validateBeforeSave: false });

  await sendPasswordResetEmail(driver, resetCode);
  ApiResponse.success(
    res,
    {},
    "If that email exists, a reset code has been sent.",
  );
});

// Reset Password for Driver
const resetPassword = asyncHandler(async (req, res) => {
  const { code, password } = req.body;
  const hashedCode = crypto.createHash("sha256").update(code).digest("hex");

  const driver = await Driver.findOne({
    resetPasswordCode: hashedCode,
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!driver) throw new ApiError(400, "Reset code is invalid or has expired.");

  driver.password = password;
  driver.resetPasswordCode = undefined;
  driver.resetPasswordExpires = undefined;
  await driver.save();

  const token = generateToken(driver._id);
  ApiResponse.success(res, { driver, token }, "Password reset successful");
});

module.exports = {
  login,
  getAssignedPickup,
  updateStatus,
  forgotPassword,
  resetPassword,
};
