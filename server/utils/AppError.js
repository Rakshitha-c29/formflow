// Operational error with an HTTP status code, handled by the central error middleware.
// errors: optional per-field messages, returned to the client alongside message
class AppError extends Error {
    constructor(message, statusCode = 500, errors) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        this.errors = errors;
    }
}

module.exports = AppError;
