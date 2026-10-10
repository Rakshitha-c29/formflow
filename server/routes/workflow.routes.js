const express = require("express");

const router = express.Router();

const {
    createWorkflow,
    getWorkflows,
    getWorkflowById
} = require("../controllers/workflow.controller");

const protect = require("../middleware/auth.middleware");
const authorize = require("../middleware/authorize.middleware");
const { ROLES } = require("../constants/roles");


// Create workflow (admin only)
router.post("/", protect, authorize(ROLES.ADMIN), createWorkflow);

// Get workflows (admin: all, others: active only)
router.get("/", protect, getWorkflows);

// Get one workflow
router.get("/:id", protect, getWorkflowById);

module.exports = router;