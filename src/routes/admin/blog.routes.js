const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../../controllers/admin/blog.controller');
const validate = require('../../middlewares/validate.middleware');

const rules = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('content').trim().notEmpty().withMessage('Content is required'),
];

router.post('/', rules, validate, ctrl.createBlog);
router.get('/', ctrl.getBlogs);
router.put('/:id', ctrl.updateBlog);
router.delete('/:id', ctrl.deleteBlog);

module.exports = router;
