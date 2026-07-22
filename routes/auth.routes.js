const express = require("express");
console.log("✅ auth.routes.js loaded");

const router = express.Router();

const { registerUser } = require("../controllers/auth.controller");

router.post("/register", registerUser);

console.log("✅ Register route created");

module.exports = router;