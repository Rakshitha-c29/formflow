const request = require("supertest");
const app = require("../app");

// Headers helmet sets that matter for a JSON API consumed by a browser SPA
const expectSecurityHeaders = (res) => {
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(res.headers["strict-transport-security"]).toMatch(/max-age=\d+/);
    expect(res.headers["content-security-policy"]).toMatch(/default-src 'self'/);
    expect(res.headers["referrer-policy"]).toBe("no-referrer");
    expect(res.headers["cross-origin-resource-policy"]).toBe("same-origin");
    expect(res.headers["x-powered-by"]).toBeUndefined();
};

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

describe("security headers (helmet)", () => {
    it.each([
        ["a successful response", () => request(app).get("/")],
        ["a 404 from the not-found handler", () => request(app).get("/api/nope")],
        ["a 401 from protect", () => request(app).get("/api/auth/profile")],
        [
            "a 400 for malformed JSON",
            () => request(app).post("/api/auth/login").set("Content-Type", "application/json").send("{bad")
        ]
    ])("are set on %s", async (_, send) => {
        expectSecurityHeaders(await send());
    });

    it("no longer reveal the server framework through X-Powered-By", async () => {
        const res = await request(app).get("/");

        expect(res.headers).not.toHaveProperty("x-powered-by");
    });

    it("are set on CORS preflights, which still succeed for the configured client", async () => {
        const res = await request(app)
            .options("/api/auth/login")
            .set("Origin", CLIENT_URL)
            .set("Access-Control-Request-Method", "POST");

        expect(res.status).toBe(204);
        expect(res.headers["access-control-allow-origin"]).toBe(CLIENT_URL);
        expectSecurityHeaders(res);
    });
});
