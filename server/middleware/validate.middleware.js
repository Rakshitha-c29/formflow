const AppError = require("../utils/AppError");

// Runs a validation schema against req.body and rejects with 400 on failure
const validate = (schema) => (req, res, next) => {
    if (!req.body || typeof req.body !== "object") {
        return next(new AppError("Request body is required", 400));
    }

    const errors = schema(req.body);

    if (errors.length > 0) {
        return next(new AppError(errors.join(", "), 400, errors));
    }

    next();
};

module.exports = validate;
