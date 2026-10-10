const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../app");
const User = require("../models/User.model");
const { useTestDB } = require("./helpers/db");
const { createUser, bearer } = require("./helpers/factory");

useTestDB();

const register = (body) => request(app).post("/api/auth/register").send(body);
const login = (body) => request(app).post("/api/auth/login").send(body);
const profile = (authorization) =>
    request(app).get("/api/auth/profile").set("Authorization", authorization);

const base64url = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");


describe("password is never exposed", () => {
    it("is omitted from the register response", async () => {
        const res = await register({ name: "Ana", email: "ana@formflow.test", password: "Password123" });

        expect(res.status).toBe(201);
        expect(res.body.user.password).toBeUndefined();
    });

    it("is excluded from queries by default and only loaded with +password", async () => {
        const user = await createUser("employee");

        expect((await User.findById(user._id)).password).toBeUndefined();
        expect((await User.findById(user._id).select("+password")).password).toMatch(/^\$2[aby]\$/);
    });

    it("is omitted from the profile returned by protect", async () => {
        const user = await createUser("employee");

        const res = await profile(bearer(user));

        expect(res.status).toBe(200);
        expect(res.body.user.password).toBeUndefined();
    });
});


describe("login with select: false on password", () => {
    it("still verifies the password and returns a token", async () => {
        const user = await createUser("employee");

        const res = await login({ email: user.email, password: "Password123" });

        expect(res.status).toBe(200);
        expect(res.body.token).toEqual(expect.any(String));
        expect(res.body.user.password).toBeUndefined();
    });

    it("rejects a wrong password with 401", async () => {
        const user = await createUser("employee");

        expect((await login({ email: user.email, password: "wrong-password" })).status).toBe(401);
    });
});


describe("JWT signing and verification", () => {
    let user;
    const originalExpiry = process.env.JWT_EXPIRES_IN;

    beforeEach(async () => {
        user = await createUser("employee");
    });

    afterEach(() => {
        if (originalExpiry === undefined) delete process.env.JWT_EXPIRES_IN;
        else process.env.JWT_EXPIRES_IN = originalExpiry;
    });

    it("signs tokens with HS256", async () => {
        const res = await login({ email: user.email, password: "Password123" });

        expect(jwt.decode(res.body.token, { complete: true }).header.alg).toBe("HS256");
    });

    it("defaults to a 1 day expiry when JWT_EXPIRES_IN is unset", async () => {
        delete process.env.JWT_EXPIRES_IN;

        const res = await login({ email: user.email, password: "Password123" });
        const { iat, exp } = jwt.decode(res.body.token);

        expect(exp - iat).toBe(24 * 60 * 60);
    });

    it("accepts a valid HS256 token", async () => {
        expect((await profile(bearer(user))).status).toBe(200);
    });

    it("rejects a token signed with a different algorithm, even with the right secret", async () => {
        const hs512 = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { algorithm: "HS512" });

        const res = await profile(`Bearer ${hs512}`);

        expect(res.status).toBe(401);
        expect(res.body.message).toBe("Invalid token");
    });

    it("rejects an unsigned token with alg none", async () => {
        const unsigned = `${base64url({ alg: "none", typ: "JWT" })}.${base64url({ id: user.id, role: "admin" })}.`;

        expect((await profile(`Bearer ${unsigned}`)).status).toBe(401);
    });

    it("rejects an expired token", async () => {
        const expired = jwt.sign(
            { id: user._id, role: user.role, exp: Math.floor(Date.now() / 1000) - 10 },
            process.env.JWT_SECRET
        );

        const res = await profile(`Bearer ${expired}`);

        expect(res.status).toBe(401);
        expect(res.body.message).toBe("Token expired");
    });
});


describe("errors array on validation failures", () => {
    it("lists each failed field from request validation, with message as the joined text", async () => {
        const res = await register({});

        expect(res.status).toBe(400);
        expect(res.body.errors).toEqual([
            "Name is required",
            "Email is required",
            "Password must be at least 6 characters"
        ]);
        expect(res.body.message).toBe(res.body.errors.join(", "));
    });

    it("lists each failed field from Mongoose schema validation", async () => {
        const admin = await createUser("admin");

        const res = await request(app)
            .post("/api/workflows")
            .set("Authorization", bearer(admin))
            .send({ steps: [{ stepNumber: 1, name: "S", approverRole: "boss" }] });

        expect(res.status).toBe(400);
        expect(res.body.errors).toHaveLength(2);
        expect(res.body.errors.join(" ")).toMatch(/name/);
        expect(res.body.errors.join(" ")).toMatch(/approverRole/);
    });

    it.each([
        ["401", () => profile("Bearer junk")],
        ["404", () => request(app).get("/api/nope")],
        ["400 malformed JSON", () => request(app).post("/api/auth/login").set("Content-Type", "application/json").send("{bad")]
    ])("is omitted from non-validation errors (%s)", async (_, send) => {
        const res = await send();

        expect(res.body.success).toBe(false);
        expect(res.body).not.toHaveProperty("errors");
    });
});


describe("duplicate email", () => {
    it("returns 409 regardless of email case", async () => {
        await register({ name: "Ana", email: "ana@formflow.test", password: "Password123" });

        const res = await register({ name: "Ana", email: "ANA@formflow.test", password: "Password123" });

        expect(res.status).toBe(409);
    });
});
