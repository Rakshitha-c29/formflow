const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const app = express();

// Behind one reverse proxy (load balancer, PaaS router), take the client IP from
// X-Forwarded-For so rate limiting is per user, not per proxy. Off by default:
// without a proxy in front, clients could spoof that header.
if (process.env.TRUST_PROXY === "true") {
    app.set("trust proxy", 1);
}

// Security headers first, so every response gets them (including CORS preflights and errors)
app.use(helmet());

// Falls back to the Vite dev server so local development needs no extra config
app.use(
    cors({
        origin: process.env.CLIENT_URL || "http://localhost:5173",
    })
);

app.use(express.json());

const authRoutes = require("./routes/auth.routes");
const workflowRoutes = require("./routes/workflow.routes");
const requestRoutes = require("./routes/request.routes");
const userRoutes = require("./routes/user.routes");
const { notFound, errorHandler } = require("./middleware/error.middleware");

app.use("/api/auth", authRoutes);
app.use("/api/workflows", workflowRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/users", userRoutes);

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Welcome to FormFlow API",
    });
});

// Must be registered after all routes
app.use(notFound);
app.use(errorHandler);

module.exports = app;