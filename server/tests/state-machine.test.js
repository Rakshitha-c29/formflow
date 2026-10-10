const request = require("supertest");
const app = require("../app");
const Request = require("../models/Request.model");
const Workflow = require("../models/Workflow.model");
const { useTestDB } = require("./helpers/db");
const { createUser, bearer, createWorkflow, createRequest } = require("./helpers/factory");

useTestDB();

afterEach(() => jest.restoreAllMocks());

let admin, employee, manager, otherManager, hr, workflow, leave;

beforeEach(async () => {
    admin = await createUser("admin");
    employee = await createUser("employee");
    manager = await createUser("manager");
    otherManager = await createUser("manager");
    hr = await createUser("hr");
    workflow = await createWorkflow(admin);
    leave = await createRequest(employee, workflow);
});

const act = (user, body, id = leave.id) =>
    request(app)
        .patch(`/api/requests/${id}/action`)
        .set("Authorization", bearer(user))
        .send(typeof body === "string" ? { action: body } : body);

const submit = (user, body) =>
    request(app).post("/api/requests").set("Authorization", bearer(user)).send(body);

const reload = () => Request.findById(leave._id);


describe("rule: cannot act on approved or rejected requests", () => {
    it.each(["approved", "rejected"])("returns 400 for any action on a %s request", async (status) => {
        await Request.updateOne({ _id: leave._id }, { status });

        for (const action of ["approved", "rejected"]) {
            const res = await act(manager, action);

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/already been completed/);
        }

        expect((await reload()).approvalHistory).toHaveLength(0);
    });

    it("a fully approved request cannot be acted on again by the final approver", async () => {
        await act(manager, "approved");
        await act(hr, "approved");

        expect((await act(hr, "rejected")).status).toBe(400);
        expect((await reload()).status).toBe("approved");
    });
});


describe("rule: cannot skip or act on future stages", () => {
    it("rejects the later step's approver and leaves the request at step 1", async () => {
        const res = await act(hr, "approved");

        expect(res.status).toBe(403);

        const current = await reload();
        expect(current.currentStep).toBe(1);
        expect(current.status).toBe("pending");
    });

    it("advances exactly one step per approval through non-consecutive stepNumbers", async () => {
        const gapped = await createWorkflow(admin, {
            steps: [
                { stepNumber: 30, name: "Admin sign-off", approverRole: "admin" },
                { stepNumber: 10, name: "Manager review", approverRole: "manager" },
                { stepNumber: 20, name: "HR review", approverRole: "hr" }
            ]
        });
        const res = await submit(employee, { workflowId: gapped.id, title: "T", description: "D" });
        const id = res.body.request._id;

        expect(res.body.request.currentStep).toBe(10);

        // Later approvers are refused until the request reaches them
        expect((await act(admin, "approved", id)).status).toBe(403);
        expect((await act(hr, "approved", id)).status).toBe(403);

        expect((await act(manager, "approved", id)).body.request.currentStep).toBe(20);
        expect((await act(admin, "approved", id)).status).toBe(403);
        expect((await act(hr, "approved", id)).body.request.currentStep).toBe(30);

        const final = await act(admin, "approved", id);
        expect(final.body.request.status).toBe("approved");
        expect(final.body.request.approvalHistory.map((h) => h.stepNumber)).toEqual([10, 20, 30]);
    });

    it("a rejection at step 1 ends the request without reaching step 2", async () => {
        await act(manager, "rejected");

        expect((await act(hr, "approved")).status).toBe(400);

        const current = await reload();
        expect(current.status).toBe("rejected");
        expect(current.currentStep).toBe(1);
    });
});


describe("rule: wrong role cannot act", () => {
    it.each([
        ["employee", () => employee],
        ["hr", () => hr],
        ["admin", () => admin]
    ])("rejects %s at the manager step with 403", async (_, user) => {
        expect((await act(user(), "approved")).status).toBe(403);
        expect((await reload()).approvalHistory).toHaveLength(0);
    });
});


