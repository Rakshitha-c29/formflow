// Shape checks shared by create and edit. Field rules (role enum, unique and
// positive stepNumbers, required step names) are enforced by the Workflow schema.
exports.workflowSchema = (body) => {
    const errors = [];

    if (typeof body.name !== "string" || body.name.trim() === "") {
        errors.push("Name is required");
    }

    if (body.description !== undefined && typeof body.description !== "string") {
        errors.push("Description must be a string");
    }

    if (body.steps !== undefined && !Array.isArray(body.steps)) {
        errors.push("Steps must be a list");
    }

    return errors;
};

exports.updateStatusSchema = (body) => {
    const errors = [];

    if (typeof body.isActive !== "boolean") {
        errors.push("isActive must be true or false");
    }

    return errors;
};
