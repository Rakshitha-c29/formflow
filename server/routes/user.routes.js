const express = require("express");

const router = express.Router();

const { getUsers, updateUserRole } = require("../controllers/user.controller");

const protect = require("../middleware/auth.middleware");
const authorize = require("../middleware/authorize.middleware");
const validate = require("../middleware/validate.middleware");
const { updateRoleSchema } = require("../validations/user.validation");
const { ROLES } = require("../constants/roles");


// List users (admin only)
router.get("/", protect, authorize(ROLES.ADMIN), getUsers);

// Change a user's role (admin only)
router.patch(
    "/:id/role",
    protect,
    authorize(ROLES.ADMIN),
    validate(updateRoleSchema),
    updateUserRole
);

module.exports = router;
