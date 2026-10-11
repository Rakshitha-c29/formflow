const dns = require("dns");
const mongoose = require("mongoose");

// Same resolver workaround as config/db.js
dns.setServers(["1.1.1.1", "8.8.8.8"]);

// Tests wipe every collection, so they must never touch the dev database.
// The dev MONGO_URI has no db name, which means MongoDB's default "test" db holds dev data.
const TEST_DB_NAME = process.env.MONGO_TEST_DB || "formflow_test";

const connectTestDB = async () => {
    if (!TEST_DB_NAME.endsWith("_test")) {
        throw new Error(`Refusing to run tests against "${TEST_DB_NAME}": name must end with "_test"`);
    }

    await mongoose.connect(process.env.MONGO_TEST_URI || process.env.MONGO_URI, {
        dbName: TEST_DB_NAME
    });

    if (mongoose.connection.db.databaseName !== TEST_DB_NAME) {
        throw new Error(`Connected to "${mongoose.connection.db.databaseName}", expected "${TEST_DB_NAME}"`);
    }
};

const clearTestDB = async () => {
    const collections = await mongoose.connection.db.collections();
    await Promise.all(collections.map((collection) => collection.deleteMany({})));
};

const disconnectTestDB = () => mongoose.disconnect();

// Registers the standard lifecycle hooks for an integration test file
const useTestDB = () => {
    beforeAll(connectTestDB);
    beforeEach(clearTestDB);
    afterAll(disconnectTestDB);
};

module.exports = { useTestDB, connectTestDB, clearTestDB, disconnectTestDB };
