const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../../controllers/admin/pickup.controller');
const validate = require('../../middlewares/validate.middleware');

// ── Metrics & Map Data ─────────────────────────────────────────────────────────
router.get('/metrics', ctrl.getMetrics);
router.get('/map-data', ctrl.getMapData);

// ── Pickups ───────────────────────────────────────────────────────────────────
router.post(
  '/',
  [
    body('orderId').isMongoId().withMessage('Valid orderId is required'),
    body('quotedPayout').isNumeric().withMessage('quotedPayout is required'),
    body('expectedResale').isNumeric().withMessage('expectedResale is required'),
    body('pickupAddress').notEmpty().withMessage('pickupAddress is required'),
    body('pickupFlags').optional().isArray(),
    body('pickupFlags.*').isIn(['meet_at_police_station', 'customer_negotiating', 'high_risk', 'repeat_seller']).withMessage('Invalid pickup flag'),
  ],
  validate,
  ctrl.createPickup
);

router.get('/', ctrl.getAllPickups);

router.put(
  '/:id/status',
  [body('status').notEmpty().withMessage('Status is required')],
  validate,
  ctrl.updatePickupStatus
);

router.put(
  '/:id/assign-driver',
  [
    body('driverId').isMongoId().withMessage('Valid driverId is required'),
    body('date').optional().isISO8601().withMessage('date must be a valid date'),
    body('timeSlot').optional().isString(),
    body('notes').optional().isString(),
  ],
  validate,
  ctrl.assignDriver
);

router.post('/:id/auto-assign', ctrl.autoAssignDriver)

module.exports = router;