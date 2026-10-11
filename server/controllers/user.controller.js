const User = require("../models/User.model");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { parsePagination, pageInfo } = require("../utils/pagination");


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


// ==========================
// LIST USERS (ADMIN)
// ==========================
exports.getUsers = asyncHandler(async (req, res) => {
    const pagination = parsePagination(req.query);

    const [users, total] = await Promise.all([
        User.find()
            .select("name email role createdAt")
            .sort({ name: 1, _id: 1 })
            .skip(pagination.skip)
            .limit(pagination.limit),
        User.countDocuments()
    ]);

    res.status(200).json({
        success: true,
        count: users.length,
        ...pageInfo(pagination, total),
        users
    });
});
