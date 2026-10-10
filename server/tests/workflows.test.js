const request = require("supertest");
const app = require("../app");
const Workflow = require("../models/Workflow.model");
const { useTestDB } = require("./helpers/db");
const { createUser, bearer, createWorkflow } = require("./helpers/factory");

useTestDB();

const newWorkflow = {
    name: "Expense claim",
    steps: [{ stepNumber: 1, name: "Manager review", approverRole: "manager" }]
};

describe("POST /api/workflows (admin only)", () => {
    it("lets admin create a workflow", async () => {
        const admin = await createUser("admin");

        const res = await request(app)
            .post("/api/workflows")
            .set("Authorization", bearer(admin))
            .send(newWorkflow);

        expect(res.status).toBe(201);
        expect(res.body.workflow.createdBy).toBe(admin.id);
    });

    it.each(["employee", "manager", "hr"])("rejects %s with 403 and creates nothing", async (role) => {
        const user = await createUser(role);

        const res = await request(app)
            .post("/api/workflows")
            .set("Authorization", bearer(user))
            .send(newWorkflow);

        expect(res.status).toBe(403);
        expect(await Workflow.countDocuments()).toBe(0);
    });

    it("rejects an unauthenticated request with 401", async () => {
        const res = await request(app).post("/api/workflows").send(newWorkflow);

        expect(res.status).toBe(401);
    });
});

describe("GET /api/workflows visibility", () => {
    let admin, employee, active, inactive;

    beforeEach(async () => {
        admin = await createUser("admin");
        employee = await createUser("employee");
        active = await createWorkflow(admin, { name: "Active" });
        inactive = await createWorkflow(admin, { name: "Inactive", isActive: false });
    });

    it("shows non-admins only active workflows, even ones they did not create", async () => {
        const res = await request(app).get("/api/workflows").set("Authorization", bearer(employee));

        expect(res.status).toBe(200);
        expect(res.body.workflows.map((w) => w.name)).toEqual(["Active"]);
    });

    it("shows admin every workflow", async () => {
        const res = await request(app).get("/api/workflows").set("Authorization", bearer(admin));

        expect(res.body.workflows.map((w) => w.name).sort()).toEqual(["Active", "Inactive"]);
    });

    it("returns 404 to a non-admin for an inactive workflow", async () => {
        const res = await request(app)
            .get(`/api/workflows/${inactive.id}`)
            .set("Authorization", bearer(employee));

        expect(res.status).toBe(404);
    });

    it("returns an active workflow to a non-admin and an inactive one to admin", async () => {
        const asEmployee = await request(app)
            .get(`/api/workflows/${active.id}`)
            .set("Authorization", bearer(employee));
        const asAdmin = await request(app)
            .get(`/api/workflows/${inactive.id}`)
            .set("Authorization", bearer(admin));

        expect(asEmployee.status).toBe(200);
        expect(asAdmin.status).toBe(200);
    });
});

describe("PATCH /api/workflows/:id/status (admin only)", () => {
    let admin, workflow;

    const setStatus = (user, body, id = workflow.id) =>
        request(app)
            .patch(`/api/workflows/${id}/status`)
            .set("Authorization", bearer(user))
            .send(body);

    beforeEach(async () => {
        admin = await createUser("admin");
        workflow = await createWorkflow(admin);
    });

    it("lets admin deactivate and reactivate a workflow", async () => {
        const off = await setStatus(admin, { isActive: false });
        expect(off.status).toBe(200);
        expect(off.body.workflow.isActive).toBe(false);

        const on = await setStatus(admin, { isActive: true });
        expect(on.body.workflow.isActive).toBe(true);
    });

    it("hides a deactivated workflow from non-admins", async () => {
        const employee = await createUser("employee");

        await setStatus(admin, { isActive: false });

        const res = await request(app).get("/api/workflows").set("Authorization", bearer(employee));
        expect(res.body.workflows).toEqual([]);
    });

    it.each(["employee", "manager", "hr"])("rejects %s with 403 and leaves it active", async (role) => {
        const user = await createUser(role);

        expect((await setStatus(user, { isActive: false })).status).toBe(403);
        expect((await Workflow.findById(workflow._id)).isActive).toBe(true);
    });

    it.each([[{}], [{ isActive: "false" }], [{ isActive: { $ne: null } }]])("rejects body %j with 400", async (body) => {
        const res = await setStatus(admin, body);

        expect(res.status).toBe(400);
        expect(res.body.errors).toEqual(["isActive must be true or false"]);
    });

    it("returns 404 for an unknown workflow", async () => {
        expect((await setStatus(admin, { isActive: false }, "000000000000000000000000")).status).toBe(404);
    });
});
