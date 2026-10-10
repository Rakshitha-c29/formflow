exports.updateStatusSchema = (body) => {
    const errors = [];

    if (typeof body.isActive !== "boolean") {
        errors.push("isActive must be true or false");
    }

    return errors;
};
