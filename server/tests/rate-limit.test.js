const request = require("supertest");
const { MAX_ATTEMPTS } = require("../middleware/rateLimit.middleware");

// Limiter counters live in memory per app instance, so tests load a fresh app.
// app.js reads TRUST_PROXY at load time, so it is set before loading.
const loadApp = ({ trustProxy = false } = {}) => {
    if (trustProxy) process.env.TRUST_PROXY = "true";

    let app;
    jest.isolateModules(() => {
        app = require("../app");
    });

    delete process.env.TRUST_PROXY;
    return app;
};

// Empty bodies fail validation (400) after the limiter runs, so no database is needed
const attempt = (app, path, ip) => {
    const req = request(app).post(`/api/auth/${path}`);
    if (ip) req.set("X-Forwarded-For", ip);
    return req.send({});
};

const attemptTimes = async (app, path, times, ip) => {
    const statuses = [];
    for (let i = 0; i < times; i++) {
        statuses.push((await attempt(app, path, ip)).status);
    }
    return statuses;
};

describe("auth rate limiting", () => {
    afterEach(() => {
        delete process.env.RATE_LIMIT_IN_TESTS;
    });

    describe("when enabled", () => {
        beforeEach(() => {
            process.env.RATE_LIMIT_IN_TESTS = "true";
        });

        it(`allows ${MAX_ATTEMPTS} failed logins, then returns 429 in the standard error format`, async () => {
            const app = loadApp();

            const statuses = await attemptTimes(app, "login", MAX_ATTEMPTS);
            expect(statuses.every((status) => status === 400)).toBe(true);

            const blocked = await attempt(app, "login");

            expect(blocked.status).toBe(429);
            expect(blocked.body).toEqual({
                success: false,
                message: "Too many attempts. Please try again in 15 minutes."
            });
            expect(blocked.headers["retry-after"]).toBeDefined();
            expect(blocked.headers.ratelimit).toBeDefined();
        });

        it("limits failed registrations the same way", async () => {
            const app = loadApp();

            await attemptTimes(app, "register", MAX_ATTEMPTS);

            expect((await attempt(app, "register")).status).toBe(429);
        });

        it("counts login and register separately", async () => {
            const app = loadApp();

            await attemptTimes(app, "login", MAX_ATTEMPTS + 1);

            expect((await attempt(app, "register")).status).toBe(400);
        });

        it("does not limit other routes", async () => {
            const app = loadApp();

            await attemptTimes(app, "login", MAX_ATTEMPTS + 1);

            expect((await request(app).get("/")).status).toBe(200);
        });

        describe("successful attempts (uses the test database)", () => {
            // The app, its models and the DB helper must come from the same isolated
            // module registry, so they share one connected mongoose instance
            let app, db, factory;

            beforeAll(async () => {
                jest.isolateModules(() => {
                    app = require("../app");
                    db = require("./helpers/db");
                    factory = require("./helpers/factory");
                });
                await db.connectTestDB();
                await db.clearTestDB();
            });

            afterAll(() => db.disconnectTestDB());

            it("login counts only failures: successful logins never use up the limit", async () => {
                const user = await factory.createUser("employee");
                const login = (password) =>
                    request(app).post("/api/auth/login").send({ email: user.email, password });

                for (let i = 0; i < MAX_ATTEMPTS + 5; i++) {
                    expect((await login("Password123")).status).toBe(200);
                }

                for (let i = 0; i < MAX_ATTEMPTS; i++) {
                    expect((await login("wrong-password")).status).toBe(401);
                }

                expect((await login("wrong-password")).status).toBe(429);
                // Once limited, even the right password is refused until the window resets
                expect((await login("Password123")).status).toBe(429);
            });

            it("register counts every attempt, including successful ones", async () => {
                const register = (n) =>
                    request(app)
                        .post("/api/auth/register")
                        .send({ name: "New user", email: `new${n}@formflow.test`, password: "Password123" });

                for (let i = 0; i < MAX_ATTEMPTS; i++) {
                    expect((await register(i)).status).toBe(201);
                }

                expect((await register(MAX_ATTEMPTS)).status).toBe(429);
            });
        });

        describe("behind a proxy (TRUST_PROXY)", () => {
            it("with TRUST_PROXY=true, limits each client IP from X-Forwarded-For separately", async () => {
                const app = loadApp({ trustProxy: true });

                await attemptTimes(app, "login", MAX_ATTEMPTS, "203.0.113.1");

                expect((await attempt(app, "login", "203.0.113.1")).status).toBe(429);
                expect((await attempt(app, "login", "203.0.113.2")).status).toBe(400);
            });

            it("by default, ignores X-Forwarded-For so clients cannot dodge the limit by spoofing it", async () => {
                // express-rate-limit logs a configuration warning when it sees the header without trust proxy
                jest.spyOn(console, "error").mockImplementation(() => {});
                const app = loadApp();

                await attemptTimes(app, "login", MAX_ATTEMPTS, "203.0.113.1");

                expect((await attempt(app, "login", "203.0.113.2")).status).toBe(429);
                console.error.mockRestore();
            });
        });
    });

    it("is off in the test environment unless explicitly enabled", async () => {
        const app = loadApp();

        const statuses = await attemptTimes(app, "login", MAX_ATTEMPTS + 5);

        expect(statuses).not.toContain(429);
    });
});
