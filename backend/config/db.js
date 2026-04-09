import pkg from "pg";
const { Pool } = pkg;

let pool;

async function connectDB() {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    await pool.query("SELECT 1");
    console.log("✅ Supabase DB connected");
  } catch (err) {
    console.error("❌ DB error:", err);
  }

  await initSchema();
}

async function initSchema() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        wallet_address VARCHAR(42) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'borrower',
        kyc_status TEXT DEFAULT 'rejected',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("✅ Tables created");
  } catch (err) {
    console.error("❌ Schema error:", err);
  }
}

function getPool() {
  if (!pool) throw new Error("DB not connected");
  return pool;
}

export { connectDB, getPool };