const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../../controllers/admin/category.controller');
const validate = require('../../middlewares/validate.middleware');

const rules = [
  body('name').trim().notEmpty().withMessage('Category name is required'),
];

router.post('/', rules, validate, ctrl.createCategory);
router.get('/', ctrl.getCategories);
router.put('/:id', ctrl.updateCategory);
router.delete('/:id', ctrl.deleteCategory);

module.exports = router;
