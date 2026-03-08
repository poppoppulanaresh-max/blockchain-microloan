```javascript
// backend/server.js

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// Route imports
const authRoutes = require("./routes/auth");
const kycRoutes = require("./routes/kyc");
const loanRoutes = require("./routes/loans");
const milestoneRoutes = require("./routes/milestones");
const repayRoutes = require("./routes/repayments");
const adminRoutes = require("./routes/admin");

// DB connection
const { connectDB } = require("./config/db");

const app = express();
const PORT = process.env.PORT || 5000;

// ─────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────
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

// ─────────────────────────────────────────
// Root Route (prevents Render 404)
// ─────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    name: "Blockchain Microloan API",
    status: "running",
    version: "1.0",
    endpoints: {
      health: "/api/health",
      auth: "/api/auth",
      kyc: "/api/kyc",
      loans: "/api/loans",
      milestones: "/api/milestones",
      repayments: "/api/repayments",
      admin: "/api/admin"
    }
  });
});

// ─────────────────────────────────────────
// API Routes
// ─────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/kyc", kycRoutes);
app.use("/api/loans", loanRoutes);
app.use("/api/milestones", milestoneRoutes);
app.use("/api/repayments", repayRoutes);
app.use("/api/admin", adminRoutes);

// ─────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString()
  });
});

// ─────────────────────────────────────────
// 404 Handler
// ─────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
});

// ─────────────────────────────────────────
// Global Error Handler
// ─────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.stack);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error"
  });
});

// ─────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────
const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 API URL: http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
```

