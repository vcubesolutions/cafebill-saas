/**
 * masterDb.js — Async helpers for master-level DB operations.
 * Uses the shared Turso client from db.js.
 */
const { queryAll, queryOne, execute } = require("./db");

async function seedAdmin() {
  const existing = await queryOne("SELECT id FROM admins LIMIT 1");
  if (!existing) {
    const pass = process.env.ADMIN_PASSWORD || "cafebill@admin2025";
    await execute("INSERT INTO admins (username, password) VALUES (?,?)", ["admin", pass]);
    console.log("✅ Default admin created: admin / " + pass);
  }
}

module.exports = { seedAdmin, queryAll, queryOne, execute };
