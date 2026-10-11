const Workflow = require("../models/Workflow.model");
const Request = require("../models/Request.model");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { ROLES } = require("../constants/roles");

// Admins manage every workflow; everyone else only sees ones they can submit to
const visibleWorkflowsFilter = (user) =>
    user.role === ROLES.ADMIN ? {} : { isActive: true };


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
// GET ALL VISIBLE WORKFLOWS
// ==========================
exports.getWorkflows = asyncHandler(async (req, res) => {
    const workflows = await Workflow.find(visibleWorkflowsFilter(req.user));

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
        ...visibleWorkflowsFilter(req.user)
    });

    if (!workflow) {
        throw new AppError("Workflow not found", 404);
    }

    res.status(200).json({
        success: true,
        workflow
    });
});


// ==========================
// ACTIVATE / DEACTIVATE WORKFLOW (ADMIN)
// ==========================
exports.updateWorkflowStatus = asyncHandler(async (req, res) => {
    const workflow = await Workflow.findByIdAndUpdate(
        req.params.id,
        { isActive: req.body.isActive },
        { returnDocument: "after" }
    );

    if (!workflow) {
        throw new AppError("Workflow not found", 404);
    }

    res.status(200).json({
        success: true,
        message: workflow.isActive ? "Workflow activated" : "Workflow deactivated",
        workflow
    });
});


// ==========================
// EDIT WORKFLOW (ADMIN)
// ==========================
// Uses save() so the same schema validation as create applies.
// createdBy and isActive are not editable here.
exports.updateWorkflow = asyncHandler(async (req, res) => {
    const workflow = await Workflow.findById(req.params.id);

    if (!workflow) {
        throw new AppError("Workflow not found", 404);
    }

    const { name, description, steps } = req.body;

    workflow.set({ name, description, steps });
    await workflow.save();

    res.status(200).json({
        success: true,
        message: "Workflow updated. Requests already submitted keep their original steps.",
        workflow
    });
});


// ==========================
// DELETE WORKFLOW (ADMIN)
// ==========================
exports.deleteWorkflow = asyncHandler(async (req, res) => {
    const workflow = await Workflow.findById(req.params.id);

    if (!workflow) {
        throw new AppError("Workflow not found", 404);
    }

    // Completed requests count too: their history still points at this workflow
    const requestCount = await Request.countDocuments({ workflow: workflow._id });

    if (requestCount > 0) {
        throw new AppError(
            `This workflow is used by ${requestCount} request(s), so it cannot be deleted. Deactivate it instead to stop new submissions.`,
            409
        );
    }

    await workflow.deleteOne();

    res.status(200).json({
        success: true,
        message: "Workflow deleted"
    });
});
