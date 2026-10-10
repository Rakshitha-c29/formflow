const authorize = require("../../middleware/authorize.middleware");
const AppError = require("../../utils/AppError");

const run = (middleware, user) => {
    const next = jest.fn();
    middleware({ user }, {}, next);
    return next.mock.calls[0][0];
};

describe("authorize middleware", () => {
    it("calls next() with no error when the user has an allowed role", () => {
        expect(run(authorize("admin"), { role: "admin" })).toBeUndefined();
    });

    it("accepts any of several allowed roles", () => {
        expect(run(authorize("manager", "hr"), { role: "hr" })).toBeUndefined();
    });

    it.each(["employee", "manager", "hr"])("rejects role %s from an admin-only route with 403", (role) => {
        const error = run(authorize("admin"), { role });

        expect(error).toBeInstanceOf(AppError);
        expect(error.statusCode).toBe(403);
    });

    it("rejects with 403 when there is no user (protect did not run)", () => {
        expect(run(authorize("admin"), undefined).statusCode).toBe(403);
    });
});
