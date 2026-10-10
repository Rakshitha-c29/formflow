// Operational error with an HTTP status code, handled by the central error middleware
class AppError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
    }
}

module.exports = AppError;
