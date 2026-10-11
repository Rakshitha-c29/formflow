const request = require("supertest");
const bcrypt = require("bcrypt");
const app = require("../app");
const Request = require("../models/Request.model");
const User = require("../models/User.model");
const { useTestDB } = require("./helpers/db");
const { createUser, bearer, createWorkflow } = require("./helpers/factory");
const { snapshotSteps, canActOnRequest } = require("../services/request.service");

useTestDB();

// Bulk insert for speed; mirrors createRequest (snapshot + first stepNumber)
const insertRequests = (submitter, workflow, count, overrides = {}) => {
    const steps = snapshotSteps(workflow);

    return Request.insertMany(
        Array.from({ length: count }, (_, i) => ({
            workflow: workflow._id,
            submittedBy: submitter._id,
            title: `Request ${i + 1}`,
            description: "D",
            steps,
            currentStep: steps[0].stepNumber,
            ...overrides
        }))
    );
};

const get = (user, path) => request(app).get(path).set("Authorization", bearer(user));

const idsOf = (res, key = "requests") => res.body[key].map((item) => item._id);

// Reads every page and returns all ids, checking the page metadata along the way
const readAllPages = async (user, path, key, limit) => {
    const ids = [];
    let page = 1;
    let totalPages;

    do {
        const res = await get(user, `${path}?page=${page}&limit=${limit}`);
        expect(res.status).toBe(200);
        expect(res.body.page).toBe(page);
        expect(res.body.count).toBe(res.body[key].length);
        totalPages = res.body.totalPages;
        ids.push(...idsOf(res, key));
        page += 1;
    } while (page <= totalPages);

    return ids;
};

let admin, employee, otherEmployee, manager, hr, workflow;

beforeEach(async () => {
    admin = await createUser("admin");
    employee = await createUser("employee");
    otherEmployee = await createUser("employee");
    manager = await createUser("manager");
    hr = await createUser("hr");
    workflow = await createWorkflow(admin);
});


describe("GET /api/requests (my requests)", () => {
    beforeEach(async () => {
        await insertRequests(employee, workflow, 25);
        await insertRequests(otherEmployee, workflow, 4);
    });

    it("returns the first 20 of the user's own requests with page metadata", async () => {
        const res = await get(employee, "/api/requests");

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ count: 20, total: 25, page: 1, limit: 20, totalPages: 2 });
        expect(res.body.requests).toHaveLength(20);
    });

    it("returns the remainder on the last page", async () => {
        const res = await get(employee, "/api/requests?page=2");

        expect(res.body).toMatchObject({ count: 5, total: 25, page: 2, totalPages: 2 });
    });

    it("returns an empty list, not an error, past the last page", async () => {
        const res = await get(employee, "/api/requests?page=3");

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ count: 0, total: 25, page: 3, totalPages: 2 });
    });

    it("pages cover every request exactly once, newest first", async () => {
        const ids = await readAllPages(employee, "/api/requests", "requests", 7);

        expect(ids).toHaveLength(25);
        expect(new Set(ids).size).toBe(25);

        const expected = await Request.find({ submittedBy: employee._id }).sort({ createdAt: -1, _id: -1 });
        expect(ids).toEqual(expected.map((r) => r.id));
    });

    it("never counts other users' requests", async () => {
        const res = await get(otherEmployee, "/api/requests");

        expect(res.body.total).toBe(4);
    });

    it("returns 400 for invalid page or limit", async () => {
        const res = await get(employee, "/api/requests?page=0&limit=500");

        expect(res.status).toBe(400);
        expect(res.body.errors).toHaveLength(2);
    });
});


