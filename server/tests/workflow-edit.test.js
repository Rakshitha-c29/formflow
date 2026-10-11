const request = require("supertest");
const app = require("../app");
const Workflow = require("../models/Workflow.model");
const Request = require("../models/Request.model");
const { useTestDB } = require("./helpers/db");
const { createUser, bearer, createWorkflow, createRequest } = require("./helpers/factory");

useTestDB();

let admin, employee, manager, hr, workflow;

beforeEach(async () => {
    admin = await createUser("admin");
    employee = await createUser("employee");
    manager = await createUser("manager");
    hr = await createUser("hr");
    workflow = await createWorkflow(admin);
});

const edited = {
    name: "Leave request v2",
    description: "HR first, then admin",
    steps: [
        { stepNumber: 1, name: "HR review", approverRole: "hr" },
        { stepNumber: 2, name: "Admin sign-off", approverRole: "admin" }
    ]
};

const put = (user, body, id = workflow.id) =>
    request(app).put(`/api/workflows/${id}`).set("Authorization", bearer(user)).send(body);

const del = (user, id = workflow.id) =>
    request(app).delete(`/api/workflows/${id}`).set("Authorization", bearer(user));

const act = (user, requestId, action = "approved") =>
    request(app)
        .patch(`/api/requests/${requestId}/action`)
        .set("Authorization", bearer(user))
        .send({ action });


describe("PUT /api/workflows/:id", () => {
    it("lets admin replace the name, description and steps", async () => {
        const res = await put(admin, edited);

        expect(res.status).toBe(200);
        expect(res.body.workflow).toMatchObject({
            name: "Leave request v2",
            description: "HR first, then admin",
            steps: edited.steps.map((step) => expect.objectContaining(step))
        });

        const saved = await Workflow.findById(workflow._id);
        expect(saved.steps.map((s) => s.approverRole)).toEqual(["hr", "admin"]);
    });

    it("does not change createdBy or isActive even if they are sent", async () => {
        const res = await put(admin, { ...edited, createdBy: employee.id, isActive: false });

        expect(res.status).toBe(200);

        const saved = await Workflow.findById(workflow._id);
        expect(saved.createdBy.toString()).toBe(admin.id);
        expect(saved.isActive).toBe(true);
    });

    it.each(["employee", "manager", "hr"])("rejects %s with 403 and changes nothing", async (role) => {
        const user = await createUser(role);

        const res = await put(user, edited);

        expect(res.status).toBe(403);
        expect((await Workflow.findById(workflow._id)).name).toBe("Leave request");
    });

    it("rejects an unauthenticated request with 401", async () => {
        expect((await request(app).put(`/api/workflows/${workflow.id}`).send(edited)).status).toBe(401);
    });

    it("returns 404 for an unknown workflow and 400 for a malformed id", async () => {
        expect((await put(admin, edited, "000000000000000000000000")).status).toBe(404);
        expect((await put(admin, edited, "abc")).status).toBe(400);
    });
});


describe("PUT validation matches create", () => {
    const step = (overrides) => ({ stepNumber: 1, name: "S", approverRole: "manager", ...overrides });

    it.each([
        ["a missing name", { steps: [step()] }],
        ["a blank name", { name: "   ", steps: [step()] }],
        ["an operator object as name", { name: { $ne: null }, steps: [step()] }],
        ["a non-string description", { name: "W", description: 42, steps: [step()] }],
        ["steps that are not a list", { name: "W", steps: "manager" }],
        ["an unknown approverRole", { name: "W", steps: [step({ approverRole: "boss" })] }],
        ["duplicate stepNumbers", { name: "W", steps: [step(), step({ name: "T" })] }],
        ["stepNumber 0", { name: "W", steps: [step({ stepNumber: 0 })] }],
        ["a fractional stepNumber", { name: "W", steps: [step({ stepNumber: 1.5 })] }],
        ["a step without a name", { name: "W", steps: [step({ name: undefined })] }]
    ])("rejects %s with 400 on both create and edit, leaving the workflow unchanged", async (_, body) => {
        const created = await request(app)
            .post("/api/workflows")
            .set("Authorization", bearer(admin))
            .send(body);
        const updated = await put(admin, body);

        expect(created.status).toBe(400);
        expect(updated.status).toBe(400);
        expect(updated.body.errors.length).toBeGreaterThan(0);

        const saved = await Workflow.findById(workflow._id);
        expect(saved.name).toBe("Leave request");
        expect(saved.steps.map((s) => s.approverRole)).toEqual(["manager", "hr"]);
    });

    it("returns 400 for a create with no body instead of 500", async () => {
        const res = await request(app).post("/api/workflows").set("Authorization", bearer(admin));

        expect(res.status).toBe(400);
    });
});


describe("editing does not affect submitted requests", () => {
    it("a request submitted before the edit keeps its original steps and approvers", async () => {
        const before = await createRequest(employee, workflow);

        await put(admin, edited);

        const stored = await Request.findById(before._id);
        expect(stored.steps.map((s) => s.approverRole)).toEqual(["manager", "hr"]);

        // Still follows the original path: manager, then hr
        expect((await act(hr, before.id)).status).toBe(403);
        expect((await act(manager, before.id)).body.request.currentStep).toBe(2);

        const final = await act(hr, before.id);
        expect(final.body.request.status).toBe("approved");
    });

    it("a request submitted after the edit uses the new steps", async () => {
        await put(admin, edited);

        const res = await request(app)
            .post("/api/requests")
            .set("Authorization", bearer(employee))
            .send({ workflowId: workflow.id, title: "T", description: "D" });

        expect(res.body.request.steps.map((s) => s.approverRole)).toEqual(["hr", "admin"]);
        expect((await act(manager, res.body.request._id)).status).toBe(403);
        expect((await act(hr, res.body.request._id)).status).toBe(200);
    });
});


describe("DELETE /api/workflows/:id", () => {
    it("lets admin delete a workflow no request uses", async () => {
        const res = await del(admin);

        expect(res.status).toBe(200);
        expect(await Workflow.findById(workflow._id)).toBeNull();
    });

    it("returns 409 with a deactivation hint while a pending request uses it", async () => {
        await createRequest(employee, workflow);

        const res = await del(admin);

        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/used by 1 request/);
        expect(res.body.message).toMatch(/Deactivate/);
        expect(await Workflow.findById(workflow._id)).not.toBeNull();
    });

    it("returns 409 even when every referencing request is completed", async () => {
        await createRequest(employee, workflow, { status: "approved", currentStep: 2 });
        await createRequest(employee, workflow, { status: "rejected" });

        const res = await del(admin);

        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/used by 2 request/);
    });

    it("only counts requests for this workflow", async () => {
        const other = await createWorkflow(admin, { name: "Other" });
        await createRequest(employee, other);

        expect((await del(admin)).status).toBe(200);
    });

    it.each(["employee", "manager", "hr"])("rejects %s with 403 and keeps the workflow", async (role) => {
        const user = await createUser(role);

        expect((await del(user)).status).toBe(403);
        expect(await Workflow.findById(workflow._id)).not.toBeNull();
    });

    it("rejects an unauthenticated request with 401", async () => {
        expect((await request(app).delete(`/api/workflows/${workflow.id}`)).status).toBe(401);
    });

    it("returns 404 for an unknown workflow and 400 for a malformed id", async () => {
        expect((await del(admin, "000000000000000000000000")).status).toBe(404);
        expect((await del(admin, "abc")).status).toBe(400);
    });
});
