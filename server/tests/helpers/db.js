const { randomUUID } = require("crypto");
const mongoose = require("mongoose");

// Connects to the in-memory MongoDB started by tests/global-setup.js.
// Each connection gets a fresh, uniquely named database, so test files never share data.
const connectTestDB = async () => {
    const uri = process.env.MEMORY_MONGO_URI;

    if (!uri) {
        throw new Error("MEMORY_MONGO_URI is not set. Run the tests with `npm test` so Jest's globalSetup starts the in-memory MongoDB.");
    }

    await mongoose.connect(uri, { dbName: `test_${randomUUID().slice(0, 8)}` });
};

const clearTestDB = async () => {
    const collections = await mongoose.connection.db.collections();
    await Promise.all(collections.map((collection) => collection.deleteMany({})));
};

const disconnectTestDB = async () => {
    await mongoose.connection.db?.dropDatabase();
    await mongoose.disconnect();
};

// Registers the standard lifecycle hooks for an integration test file
const useTestDB = () => {
    beforeAll(connectTestDB);
    beforeEach(clearTestDB);
    afterAll(disconnectTestDB);
};

module.exports = { useTestDB, connectTestDB, clearTestDB, disconnectTestDB };
