const User = require("../models/User.model");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");


// ==========================
// CHANGE A USER'S ROLE (ADMIN)
// ==========================
exports.updateUserRole = asyncHandler(async (req, res) => {
    const { role } = req.body;

    // Prevents an admin from demoting themselves and leaving no admin
    if (req.params.id === req.user.id) {
        throw new AppError("You cannot change your own role", 400);
    }

    const user = await User.findByIdAndUpdate(
        req.params.id,
        { role },
        { returnDocument: "after", runValidators: true }
    );

    if (!user) {
        throw new AppError("User not found", 404);
    }

    // protect reads the role from the database, so this applies on the user's next request
    res.status(200).json({
        success: true,
        message: `Role updated to ${user.role}`,
        user
    });
});
