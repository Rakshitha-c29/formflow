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

        steps: [
            {
                stepNumber: {
                    type: Number,
                    required: true
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