describe("rule: invalid action rejected", () => {
    it.each([
        ["an unknown action", { action: "maybe" }],
        ["a missing action", {}],
        ["an operator object", { action: { $ne: null } }],
        ["a non-string comment", { action: "approved", comment: { $gt: "" } }]
    ])("returns 400 for %s", async (_, body) => {
        expect((await act(manager, body)).status).toBe(400);
        expect((await reload()).approvalHistory).toHaveLength(0);
    });

    it("returns 400 for a comment over 500 characters and records nothing", async () => {
        const res = await act(manager, { action: "approved", comment: "x".repeat(501) });

        expect(res.status).toBe(400);

        const current = await reload();
        expect(current.currentStep).toBe(1);
        expect(current.approvalHistory).toHaveLength(0);
    });

    it("stores a valid comment with the history entry", async () => {
        const res = await act(manager, { action: "approved", comment: "  Looks fine  " });

        expect(res.body.request.approvalHistory[0]).toMatchObject({
            stepNumber: 1,
            action: "approved",
            actedBy: manager.id,
            comment: "Looks fine"
        });
    });
});


describe("rule: missing workflow or request rejected", () => {
    it("returns 404 when acting on a request that does not exist", async () => {
        expect((await act(manager, "approved", "000000000000000000000000")).status).toBe(404);
    });

    it("returns 400 when acting on a malformed request id", async () => {
        expect((await act(manager, "approved", "abc")).status).toBe(400);
    });

    it("returns 404 when submitting to a workflow that does not exist", async () => {
        const res = await submit(employee, { workflowId: "000000000000000000000000", title: "T", description: "D" });

        expect(res.status).toBe(404);
    });

    it.each([
        ["a malformed id", "abc"],
        ["an operator object", { $ne: null }]
    ])("returns 400 when workflowId is %s", async (_, workflowId) => {
        expect((await submit(employee, { workflowId, title: "T", description: "D" })).status).toBe(400);
    });

    it("returns 400 when submitting to an inactive workflow", async () => {
        const inactive = await createWorkflow(admin, { isActive: false });

        expect((await submit(employee, { workflowId: inactive.id, title: "T", description: "D" })).status).toBe(400);
    });

    it("returns 400 when submitting to a workflow with no steps", async () => {
        const empty = await createWorkflow(admin, { steps: [] });

        const res = await submit(employee, { workflowId: empty.id, title: "T", description: "D" });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/no approval steps/);
    });
});


describe("steps snapshot (workflow edits do not affect in-flight requests)", () => {
    it("copies the workflow's steps into the request at submission", async () => {
        const res = await submit(employee, { workflowId: workflow.id, title: "T", description: "D" });

        expect(res.status).toBe(201);
        expect(res.body.request.steps).toEqual([
            { stepNumber: 1, name: "Manager review", approverRole: "manager" },
            { stepNumber: 2, name: "HR review", approverRole: "hr" }
        ]);
    });

    it("keeps the original approver after the workflow's step role is changed", async () => {
        await Workflow.updateOne({ _id: workflow._id }, { "steps.0.approverRole": "hr" });

        expect((await act(hr, "approved")).status).toBe(403);
        expect((await act(manager, "approved")).status).toBe(200);
    });

    it("keeps the original path after a step is added to the workflow", async () => {
        await Workflow.updateOne(
            { _id: workflow._id },
            { $push: { steps: { stepNumber: 3, name: "Admin sign-off", approverRole: "admin" } } }
        );

        await act(manager, "approved");
        const res = await act(hr, "approved");

        expect(res.body.request.status).toBe("approved");
    });

    it("can still be completed after the workflow is deleted", async () => {
        await Workflow.deleteOne({ _id: workflow._id });

        await act(manager, "approved");
        const res = await act(hr, "approved");

        expect(res.status).toBe(200);
        expect(res.body.request.status).toBe("approved");
    });

    it("new submissions pick up the edited workflow", async () => {
        await Workflow.updateOne({ _id: workflow._id }, { "steps.0.approverRole": "hr" });

        const res = await submit(employee, { workflowId: workflow.id, title: "T", description: "D" });

        expect(res.body.request.steps[0].approverRole).toBe("hr");
    });

    it("pending queues follow the snapshot, not the edited workflow", async () => {
        await Workflow.updateOne({ _id: workflow._id }, { "steps.0.approverRole": "hr" });

        const asManager = await request(app).get("/api/requests/pending").set("Authorization", bearer(manager));
        const asHr = await request(app).get("/api/requests/pending").set("Authorization", bearer(hr));

        expect(asManager.body.requests.map((r) => r._id)).toEqual([leave.id]);
        expect(asHr.body.requests).toEqual([]);
    });
});


