/**
 * db.js — Single Turso/libSQL client for all databases.
 * In production: connects to Turso cloud (TURSO_URL + TURSO_AUTH_TOKEN).
 * In development: uses a local SQLite file automatically.
 */
const { createClient } = require("@libsql/client");
const path = require("path");

let client = null;

function getClient() {
  if (client) return client;
  const url = process.env.TURSO_URL || `file:${path.join(__dirname, "data", "local.db")}`;
  const authToken = process.env.TURSO_AUTH_TOKEN || undefined;
  client = createClient({ url, ...(authToken ? { authToken } : {}) });
  return client;
}

/** Fetch all rows */
async function queryAll(sql, args = []) {
  const result = await getClient().execute({ sql, args });
  return result.rows;
}

/** Fetch one row (or null) */
async function queryOne(sql, args = []) {
  const rows = await queryAll(sql, args);
  return rows[0] || null;
}

/** Run INSERT / UPDATE / DELETE */
async function execute(sql, args = []) {
  const result = await getClient().execute({ sql, args });
  return {
    lastInsertRowid: result.lastInsertRowid ? Number(result.lastInsertRowid) : null,
    rowsAffected: result.rowsAffected,
  };
}

/** Run multiple schema statements at startup */
async function initSchema() {
  const c = getClient();
  await c.executeMultiple(`
    CREATE TABLE IF NOT EXISTS tenants (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      subdomain    TEXT UNIQUE NOT NULL,
      cafe_name    TEXT NOT NULL,
      owner_name   TEXT NOT NULL,
      mobile       TEXT NOT NULL,
      email        TEXT DEFAULT '',
      city         TEXT DEFAULT '',
      plan         TEXT DEFAULT 'basic',
      status       TEXT DEFAULT 'trial',
      trial_ends   INTEGER,
      wizard_done  INTEGER DEFAULT 0,
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admins (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS signup_requests (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      cafe_name   TEXT NOT NULL,
      owner_name  TEXT NOT NULL,
      mobile      TEXT NOT NULL,
      email       TEXT DEFAULT '',
      city        TEXT DEFAULT '',
      plan        TEXT DEFAULT 'basic',
      status      TEXT DEFAULT 'pending',
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cafe_info (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id  TEXT NOT NULL,
      cafe_name  TEXT NOT NULL,
      owner_name TEXT NOT NULL,
      mobile     TEXT NOT NULL,
      email      TEXT DEFAULT '',
      city       TEXT DEFAULT '',
      pin        TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS items (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id TEXT NOT NULL,
      name      TEXT NOT NULL,
      price     REAL NOT NULL,
      category  TEXT DEFAULT '',
      image     TEXT DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id    TEXT NOT NULL,
      customerName TEXT NOT NULL,
      tableNo      TEXT DEFAULT '',
      items        TEXT NOT NULL,
      total        REAL NOT NULL,
      paymentMode  TEXT DEFAULT 'cash',
      createdAt    DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS staff (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id TEXT NOT NULL,
      name      TEXT NOT NULL,
      role      TEXT DEFAULT 'Cashier',
      pin       TEXT NOT NULL,
      active    INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS categories (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id TEXT NOT NULL,
      name      TEXT NOT NULL,
      icon      TEXT DEFAULT '🍽️',
      sortOrder INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS business_settings (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id            TEXT NOT NULL,
      currency             TEXT DEFAULT 'INR',
      gstEnabled           INTEGER DEFAULT 1,
      gstPercentage        REAL DEFAULT 5,
      serviceCharge        INTEGER DEFAULT 0,
      serviceChargePercent REAL DEFAULT 10,
      billPrefix           TEXT DEFAULT 'BILL'
    );

    CREATE TABLE IF NOT EXISTS payment_methods (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id TEXT NOT NULL,
      cash      INTEGER DEFAULT 1,
      upi       INTEGER DEFAULT 0,
      upiId     TEXT DEFAULT '',
      card      INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS otps (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id TEXT NOT NULL,
      mobile    TEXT NOT NULL,
      otp       TEXT NOT NULL,
      expiresAt INTEGER NOT NULL
    );
  `);
}

/** Run migrations for columns added after initial schema */
async function runMigrations() {
  // Add wizard_done to tenants if it doesn't exist yet
  try {
    await getClient().execute("ALTER TABLE tenants ADD COLUMN wizard_done INTEGER DEFAULT 0");
  } catch (_) { /* column already exists — safe to ignore */ }
}

module.exports = { getClient, queryAll, queryOne, execute, initSchema, runMigrations };
