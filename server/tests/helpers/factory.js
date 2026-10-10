const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../../models/User.model");
const Workflow = require("../../models/Workflow.model");
const Request = require("../../models/Request.model");

let counter = 0;

// Low bcrypt cost keeps tests fast; these users never log in through the API
const createUser = async (role, overrides = {}) => {
    counter += 1;

    return User.create({
        name: `Test ${role} ${counter}`,
        email: `${role}${counter}@formflow.test`,
        password: await bcrypt.hash("Password123", 4),
        role,
        ...overrides
    });
};

// Same payload shape as auth.controller's generateToken
const tokenFor = (user) =>
    jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1h" });

const bearer = (user) => `Bearer ${tokenFor(user)}`;

const DEFAULT_STEPS = [
    { stepNumber: 1, name: "Manager review", approverRole: "manager" },
    { stepNumber: 2, name: "HR review", approverRole: "hr" }
];

const createWorkflow = (createdBy, overrides = {}) =>
    Workflow.create({
        name: "Leave request",
        description: "Two-step approval",
        steps: DEFAULT_STEPS,
        createdBy: createdBy._id,
        ...overrides
    });

const createRequest = (submittedBy, workflow, overrides = {}) =>
    Request.create({
        workflow: workflow._id,
        submittedBy: submittedBy._id,
        title: "Annual leave",
        description: "Five days in December",
        ...overrides
    });

module.exports = { createUser, tokenFor, bearer, createWorkflow, createRequest };
