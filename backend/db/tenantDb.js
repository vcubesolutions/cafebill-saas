/**
 * tenantDb.js — Returns a per-tenant SQLite database.
 * Each tenant gets their own .db file in db/data/tenants/
 * Connection is cached so we don't open a new file on every request.
 */
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

// In production (Render), DB_PATH points to the persistent disk mount.
// In development, defaults to backend/db/data/tenants/
const BASE_DIR = process.env.DB_PATH || path.join(__dirname, "data");
const TENANT_DIR = path.join(BASE_DIR, "tenants");
if (!fs.existsSync(TENANT_DIR)) fs.mkdirSync(TENANT_DIR, { recursive: true });

// Connection cache
const connections = {};

function getTenantDb(subdomain) {
  if (connections[subdomain]) return connections[subdomain];

  const dbPath = path.join(TENANT_DIR, `${subdomain}.db`);
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  // ── Initialize tenant schema ──────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS cafe_info (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      cafe_name  TEXT NOT NULL,
      owner_name TEXT NOT NULL,
      mobile     TEXT NOT NULL,
      email      TEXT,
      city       TEXT,
      pin        TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS items (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      name     TEXT NOT NULL,
      price    REAL NOT NULL,
      category TEXT DEFAULT '',
      image    TEXT DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      customerName TEXT NOT NULL,
      tableNo      TEXT DEFAULT '',
      items        TEXT NOT NULL,
      total        REAL NOT NULL,
      paymentMode  TEXT DEFAULT 'cash',
      createdAt    DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS staff (
      id     INTEGER PRIMARY KEY AUTOINCREMENT,
      name   TEXT NOT NULL,
      role   TEXT DEFAULT 'Cashier',
      pin    TEXT NOT NULL,
      active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS categories (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      name      TEXT NOT NULL,
      icon      TEXT DEFAULT '🍽️',
      sortOrder INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS business_settings (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      currency             TEXT DEFAULT 'INR',
      gstEnabled           INTEGER DEFAULT 1,
      gstPercentage        REAL DEFAULT 5,
      serviceCharge        INTEGER DEFAULT 0,
      serviceChargePercent REAL DEFAULT 10,
      billPrefix           TEXT DEFAULT 'BILL'
    );

    CREATE TABLE IF NOT EXISTS payment_methods (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      cash  INTEGER DEFAULT 1,
      upi   INTEGER DEFAULT 0,
      upiId TEXT DEFAULT '',
      card  INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS otps (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      mobile    TEXT NOT NULL,
      otp       TEXT NOT NULL,
      expiresAt INTEGER NOT NULL
    );
  `);

  connections[subdomain] = db;
  return db;
}

function deleteTenantDb(subdomain) {
  if (connections[subdomain]) {
    connections[subdomain].close();
    delete connections[subdomain];
  }
  const dbPath = path.join(TENANT_DIR, `${subdomain}.db`);
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
}

module.exports = { getTenantDb, deleteTenantDb };
