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

app.use("/api/auth", authRoutes);
app.use("/api/workflows", workflowRoutes);
app.use("/api/requests", requestRoutes);

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Welcome to FormFlow API",
    });
});

module.exports = app;