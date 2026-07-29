const mongoose = require("mongoose");

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
            trim: true
        },

        description: {
            type: String,
            required: true,
            trim: true
        },

        // Overall request status
        status: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "pending"
        },

        // Which approval step we're currently on
        currentStep: {
            type: Number,
            default: 1
        },

        // History of approvals/rejections
        approvalHistory: [
            {
                stepNumber: Number,

                action: {
                    type: String,
                    enum: ["approved", "rejected"]
                },

                actedBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User"
                },

                comment: String,

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

module.exports = mongoose.model("Request", requestSchema);