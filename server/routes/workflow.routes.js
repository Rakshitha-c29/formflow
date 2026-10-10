const express = require("express");

const router = express.Router();

const {
    createWorkflow,
    getWorkflows,
    getWorkflowById,
    updateWorkflowStatus
} = require("../controllers/workflow.controller");

const protect = require("../middleware/auth.middleware");
const authorize = require("../middleware/authorize.middleware");
const validate = require("../middleware/validate.middleware");
const { updateStatusSchema } = require("../validations/workflow.validation");
const { ROLES } = require("../constants/roles");


// Create workflow (admin only)
router.post("/", protect, authorize(ROLES.ADMIN), createWorkflow);

// Get workflows (admin: all, others: active only)
router.get("/", protect, getWorkflows);

// Get one workflow
router.get("/:id", protect, getWorkflowById);

// Activate / deactivate (admin only). In-flight requests keep their own steps snapshot.
router.patch(
    "/:id/status",
    protect,
    authorize(ROLES.ADMIN),
    validate(updateStatusSchema),
    updateWorkflowStatus
);

module.exports = router;