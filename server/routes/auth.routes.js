const express = require("express");

const router = express.Router();

const {
    registerUser,
    loginUser
} = require("../controllers/auth.controller");

const protect = require("../middleware/auth.middleware");

router.post("/register", registerUser);

router.post("/login", loginUser);

// Temporary protected route
router.get("/profile", protect, (req, res) => {
    res.status(200).json({
        success: true,
        message: "You accessed a protected route!",
        user: req.user
    });
});

module.exports = router;