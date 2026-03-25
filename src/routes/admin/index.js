const router = require('express').Router();
const { verifyToken, isAdmin } = require('../../middlewares/auth.middleware');

// Apply admin middleware to ALL admin routes
router.use(verifyToken, isAdmin);

router.use('/dashboard', require('./dashboard.routes'));
router.use('/categories', require('./category.routes'));
router.use('/brands', require('./brand.routes'));
router.use('/products', require('./product.routes'));
router.use('/orders', require('./order.routes'));
router.use('/users', require('./user.routes'));
router.use('/contacts', require('./contact.routes'));
router.use('/faqs', require('./faq.routes'));
router.use('/blogs', require('./blog.routes'));

module.exports = router;
