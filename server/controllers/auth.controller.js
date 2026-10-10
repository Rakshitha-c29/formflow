const User = require("../models/User.model");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");


// ==========================
// GENERATE JWT
// ==========================
const generateToken = (user) => {
    return jwt.sign(
        {
            id: user._id,
            role: user.role
        },
        process.env.JWT_SECRET,
        {
            algorithm: "HS256",
            expiresIn: process.env.JWT_EXPIRES_IN || "1d"
        }
    );
};


// ==========================
// REGISTER USER
// ==========================
exports.registerUser = asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });

    if (existingUser) {
        throw new AppError("An account with that email already exists", 409);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // A concurrent duplicate still hits the unique index and becomes a 409
    const user = await User.create({
        name,
        email,
        password: hashedPassword
    });

    res.status(201).json({
        success: true,
        message: "User registered successfully",
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
        }
    });
});


// ==========================
// LOGIN USER
// ==========================
exports.loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // password is select: false on the model, so request it explicitly here only
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
        throw new AppError("Invalid email or password", 401);
    }

    const passwordMatch = await bcrypt.compare(
        password,
        user.password
    );

    if (!passwordMatch) {
        throw new AppError("Invalid email or password", 401);
    }

    // Create JWT
    const token = generateToken(user);

    res.status(200).json({
        success: true,
        message: "Login successful",
        token,
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
        }
    });
});
