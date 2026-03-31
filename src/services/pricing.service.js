const Product = require('../models/Product');
const ApiError = require('../utils/ApiError');

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
const calculatePrice = async (productId, selectedOptionsArr = []) => {
  const product = await Product.findById(productId);
  if (!product) throw new ApiError(404, 'Product not found');
  if (!product.isActive) throw new ApiError(400, 'Product is not available');

  let runningPrice = product.basePrice;
  const priceBreakdown = [
    { label: 'Base Price', amount: product.basePrice, runningTotal: runningPrice },
  ];
  const selectedOptions = [];
  const errors = [];

  for (const step of product.steps) {
    const userSelection = selectedOptionsArr.find((s) => s.stepKey === step.key);

    if (!userSelection) {
      if (step.isRequired) {
        errors.push(`Step "${step.title}" is required.`);
      }
      continue;
    }

    const chosenOption = step.options.find((o) => o.value === userSelection.optionValue);
    if (!chosenOption) {
      errors.push(`Invalid option "${userSelection.optionValue}" for step "${step.title}".`);
      continue;
    }

    let adjustment = 0;
    if (chosenOption.modifierType === 'percentage') {
      adjustment = (runningPrice * chosenOption.priceModifier) / 100;
    } else {
      adjustment = chosenOption.priceModifier;
    }

    runningPrice += adjustment;
    runningPrice = Math.max(0, runningPrice); // price can never go negative

    priceBreakdown.push({
      label: `${step.title}: ${chosenOption.label}`,
      modifierType: chosenOption.modifierType,
      modifier: chosenOption.priceModifier,
      adjustment: parseFloat(adjustment.toFixed(2)),
      runningTotal: parseFloat(runningPrice.toFixed(2)),
    });

    selectedOptions.push({
      stepKey: step.key,
      stepTitle: step.title,
      optionLabel: chosenOption.label,
      optionValue: chosenOption.value,
      priceModifier: chosenOption.priceModifier,
      modifierType: chosenOption.modifierType,
    });
  }

  if (errors.length > 0) {
    throw new ApiError(400, 'Invalid configuration', errors.map((e) => ({ message: e })));
  }

  return {
    basePrice: product.basePrice,
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
const calculateMultiPrice = async (items = []) => {
  if (!items.length) throw new ApiError(400, 'At least one item is required');

  const results = await Promise.all(
    items.map(({ productId, selectedOptions }) => calculatePrice(productId, selectedOptions))
  );

  const totalBasePrice = results.reduce((sum, r) => sum + r.basePrice, 0);
  const totalCalculatedPrice = results.reduce((sum, r) => sum + r.calculatedPrice, 0);

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
  const Order = require('../models/Order');
  const since = new Date();
  since.setDate(since.getDate() - days);

  const analytics = await Order.aggregate([
    {
      $match: {
        'items.productId': new (require('mongoose').Types.ObjectId)(productId),
        status: 'paid',
        createdAt: { $gte: since },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        dailyPayout: { $sum: '$totalCalculatedPrice' },
        dailyOrders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const totalPayout = analytics.reduce((sum, d) => sum + d.dailyPayout, 0);
  const totalOrders = analytics.reduce((sum, d) => sum + d.dailyOrders, 0);

  return { analytics, totalPayout: parseFloat(totalPayout.toFixed(2)), totalOrders, days };
};

/**
 * Get daily payout analytics across all products
 */
const getDailyPayoutAnalytics = async (days = 30) => {
  const Order = require('../models/Order');
  const since = new Date();
  since.setDate(since.getDate() - days);

  const analytics = await Order.aggregate([
    {
      $match: {
        status: 'paid',
        createdAt: { $gte: since },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        payout: { $sum: '$totalCalculatedPrice' },
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
  getDailyPayoutAnalytics,
};