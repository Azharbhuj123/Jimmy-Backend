const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/order.controller');
const { verifyToken } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
 
router.use(verifyToken);

router.post('/', validate, ctrl.createOrder);
router.post('/calculate-price',   ctrl.calculateOrderPrice);
router.get('/', ctrl.getMyOrders);
router.get('/:id', ctrl.getMyOrder);

module.exports = router;
