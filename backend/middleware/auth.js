// backend/middleware/auth.js
const jwt  = require("jsonwebtoken");
const { getPool } = require("../config/db");

/**
 * Verify JWT and attach user to req.user
 */
async function protect(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const token   = header.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const pool = getPool();
    const [rows] = await pool.execute(
      "SELECT id, wallet_address, name, email, role, kyc_status FROM users WHERE id = ?",
      [decoded.id]
    );

    if (!rows.length) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    req.user = rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
}

/**
 * Role-based guard
 * Usage: authorize("admin"), authorize("lender","admin")
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user.role}' is not authorized`
      });
    }
    next();
  };
}

module.exports = { protect, authorize };
