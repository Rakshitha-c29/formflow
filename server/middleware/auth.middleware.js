const jwt = require("jsonwebtoken");
const User = require("../models/User.model");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");

const protect = asyncHandler(async (req, res, next) => {
    // Get Authorization header
    const authHeader = req.headers.authorization;

    // Check if token exists
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new AppError("Not authorized. Token missing.", 401);
    }

    // Extract and verify token (JWT errors become 401 in the error middleware).
    // Pinning the algorithm rejects tokens signed with anything other than our HS256 secret
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });

    // Load the current user so deleted users and changed roles take effect immediately
    const user = await User.findById(decoded.id);

    if (!user) {
        throw new AppError("User belonging to this token no longer exists", 401);
    }

    req.user = user;

    next();
});

module.exports = protect;
