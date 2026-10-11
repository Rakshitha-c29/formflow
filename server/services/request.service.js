const { ROLES } = require("../constants/roles");

// Accepts an ObjectId, a populated document, or a string
const idOf = (ref) => (ref && ref._id ? ref._id : ref)?.toString();

const sortSteps = (steps) => [...steps].sort((a, b) => a.stepNumber - b.stepNumber);


// ==========================
// STEP NAVIGATION
// ==========================
// A request's currentStep holds a stepNumber, not an array position,
// and steps come from the request's own snapshot rather than the live workflow

// Copied into the request at submission
const snapshotSteps = (workflow) =>
    sortSteps(workflow.steps).map(({ stepNumber, name, approverRole }) => ({
        stepNumber,
        name,
        approverRole
    }));

const getCurrentStep = (request) =>
    (request.steps || []).find((step) => step.stepNumber === request.currentStep);

// The step with the next-highest stepNumber, or undefined after the final step
const getNextStep = (request) =>
    sortSteps(request.steps || []).find((step) => step.stepNumber > request.currentStep);


// ==========================
// STATE TRANSITION
// ==========================
// pending@N --approved--> pending@next, or approved after the final step
// pending@N --rejected--> rejected
const getTransition = (request, action) => {
    if (action === "rejected") {
        return { status: "rejected", currentStep: request.currentStep };
    }

    const nextStep = getNextStep(request);

    return nextStep
        ? { status: "pending", currentStep: nextStep.stepNumber }
        : { status: "approved", currentStep: request.currentStep };
};


// ==========================
// CAN THIS USER APPROVE / REJECT THIS REQUEST RIGHT NOW?
// ==========================
const canActOnRequest = (user, request) => {
    if (request.status !== "pending") {
        return { allowed: false, reason: "Request has already been completed" };
    }

    if (idOf(request.submittedBy) === idOf(user)) {
        return { allowed: false, reason: "You cannot approve or reject your own request" };
    }

    const step = getCurrentStep(request);

    if (!step || step.approverRole !== user.role) {
        return { allowed: false, reason: "You are not the approver for the current step" };
    }

    return { allowed: true };
};


// ==========================
// CAN THIS USER VIEW THIS REQUEST?
// ==========================
// Submitter, admin, anyone who already acted on it, or the current approver
const canViewRequest = (user, request) => {
    if (user.role === ROLES.ADMIN) return true;

    if (idOf(request.submittedBy) === idOf(user)) return true;

    const actedOnIt = request.approvalHistory.some(
        (entry) => idOf(entry.actedBy) === idOf(user)
    );
    if (actedOnIt) return true;

    return canActOnRequest(user, request).allowed;
};

// ==========================
// DATABASE FILTER: REQUESTS WAITING ON THIS USER
// ==========================
// The query form of canActOnRequest, so pending queues can be paginated in the database.
// Admin sees every pending request. Everyone else: pending, not their own, and the step
// whose stepNumber equals currentStep is assigned to their role.
const pendingRequestsFilter = (user) => {
    if (user.role === ROLES.ADMIN) {
        return { status: "pending" };
    }

    return {
        status: "pending",
        submittedBy: { $ne: user._id },
        // Index-friendly pre-filter; the $expr below is the exact rule
        "steps.approverRole": user.role,
        $expr: {
            $anyElementTrue: {
                $map: {
                    input: { $ifNull: ["$steps", []] },
                    as: "step",
                    in: {
                        $and: [
                            { $eq: ["$$step.stepNumber", "$currentStep"] },
                            { $eq: ["$$step.approverRole", user.role] }
                        ]
                    }
                }
            }
        }
    };
};

module.exports = {
    pendingRequestsFilter,
    snapshotSteps,
    getCurrentStep,
    getNextStep,
    getTransition,
    canActOnRequest,
    canViewRequest
};
