/**
 * tenant.js — Resolves the current tenant from the request.
 *
 * Resolution order:
 *   1. Subdomain in hostname  (mycafe.cafebill.in  → "mycafe")
 *   2. X-Tenant-ID header     (for dev/testing)
 *   3. ?tenant= query param   (for dev/testing)
 *
 * Attaches req.tenant (master row) and req.tenantDb (SQLite DB)
 */
const masterDb = require("../db/masterDb");
const { getTenantDb } = require("../db/tenantDb");

const RESERVED = new Set(["admin", "www", "api", "app", "landing", "static"]);

module.exports = function tenantMiddleware(req, res, next) {
  // ── Derive subdomain ──────────────────────────────────────
  let subdomain =
    req.headers["x-tenant-id"] ||          // dev override
    req.query.tenant ||                     // dev override
    extractSubdomain(req.hostname);         // production

  if (!subdomain || RESERVED.has(subdomain)) return next();

  // ── Look up tenant in master DB ───────────────────────────
  const tenant = masterDb
    .prepare("SELECT * FROM tenants WHERE subdomain = ?")
    .get(subdomain);

  if (!tenant) {
    return res.status(404).json({ error: "Cafe not found. Please check your URL." });
  }

  if (tenant.status === "suspended") {
    return res.status(403).json({ error: "This account has been suspended. Please contact support." });
  }

  // ── Check trial expiry ────────────────────────────────────
  if (tenant.status === "trial" && tenant.trial_ends && Date.now() > tenant.trial_ends) {
    masterDb.prepare("UPDATE tenants SET status = 'expired' WHERE id = ?").run(tenant.id);
    return res.status(402).json({ error: "Your free trial has expired. Please upgrade your plan." });
  }

  req.tenant   = tenant;
  req.tenantDb = getTenantDb(subdomain);
  next();
};

function extractSubdomain(hostname) {
  if (!hostname) return null;
  // Strip port
  const host = hostname.split(":")[0];
  const parts = host.split(".");
  // e.g. mycafe.cafebill.in → ["mycafe","cafebill","in"] → parts[0]
  // e.g. mycafe.localhost   → ["mycafe","localhost"]       → parts[0]
  if (parts.length >= 2 && parts[0] !== "localhost") {
    return parts[0];
  }
  return null;
}
