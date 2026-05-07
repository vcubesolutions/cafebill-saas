const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

// In production (Render), DB_PATH points to the persistent disk mount.
// In development, defaults to backend/db/data/
const DB_DIR = process.env.DB_PATH || path.join(__dirname, "data");
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const master = new Database(path.join(DB_DIR, "master.db"));
master.pragma("journal_mode = WAL");

// ── Master tables ─────────────────────────────────────────────
master.exec(`
  CREATE TABLE IF NOT EXISTS tenants (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    subdomain    TEXT UNIQUE NOT NULL,
    cafe_name    TEXT NOT NULL,
    owner_name   TEXT NOT NULL,
    mobile       TEXT NOT NULL,
    email        TEXT,
    city         TEXT,
    plan         TEXT DEFAULT 'basic',
    status       TEXT DEFAULT 'trial',
    trial_ends   INTEGER,
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
    email       TEXT,
    city        TEXT,
    plan        TEXT DEFAULT 'basic',
    status      TEXT DEFAULT 'pending',
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed default admin (only if none exists)
const adminExists = master.prepare("SELECT id FROM admins LIMIT 1").get();
if (!adminExists) {
  const pass = process.env.ADMIN_PASSWORD || "cafebill@admin2025";
  master.prepare("INSERT INTO admins (username, password) VALUES (?,?)").run("admin", pass);
  console.log("✅ Default admin created: admin / " + pass);
}

module.exports = master;
