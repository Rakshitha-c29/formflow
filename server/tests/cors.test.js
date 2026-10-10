const request = require("supertest");

// app.js reads CLIENT_URL when it is loaded, so each case loads a fresh copy
const loadApp = (clientUrl) => {
    const original = process.env.CLIENT_URL;

    if (clientUrl === undefined) delete process.env.CLIENT_URL;
    else process.env.CLIENT_URL = clientUrl;

    let app;
    jest.isolateModules(() => {
        app = require("../app");
    });

    if (original === undefined) delete process.env.CLIENT_URL;
    else process.env.CLIENT_URL = original;

    return app;
};

const preflight = (app, origin) =>
    request(app)
        .options("/api/auth/login")
        .set("Origin", origin)
        .set("Access-Control-Request-Method", "POST");

describe("CORS origin", () => {
    it("allows the origin configured in CLIENT_URL", async () => {
        const app = loadApp("https://formflow.example.com");

        const res = await preflight(app, "https://formflow.example.com");

        expect(res.headers["access-control-allow-origin"]).toBe("https://formflow.example.com");
    });

    it("does not echo back any other origin", async () => {
        const app = loadApp("https://formflow.example.com");

        const res = await preflight(app, "https://evil.example.com");

        expect(res.headers["access-control-allow-origin"]).not.toBe("https://evil.example.com");
    });

    it("falls back to the Vite dev server when CLIENT_URL is unset", async () => {
        const app = loadApp(undefined);

        const res = await preflight(app, "http://localhost:5173");

        expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    });
});
