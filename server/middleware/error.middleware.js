const AppError = require("../utils/AppError");


// ==========================
// 404 FOR UNKNOWN ROUTES
// ==========================
const notFound = (req, res, next) => {
    next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
};


// ==========================
// MAP KNOWN LIBRARY ERRORS TO HTTP ERRORS
// ==========================
const normalizeError = (err) => {
    if (err instanceof AppError) return err;

    // Invalid ObjectId, e.g. /api/requests/abc
    if (err.name === "CastError") {
        return new AppError(`Invalid ${err.path}: ${err.value}`, 400);
    }

    // Mongoose schema validation
    if (err.name === "ValidationError") {
        const errors = Object.values(err.errors).map((e) => e.message);
        return new AppError(errors.join(", "), 400, errors);
    }

    // Unique index violation
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue || {})[0] || "field";
        return new AppError(`An account with that ${field} already exists`, 409);
    }

    if (err.name === "JsonWebTokenError") {
        return new AppError("Invalid token", 401);
    }

    if (err.name === "TokenExpiredError") {
        return new AppError("Token expired", 401);
    }

    // Malformed JSON body
    if (err.type === "entity.parse.failed") {
        return new AppError("Malformed JSON in request body", 400);
    }

    return err;
};


// ==========================
// CENTRAL ERROR HANDLER
// ==========================
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
    const error = normalizeError(err);
    const statusCode = error.statusCode || 500;

    if (statusCode >= 500) {
        console.error(err);
    }

    const body = {
        success: false,
        message: error.isOperational ? error.message : "Internal server error"
    };

    if (error.isOperational && Array.isArray(error.errors)) {
        body.errors = error.errors;
    }

    res.status(statusCode).json(body);
};

module.exports = { notFound, errorHandler };
