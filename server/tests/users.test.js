const request = require("supertest");
const app = require("../app");
const User = require("../models/User.model");
const { useTestDB } = require("./helpers/db");
const { createUser, bearer } = require("./helpers/factory");

useTestDB();

const changeRole = (actor, targetId, body) =>
    request(app)
        .patch(`/api/users/${targetId}/role`)
        .set("Authorization", bearer(actor))
        .send(body);

describe("PATCH /api/users/:id/role", () => {
    let admin, employee;

    beforeEach(async () => {
        admin = await createUser("admin");
        employee = await createUser("employee");
    });

    it("lets admin change a user's role without exposing the password", async () => {
        const res = await changeRole(admin, employee.id, { role: "manager" });

        expect(res.status).toBe(200);
        expect(res.body.user.role).toBe("manager");
        expect(res.body.user.password).toBeUndefined();
        expect((await User.findById(employee._id)).role).toBe("manager");
    });

    it.each(["employee", "manager", "hr"])("rejects %s with 403 and leaves the role unchanged", async (role) => {
        const actor = await createUser(role);

        const res = await changeRole(actor, employee.id, { role: "admin" });

        expect(res.status).toBe(403);
        expect((await User.findById(employee._id)).role).toBe("employee");
    });

    it("stops a user promoting themselves", async () => {
        const res = await changeRole(employee, employee.id, { role: "admin" });

        expect(res.status).toBe(403);
    });

    it("stops admin changing their own role", async () => {
        const res = await changeRole(admin, admin.id, { role: "employee" });

        expect(res.status).toBe(400);
        expect((await User.findById(admin._id)).role).toBe("admin");
    });

    it.each([[{ role: "superuser" }], [{ role: { $ne: null } }], [{}]])("rejects invalid body %j with 400", async (body) => {
        const res = await changeRole(admin, employee.id, body);

        expect(res.status).toBe(400);
    });

    it("returns 404 for an unknown user and 400 for a malformed id", async () => {
        const unknown = await changeRole(admin, "000000000000000000000000", { role: "hr" });
        const malformed = await changeRole(admin, "abc", { role: "hr" });

        expect(unknown.status).toBe(404);
        expect(malformed.status).toBe(400);
    });

    it("rejects an unauthenticated request with 401", async () => {
        const res = await request(app).patch(`/api/users/${employee.id}/role`).send({ role: "hr" });

        expect(res.status).toBe(401);
    });
});

describe("role changes apply immediately to existing tokens", () => {
    it("a promoted user's old token gains admin access", async () => {
        const admin = await createUser("admin");
        const employee = await createUser("employee");
        const oldToken = bearer(employee);

        await changeRole(admin, employee.id, { role: "admin" });

        const res = await request(app)
            .post("/api/workflows")
            .set("Authorization", oldToken)
            .send({ name: "W", steps: [{ stepNumber: 1, name: "S", approverRole: "manager" }] });

        expect(res.status).toBe(201);
    });

    it("a demoted admin's old token loses admin access", async () => {
        const admin = await createUser("admin");
        const otherAdmin = await createUser("admin");
        const oldToken = bearer(otherAdmin);

        await changeRole(admin, otherAdmin.id, { role: "employee" });

        const res = await request(app)
            .post("/api/workflows")
            .set("Authorization", oldToken)
            .send({ name: "W", steps: [{ stepNumber: 1, name: "S", approverRole: "manager" }] });

        expect(res.status).toBe(403);
    });
});
