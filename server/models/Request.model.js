const mongoose = require("mongoose");
const { ROLE_VALUES } = require("../constants/roles");

// Copy of the workflow's steps taken at submission, so later workflow edits
// or deletion cannot change the approval path of a request already in flight
const stepSnapshotSchema = new mongoose.Schema(
    {
        stepNumber: {
            type: Number,
            required: true,
            min: 1
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
    },
    { _id: false }
);

const requestSchema = new mongoose.Schema(
    {
        // Which workflow this request belongs to
        workflow: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Workflow",
            required: true
        },

        // User who submitted the request
        submittedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        // Information entered by the user
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 150
        },

        description: {
            type: String,
            required: true,
            trim: true,
            maxlength: 2000
        },

        // Approval path for this request (see stepSnapshotSchema)
        steps: {
            type: [stepSnapshotSchema],
            validate: {
                validator: (steps) => steps.length > 0,
                message: "A request must have at least one approval step"
            }
        },

        // Overall request status
        status: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "pending"
        },

        // stepNumber of the step awaiting action (not an array index)
        currentStep: {
            type: Number,
            required: true,
            min: 1
        },

        // History of approvals/rejections
        approvalHistory: [
            {
                stepNumber: {
                    type: Number,
                    required: true
                },

                action: {
                    type: String,
                    enum: ["approved", "rejected"],
                    required: true
                },

                actedBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                    required: true
                },

                comment: {
                    type: String,
                    trim: true,
                    maxlength: 500
                },

                actedAt: {
                    type: Date,
                    default: Date.now
                }
            }
        ]
    },
    {
        timestamps: true
    }
);

// "My requests", newest first
requestSchema.index({ submittedBy: 1, createdAt: -1 });

// Pending queues
requestSchema.index({ status: 1, workflow: 1 });

module.exports = mongoose.model("Request", requestSchema);