describe("concurrent approvals", () => {
    it("returns 409 when another approver acts between the read and the write", async () => {
        const realFindById = Request.findById.bind(Request);

        jest.spyOn(Request, "findById").mockImplementationOnce(async (id) => {
            const stale = await realFindById(id);

            // Another manager approves step 1 after our read but before our write
            await Request.updateOne(
                { _id: id },
                {
                    $set: { currentStep: 2 },
                    $push: { approvalHistory: { stepNumber: 1, action: "approved", actedBy: otherManager._id } }
                }
            );

            return stale;
        });

        const res = await act(manager, "approved");

        expect(res.status).toBe(409);

        const current = await reload();
        expect(current.currentStep).toBe(2);
        expect(current.approvalHistory).toHaveLength(1);
        expect(current.approvalHistory[0].actedBy.toString()).toBe(otherManager.id);
    });

    it("lets exactly one of several simultaneous approvals through", async () => {
        const managers = [manager, otherManager, ...(await Promise.all([1, 2, 3].map(() => createUser("manager"))))];

        const responses = await Promise.all(managers.map((m) => act(m, "approved")));
        const statuses = responses.map((res) => res.status);

        expect(statuses.filter((s) => s === 200)).toHaveLength(1);
        // Losers either saw the old step (409) or arrived after it moved on (403)
        expect(statuses.every((s) => [200, 403, 409].includes(s))).toBe(true);

        const current = await reload();
        expect(current.currentStep).toBe(2);
        expect(current.approvalHistory).toHaveLength(1);
    });

    it("lets only one of a simultaneous approve and reject win", async () => {
        const [approve, reject] = await Promise.all([
            act(manager, "approved"),
            act(otherManager, "rejected")
        ]);

        expect([approve.status, reject.status].filter((s) => s === 200)).toHaveLength(1);

        const current = await reload();
        expect(current.approvalHistory).toHaveLength(1);
        expect(current.status).toBe(approve.status === 200 ? "pending" : "rejected");
    });
});


describe("workflow step validation", () => {
    const createAsAdmin = (steps) =>
        request(app)
            .post("/api/workflows")
            .set("Authorization", bearer(admin))
            .send({ name: "W", steps });

    it.each([
        ["duplicate stepNumbers", [
            { stepNumber: 1, name: "A", approverRole: "manager" },
            { stepNumber: 1, name: "B", approverRole: "hr" }
        ]],
        ["stepNumber 0", [{ stepNumber: 0, name: "A", approverRole: "manager" }]],
        ["a fractional stepNumber", [{ stepNumber: 1.5, name: "A", approverRole: "manager" }]]
    ])("rejects %s with 400", async (_, steps) => {
        expect((await createAsAdmin(steps)).status).toBe(400);
    });
});


describe("Request model constraints", () => {
    it.each([
        ["a title over 150 characters", { title: "x".repeat(151), description: "D" }],
        ["a description over 2000 characters", { title: "T", description: "x".repeat(2001) }]
    ])("rejects submission with %s", async (_, body) => {
        const res = await submit(employee, { workflowId: workflow.id, ...body });

        expect(res.status).toBe(400);
    });

    it("requires stepNumber, action and actedBy on every history entry", async () => {
        const doc = new Request({
            workflow: workflow._id,
            submittedBy: employee._id,
            title: "T",
            description: "D",
            steps: [{ stepNumber: 1, name: "S", approverRole: "manager" }],
            currentStep: 1,
            approvalHistory: [{ comment: "no details" }]
        });

        const error = await doc.validate().catch((e) => e);

        expect(Object.keys(error.errors).sort()).toEqual([
            "approvalHistory.0.actedBy",
            "approvalHistory.0.action",
            "approvalHistory.0.stepNumber"
        ]);
    });

    it("rejects currentStep below 1 and a request with no steps", async () => {
        const doc = new Request({
            workflow: workflow._id,
            submittedBy: employee._id,
            title: "T",
            description: "D",
            steps: [],
            currentStep: 0
        });

        const error = await doc.validate().catch((e) => e);

        expect(error.errors).toHaveProperty("currentStep");
        expect(error.errors).toHaveProperty("steps");
    });

    it("declares the query indexes", () => {
        const indexes = Request.schema.indexes().map(([fields]) => fields);

        expect(indexes).toContainEqual({ submittedBy: 1, createdAt: -1 });
        expect(indexes).toContainEqual({ status: 1, workflow: 1 });
    });
});
