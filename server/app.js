const express = require("express");
const cors = require("cors");

const app = express();

app.use(
    cors({
        origin: "http://localhost:5173",
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