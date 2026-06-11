const router = require("express").Router();
const intakeCtrl = require("../controllers/intake.controller");
const upload = require("../middlewares/upload.middleware");
const { optionalToken } = require("../middlewares/auth.middleware");

// POST /api/intake/create - Handles text fields, functional checklist array, and multi-part form upload for IMEI screenshot
router.post("/create", optionalToken, upload.single("file"), intakeCtrl.createIntake);

// GET /api/intake/lookup/:identifier - Queries database using unique barcode/internal_id or IMEI
router.get("/lookup/:identifier", optionalToken, intakeCtrl.lookupIntake);

// PATCH /api/intake/assign-driver - Assigns employee/driver to unassigned device pickup order
router.patch("/assign-driver", optionalToken, intakeCtrl.assignDriver);

// PATCH /api/intake/lower-price - Applies 15% discount & sets status to Counteroffer Needed
router.patch("/lower-price", optionalToken, intakeCtrl.lowerPrice);

// POST /api/intake/publish-marketplace - Bonus integration endpoint
router.post("/publish-marketplace", optionalToken, intakeCtrl.publishMarketplace);

// GET /api/intake/all - Get all intakes for admin/dashboard view
router.get("/all", optionalToken, intakeCtrl.getAllIntakes);

module.exports = router;
