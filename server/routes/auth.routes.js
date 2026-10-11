const express = require("express");

const router = express.Router();

const {
    registerUser,
    loginUser
} = require("../controllers/auth.controller");

const protect = require("../middleware/auth.middleware");
const validate = require("../middleware/validate.middleware");
const { createAuthLimiter } = require("../middleware/rateLimit.middleware");
const { registerSchema, loginSchema } = require("../validations/auth.validation");

// Limiters run before validation so malformed attempts count too.
// Register counts every attempt (limits account creation);
// login counts only failures (limits password guessing without locking out real users).
router.post("/register", createAuthLimiter(), validate(registerSchema), registerUser);

router.post("/login", createAuthLimiter({ countSuccessful: false }), validate(loginSchema), loginUser);

// Temporary protected route
router.get("/profile", protect, (req, res) => {
    res.status(200).json({
        success: true,
        message: "You accessed a protected route!",
        user: req.user
    });
});

module.exports = router;