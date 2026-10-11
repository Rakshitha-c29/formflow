// Usage:
//   npm run seed           Safe to re-run. Creates whatever is missing.
//   npm run seed:reset     Resets a public demo: deletes ALL requests and every non-demo
//                          user and workflow, then restores the demo data. Refuses to run
//                          unless the database name ends in "_demo".
//
// Steps:
// 1. Migrates legacy role "user" -> "employee"
// 2. Upserts one demo account per role (password: DEMO_PASSWORD below)
// 3. Creates the demo workflows if missing (restores them with --reset)
// 4. Backfills the steps snapshot on requests created before snapshots existed
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const User = require("../models/User.model");
const Workflow = require("../models/Workflow.model");
const Request = require("../models/Request.model");
const { snapshotSteps } = require("../services/request.service");
const { ROLES, ROLE_VALUES } = require("../constants/roles");

const DEMO_PASSWORD = "Demo@2026";

const DEMO_USER_NAMES = {
    employee: "Test Employee",
    manager: "Test Manager",
    hr: "Test HR",
    admin: "Test Admin"
};

const demoEmail = (role) => `${role}@formflow.test`;

// Steps are numbered by position when saved
const DEMO_WORKFLOWS = [
    {
        name: "Leave Request Approval",
        description: "Time off requests, approved by a manager and then HR.",
        steps: [
            { name: "Manager review", approverRole: ROLES.MANAGER },
            { name: "HR review", approverRole: ROLES.HR }
        ]
    },
    {
        name: "Remote Work Request",
        description: "Requests to work remotely, approved by a manager.",
        steps: [
            { name: "Manager review", approverRole: ROLES.MANAGER }
        ]
    },
    {
        name: "Policy Exception",
        description: "Exceptions to company policy, reviewed by HR and then a manager.",
        steps: [
            { name: "HR review", approverRole: ROLES.HR },
            { name: "Manager review", approverRole: ROLES.MANAGER }
        ]
    }
];

const numberSteps = (steps) => steps.map((step, index) => ({ ...step, stepNumber: index + 1 }));

const DEMO_DB_SUFFIX = "_demo";

class SeedGuardError extends Error {}

// --reset deletes real data, so it only runs against a database explicitly named as a demo
const assertDemoDatabase = (name = mongoose.connection.db?.databaseName) => {
    if (!name || !name.endsWith(DEMO_DB_SUFFIX)) {
        throw new SeedGuardError(
            `Refusing to reset database "${name}". --reset deletes all requests and every non-demo ` +
            `user and workflow, so it only runs on a database whose name ends in "${DEMO_DB_SUFFIX}". ` +
            `Point MONGO_URI at a demo database (for example .../formflow${DEMO_DB_SUFFIX}) and try again.`
        );
    }
};

// Everything except the demo accounts and demo workflows (matched by email and by name)
const clearNonDemoData = async (log) => {
    const requests = await Request.deleteMany({});
    const users = await User.deleteMany({ email: { $nin: ROLE_VALUES.map(demoEmail) } });
    const workflows = await Workflow.deleteMany({ name: { $nin: DEMO_WORKFLOWS.map((w) => w.name) } });

    log(`Reset: deleted ${requests.deletedCount} request(s), ${users.deletedCount} non-demo user(s), ` +
        `${workflows.deletedCount} non-demo workflow(s)`);
};


const migrateLegacyRoles = async (log) => {
    // Bypass schema validation: "user" is no longer a valid enum value
    const migrated = await User.collection.updateMany(
        { role: "user" },
        { $set: { role: ROLES.EMPLOYEE } }
    );
    log(`Migrated ${migrated.modifiedCount} user(s) from "user" to "employee"`);
};

// Always restores name, role and password, so a demo account changed by a visitor recovers
const upsertDemoUsers = async (log) => {
    const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);
    const users = {};

    for (const role of ROLE_VALUES) {
        const email = demoEmail(role);

        users[role] = await User.findOneAndUpdate(
            { email },
            {
                name: DEMO_USER_NAMES[role] || `Test ${role}`,
                email,
                password: hashedPassword,
                role
            },
            { upsert: true, runValidators: true, returnDocument: "after" }
        );

        log(`Seeded ${email} (${role})`);
    }

    log(`All demo users use password: ${DEMO_PASSWORD}`);
    return users;
};

// Matched by name. Without reset, an existing demo workflow is left exactly as an admin
// last edited it. With reset, it is restored to its original definition and reactivated.
const ensureDemoWorkflows = async (admin, reset, log) => {
    for (const definition of DEMO_WORKFLOWS) {
        const steps = numberSteps(definition.steps);
        const existing = await Workflow.findOne({ name: definition.name });

        if (!existing) {
            await Workflow.create({ ...definition, steps, createdBy: admin._id });
            log(`Created workflow "${definition.name}"`);
        } else if (reset) {
            existing.set({ description: definition.description, steps, isActive: true, createdBy: admin._id });
            await existing.save();
            log(`Restored workflow "${definition.name}"`);
        } else {
            log(`Workflow "${definition.name}" already exists, left unchanged`);
        }
    }
};

// Older requests advanced by array position over steps numbered 1..n, so their
// currentStep already equals a stepNumber and only the snapshot is missing
const backfillRequestSteps = async (log) => {
    const requests = await Request.collection
        .find({ steps: { $exists: false } }, { projection: { workflow: 1, currentStep: 1 } })
        .toArray();

    let backfilled = 0;

    for (const request of requests) {
        const workflow = await Workflow.findById(request.workflow);

        if (!workflow || workflow.steps.length === 0) {
            log(`Skipped request ${request._id}: workflow missing or has no steps`);
            continue;
        }

        const steps = snapshotSteps(workflow);

        if (!steps.some((step) => step.stepNumber === request.currentStep)) {
            log(`Skipped request ${request._id}: currentStep ${request.currentStep} matches no step`);
            continue;
        }

        await Request.collection.updateOne(
            { _id: request._id, steps: { $exists: false } },
            { $set: { steps } }
        );
        backfilled += 1;
    }

    log(`Backfilled steps snapshot on ${backfilled} of ${requests.length} request(s)`);
};

// Expects an open mongoose connection
const runSeed = async ({ reset = false, log = console.log } = {}) => {
    if (reset) {
        // Checked before any write
        assertDemoDatabase();
        await clearNonDemoData(log);
    }

    await migrateLegacyRoles(log);
    const users = await upsertDemoUsers(log);
    await ensureDemoWorkflows(users[ROLES.ADMIN], reset, log);
    await backfillRequestSteps(log);
};

module.exports = { runSeed, assertDemoDatabase, SeedGuardError, DEMO_WORKFLOWS, DEMO_PASSWORD, demoEmail };


if (require.main === module) {
    require("dotenv").config({ quiet: true });
    require("../config/env")();

    const connectDB = require("../config/db");
    const reset = process.argv.includes("--reset");

    connectDB()
        .then(() => runSeed({ reset }))
        .catch((error) => {
            console.error("❌ Seed failed");
            // A refused reset is an expected outcome, so print only its explanation
            console.error(error instanceof SeedGuardError ? error.message : error);
            process.exitCode = 1;
        })
        .finally(() => mongoose.disconnect());
}
