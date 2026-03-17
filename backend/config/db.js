// backend/config/db.js
const mysql = require("mysql2/promise");

let pool;

async function connectDB() {
  pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "microloan_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

  // Test connection
  const conn = await pool.getConnection();
  console.log("✅ MySQL connected");
  console.log("DB HOST =", process.env.DB_HOST);
  conn.release();

  // Initialize schema
  await initSchema();
}

async function initSchema() {
  const conn = await pool.getConnection();
  try {
    // ── Users table ─────────────────────────────────
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        wallet_address VARCHAR(42)  NOT NULL UNIQUE,
        name          VARCHAR(100) NOT NULL,
        email         VARCHAR(100) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role          ENUM('borrower','lender','admin','auditor','government') DEFAULT 'borrower',
        kyc_status    ENUM('pending','verified','rejected') DEFAULT 'rejected',
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Backward‑compatible migration:
    // - fix wrong default kyc_status ('pending' made new users look "under review" before submission)
    try {
      await conn.execute(`
        ALTER TABLE users
        MODIFY COLUMN kyc_status ENUM('pending','verified','rejected') DEFAULT 'rejected'
      `);
    } catch (e) {
      // ignore if not supported by provider / already correct
    }

    // ── KYC Documents (off-chain sensitive data) ────
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS kyc_documents (
        id             INT AUTO_INCREMENT PRIMARY KEY,
        user_id        INT NOT NULL,
        business_name  VARCHAR(200),
        gst_number     VARCHAR(20),
        aadhaar_number VARCHAR(20),
        pan_number     VARCHAR(20),
        business_type  VARCHAR(100),
        annual_turnover DECIMAL(15,2),
        doc_hash        TEXT  NOT NULL COMMENT 'SHA-256 hash stored on blockchain',
        submitted_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        verified_at    TIMESTAMP NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // ── Loan Applications (metadata) ───────────────
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS loans (
        id                 INT AUTO_INCREMENT PRIMARY KEY,
        loan_id_hash       VARCHAR(66)  NOT NULL UNIQUE COMMENT 'bytes32 on blockchain',
        borrower_id        INT NOT NULL,
        lender_id          INT,
        amount_wei         VARCHAR(40)  NOT NULL COMMENT 'stored as string to avoid overflow',
        interest_rate      INT          NOT NULL COMMENT 'rate * 100',
        tenure_months      INT          NOT NULL,
        collateral         TEXT,
        status             ENUM('PENDING','APPROVED','REJECTED','ACTIVE','COMPLETED','DEFAULTED') DEFAULT 'PENDING',
        credit_score       INT          DEFAULT 0,
        applied_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_at        TIMESTAMP NULL,
        completed_at       TIMESTAMP NULL,
        tx_hash_created    VARCHAR(66),
        tx_hash_approved   VARCHAR(66),
        tx_hash_rejected   VARCHAR(66),
        reject_reason      TEXT,
        FOREIGN KEY (borrower_id) REFERENCES users(id),
        FOREIGN KEY (lender_id)   REFERENCES users(id)
      )
    `);

    // Backward‑compatible migration: add "purpose" column if missing
    try {
      await conn.execute(`
        ALTER TABLE loans
        ADD COLUMN purpose VARCHAR(255) NULL AFTER collateral
      `);
    } catch (e) {
      // Ignore "duplicate column" error when purpose already exists
      if (e && e.code !== "ER_DUP_FIELDNAME") {
        throw e;
      }
    }

    // ── Milestones ─────────────────────────────────
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS milestones (
        id               INT AUTO_INCREMENT PRIMARY KEY,
        loan_id          INT          NOT NULL,
        stage            INT          NOT NULL COMMENT '1-4',
        pct              INT          NOT NULL COMMENT '20,30,30,20',
        proof_hash       VARCHAR(66)  COMMENT 'IPFS hash or document hash',
        bill_description TEXT,
        status           ENUM('PENDING','SUBMITTED','RELEASED') DEFAULT 'PENDING',
        submitted_at     TIMESTAMP NULL,
        released_at      TIMESTAMP NULL,
        amount_released  VARCHAR(40),
        tx_hash          VARCHAR(66),
        FOREIGN KEY (loan_id) REFERENCES loans(id)
      )
    `);

    // Backward‑compatible migration for older schemas:
    // - add pct column if missing
    // - if legacy release_percent exists, copy values into pct
    try {
      await conn.execute(`ALTER TABLE milestones ADD COLUMN pct INT NULL AFTER stage`);
    } catch (e) {
      if (!e || e.code !== "ER_DUP_FIELDNAME") throw e;
    }
    try {
      // If legacy column exists, copy its values into pct where pct is null
      await conn.execute(`
        UPDATE milestones
        SET pct = release_percent
        WHERE pct IS NULL
      `);
    } catch (_) {
      // Ignore if legacy column doesn't exist
    }
    // Ensure pct is non-null for new rows
    await conn.execute(`UPDATE milestones SET pct = 0 WHERE pct IS NULL`);

    // ── Repayment Schedule ──────────────────────────
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS repayments (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        loan_id         INT          NOT NULL,
        installment_no  INT          NOT NULL,
        emi_amount_wei  VARCHAR(40)  NOT NULL,
        due_date        TIMESTAMP    NOT NULL,
        paid            BOOLEAN      DEFAULT FALSE,
        paid_at         TIMESTAMP NULL,
        penalty_wei     VARCHAR(40)  DEFAULT '0',
        tx_hash         VARCHAR(66),
        FOREIGN KEY (loan_id) REFERENCES loans(id)
      )
    `);

    // ── Audit Logs ─────────────────────────────────
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        loan_id      INT,
        actor_wallet VARCHAR(42),
        action       VARCHAR(100) NOT NULL,
        details      JSON,
        tx_hash      VARCHAR(66),
        block_number INT,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (loan_id) REFERENCES loans(id)
      )
    `);

    console.log("✅ Database schema initialized");
  } finally {
    conn.release();
  }
}

function getPool() {
  if (!pool) throw new Error("DB not connected. Call connectDB() first.");
  return pool;
}

module.exports = { connectDB, getPool };
