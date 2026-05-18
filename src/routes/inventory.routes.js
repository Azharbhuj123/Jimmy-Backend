const router = require("express").Router();
const intakeCtrl = require("../controllers/intake.controller");
const { optionalToken } = require("../middlewares/auth.middleware");

// GET /api/inventory/aging - Inventory analytics query pulling items > 20 days old
router.get("/aging", optionalToken, intakeCtrl.getAgingInventory);

module.exports = router;
