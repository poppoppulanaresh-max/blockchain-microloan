import pkg from "pg";
const { Pool } = pkg;

let pool;

async function connectDB() {
  console.log("🔗 Connecting to:", process.env.DATABASE_URL);

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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS kyc_documents (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        business_name VARCHAR(200),
        gst_number VARCHAR(20),
        aadhaar_number VARCHAR(12),
        pan_number VARCHAR(10),
        business_type VARCHAR(100),
        annual_turnover NUMERIC,
        doc_hash TEXT,
        submitted_at TIMESTAMP,
        verified_at TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS loans (
        id SERIAL PRIMARY KEY,
        loan_id_hash TEXT UNIQUE,
        borrower_id INTEGER REFERENCES users(id),
        lender_id INTEGER REFERENCES users(id),
        amount_wei TEXT,
        interest_rate NUMERIC,
        tenure_months INTEGER,
        collateral TEXT,
        purpose TEXT,
        credit_score INTEGER,
        status TEXT DEFAULT 'PENDING',
        tx_hash_credit TEXT,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_at TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS milestones (
        id SERIAL PRIMARY KEY,
        loan_id INTEGER REFERENCES loans(id),
        stage INTEGER,
        pct INTEGER,
        status TEXT DEFAULT 'PENDING',
        proof_hash TEXT,
        bill_description TEXT,
        tx_hash TEXT,
        released_at TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS repayments (
        id SERIAL PRIMARY KEY,
        loan_id INTEGER REFERENCES loans(id),
        installment_no INTEGER,
        due_date TIMESTAMP,
        emi_amount_wei TEXT,
        paid BOOLEAN DEFAULT FALSE,
        amount_wei TEXT,
        tx_hash TEXT,
        paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        loan_id INTEGER REFERENCES loans(id),
        actor_wallet TEXT,
        action TEXT,
        details TEXT,
        tx_hash TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("✅ Tables created");

    // --- lightweight migrations for existing databases ---
    // loans
    await pool.query(`ALTER TABLE loans ADD COLUMN IF NOT EXISTS funded_at TIMESTAMP`);

    // milestones
    await pool.query(`ALTER TABLE milestones ADD COLUMN IF NOT EXISTS bill_description TEXT`);
    await pool.query(`ALTER TABLE milestones ADD COLUMN IF NOT EXISTS tx_hash TEXT`);

    // repayments
    await pool.query(`ALTER TABLE repayments ADD COLUMN IF NOT EXISTS installment_no INTEGER`);
    await pool.query(`ALTER TABLE repayments ADD COLUMN IF NOT EXISTS due_date TIMESTAMP`);
    await pool.query(`ALTER TABLE repayments ADD COLUMN IF NOT EXISTS emi_amount_wei TEXT`);
    await pool.query(`ALTER TABLE repayments ADD COLUMN IF NOT EXISTS paid BOOLEAN DEFAULT FALSE`);
  } catch (err) {
    console.error("❌ Schema error:", err);
  }
}

function getPool() {
  if (!pool) throw new Error("DB not connected");
  return pool;
}

export { connectDB, getPool };