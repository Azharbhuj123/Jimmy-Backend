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

module.exports = router;
