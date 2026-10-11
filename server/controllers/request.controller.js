const Request = require("../models/Request.model");
const Workflow = require("../models/Workflow.model");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { parsePagination, pageInfo } = require("../utils/pagination");
const {
    pendingRequestsFilter,
    snapshotSteps,
    getTransition,
    canActOnRequest,
    canViewRequest
} = require("../services/request.service");


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

    const steps = snapshotSteps(workflow);

    const request = await Request.create({
        workflow: workflowId,
        submittedBy: req.user.id,
        title,
        description,
        steps,
        currentStep: steps[0].stepNumber
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
    const pagination = parsePagination(req.query);
    const filter = { submittedBy: req.user._id };

    // _id breaks ties between requests created in the same millisecond, so pages never overlap
    const [requests, total] = await Promise.all([
        Request.find(filter)
            .populate("workflow", "name description")
            .sort({ createdAt: -1, _id: -1 })
            .skip(pagination.skip)
            .limit(pagination.limit),
        Request.countDocuments(filter)
    ]);

    res.status(200).json({
        success: true,
        count: requests.length,
        ...pageInfo(pagination, total),
        requests
    });
});


// ==========================
// MY REQUEST STATS
// ==========================
// Totals for the dashboard cards, independent of which page of the list is loaded
exports.getMyRequestStats = asyncHandler(async (req, res) => {
    const groups = await Request.aggregate([
        { $match: { submittedBy: req.user._id } },
        { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    const stats = { total: 0, pending: 0, approved: 0, rejected: 0 };

    for (const { _id: status, count } of groups) {
        stats[status] = count;
        stats.total += count;
    }

    res.status(200).json({
        success: true,
        stats
    });
});


// ==========================
// GET PENDING REQUESTS
// ==========================
// Admin sees every pending request; everyone else sees only the ones
// waiting on their role at the current step (never their own)
exports.getPendingRequests = asyncHandler(async (req, res) => {
    const pagination = parsePagination(req.query);

    // Filtered entirely in the database so total and pages are exact
    const filter = pendingRequestsFilter(req.user);

    const [requests, total] = await Promise.all([
        Request.find(filter)
            .populate("workflow", "name description")
            .populate("submittedBy", "name email")
            .sort({ createdAt: -1, _id: -1 })
            .skip(pagination.skip)
            .limit(pagination.limit),
        Request.countDocuments(filter)
    ]);

    res.status(200).json({
        success: true,
        count: requests.length,
        ...pageInfo(pagination, total),
        requests
    });
});


// ==========================
// GET ONE REQUEST
// ==========================
exports.getRequestById = asyncHandler(async (req, res) => {
    const request = await Request.findById(req.params.id)
        .populate("workflow", "name description")
        .populate("submittedBy", "name email")
        .populate("approvalHistory.actedBy", "name email");

    if (!request) {
        throw new AppError("Request not found", 404);
    }

    if (!canViewRequest(req.user, request)) {
        throw new AppError("You do not have permission to view this request", 403);
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

    const request = await Request.findById(req.params.id);

    if (!request) {
        throw new AppError("Request not found", 404);
    }

    if (request.status !== "pending") {
        throw new AppError("Request has already been completed", 400);
    }

    // Wrong role for the current step, or approving your own request
    const permission = canActOnRequest(req.user, request);

    if (!permission.allowed) {
        throw new AppError(permission.reason, 403);
    }

    const { status, currentStep } = getTransition(request, action);

    // Only applies if nobody else has acted since we read the request.
    // The permission check above depends only on status and currentStep,
    // so it is still valid whenever this filter matches.
    const updated = await Request.findOneAndUpdate(
        {
            _id: request._id,
            status: "pending",
            currentStep: request.currentStep
        },
        {
            $set: { status, currentStep },
            $push: {
                approvalHistory: {
                    stepNumber: request.currentStep,
                    action,
                    actedBy: req.user.id,
                    comment
                }
            }
        },
        { returnDocument: "after", runValidators: true }
    );

    if (!updated) {
        throw new AppError("This request was updated by someone else. Reload it and try again.", 409);
    }

    res.status(200).json({
        success: true,
        message:
            action === "rejected"
                ? "Request rejected"
                : updated.status === "approved"
                    ? "Request fully approved"
                    : "Request moved to next approval step",
        request: updated
    });
});
