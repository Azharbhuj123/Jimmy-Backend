const router = require('express').Router();
const ctrl = require('../../controllers/admin/dashboard.controller');

router.get('/', ctrl.getDashboard);

module.exports = router;
