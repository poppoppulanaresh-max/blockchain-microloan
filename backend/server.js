import express from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import dotenv from "dotenv";

dotenv.config();

// Routes
import authRoutes from "./routes/auth.js";
import kycRoutes from "./routes/kyc.js";
import loanRoutes from "./routes/loans.js";
import milestoneRoutes from "./routes/milestones.js";
import repayRoutes from "./routes/repayments.js";
import adminRoutes from "./routes/admin.js";

// DB
import { connectDB } from "./config/db.js";

const app = express();
const PORT = process.env.PORT || 10000;

/* =========================
   MIDDLEWARE
========================= */

// Security headers
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: function (origin, callback) {
      const allowedOrigins = [
        "http://localhost:3000",
        process.env.FRONTEND_URL,
      ];

      if (
        !origin || // allow Postman / curl
        allowedOrigins.includes(origin) ||
        /\.vercel\.app$/.test(origin)
      ) {
        callback(null, true);
      } else {
        console.error("❌ CORS blocked:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// Logging
app.use(morgan("dev"));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================
   ROUTES
========================= */

// Root route (fixes 404 on Render homepage)
app.get("/", (req, res) => {
  res.send("🚀 Blockchain Microloan API is running");
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/kyc", kycRoutes);
app.use("/api/loans", loanRoutes);
app.use("/api/milestones", milestoneRoutes);
app.use("/api/repayments", repayRoutes);
app.use("/api/admin", adminRoutes);

/* =========================
   404 HANDLER
========================= */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`,
  });
});

/* =========================
   GLOBAL ERROR HANDLER
========================= */
app.use((err, req, res, next) => {
  console.error("🔥 ERROR:", err.message);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

/* =========================
   START SERVER
========================= */
const startServer = async () => {
  try {
    await connectDB();
    console.log("✅ Database connected");

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err.message);
    process.exit(1);
  }
};

startServer();

export default app;