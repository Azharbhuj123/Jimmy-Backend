const router = require('express').Router();
const ctrl = require('../controllers/driver.controller');
const { verifyDriverToken } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { body } = require('express-validator');

// Public driver routes
router.post('/login', [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
], validate, ctrl.login);

router.post('/forgot-password', [
    body('email').isEmail().withMessage('Valid email is required')
], validate, ctrl.forgotPassword);

router.post('/reset-password', [
    body('code').notEmpty().withMessage('Reset code is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], validate, ctrl.resetPassword);

// Protected driver routes
router.use(verifyDriverToken);

router.get('/assigned-pickup', ctrl.getAssignedPickup);
router.patch('/pickup/:id/status', [
    body('status').isIn(['en_route', 'arrived', 'picked_up', 'delivered']).withMessage('Invalid status')
], validate, ctrl.updateStatus);

module.exports = router;
