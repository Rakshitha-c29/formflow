const express = require("express");

const router = express.Router();

const {
    createWorkflow,
    getWorkflows,
    getWorkflowById
} = require("../controllers/workflow.controller");

const protect = require("../middleware/auth.middleware");


// Create workflow
router.post("/", protect, createWorkflow);

// Get all workflows created by logged-in user
router.get("/", protect, getWorkflows);

// Get one workflow
router.get("/:id", protect, getWorkflowById);

module.exports = router;