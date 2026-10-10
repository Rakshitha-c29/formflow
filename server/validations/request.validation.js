const ACTIONS = ["approved", "rejected"];

exports.actionSchema = (body) => {
    const errors = [];

    if (!ACTIONS.includes(body.action)) {
        errors.push("Action must be approved or rejected");
    }

    if (body.comment !== undefined && typeof body.comment !== "string") {
        errors.push("Comment must be a string");
    }

    return errors;
};
