const { MongoMemoryServer } = require("mongodb-memory-server");

// Starts one in-memory MongoDB for the whole run. Each test file then uses its
// own database on it (see helpers/db.js), so files can run in parallel.
module.exports = async () => {
    const mongod = await MongoMemoryServer.create();

    globalThis.__MONGOD__ = mongod;

    // Read only by tests/helpers/db.js; test files inherit it from this process
    process.env.MEMORY_MONGO_URI = mongod.getUri();
};
