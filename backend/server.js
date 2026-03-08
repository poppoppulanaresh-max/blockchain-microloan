```javascript
// backend/server.js

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");

require("dotenv").config();

const authRoutes = require("./routes/auth");
const kycRoutes = require("./routes/kyc");
const loanRoutes = require("./routes/loans");
const milestoneRoutes = require("./routes/milestones");
const repayRoutes = require("./routes/repayments");
const adminRoutes = require("./routes/admin");
const { connectDB } = require("./config/db");

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ─────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true
  })
);
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Routes ─────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/kyc", kycRoutes);
app.use("/api/loans", loanRoutes);
app.use("/api/milestones", milestoneRoutes);
app.use("/api/repayments", repayRoutes);
app.use("/api/admin", adminRoutes);

// ── Health check ───────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString()
  });
});

// ── Error handler ──────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error"
  });
});

// ── Start Server ───────────────────────
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
  });
});

module.exports = app;
```
