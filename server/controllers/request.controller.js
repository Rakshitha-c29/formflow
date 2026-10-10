const Request = require("../models/Request.model");
const Workflow = require("../models/Workflow.model");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");


// ==========================
// SUBMIT REQUEST
// ==========================
exports.submitRequest = asyncHandler(async (req, res) => {
    const { workflowId, title, description } = req.body;

    const workflow = await Workflow.findById(workflowId);

    if (!workflow) {
        throw new AppError("Workflow not found", 404);
    }

    if (!workflow.isActive) {
        throw new AppError("Workflow is not active", 400);
    }

    if (!workflow.steps || workflow.steps.length === 0) {
        throw new AppError("Workflow has no approval steps", 400);
    }

    const request = await Request.create({
        workflow: workflowId,
        submittedBy: req.user.id,
        title,
        description,
        currentStep: 1
    });

    res.status(201).json({
        success: true,
        message: "Request submitted successfully",
        request
    });
});


// ==========================
// GET MY REQUESTS
// ==========================
exports.getMyRequests = asyncHandler(async (req, res) => {
    const requests = await Request.find({
        submittedBy: req.user.id
    })
        .populate("workflow", "name description")
        .sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        count: requests.length,
        requests
    });
});


// ==========================
// GET PENDING REQUESTS
// ==========================
exports.getPendingRequests = asyncHandler(async (req, res) => {
    const requests = await Request.find({
        status: "pending"
    })
        .populate("workflow", "name description steps")
        .populate("submittedBy", "name email")
        .sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        count: requests.length,
        requests
    });
});


// ==========================
// GET ONE REQUEST
// ==========================
exports.getRequestById = asyncHandler(async (req, res) => {
    const request = await Request.findById(req.params.id)
        .populate("workflow", "name description steps")
        .populate("submittedBy", "name email")
        .populate("approvalHistory.actedBy", "name email");

    if (!request) {
        throw new AppError("Request not found", 404);
    }

    res.status(200).json({
        success: true,
        request
    });
});


// ==========================
// APPROVE / REJECT REQUEST
// ==========================
exports.processRequest = asyncHandler(async (req, res) => {
    const { action, comment } = req.body;

    if (!["approved", "rejected"].includes(action)) {
        throw new AppError("Action must be approved or rejected", 400);
    }

    const request = await Request.findById(req.params.id);

    if (!request) {
        throw new AppError("Request not found", 404);
    }

    if (request.status !== "pending") {
        throw new AppError("Request has already been completed", 400);
    }

    const workflow = await Workflow.findById(request.workflow);

    if (!workflow) {
        throw new AppError("Workflow not found", 404);
    }

    request.approvalHistory.push({
        stepNumber: request.currentStep,
        action,
        actedBy: req.user.id,
        comment
    });

    if (action === "rejected") {

        request.status = "rejected";

    } else {

        if (request.currentStep < workflow.steps.length) {
            request.currentStep += 1;
        } else {
            request.status = "approved";
        }
    }

    await request.save();

    res.status(200).json({
        success: true,
        message:
            action === "rejected"
                ? "Request rejected"
                : request.status === "approved"
                    ? "Request fully approved"
                    : "Request moved to next approval step",
        request
    });
});
