const router = require('express').Router();

router.use('/auth', require('./auth.routes'));
router.use('/admin', require('./admin/index'));
router.use('/orders', require('./order.routes'));
router.use('/products', require('./product.routes'));
router.use('/driver', require('./driver.routes'));
router.use('/intake', require('./intake.routes'));
router.use('/inventory', require('./inventory.routes'));
router.use('/', require('./public.routes'));

module.exports = router;
