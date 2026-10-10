// Usage: npm run seed
// 1. Migrates legacy role "user" -> "employee"
// 2. Upserts one test account per role (password: TEST_PASSWORD below)
require("dotenv").config({ quiet: true });
require("../config/env")();

const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User.model");
const { ROLE_VALUES } = require("../constants/roles");

const TEST_PASSWORD = "Password123";

const seed = async () => {
    await connectDB();

    // Bypass schema validation: "user" is no longer a valid enum value
    const migrated = await User.collection.updateMany(
        { role: "user" },
        { $set: { role: "employee" } }
    );
    console.log(`Migrated ${migrated.modifiedCount} user(s) from "user" to "employee"`);

    const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 10);

    for (const role of ROLE_VALUES) {
        const email = `${role}@formflow.test`;

        await User.findOneAndUpdate(
            { email },
            {
                name: `Test ${role.charAt(0).toUpperCase()}${role.slice(1)}`,
                email,
                password: hashedPassword,
                role
            },
            { upsert: true, runValidators: true }
        );

        console.log(`Seeded ${email} (${role})`);
    }

    console.log(`All test users use password: ${TEST_PASSWORD}`);
};

seed()
    .catch((error) => {
        console.error("❌ Seed failed");
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
