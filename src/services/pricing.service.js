const Product = require("../models/Product");
const ApiError = require("../utils/ApiError");

/**
 * Calculate the final price for a single product given selected options.
 *
 * Pricing rules:
 *  - Start with product.basePrice
 *  - For each step, the user selects one option
 *  - Option modifierType 'fixed'      → add priceModifier to running total
 *  - Option modifierType 'percentage' → multiply running total by (1 + priceModifier/100)
 *
 * @param {string} productId
 * @param {Array}  selectedOptionsArr  [{ stepKey, optionValue }]
 * @returns {{ basePrice, calculatedPrice, priceBreakdown, selectedOptions, productName }}
 */
const calculatePrice = async (
  productId,
  selectedOptionsArr = [],
  isLocalPickup = false,
) => {
  const product = await Product.findById(productId);
  if (!product) throw new ApiError(404, "Product not found");
  if (!product.isActive) throw new ApiError(400, "Product is not available");

  let runningPrice = 0;
  const priceBreakdown = [];
  const selectedOptions = [];
  const errors = [];

  for (const step of product.steps) {
    // Filter all selections for this step
    const userSelections = selectedOptionsArr.filter(
      (s) => s.stepKey === step.key,
    );

    if (userSelections.length === 0) {
      if (step.isRequired) {
        errors.push(`Step "${step.title}" is required.`);
      }
      continue;
    }

    // Get all chosen options for this step
    const chosenOptions = [];
    for (const selection of userSelections) {
      // We check both value and label just in case
      const opt = step.options.find(
        (o) =>
          o.value === selection.optionValue ||
          o.label === selection.optionValue,
      );
      if (opt) {
        chosenOptions.push(opt);
      }
    }

    if (chosenOptions.length === 0) {
      errors.push(`Invalid options for step "${step.title}".`);
      continue;
    }

    // Lowest Price Logic: Pick the option with the minimum modifier
    let pickedOption = chosenOptions[0];
    let minModifier = isLocalPickup
      ? pickedOption.pickupPriceModifier
      : pickedOption.shipPriceModifier;

    for (let i = 1; i < chosenOptions.length; i++) {
      const currentModifier = isLocalPickup
        ? chosenOptions[i].pickupPriceModifier
        : chosenOptions[i].shipPriceModifier;
      if (currentModifier < minModifier) {
        minModifier = currentModifier;
        pickedOption = chosenOptions[i];
      }
    }

    let adjustment = 0;
    if (pickedOption.modifierType === "percentage") {
      adjustment = (runningPrice * minModifier) / 100;
    } else {
      adjustment = minModifier;
    }

    runningPrice += adjustment;
    runningPrice = Math.max(0, runningPrice); // price can never go negative

    priceBreakdown.push({
      label: `${step.title}: ${pickedOption.label}${chosenOptions.length > 1 ? " (Lowest among selected)" : ""}`,
      condition: `${pickedOption.label}`,
      modifierType: pickedOption.modifierType,
      modifier: minModifier,
      adjustment: parseFloat(adjustment.toFixed(2)),
      runningTotal: parseFloat(runningPrice.toFixed(2)),
    });

    selectedOptions.push({
      stepKey: step.key,
      stepTitle: step.title,
      optionLabels: chosenOptions.map((o) => o.label),
      pickedOptionLabel: pickedOption.label,
      priceModifier: minModifier,
      modifierType: pickedOption.modifierType,
    });
  }

  if (errors.length > 0) {
    throw new ApiError(
      400,
      "Invalid configuration",
      errors.map((e) => ({ message: e })),
    );
  }

  return {
    basePrice: 0,
    calculatedPrice: parseFloat(runningPrice.toFixed(2)),
    priceBreakdown,
    selectedOptions,
    productName: product.name,
    productImage: product.images,
    productId: product._id,
  };
};

/**
 * Calculate prices for multiple products at once.
 *
 * @param {Array} items  [{ productId, selectedOptions }]
 * @returns {{ items, totalBasePrice, totalCalculatedPrice }}
 */
const calculateMultiPrice = async (
  items = [],
  fulfillmentType = "shipping",
) => {
  if (!items.length) throw new ApiError(400, "At least one item is required");

  const isLocalPickup = fulfillmentType === "pickup";

  const results = await Promise.all(
    items.map(({ productId, selectedOptions }) =>
      calculatePrice(productId, selectedOptions, isLocalPickup),
    ),
  );

  const totalBasePrice = results.reduce((sum, r) => sum + r.basePrice, 0);
  const totalCalculatedPrice = results.reduce(
    (sum, r) => sum + r.calculatedPrice,
    0,
  );

  return {
    items: results,
    totalBasePrice: parseFloat(totalBasePrice.toFixed(2)),
    totalCalculatedPrice: parseFloat(totalCalculatedPrice.toFixed(2)),
  };
};

/**
 * Get revenue analytics per product (payout = what admin pays users)
 */
const getProductAnalytics = async (productId, days = 30) => {
  const Order = require("../models/Order");
  const since = new Date();
  since.setDate(since.getDate() - days);

  const analytics = await Order.aggregate([
    {
      $match: {
        "items.productId": new (require("mongoose").Types.ObjectId)(productId),
        status: "paid",
        createdAt: { $gte: since },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        dailyPayout: { $sum: "$totalCalculatedPrice" },
        dailyOrders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const totalPayout = analytics.reduce((sum, d) => sum + d.dailyPayout, 0);
  const totalOrders = analytics.reduce((sum, d) => sum + d.dailyOrders, 0);

  return {
    analytics,
    totalPayout: parseFloat(totalPayout.toFixed(2)),
    totalOrders,
    days,
  };
};

/**
 * Get payout analytics across all products with range support
 */
const getPayoutAnalytics = async (range = "weekly") => {
  const Order = require("../models/Order");
  const since = new Date();
  let format = "%Y-%m-%d";
  let days = 7;

  if (range === "monthly") {
    days = 30;
  } else if (range === "yearly") {
    days = 365;
    format = "%Y-%m"; // Group by month
  } else if (range === "daily") {
    days = 1;
  }

  since.setDate(since.getDate() - days);

  const analytics = await Order.aggregate([
    {
      $match: {
        status: "paid",
        createdAt: { $gte: since },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: format, date: "$createdAt" } },
        payout: { $sum: "$totalCalculatedPrice" },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return analytics;
};

module.exports = {
  calculatePrice,
  calculateMultiPrice,
  getProductAnalytics,
  getPayoutAnalytics,
};