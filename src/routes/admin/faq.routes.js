const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../../controllers/admin/faq.controller');
const validate = require('../../middlewares/validate.middleware');

const rules = [
  body('question').trim().notEmpty().withMessage('Question is required'),
  body('answer').trim().notEmpty().withMessage('Answer is required'),
];

router.post('/', rules, validate, ctrl.createFAQ);
router.get('/', ctrl.getFAQs);
router.put('/:id', ctrl.updateFAQ);
router.delete('/:id', ctrl.deleteFAQ);

module.exports = router;
