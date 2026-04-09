import jwt from "jsonwebtoken";
import { getPool } from "../config/db.js";

async function protect(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const pool = getPool();
    const result = await pool.query(
      "SELECT id, wallet_address, name, email, role, kyc_status FROM users WHERE id = $1",
      [decoded.id]
    );

    if (!result.rows.length) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user.role}' is not authorized`,
      });
    }
    next();
  };
}

export { protect, authorize };