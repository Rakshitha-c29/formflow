const dns = require("dns");
dns.setServers(["1.1.1.1","8.8.8.8"]);
const mongoose = require("mongoose");
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        console.log("✅ MongoDB Connected Successfully");
    } catch (error) {
        console.error("❌ Database connection failed");
        console.error(error);

        process.exit(1);
    }
};

module.exports = connectDB;