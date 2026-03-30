const router = require('express').Router();
const ctrl = require('../controllers/product.controller');

router.get('/', ctrl.getProducts);
router.get('/popular-products', ctrl.getMostPopularProducts);
router.get('/slug/:slug', ctrl.getProductBySlug);
router.get('/:id', ctrl.getProduct);

module.exports = router;
