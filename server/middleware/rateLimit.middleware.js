const { rateLimit } = require("express-rate-limit");
const AppError = require("../utils/AppError");

const WINDOW_MINUTES = 15;
const MAX_ATTEMPTS = 10;

// Off in tests so suites can log in freely; a dedicated test turns it back on
const isDisabled = () =>
    process.env.NODE_ENV === "test" && process.env.RATE_LIMIT_IN_TESTS !== "true";

// Each call creates an independent counter, so login and register are limited separately.
// countSuccessful: false ignores responses below 400, so only failed attempts count.
const createAuthLimiter = ({ countSuccessful = true } = {}) =>
    rateLimit({
        windowMs: WINDOW_MINUTES * 60 * 1000,
        limit: MAX_ATTEMPTS,
        skipSuccessfulRequests: !countSuccessful,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        skip: isDisabled,
        // Route through the central error handler for the standard error body
        handler: (req, res, next) => {
            next(new AppError(
                `Too many attempts. Please try again in ${WINDOW_MINUTES} minutes.`,
                429
            ));
        }
    });

module.exports = { createAuthLimiter, MAX_ATTEMPTS };
