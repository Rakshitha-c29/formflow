// Usage: npm run seed
// 1. Migrates legacy role "user" -> "employee"
// 2. Upserts one test account per role (password: TEST_PASSWORD below)
// 3. Backfills the steps snapshot on requests created before snapshots existed
require("dotenv").config({ quiet: true });
require("../config/env")();

const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User.model");
const Workflow = require("../models/Workflow.model");
const Request = require("../models/Request.model");
const { snapshotSteps } = require("../services/request.service");
const { ROLE_VALUES } = require("../constants/roles");

const TEST_PASSWORD = "Demo@2026";

const TEST_USER_NAMES = {
    employee: "Test Employee",
    manager: "Test Manager",
    hr: "Test HR",
    admin: "Test Admin"
};

const seed = async () => {
    await connectDB();

    // Bypass schema validation: "user" is no longer a valid enum value
    const migrated = await User.collection.updateMany(
        { role: "user" },
        { $set: { role: "employee" } }
    );
    console.log(`Migrated ${migrated.modifiedCount} user(s) from "user" to "employee"`);

    const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 10);

    for (const role of ROLE_VALUES) {
        const email = `${role}@formflow.test`;

        await User.findOneAndUpdate(
            { email },
            {
                name: TEST_USER_NAMES[role] || `Test ${role}`,
                email,
                password: hashedPassword,
                role
            },
            { upsert: true, runValidators: true }
        );

        console.log(`Seeded ${email} (${role})`);
    }

    console.log(`All test users use password: ${TEST_PASSWORD}`);

    await backfillRequestSteps();
};

// Older requests advanced by array position over steps numbered 1..n, so their
// currentStep already equals a stepNumber and only the snapshot is missing
const backfillRequestSteps = async () => {
    const requests = await Request.collection
        .find({ steps: { $exists: false } }, { projection: { workflow: 1, currentStep: 1 } })
        .toArray();

    let backfilled = 0;

    for (const request of requests) {
        const workflow = await Workflow.findById(request.workflow);

        if (!workflow || workflow.steps.length === 0) {
            console.warn(`Skipped request ${request._id}: workflow missing or has no steps`);
            continue;
        }

        const steps = snapshotSteps(workflow);

        if (!steps.some((step) => step.stepNumber === request.currentStep)) {
            console.warn(`Skipped request ${request._id}: currentStep ${request.currentStep} matches no step`);
            continue;
        }

        await Request.collection.updateOne(
            { _id: request._id, steps: { $exists: false } },
            { $set: { steps } }
        );
        backfilled += 1;
    }

    console.log(`Backfilled steps snapshot on ${backfilled} of ${requests.length} request(s)`);
};

seed()
    .catch((error) => {
        console.error("❌ Seed failed");
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
