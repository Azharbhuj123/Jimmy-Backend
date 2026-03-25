const router = require('express').Router();
const ctrl = require('../../controllers/admin/contact.controller');

router.get('/', ctrl.getContacts);
router.patch('/:id/read', ctrl.markAsRead);
router.delete('/:id', ctrl.deleteContact);

module.exports = router;
