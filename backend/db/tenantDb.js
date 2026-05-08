/**
 * tenantDb.js — Async helpers for tenant-scoped DB operations.
 * All queries automatically filter by tenant_id.
 */
const { queryAll, queryOne, execute } = require("./db");

/** Fetch all rows for a tenant */
async function tenantQueryAll(sql, tenantId, args = []) {
  return queryAll(sql, [tenantId, ...args]);
}

/** Fetch one row for a tenant */
async function tenantQueryOne(sql, tenantId, args = []) {
  return queryOne(sql, [tenantId, ...args]);
}

/** Run INSERT/UPDATE/DELETE for a tenant */
async function tenantExecute(sql, tenantId, args = []) {
  return execute(sql, [tenantId, ...args]);
}

/** Create initial cafe_info record when a new tenant is activated */
async function initTenant(tenantId, cafeName, ownerName, mobile, email, city) {
  await execute("DELETE FROM cafe_info WHERE tenant_id=?", [tenantId]);
  await execute(
    "INSERT INTO cafe_info (tenant_id, cafe_name, owner_name, mobile, email, city) VALUES (?,?,?,?,?,?)",
    [tenantId, cafeName, ownerName, mobile, email || "", city || ""]
  );
}

/** Delete all data for a tenant (when deleting a tenant) */
async function deleteTenantData(tenantId) {
  const tables = ["cafe_info","items","orders","staff","categories",
                  "business_settings","payment_methods","otps"];
  for (const t of tables) {
    await execute(`DELETE FROM ${t} WHERE tenant_id=?`, [tenantId]);
  }
}

module.exports = { tenantQueryAll, tenantQueryOne, tenantExecute, initTenant, deleteTenantData };
