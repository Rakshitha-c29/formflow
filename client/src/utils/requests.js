// Helpers for displaying a request's position in its workflow.
// currentStep holds a stepNumber, and steps is the snapshot taken at submission.

export const sortSteps = (steps = []) =>
    [...steps].sort((a, b) => a.stepNumber - b.stepNumber);

export const getCurrentStep = (request) =>
    request?.steps?.find((step) => step.stepNumber === request.currentStep);

export const idOf = (ref) => (ref && ref._id ? ref._id : ref);

export const formatDate = (value) =>
    value
        ? new Date(value).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
        })
        : "";
