const express = require("express");

const router = express.Router();

const {
    registerUser,
    loginUser
} = require("../controllers/auth.controller");

const protect = require("../middleware/auth.middleware");
const validate = require("../middleware/validate.middleware");
const { registerSchema, loginSchema } = require("../validations/auth.validation");

router.post("/register", validate(registerSchema), registerUser);

router.post("/login", validate(loginSchema), loginUser);

// Temporary protected route
router.get("/profile", protect, (req, res) => {
    res.status(200).json({
        success: true,
        message: "You accessed a protected route!",
        user: req.user
    });
});

module.exports = router;