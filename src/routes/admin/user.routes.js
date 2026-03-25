const router = require('express').Router();
const ctrl = require('../../controllers/admin/user.controller');

router.get('/', ctrl.getUsers);
router.get('/:id', ctrl.getUser);
router.delete('/:id', ctrl.deleteUser);
router.patch('/:id/toggle-status', ctrl.toggleUserStatus);

module.exports = router;