describe("GET /api/requests/pending", () => {
    it("paginates a role's queue and reports the exact total", async () => {
        await insertRequests(employee, workflow, 23);

        const first = await get(manager, "/api/requests/pending?limit=10");
        const last = await get(manager, "/api/requests/pending?limit=10&page=3");

        expect(first.body).toMatchObject({ count: 10, total: 23, totalPages: 3 });
        expect(last.body).toMatchObject({ count: 3, page: 3 });
    });

    it("counts only requests whose current step is the user's role", async () => {
        await insertRequests(employee, workflow, 6);
        await insertRequests(employee, workflow, 4, { currentStep: 2 });

        expect((await get(manager, "/api/requests/pending")).body.total).toBe(6);
        expect((await get(hr, "/api/requests/pending")).body.total).toBe(4);
        expect((await get(employee, "/api/requests/pending")).body.total).toBe(0);
        expect((await get(admin, "/api/requests/pending")).body.total).toBe(10);
    });

    it("returns exactly the requests canActOnRequest allows, across all pages", async () => {
        const otherManager = await createUser("manager");
        const hrFirst = await createWorkflow(admin, {
            name: "HR then manager",
            steps: [
                { stepNumber: 10, name: "HR review", approverRole: "hr" },
                { stepNumber: 20, name: "Manager review", approverRole: "manager" }
            ]
        });
        const managerOnly = await createWorkflow(admin, {
            name: "Manager only",
            steps: [{ stepNumber: 5, name: "Manager review", approverRole: "manager" }]
        });

        // A deliberately mixed set: steps, statuses, workflows, and the approvers' own requests
        await insertRequests(employee, workflow, 4);
        await insertRequests(employee, workflow, 3, { currentStep: 2 });
        await insertRequests(employee, workflow, 2, { status: "approved", currentStep: 2 });
        await insertRequests(employee, workflow, 2, { status: "rejected" });
        await insertRequests(otherEmployee, hrFirst, 3);
        await insertRequests(otherEmployee, hrFirst, 3, { currentStep: 20 });
        await insertRequests(employee, managerOnly, 2);
        await insertRequests(manager, workflow, 2);
        await insertRequests(hr, hrFirst, 2);
        await insertRequests(otherManager, managerOnly, 1);

        const all = await Request.find();

        for (const user of [manager, otherManager, hr, employee, otherEmployee]) {
            const expected = all
                .filter((r) => canActOnRequest(user, r).allowed)
                .map((r) => r.id)
                .sort();

            const ids = await readAllPages(user, "/api/requests/pending", "requests", 3);

            expect(ids.sort()).toEqual(expected);
        }
    });

    it("returns 400 for an invalid limit", async () => {
        expect((await get(manager, "/api/requests/pending?limit=101")).status).toBe(400);
    });
});


describe("GET /api/users (admin)", () => {
    beforeEach(async () => {
        // 5 users exist from the outer beforeEach; add 22 more
        const password = await bcrypt.hash("Password123", 4);
        await User.insertMany(
            Array.from({ length: 22 }, (_, i) => ({
                name: `Bulk ${String(i).padStart(2, "0")}`,
                email: `bulk${i}@formflow.test`,
                password,
                role: "employee"
            }))
        );
    });

    it("paginates users sorted by name", async () => {
        const first = await get(admin, "/api/users");
        const second = await get(admin, "/api/users?page=2");

        expect(first.body).toMatchObject({ count: 20, total: 27, totalPages: 2 });
        expect(second.body).toMatchObject({ count: 7, page: 2 });

        const names = [...first.body.users, ...second.body.users].map((u) => u.name);
        expect(names).toEqual([...names].sort());
        expect(new Set(names).size).toBe(27);
    });

    it("returns 400 for an invalid page", async () => {
        expect((await get(admin, "/api/users?page=abc")).status).toBe(400);
    });

    it("is still admin only", async () => {
        expect((await get(manager, "/api/users?page=1")).status).toBe(403);
    });
});


describe("GET /api/requests/stats", () => {
    it("returns the user's totals by status regardless of pagination", async () => {
        await insertRequests(employee, workflow, 23);
        await insertRequests(employee, workflow, 4, { status: "approved", currentStep: 2 });
        await insertRequests(employee, workflow, 2, { status: "rejected" });
        await insertRequests(otherEmployee, workflow, 5);

        const res = await get(employee, "/api/requests/stats");

        expect(res.status).toBe(200);
        expect(res.body.stats).toEqual({ total: 29, pending: 23, approved: 4, rejected: 2 });
    });

    it("returns zeros for a user with no requests", async () => {
        const res = await get(otherEmployee, "/api/requests/stats");

        expect(res.body.stats).toEqual({ total: 0, pending: 0, approved: 0, rejected: 0 });
    });

    it("is not mistaken for a request id", async () => {
        expect((await get(employee, "/api/requests/stats")).body).not.toHaveProperty("request");
    });

    it("requires authentication", async () => {
        expect((await request(app).get("/api/requests/stats")).status).toBe(401);
    });
});
