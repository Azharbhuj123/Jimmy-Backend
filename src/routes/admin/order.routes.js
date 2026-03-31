const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../../controllers/admin/order.controller');
const validate = require('../../middlewares/validate.middleware');

router.get('/', ctrl.getOrders);
router.get('/:id', ctrl.getOrder);

router.put(
  '/:id/status',
  [body('status').notEmpty().withMessage('Status is required')],
  validate,
  ctrl.updateOrderStatus
);

router.put(
  '/:id/shipping',
  [
    body('labelUrl').notEmpty().withMessage('labelUrl is required'),
    body('trackingNumber').notEmpty().withMessage('trackingNumber is required'),
    body('courier').notEmpty().withMessage('courier is required'),
  ],
  validate,
  ctrl.updateShipping
);

router.put(
  '/:id/pay',
  [body('paymentMethod').notEmpty().withMessage('paymentMethod is required'),
  ],
  validate,
  ctrl.markPaymentSent
);

module.exports = router;