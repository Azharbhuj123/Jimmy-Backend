const Intake = require("../models/Intake");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { uploadToS3 } = require("../services/upload.service");
const { fetchMarketValuation, publishListingToMarketplace } = require("../services/marketplace.stub.service");
const { sendRepricingEmail } = require("../services/email.service");

/**
 * Helper to safely parse incoming form fields whether sent as JSON string,
 * nested object, or fallback flat fields.
 */
const parseField = (val, fallback) => {
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch (e) {
      return val;
    }
  }
  return val !== undefined ? val : fallback;
};

// POST /api/intake/create
const createIntake = asyncHandler(async (req, res) => {
  let imei_screenshot_url = req.body.imei_screenshot_url || "";

  // Handle multi-part form upload for IMEI screenshot
  if (req.file) {
    imei_screenshot_url = await uploadToS3(req.file.buffer, req.file.originalname, "intake");
  }

  // Parse Device Info
  const device_info = parseField(req.body.device_info, {
    name: req.body.name || "iPhone 15 Pro",
    capacity: req.body.capacity || "256GB",
    carrier_status: req.body.carrier_status || "Unlocked",
    imei: req.body.imei || "",
  });

  // Parse Battery Info
  const battery_info = parseField(req.body.battery_info, {
    health_percentage: Number(req.body.health_percentage) || 100,
    cycle_count: Number(req.body.cycle_count) || 0,
  });

  // Parse Physical Condition
  const physical_condition = parseField(req.body.physical_condition, {
    condition: req.body.condition || "Excellent",
    cosmetic_notes: req.body.cosmetic_notes || "",
  });

  // Parse Functional Testing
  const functional_testing = parseField(req.body.functional_testing, {
    face_id: req.body.face_id !== undefined ? req.body.face_id === "true" || req.body.face_id === true : true,
    cameras: req.body.cameras !== undefined ? req.body.cameras === "true" || req.body.cameras === true : true,
    speakers: req.body.speakers !== undefined ? req.body.speakers === "true" || req.body.speakers === true : true,
    charging: req.body.charging !== undefined ? req.body.charging === "true" || req.body.charging === true : true,
    cellular: req.body.cellular !== undefined ? req.body.cellular === "true" || req.body.cellular === true : true,
    wifi: req.body.wifi !== undefined ? req.body.wifi === "true" || req.body.wifi === true : true,
    buttons: req.body.buttons !== undefined ? req.body.buttons === "true" || req.body.buttons === true : true,
  });

  // Parse Acquisition Info
  const acquisition_info = parseField(req.body.acquisition_info, {
    purchase_price: Number(req.body.purchase_price) || 500,
    payment_method: req.body.payment_method || "Cash",
  });

  // Parse Tracking
  const tracking = parseField(req.body.tracking, {
    employee: req.body.employee || req.user?.name || "Warehouse Employee",
    lead_source: req.body.lead_source || "Walk-in",
    listed_where: req.body.listed_where || "Unlisted",
    acquisition_location: req.body.acquisition_location || "Storefront",
    freeform_notes: req.body.freeform_notes || "",
  });

  const order_status = req.body.order_status || "Unassigned";

  // Create Intake Record
  const intake = await Intake.create({
    device_info,
    imei_screenshot_url,
    battery_info,
    physical_condition,
    functional_testing,
    acquisition_info,
    tracking,
    order_status,
  });

  // Fetch market valuation stub
  const valuation = await fetchMarketValuation(intake);

  ApiResponse.success(res, { intake, valuation }, "Device intake completed successfully", 201);
});

// GET /api/intake/lookup/:identifier
const lookupIntake = asyncHandler(async (req, res) => {
  const { identifier } = req.params;

  if (!identifier) {
    throw new ApiError(400, "Identifier (Tracking ID or IMEI) is required");
  }

  // Query database using unique barcode/internal_id or IMEI
  const intake = await Intake.findOne({
    $or: [{ internal_id: identifier }, { "device_info.imei": identifier }],
  });

  if (!intake) {
    throw new ApiError(404, `No device intake found matching identifier: ${identifier}`);
  }

  const valuation = await fetchMarketValuation(intake);

  ApiResponse.success(
    res,
    {
      intake,
      valuation,
      imei_screenshot_url: intake.imei_screenshot_url,
    },
    "Device lookup successful",
    200
  );
});

