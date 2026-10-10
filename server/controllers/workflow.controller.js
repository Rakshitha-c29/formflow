const Workflow = require("../models/Workflow.model");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");


// ==========================
// CREATE WORKFLOW
// ==========================
exports.createWorkflow = asyncHandler(async (req, res) => {
    const { name, description, steps } = req.body;

    const workflow = await Workflow.create({
        name,
        description,
        steps,
        createdBy: req.user.id
    });

    res.status(201).json({
        success: true,
        message: "Workflow created successfully",
        workflow
    });
});


// ==========================
// GET ALL MY WORKFLOWS
// ==========================
exports.getWorkflows = asyncHandler(async (req, res) => {
    const workflows = await Workflow.find({
        createdBy: req.user.id
    });

    res.status(200).json({
        success: true,
        count: workflows.length,
        workflows
    });
});


// ==========================
// GET ONE WORKFLOW
// ==========================
exports.getWorkflowById = asyncHandler(async (req, res) => {
    const workflow = await Workflow.findOne({
        _id: req.params.id,
        createdBy: req.user.id
    });

    if (!workflow) {
        throw new AppError("Workflow not found", 404);
    }

    res.status(200).json({
        success: true,
        workflow
    });
});
