const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const User = require("../models/User.model");
const Workflow = require("../models/Workflow.model");
const Request = require("../models/Request.model");
const { useTestDB } = require("./helpers/db");
const { createUser, createWorkflow, createRequest } = require("./helpers/factory");
const { runSeed, DEMO_PASSWORD, demoEmail } = require("../scripts/seed");

// --reset only runs on a database whose name ends in "_demo"
useTestDB({ dbSuffix: "_demo" });

const seed = (options = {}) => runSeed({ log: () => {}, ...options });

const demoUser = (role) => User.findOne({ email: demoEmail(role) }).select("+password");

const workflowSummary = async () =>
    (await Workflow.find().sort({ name: 1 })).map((w) => ({
        name: w.name,
        isActive: w.isActive,
        roles: [...w.steps].sort((a, b) => a.stepNumber - b.stepNumber).map((s) => s.approverRole)
    }));

const EXPECTED_WORKFLOWS = [
    { name: "Leave Request Approval", isActive: true, roles: ["manager", "hr"] },
    { name: "Policy Exception", isActive: true, roles: ["hr", "manager"] },
    { name: "Remote Work Request", isActive: true, roles: ["manager"] }
];

const DEMO_EMAILS = ["admin", "employee", "hr", "manager"].map(demoEmail);


describe("seed --reset on a _demo database", () => {
    it("runs because the database name ends in _demo", async () => {
        expect(mongoose.connection.db.databaseName).toMatch(/_demo$/);

        await expect(seed({ reset: true })).resolves.toBeUndefined();
    });

    it("deletes every request", async () => {
        await seed();
        const employee = await demoUser("employee");
        const visitor = await createUser("employee");
        const leave = await Workflow.findOne({ name: "Leave Request Approval" });
        await createRequest(employee, leave);
        await createRequest(visitor, leave);

        await seed({ reset: true });

        expect(await Request.countDocuments()).toBe(0);
    });

    it("deletes every non-demo user and keeps exactly the four demo accounts", async () => {
        await seed();
        await createUser("employee", { name: "Visitor" });
        await createUser("manager", { name: "Visitor manager" });
        await User.collection.insertOne({ name: "Legacy", email: "legacy@example.com", password: "x", role: "user" });

        await seed({ reset: true });

        const emails = (await User.find().sort({ email: 1 })).map((u) => u.email);
        expect(emails).toEqual(DEMO_EMAILS);
    });

    it("deletes every non-demo workflow, including a renamed demo workflow, and recreates the original", async () => {
        await seed();
        const admin = await demoUser("admin");
        await createWorkflow(admin, { name: "Visitor workflow" });
        await Workflow.updateOne({ name: "Remote Work Request" }, { name: "Renamed by visitor" });

        await seed({ reset: true });

        expect(await workflowSummary()).toEqual(EXPECTED_WORKFLOWS);
    });

    it("restores demo users' names, roles and passwords", async () => {
        await seed();
        await User.updateOne(
            { email: demoEmail("manager") },
            { name: "Hacked", role: "employee", password: await bcrypt.hash("changed-by-visitor1", 4) }
        );

        await seed({ reset: true });

        const manager = await demoUser("manager");
        expect(manager.name).toBe("Test Manager");
        expect(manager.role).toBe("manager");
        expect(await bcrypt.compare(DEMO_PASSWORD, manager.password)).toBe(true);
    });

    it("restores edited, deactivated and deleted demo workflows, owned by the demo admin", async () => {
        await seed();
        await Workflow.updateOne(
            { name: "Leave Request Approval" },
            { description: "Edited", steps: [{ stepNumber: 1, name: "Admin only", approverRole: "admin" }] }
        );
        await Workflow.updateOne({ name: "Policy Exception" }, { isActive: false });
        await Workflow.deleteOne({ name: "Remote Work Request" });

        await seed({ reset: true });

        expect(await workflowSummary()).toEqual(EXPECTED_WORKFLOWS);
        expect((await Workflow.findOne({ name: "Leave Request Approval" })).description).not.toBe("Edited");

        const admin = await demoUser("admin");
        expect((await Workflow.distinct("createdBy")).map(String)).toEqual([admin.id]);
    });

    it("works on an empty database", async () => {
        await seed({ reset: true });

        expect((await User.find().sort({ email: 1 })).map((u) => u.email)).toEqual(DEMO_EMAILS);
        expect(await workflowSummary()).toEqual(EXPECTED_WORKFLOWS);
    });
});