// PATCH /api/intake/assign-driver
const assignDriver = asyncHandler(async (req, res) => {
  const { internal_id, employee, order_status } = req.body;

  if (!internal_id) {
    throw new ApiError(400, "internal_id is required to assign driver");
  }

  const intake = await Intake.findOne({ internal_id });

  if (!intake) {
    throw new ApiError(404, `Intake record not found for ID: ${internal_id}`);
  }

  if (employee) intake.tracking.employee = employee;
  if (order_status) intake.order_status = order_status;

  await intake.save();

  ApiResponse.success(res, { intake }, "Driver assigned successfully", 200);
});

// GET /api/inventory/aging
const getAgingInventory = asyncHandler(async (req, res) => {
  // Pull items sitting in stock (not completed)
  const items = await Intake.find({
    order_status: { $nin: ["Completed", "Payment Sent", "Failed Pickup", "No Show"] },
  }).sort({ createdAt: 1 });

  const now = Date.now();
  const ONE_DAY = 1000 * 60 * 60 * 24;

  const enrichedItems = items.map((item) => {
    const itemObj = item.toObject();
    const daysInStock = Math.floor((now - new Date(itemObj.createdAt).getTime()) / ONE_DAY);
    
    // Check if sitting in stock for over 20 days
    const isAging = daysInStock >= 20;

    return {
      ...itemObj,
      days_in_stock: daysInStock,
      is_aging: isAging,
      prompt: isAging ? "Would you like to lower the price?" : null,
      suggested_action: isAging ? "Apply 15% discount or list on Swappa/eBay" : "Monitor inventory",
      suggested_discount_price: isAging ? Number((itemObj.acquisition_info.purchase_price * 0.85).toFixed(2)) : null,
    };
  });

  // Filter for aging items specifically, but also return full inventory breakdown
  const agingInventory = enrichedItems.filter((i) => i.is_aging);

  ApiResponse.success(
    res,
    {
      total_in_stock: enrichedItems.length,
      total_aging: agingInventory.length,
      aging_items: agingInventory,
      all_active_items: enrichedItems,
    },
    "Aging inventory analytics retrieved successfully",
    200
  );
});

// PATCH /api/intake/lower-price
// Applies 15% discount to acquisition_info.purchase_price, emails client if email on file,
// and returns a ready-to-send client message for the admin to share manually.
const lowerPrice = asyncHandler(async (req, res) => {
  const { internal_id } = req.body;

  if (!internal_id) {
    throw new ApiError(400, "internal_id is required");
  }

  const intake = await Intake.findOne({ internal_id });
  if (!intake) {
    throw new ApiError(404, `Intake record not found for ID: ${internal_id}`);
  }

  const originalPrice = intake.acquisition_info.purchase_price;
  const discountedPrice = parseFloat((originalPrice * 0.85).toFixed(2));

  // Save the new price and flag status
  intake.acquisition_info.purchase_price = discountedPrice;
  intake.order_status = "Counteroffer Needed";
  await intake.save();

  // Send email to client if email is on file (non-blocking)
  const emailSent = !!intake.client_email;
  if (emailSent) {
    await sendRepricingEmail(intake, discountedPrice);
  }

  // Build a ready-to-share message the admin can copy/send manually
  const deviceLabel = `${intake.device_info.name} ${intake.device_info.capacity}`;
  const clientMessage = [].join("\n");

  ApiResponse.success(
    res,
    {
      internal_id,
      original_price: originalPrice,
      new_price: discountedPrice,
      email_sent: emailSent,
      client_message: clientMessage,
    },
    `Price lowered to $${discountedPrice} (15% discount applied)`,
    200,
  );
});

// POST /api/intake/publish-marketplace (Bonus integration endpoint)
const publishMarketplace = asyncHandler(async (req, res) => {
  const { internal_id, marketplace } = req.body;

  if (!internal_id || !marketplace) {
    throw new ApiError(400, "internal_id and marketplace ('eBay' or 'Swappa') are required");
  }

  const intake = await Intake.findOne({ internal_id });
  if (!intake) {
    throw new ApiError(404, `Intake record not found for ID: ${internal_id}`);
  }

  const result = await publishListingToMarketplace(intake, marketplace);
  intake.tracking.listed_where = marketplace;
  await intake.save();

  ApiResponse.success(res, { result, intake }, `Successfully published to ${marketplace}`, 200);
});

// GET /api/intake/all
const getAllIntakes = asyncHandler(async (req, res) => {
  const intakes = await Intake.find({}).sort({ createdAt: -1 });
  ApiResponse.success(res, { intakes }, "All intakes retrieved", 200);
});

module.exports = {
  createIntake,
  lookupIntake,
  assignDriver,
  lowerPrice,
  getAgingInventory,
  publishMarketplace,
  getAllIntakes,
};
