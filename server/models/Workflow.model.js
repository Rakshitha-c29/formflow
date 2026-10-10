const mongoose = require("mongoose");
const { ROLE_VALUES } = require("../constants/roles");

const workflowSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        description: {
            type: String,
            trim: true
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        // Steps run in ascending stepNumber order; numbers need not be consecutive
        steps: {
            type: [
                {
                    stepNumber: {
                        type: Number,
                        required: true,
                        min: 1,
                        validate: {
                            validator: Number.isInteger,
                            message: "stepNumber must be a whole number"
                        }
                    },

                    name: {
                        type: String,
                        required: true
                    },

                    approverRole: {
                        type: String,
                        enum: ROLE_VALUES,
                        required: true
                    }
                }
            ],
            validate: {
                // currentStep identifies a step by stepNumber, so duplicates would be ambiguous
                validator: (steps) =>
                    new Set(steps.map((step) => step.stepNumber)).size === steps.length,
                message: "Each step must have a unique stepNumber"
            }
        },

        isActive: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Workflow", workflowSchema);