const { Types } = require("mongoose");
const {
    snapshotSteps,
    getCurrentStep,
    getNextStep,
    getTransition,
    canActOnRequest,
    canViewRequest
} = require("../../services/request.service");

const makeUser = (role) => ({ _id: new Types.ObjectId(), role });

const TWO_STEPS = [
    { stepNumber: 1, name: "Manager review", approverRole: "manager" },
    { stepNumber: 2, name: "HR review", approverRole: "hr" }
];

// Non-consecutive and stored out of order, to prove nothing relies on array position
const GAPPED_STEPS = [
    { stepNumber: 30, name: "Admin sign-off", approverRole: "admin" },
    { stepNumber: 10, name: "Manager review", approverRole: "manager" },
    { stepNumber: 20, name: "HR review", approverRole: "hr" }
];

const makeRequest = (submitter, overrides = {}) => ({
    submittedBy: submitter._id,
    status: "pending",
    steps: TWO_STEPS,
    currentStep: 1,
    approvalHistory: [],
    ...overrides
});


describe("snapshotSteps", () => {
    it("copies only stepNumber, name and approverRole, sorted by stepNumber", () => {
        const workflow = {
            steps: GAPPED_STEPS.map((step) => ({ ...step, _id: new Types.ObjectId() }))
        };

        expect(snapshotSteps(workflow)).toEqual([
            { stepNumber: 10, name: "Manager review", approverRole: "manager" },
            { stepNumber: 20, name: "HR review", approverRole: "hr" },
            { stepNumber: 30, name: "Admin sign-off", approverRole: "admin" }
        ]);
    });

    it("returns a copy that does not change when the workflow does", () => {
        const workflow = { steps: TWO_STEPS.map((step) => ({ ...step })) };
        const snapshot = snapshotSteps(workflow);

        workflow.steps[0].approverRole = "hr";

        expect(snapshot[0].approverRole).toBe("manager");
    });
});


describe("step navigation by stepNumber", () => {
    const employee = makeUser("employee");

    it("finds the current step by stepNumber, not array position", () => {
        const request = makeRequest(employee, { steps: GAPPED_STEPS, currentStep: 20 });

        expect(getCurrentStep(request).name).toBe("HR review");
    });

    it("returns no current step when currentStep matches no stepNumber", () => {
        expect(getCurrentStep(makeRequest(employee, { steps: GAPPED_STEPS, currentStep: 2 }))).toBeUndefined();
    });

    it.each([
        [10, 20],
        [20, 30],
        [30, undefined]
    ])("after step %i the next step is %s", (current, expected) => {
        const request = makeRequest(employee, { steps: GAPPED_STEPS, currentStep: current });

        expect(getNextStep(request)?.stepNumber).toBe(expected);
    });
});


describe("getTransition", () => {
    const employee = makeUser("employee");

    it("approving a middle step moves to the next stepNumber and stays pending", () => {
        const request = makeRequest(employee, { steps: GAPPED_STEPS, currentStep: 10 });

        expect(getTransition(request, "approved")).toEqual({ status: "pending", currentStep: 20 });
    });

    it("approving the final step marks the request approved", () => {
        const request = makeRequest(employee, { steps: GAPPED_STEPS, currentStep: 30 });

        expect(getTransition(request, "approved")).toEqual({ status: "approved", currentStep: 30 });
    });

    it.each([10, 20, 30])("rejecting at step %i ends the request there", (current) => {
        const request = makeRequest(employee, { steps: GAPPED_STEPS, currentStep: current });

        expect(getTransition(request, "rejected")).toEqual({ status: "rejected", currentStep: current });
    });

    it("a single-step request is approved by one approval", () => {
        const request = makeRequest(employee, { steps: [TWO_STEPS[0]] });

        expect(getTransition(request, "approved").status).toBe("approved");
    });
});


describe("canActOnRequest", () => {
    const employee = makeUser("employee");
    const manager = makeUser("manager");
    const hr = makeUser("hr");
    const admin = makeUser("admin");

    it("allows the role assigned to the current step", () => {
        expect(canActOnRequest(manager, makeRequest(employee))).toEqual({ allowed: true });
    });

    it("follows currentStep to the next step's role", () => {
        const request = makeRequest(employee, { currentStep: 2 });

        expect(canActOnRequest(hr, request).allowed).toBe(true);
        expect(canActOnRequest(manager, request).allowed).toBe(false);
    });

    it("rejects a role that belongs to a later step", () => {
        const result = canActOnRequest(hr, makeRequest(employee));

        expect(result.allowed).toBe(false);
        expect(result.reason).toMatch(/not the approver/);
    });

    it("does not let admin act on another role's step", () => {
        expect(canActOnRequest(admin, makeRequest(employee)).allowed).toBe(false);
    });

    it("blocks self-approval even when the role matches", () => {
        const result = canActOnRequest(manager, makeRequest(manager));

        expect(result.allowed).toBe(false);
        expect(result.reason).toMatch(/your own request/);
    });

    it("blocks self-approval when submittedBy is populated", () => {
        const request = makeRequest(manager, { submittedBy: { _id: manager._id, name: "M" } });

        expect(canActOnRequest(manager, request).allowed).toBe(false);
    });

    it.each(["approved", "rejected"])("rejects acting on a %s request", (status) => {
        const result = canActOnRequest(manager, makeRequest(employee, { status }));

        expect(result.allowed).toBe(false);
        expect(result.reason).toMatch(/already been completed/);
    });

    it("uses the request's snapshot with non-consecutive stepNumbers", () => {
        const request = makeRequest(employee, { steps: GAPPED_STEPS, currentStep: 20 });

        expect(canActOnRequest(hr, request).allowed).toBe(true);
        expect(canActOnRequest(manager, request).allowed).toBe(false);
    });

    it("lets nobody act when currentStep matches no step", () => {
        const request = makeRequest(employee, { currentStep: 7 });

        for (const user of [manager, hr, admin]) {
            expect(canActOnRequest(user, request).allowed).toBe(false);
        }
    });

    it("lets nobody act on a request without a steps snapshot", () => {
        expect(canActOnRequest(manager, makeRequest(employee, { steps: undefined })).allowed).toBe(false);
    });
});


describe("canViewRequest", () => {
    const employee = makeUser("employee");
    const otherEmployee = makeUser("employee");
    const manager = makeUser("manager");
    const hr = makeUser("hr");
    const admin = makeUser("admin");

    it("lets the submitter view their request", () => {
        expect(canViewRequest(employee, makeRequest(employee))).toBe(true);
    });

    it("lets admin view any request", () => {
        expect(canViewRequest(admin, makeRequest(employee))).toBe(true);
    });

    it("lets the current step's approver view it", () => {
        expect(canViewRequest(manager, makeRequest(employee))).toBe(true);
    });

    it("lets a past approver view it after it moves on", () => {
        const request = makeRequest(employee, {
            currentStep: 2,
            approvalHistory: [{ stepNumber: 1, action: "approved", actedBy: manager._id }]
        });

        expect(canViewRequest(manager, request)).toBe(true);
    });

    it("denies another employee", () => {
        expect(canViewRequest(otherEmployee, makeRequest(employee))).toBe(false);
    });

    it("denies a later step's approver before it reaches them", () => {
        expect(canViewRequest(hr, makeRequest(employee))).toBe(false);
    });

    it("denies an approver-role user once the request is completed and they never acted", () => {
        const request = makeRequest(employee, { status: "approved", currentStep: 2 });

        expect(canViewRequest(hr, request)).toBe(false);
    });
});
