const Workflow = require("../models/Workflow.model");


// ==========================
// CREATE WORKFLOW
// ==========================
exports.createWorkflow = async (req, res) => {
    try {
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

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// ==========================
// GET ALL MY WORKFLOWS
// ==========================
exports.getWorkflows = async (req, res) => {
    try {
        const workflows = await Workflow.find({
            createdBy: req.user.id
        });

        res.status(200).json({
            success: true,
            count: workflows.length,
            workflows
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// ==========================
// GET ONE WORKFLOW
// ==========================
exports.getWorkflowById = async (req, res) => {
    try {
        const workflow = await Workflow.findOne({
            _id: req.params.id,
            createdBy: req.user.id
        });

        if (!workflow) {
            return res.status(404).json({
                success: false,
                message: "Workflow not found"
            });
        }

        res.status(200).json({
            success: true,
            workflow
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};