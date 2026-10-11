// Runs before each test file (jest "setupFiles").
// Tests are self-contained: they never read .env or reach an external database.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret";

// The in-memory server's address satisfies the startup env check; tests connect
// through tests/helpers/db.js, never through config/db.js
process.env.MONGO_URI = process.env.MEMORY_MONGO_URI;

// Use the app's defaults regardless of the developer's shell environment
for (const name of ["CLIENT_URL", "JWT_EXPIRES_IN", "TRUST_PROXY", "RATE_LIMIT_IN_TESTS"]) {
    delete process.env[name];
}

require("../config/env")();
