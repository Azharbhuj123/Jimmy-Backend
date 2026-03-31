const router = require('express').Router();
const { body } = require('express-validator');
const publicCtrl = require('../controllers/public.controller');
const contactCtrl = require('../controllers/contact.controller');
const validate = require('../middlewares/validate.middleware');
const upload = require('../middlewares/upload.middleware');
const ctrl = require('../controllers/order.controller');

const contactRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('message').trim().notEmpty().withMessage('Message is required'),
];

router.get('/faqs', publicCtrl.getFAQs);
router.get('/blogs', publicCtrl.getBlogs);
router.get('/blogs/:slug', publicCtrl.getBlog);
router.get('/categories', publicCtrl.getCategories);
router.get('/brands', publicCtrl.getBrands);
router.post('/contact', contactRules, validate, contactCtrl.submitContact);
router.post('/upload', upload.single('file'),  publicCtrl.uploadFile);
router.post('/calculate-price',   publicCtrl.calculateOrderPrice);


module.exports = router;
