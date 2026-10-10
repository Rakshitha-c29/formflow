const { Types } = require("mongoose");
const { canActOnRequest, canViewRequest } = require("../../services/request.service");

const makeUser = (role) => ({ _id: new Types.ObjectId(), role });

const workflow = {
    steps: [
        { stepNumber: 1, name: "Manager review", approverRole: "manager" },
        { stepNumber: 2, name: "HR review", approverRole: "hr" }
    ]
};

const makeRequest = (submitter, overrides = {}) => ({
    submittedBy: submitter._id,
    status: "pending",
    currentStep: 1,
    approvalHistory: [],
    ...overrides
});

describe("canActOnRequest", () => {
    const employee = makeUser("employee");
    const manager = makeUser("manager");
    const hr = makeUser("hr");
    const admin = makeUser("admin");

    it("allows the role assigned to the current step", () => {
        expect(canActOnRequest(manager, makeRequest(employee), workflow)).toEqual({ allowed: true });
    });

    it("follows currentStep to the next step's role", () => {
        const request = makeRequest(employee, { currentStep: 2 });

        expect(canActOnRequest(hr, request, workflow).allowed).toBe(true);
        expect(canActOnRequest(manager, request, workflow).allowed).toBe(false);
    });

    it("rejects a role that belongs to a later step", () => {
        const result = canActOnRequest(hr, makeRequest(employee), workflow);

        expect(result.allowed).toBe(false);
        expect(result.reason).toMatch(/not the approver/);
    });

    it("does not let admin act on another role's step", () => {
        expect(canActOnRequest(admin, makeRequest(employee), workflow).allowed).toBe(false);
    });

    it("blocks self-approval even when the role matches", () => {
        const result = canActOnRequest(manager, makeRequest(manager), workflow);

        expect(result.allowed).toBe(false);
        expect(result.reason).toMatch(/your own request/);
    });

    it("blocks self-approval when submittedBy is populated", () => {
        const request = makeRequest(manager, { submittedBy: { _id: manager._id, name: "M" } });

        expect(canActOnRequest(manager, request, workflow).allowed).toBe(false);
    });

    it.each(["approved", "rejected"])("rejects acting on a %s request", (status) => {
        const result = canActOnRequest(manager, makeRequest(employee, { status }), workflow);

        expect(result.allowed).toBe(false);
        expect(result.reason).toMatch(/already been completed/);
    });

    it("resolves the current step by stepNumber, not array position", () => {
        const unordered = { steps: [...workflow.steps].reverse() };

        expect(canActOnRequest(manager, makeRequest(employee), unordered).allowed).toBe(true);
    });

    it("rejects when the workflow is missing", () => {
        expect(canActOnRequest(manager, makeRequest(employee), null).allowed).toBe(false);
    });
});

describe("canViewRequest", () => {
    const employee = makeUser("employee");
    const otherEmployee = makeUser("employee");
    const manager = makeUser("manager");
    const hr = makeUser("hr");
    const admin = makeUser("admin");

    it("lets the submitter view their request", () => {
        expect(canViewRequest(employee, makeRequest(employee), workflow)).toBe(true);
    });

    it("lets admin view any request", () => {
        expect(canViewRequest(admin, makeRequest(employee), workflow)).toBe(true);
    });

    it("lets the current step's approver view it", () => {
        expect(canViewRequest(manager, makeRequest(employee), workflow)).toBe(true);
    });

    it("lets a past approver view it after it moves on", () => {
        const request = makeRequest(employee, {
            currentStep: 2,
            approvalHistory: [{ stepNumber: 1, action: "approved", actedBy: manager._id }]
        });

        expect(canViewRequest(manager, request, workflow)).toBe(true);
    });

    it("denies another employee", () => {
        expect(canViewRequest(otherEmployee, makeRequest(employee), workflow)).toBe(false);
    });

    it("denies a later step's approver before it reaches them", () => {
        expect(canViewRequest(hr, makeRequest(employee), workflow)).toBe(false);
    });

    it("denies an approver-role user once the request is completed and they never acted", () => {
        const request = makeRequest(employee, { status: "approved", currentStep: 2 });

        expect(canViewRequest(hr, request, workflow)).toBe(false);
    });
});
