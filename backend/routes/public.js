/**
 * public.js — Routes accessible without tenant auth.
 * POST /api/public/register  → new cafe signup from landing page
 * GET  /api/public/plans     → pricing info
 */
const express = require("express");
const router = express.Router();
const masterDb = require("../db/masterDb");
const { getTenantDb } = require("../db/tenantDb");

const PLANS = {
  basic:    { name: "Basic",    price: 299,  staffLimit: 2,  itemLimit: 30, branches: 1 },
  pro:      { name: "Pro",      price: 699,  staffLimit: 10, itemLimit: -1, branches: 3 },
  business: { name: "Business", price: 1499, staffLimit: -1, itemLimit: -1, branches: -1 },
};

// ── GET /api/public/plans ─────────────────────────────────────
router.get("/plans", (req, res) => {
  res.json(PLANS);
});

// ── POST /api/public/register — New cafe signup ───────────────
router.post("/register", (req, res) => {
  const { cafeName, ownerName, mobile, email, city, plan } = req.body;

  if (!cafeName || !ownerName || !mobile || !city) {
    return res.status(400).json({ error: "Name, owner, mobile, and city are required." });
  }
  if (!/^\d{10}$/.test(mobile)) {
    return res.status(400).json({ error: "Please provide a valid 10-digit mobile number." });
  }

  // Check for duplicate mobile
  const existing = masterDb.prepare("SELECT id FROM signup_requests WHERE mobile = ?").get(mobile);
  if (existing) {
    return res.status(409).json({ error: "A request with this mobile number already exists." });
  }

  // Save signup request (admin will activate manually)
  masterDb.prepare(`
    INSERT INTO signup_requests (cafe_name, owner_name, mobile, email, city, plan, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `).run(cafeName.trim(), ownerName.trim(), mobile.trim(), email || "", city.trim(), plan || "basic");

  // Generate subdomain suggestion
  const subdomain = cafeName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 20) || `cafe${Date.now()}`;

  res.json({ success: true, subdomain });
});

// ── GET /api/public/tenant-info — used by frontend app ───────
// Returns current tenant's plan and cafe info for the billing app
router.get("/tenant-info", (req, res) => {
  if (!req.tenant) return res.status(404).json({ error: "No tenant context" });

  const db = req.tenantDb;
  const cafeInfo = db.prepare("SELECT * FROM cafe_info LIMIT 1").get();
  const bizSettings = db.prepare("SELECT * FROM business_settings LIMIT 1").get();

  res.json({
    tenant: {
      id:        req.tenant.id,
      subdomain: req.tenant.subdomain,
      cafeName:  req.tenant.cafe_name,
      ownerName: req.tenant.owner_name,
      mobile:    req.tenant.mobile,
      email:     req.tenant.email,
      city:      req.tenant.city,
      plan:      req.tenant.plan,
      status:    req.tenant.status,
      planLimits: PLANS[req.tenant.plan] || PLANS.basic,
    },
    cafeInfo: cafeInfo || null,
    bizSettings: bizSettings || null,
  });
});

module.exports = { router, PLANS };
