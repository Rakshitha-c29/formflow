const Request = require("../models/Request.model");
const Workflow = require("../models/Workflow.model");


// ==========================
// SUBMIT REQUEST
// ==========================
exports.submitRequest = async (req, res) => {
    try {
        const { workflowId, title, description } = req.body;

        const workflow = await Workflow.findById(workflowId);

        if (!workflow) {
            return res.status(404).json({
                success: false,
                message: "Workflow not found"
            });
        }

        if (!workflow.isActive) {
            return res.status(400).json({
                success: false,
                message: "Workflow is not active"
            });
        }

        if (!workflow.steps || workflow.steps.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Workflow has no approval steps"
            });
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

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// ==========================
// GET MY REQUESTS
// ==========================
exports.getMyRequests = async (req, res) => {
    try {
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

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// ==========================
// GET PENDING REQUESTS
// ==========================
exports.getPendingRequests = async (req, res) => {
    try {
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

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// ==========================
// GET ONE REQUEST
// ==========================
exports.getRequestById = async (req, res) => {
    try {
        const request = await Request.findById(req.params.id)
            .populate("workflow", "name description steps")
            .populate("submittedBy", "name email")
            .populate("approvalHistory.actedBy", "name email");

        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Request not found"
            });
        }

        res.status(200).json({
            success: true,
            request
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// ==========================
// APPROVE / REJECT REQUEST
// ==========================
exports.processRequest = async (req, res) => {
    try {
        const { action, comment } = req.body;

        if (!["approved", "rejected"].includes(action)) {
            return res.status(400).json({
                success: false,
                message: "Action must be approved or rejected"
            });
        }

        const request = await Request.findById(req.params.id);

        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Request not found"
            });
        }

        if (request.status !== "pending") {
            return res.status(400).json({
                success: false,
                message: "Request has already been completed"
            });
        }

        const workflow = await Workflow.findById(request.workflow);

        if (!workflow) {
            return res.status(404).json({
                success: false,
                message: "Workflow not found"
            });
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

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};