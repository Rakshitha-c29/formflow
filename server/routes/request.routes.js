const express = require("express");

const router = express.Router();

const {
    submitRequest,
    getMyRequests,
    getPendingRequests,
    getRequestById,
    processRequest
} = require("../controllers/request.controller");

const protect = require("../middleware/auth.middleware");


// Submit request
router.post("/", protect, submitRequest);

// Get my requests
router.get("/", protect, getMyRequests);

// Get pending requests
router.get("/pending", protect, getPendingRequests);

// Get one request
router.get("/:id", protect, getRequestById);

// Approve / reject
router.patch("/:id/action", protect, processRequest);

module.exports = router;