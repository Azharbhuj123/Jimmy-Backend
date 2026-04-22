const router = require("express").Router();
const { body } = require("express-validator");
const ctrl = require("../../controllers/admin/product.controller");
const validate = require("../../middlewares/validate.middleware");

const productRules = [
  body("name").trim().notEmpty().withMessage("Product name is required"),
  // body('categoryId').isMongoId().withMessage('Valid categoryId is required'),
  body("brandId").isMongoId().withMessage("Valid brandId is required"),
  body("basePrice")
    .isFloat({ min: 0 })
    .withMessage("basePrice must be a non-negative number"),
];

router.post("/", productRules, validate, ctrl.createProduct);
router.get("/", ctrl.getProducts);
router.get("/:id", ctrl.getProduct);
router.put("/:id", ctrl.updateProduct);
router.delete("/:id", ctrl.deleteProduct);

// Step management
router.post("/:id/steps", ctrl.addStep);
router.put("/:id/steps/:stepId", ctrl.updateStep);
router.delete("/:id/steps/:stepId", ctrl.deleteStep);

// Analytics
router.get("/:id/analytics", ctrl.getAnalytics);

// Advanced Actions
router.post("/:id/duplicate", ctrl.duplicateProduct);
router.patch("/bulk-update", ctrl.bulkUpdateProducts);

module.exports = router;
