const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../../controllers/admin/brand.controller');
const validate = require('../../middlewares/validate.middleware');

const rules = [
  body('name').trim().notEmpty().withMessage('Brand name is required'),
];

router.post('/', rules, validate, ctrl.createBrand);
router.get('/', ctrl.getBrands);
router.put('/:id', ctrl.updateBrand);
router.delete('/:id', ctrl.deleteBrand);

module.exports = router;
