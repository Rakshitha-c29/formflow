const request = require("supertest");
const app = require("../app");
const Request = require("../models/Request.model");
const { useTestDB } = require("./helpers/db");
const { createUser, bearer, createWorkflow, createRequest } = require("./helpers/factory");

useTestDB();

// Workflow: step 1 manager -> step 2 hr
let admin, employee, otherEmployee, manager, otherManager, hr, workflow, leave;

beforeEach(async () => {
    admin = await createUser("admin");
    employee = await createUser("employee");
    otherEmployee = await createUser("employee");
    manager = await createUser("manager");
    otherManager = await createUser("manager");
    hr = await createUser("hr");
    workflow = await createWorkflow(admin);
    leave = await createRequest(employee, workflow);
});

const getPending = (user) =>
    request(app).get("/api/requests/pending").set("Authorization", bearer(user));

const getOne = (user, id = leave.id) =>
    request(app).get(`/api/requests/${id}`).set("Authorization", bearer(user));

const act = (user, action, id = leave.id) =>
    request(app)
        .patch(`/api/requests/${id}/action`)
        .set("Authorization", bearer(user))
        .send({ action });

const pendingIds = (res) => res.body.requests.map((r) => r._id);


describe("GET /api/requests/pending (role-filtered)", () => {
    it("shows a step-1 request to managers", async () => {
        const res = await getPending(manager);

        expect(res.status).toBe(200);
        expect(pendingIds(res)).toEqual([leave.id]);
    });

    it("hides it from hr until it reaches the hr step", async () => {
        expect(pendingIds(await getPending(hr))).toEqual([]);

        await act(manager, "approved");

        expect(pendingIds(await getPending(hr))).toEqual([leave.id]);
        expect(pendingIds(await getPending(manager))).toEqual([]);
    });

    it("shows employees nothing to approve", async () => {
        expect(pendingIds(await getPending(employee))).toEqual([]);
    });

    it("excludes a manager's own request from their queue", async () => {
        const own = await createRequest(manager, workflow);

        const res = await getPending(manager);

        expect(pendingIds(res)).not.toContain(own.id);
        expect(pendingIds(await getPending(otherManager))).toContain(own.id);
    });

    it("excludes completed requests", async () => {
        await Request.updateOne({ _id: leave._id }, { status: "rejected" });

        expect(pendingIds(await getPending(manager))).toEqual([]);
    });

    it("shows admin every pending request regardless of step", async () => {
        const atHrStep = await createRequest(otherEmployee, workflow, { currentStep: 2 });

        const res = await getPending(admin);

        expect(pendingIds(res).sort()).toEqual([leave.id, atHrStep.id].sort());
    });

    it("rejects an unauthenticated request with 401", async () => {
        expect((await request(app).get("/api/requests/pending")).status).toBe(401);
    });
});


describe("GET /api/requests/:id (access control)", () => {
    it.each([
        ["submitter", () => employee],
        ["admin", () => admin],
        ["current step approver", () => manager]
    ])("allows the %s", async (_, user) => {
        expect((await getOne(user())).status).toBe(200);
    });

    it.each([
        ["another employee", () => otherEmployee],
        ["a later step's approver", () => hr]
    ])("denies %s with 403", async (_, user) => {
        const res = await getOne(user());

        expect(res.status).toBe(403);
        expect(res.body.request).toBeUndefined();
    });

    it("keeps access for a past approver and grants it to the next approver", async () => {
        await act(manager, "approved");

        expect((await getOne(manager)).status).toBe(200);
        expect((await getOne(hr)).status).toBe(200);
        expect((await getOne(otherEmployee)).status).toBe(403);
    });

    it("returns 404 for an unknown id and 400 for a malformed id", async () => {
        expect((await getOne(admin, "000000000000000000000000")).status).toBe(404);
        expect((await getOne(admin, "abc")).status).toBe(400);
    });
});


describe("PATCH /api/requests/:id/action (who may act)", () => {
    it("walks the request through each step with the right roles", async () => {
        const first = await act(manager, "approved");
        expect(first.status).toBe(200);
        expect(first.body.request.currentStep).toBe(2);

        const second = await act(hr, "approved");
        expect(second.status).toBe(200);
        expect(second.body.request.status).toBe("approved");
    });

    it("lets the current approver reject", async () => {
        const res = await act(manager, "rejected");

        expect(res.status).toBe(200);
        expect(res.body.request.status).toBe("rejected");
    });

    it.each([
        ["hr (later step)", () => hr],
        ["another employee", () => otherEmployee],
        ["the submitter", () => employee],
        ["admin", () => admin]
    ])("rejects %s at the manager step with 403 and changes nothing", async (_, user) => {
        const res = await act(user(), "approved");

        expect(res.status).toBe(403);

        const unchanged = await Request.findById(leave._id);
        expect(unchanged.currentStep).toBe(1);
        expect(unchanged.approvalHistory).toHaveLength(0);
    });

    it("blocks self-approval when the submitter holds the approver role", async () => {
        const own = await createRequest(manager, workflow);

        const res = await act(manager, "approved", own.id);

        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/your own request/);
        expect((await act(otherManager, "approved", own.id)).status).toBe(200);
    });

    it("blocks self-rejection too", async () => {
        const own = await createRequest(manager, workflow);

        expect((await act(manager, "rejected", own.id)).status).toBe(403);
    });

    it("stops the previous approver acting again once the step has moved on", async () => {
        await act(manager, "approved");

        expect((await act(manager, "approved")).status).toBe(403);
    });

    it("returns 400 for a completed request", async () => {
        await act(manager, "rejected");

        expect((await act(manager, "approved")).status).toBe(400);
    });

    it("returns 400 for an invalid action", async () => {
        expect((await act(manager, "maybe")).status).toBe(400);
    });
});
