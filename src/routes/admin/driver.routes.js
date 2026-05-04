const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../../controllers/admin/driver.controller');
const validate = require('../../middlewares/validate.middleware');

router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('phone').trim().notEmpty().withMessage('Phone is required'),
    body('email').trim().isEmail().withMessage('A valid email is required'),
  ],
  validate,
  ctrl.createDriver
);

router.get('/', ctrl.getDrivers);
router.get('/workload', ctrl.getDriverWorkload);
router.put('/:id', ctrl.updateDriver);
router.delete('/:id', ctrl.deleteDriver);

module.exports = router;
