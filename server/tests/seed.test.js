const request = require("supertest");
const bcrypt = require("bcrypt");
const app = require("../app");
const User = require("../models/User.model");
const Workflow = require("../models/Workflow.model");
const Request = require("../models/Request.model");
const { useTestDB } = require("./helpers/db");
const { createUser, bearer, createWorkflow, createRequest } = require("./helpers/factory");
const { runSeed, assertDemoDatabase, SeedGuardError, DEMO_WORKFLOWS, DEMO_PASSWORD, demoEmail } = require("../scripts/seed");

useTestDB();

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


describe("seed", () => {
    it("creates one demo user per role with the demo password", async () => {
        await seed();

        for (const role of ["employee", "manager", "hr", "admin"]) {
            const user = await demoUser(role);

            expect(user.role).toBe(role);
            expect(await bcrypt.compare(DEMO_PASSWORD, user.password)).toBe(true);
        }
    });

    it("creates the three demo workflows, owned by the demo admin", async () => {
        await seed();

        expect(await workflowSummary()).toEqual(EXPECTED_WORKFLOWS);

        const admin = await demoUser("admin");
        const owners = await Workflow.distinct("createdBy");
        expect(owners.map(String)).toEqual([admin.id]);
    });

    it("numbers demo workflow steps 1..n in the listed order", async () => {
        await seed();

        const policy = await Workflow.findOne({ name: "Policy Exception" });

        expect(policy.steps.map((s) => [s.stepNumber, s.name])).toEqual([
            [1, "HR review"],
            [2, "Manager review"]
        ]);
    });

    it("is idempotent: running twice creates no duplicates", async () => {
        await seed();
        await seed();

        expect(await User.countDocuments({ email: /@formflow\.test$/ })).toBe(4);
        expect(await Workflow.countDocuments()).toBe(DEMO_WORKFLOWS.length);
    });

    it("leaves an admin's edits to a demo workflow in place on a normal run", async () => {
        await seed();
        await Workflow.updateOne(
            { name: "Remote Work Request" },
            { isActive: false, steps: [{ stepNumber: 1, name: "HR review", approverRole: "hr" }] }
        );

        await seed();

        const remote = await Workflow.findOne({ name: "Remote Work Request" });
        expect(remote.isActive).toBe(false);
        expect(remote.steps.map((s) => s.approverRole)).toEqual(["hr"]);
    });

    it("keeps existing requests on a normal run", async () => {
        await seed();
        const employee = await demoUser("employee");
        const leave = await Workflow.findOne({ name: "Leave Request Approval" });
        await createRequest(employee, leave);

        await seed();

        expect(await Request.countDocuments()).toBe(1);
    });

    it("migrates legacy \"user\" roles to employee", async () => {
        await User.collection.insertOne({ name: "Legacy", email: "legacy@example.com", password: "x", role: "user" });

        await seed();

        expect((await User.findOne({ email: "legacy@example.com" })).role).toBe("employee");
    });

    it("backfills the steps snapshot on requests created before snapshots existed", async () => {
        await seed();
        const leave = await Workflow.findOne({ name: "Leave Request Approval" });
        const employee = await demoUser("employee");
        const { insertedId } = await Request.collection.insertOne({
            workflow: leave._id,
            submittedBy: employee._id,
            title: "Old",
            description: "Before snapshots",
            status: "pending",
            currentStep: 1,
            approvalHistory: []
        });

        await seed();

        const backfilled = await Request.findById(insertedId);
        expect(backfilled.steps.map((s) => s.approverRole)).toEqual(["manager", "hr"]);
    });

    it("produces workflows that work end to end: employee -> manager -> HR", async () => {
        await seed();
        const [employee, manager, hr] = await Promise.all(["employee", "manager", "hr"].map(demoUser));
        const leave = await Workflow.findOne({ name: "Leave Request Approval" });

        const submitted = await request(app)
            .post("/api/requests")
            .set("Authorization", bearer(employee))
            .send({ workflowId: leave.id, title: "Leave", description: "Two days" });
        const id = submitted.body.request._id;

        const act = (user) =>
            request(app).patch(`/api/requests/${id}/action`).set("Authorization", bearer(user)).send({ action: "approved" });

        expect((await act(manager)).body.request.currentStep).toBe(2);
        expect((await act(hr)).body.request.status).toBe("approved");
    });
});



describe("--reset database name guard", () => {
    it.each(["formflow_demo", "acme_demo"])("allows %s", (name) => {
        expect(() => assertDemoDatabase(name)).not.toThrow();
    });

    it.each([
        ["the default dev database", "test"],
        ["a name that only contains _demo", "formflow_demo_backup"],
        ["a name without the underscore", "formflowdemo"],
        ["the bare word", "demo"],
        ["a test database", "formflow_test"],
        ["an empty name", ""],
        ["no connection", undefined]
    ])("refuses %s (%s)", (_, name) => {
        expect(() => assertDemoDatabase(name)).toThrow(SeedGuardError);
    });
});


describe("seed --reset outside a demo database", () => {
    it("refuses with a clear error and deletes nothing", async () => {
        await seed();
        const employee = await demoUser("employee");
        const leave = await Workflow.findOne({ name: "Leave Request Approval" });
        await createRequest(employee, leave);
        await createUser("employee", { name: "Real user" });
        await createWorkflow(employee, { name: "Real workflow" });

        const error = await seed({ reset: true }).catch((e) => e);

        expect(error).toBeInstanceOf(SeedGuardError);
        expect(error.message).toMatch(/^Refusing to reset database "test_[0-9a-f]+"/);
        expect(error.message).toMatch(/ends in "_demo"/);

        expect(await Request.countDocuments()).toBe(1);
        expect(await User.exists({ name: "Real user" })).toBeTruthy();
        expect(await Workflow.exists({ name: "Real workflow" })).toBeTruthy();
    });
});
