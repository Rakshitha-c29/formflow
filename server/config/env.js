// Fail fast at startup instead of crashing on the first request that needs a missing variable
const REQUIRED_ENV_VARS = ["MONGO_URI", "JWT_SECRET"];

const validateEnv = () => {
    const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]?.trim());

    if (missing.length > 0) {
        console.error(`❌ Missing required environment variables: ${missing.join(", ")}`);
        process.exit(1);
    }
};

module.exports = validateEnv;
