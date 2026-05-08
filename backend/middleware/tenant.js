/**
 * tenant.js — Resolves the current tenant from the request (async).
 * Attaches req.tenant (master row) and req.tenantId (subdomain string).
 */
const { queryOne, execute } = require("../db/db");

const RESERVED = new Set(["admin", "www", "api", "app", "landing", "static", "cafebilling"]);

module.exports = async function tenantMiddleware(req, res, next) {
  let subdomain =
    req.headers["x-tenant-id"] ||
    req.query.tenant ||
    extractSubdomain(req.hostname);

  if (!subdomain || RESERVED.has(subdomain)) return next();

  try {
    const tenant = await queryOne("SELECT * FROM tenants WHERE subdomain=?", [subdomain]);

    if (!tenant) {
      return res.status(404).json({ error: "Cafe not found. Please check your URL." });
    }

    if (tenant.status === "suspended") {
      return res.status(403).json({ error: "This account has been suspended. Please contact support." });
    }

    if (tenant.status === "trial" && tenant.trial_ends && Date.now() > tenant.trial_ends) {
      await execute("UPDATE tenants SET status='expired' WHERE id=?", [tenant.id]);
      return res.status(402).json({ error: "Your free trial has expired. Please upgrade your plan." });
    }

    req.tenant   = tenant;
    req.tenantId = subdomain;
    next();
  } catch (err) {
    console.error("Tenant middleware error:", err);
    res.status(500).json({ error: "Server error resolving tenant." });
  }
};

function extractSubdomain(hostname) {
  if (!hostname) return null;
  const host  = hostname.split(":")[0];
  const parts = host.split(".");
  if (parts.length >= 2 && parts[0] !== "localhost") return parts[0];
  return null;
}
