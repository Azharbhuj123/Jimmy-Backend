const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../../controllers/admin/pickup.controller');
const validate = require('../../middlewares/validate.middleware');

// ── Pickup orders ─────────────────────────────────────────────────────────────
router.get('/', ctrl.getPickups);

router.put(
  '/:id/assign-driver',
  [body('driverId').isMongoId().withMessage('Valid driverId is required')],
  validate,
  ctrl.assignDriver
);

router.put(
  '/:id/status',
  [body('status').notEmpty().withMessage('Status is required')],
  validate,
  ctrl.updatePickupStatus
);

// ── Driver management ─────────────────────────────────────────────────────────
router.post(
  '/drivers',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('phone').trim().notEmpty().withMessage('Phone is required'),
  ],
  validate,
  ctrl.createDriver
);

router.get('/drivers', ctrl.getDrivers);
router.put('/drivers/:id', ctrl.updateDriver);
router.delete('/drivers/:id', ctrl.deleteDriver);

module.exports = router;