// Runs before each test file (jest "setupFiles")
require("dotenv").config({ quiet: true });

process.env.NODE_ENV = "test";

require("../config/env")();
