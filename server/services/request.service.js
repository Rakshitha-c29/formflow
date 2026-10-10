const { ROLES } = require("../constants/roles");

// Accepts an ObjectId, a populated document, or a string
const idOf = (ref) => (ref && ref._id ? ref._id : ref)?.toString();

// currentStep is 1-based and advances through the steps in stepNumber order
const getCurrentStep = (workflow, request) => {
    if (!workflow) return undefined;

    const steps = [...workflow.steps].sort((a, b) => a.stepNumber - b.stepNumber);
    return steps[request.currentStep - 1];
};


// ==========================
// CAN THIS USER APPROVE / REJECT THIS REQUEST RIGHT NOW?
// ==========================
const canActOnRequest = (user, request, workflow) => {
    if (request.status !== "pending") {
        return { allowed: false, reason: "Request has already been completed" };
    }

    if (idOf(request.submittedBy) === idOf(user)) {
        return { allowed: false, reason: "You cannot approve or reject your own request" };
    }

    const step = getCurrentStep(workflow, request);

    if (!step || step.approverRole !== user.role) {
        return { allowed: false, reason: "You are not the approver for the current step" };
    }

    return { allowed: true };
};


// ==========================
// CAN THIS USER VIEW THIS REQUEST?
// ==========================
// Submitter, admin, anyone who already acted on it, or the current approver
const canViewRequest = (user, request, workflow) => {
    if (user.role === ROLES.ADMIN) return true;

    if (idOf(request.submittedBy) === idOf(user)) return true;

    const actedOnIt = request.approvalHistory.some(
        (entry) => idOf(entry.actedBy) === idOf(user)
    );
    if (actedOnIt) return true;

    return canActOnRequest(user, request, workflow).allowed;
};

module.exports = { canActOnRequest, canViewRequest, getCurrentStep };
