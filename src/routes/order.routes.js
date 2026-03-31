const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/order.controller');
const { verifyToken, optionalToken } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');


router.post('/',optionalToken, validate, ctrl.createOrder);
router.post('/calculate-price', verifyToken, ctrl.calculateOrderPrice);
router.get('/', verifyToken, ctrl.getMyOrders);
router.get('/:id', verifyToken, ctrl.getMyOrder);

module.exports = router;
