const router = require('express').Router();
const ctrl = require('../controllers/product.controller');

router.get('/', ctrl.getProducts);
router.get('/search', ctrl.searchProducts);
router.get('/popular-products', ctrl.getMostPopularProducts);
router.get('/popular-products-name', ctrl.getMostPopularProductsName);
router.get('/popular-categories', ctrl.getMostPopularCategories);
router.get('/slug/:slug', ctrl.getProductBySlug);
router.get('/:id', ctrl.getProduct);

module.exports = router;
