const AppError = require("../utils/AppError");

// Allows the request through only if the logged-in user has one of the given roles.
// Must run after protect, which loads req.user from the database.
const authorize = (...allowedRoles) => (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
        return next(new AppError("You do not have permission to perform this action", 403));
    }

    next();
};

module.exports = authorize;
