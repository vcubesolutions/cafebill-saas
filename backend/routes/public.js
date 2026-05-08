/**
 * public.js — Routes accessible without tenant auth.
 */
const express = require("express");
const router  = express.Router();
const { queryOne, execute } = require("../db/db");

const PLANS = {
  basic:    { name: "Basic",    price: 299,  staffLimit: 2,  itemLimit: 30, branches: 1 },
  pro:      { name: "Pro",      price: 699,  staffLimit: 10, itemLimit: -1, branches: 3 },
  business: { name: "Business", price: 1499, staffLimit: -1, itemLimit: -1, branches: -1 },
};

router.get("/plans", (req, res) => res.json(PLANS));

router.post("/register", async (req, res) => {
  try {
    const { cafeName, ownerName, mobile, email, city, plan } = req.body;
    if (!cafeName || !ownerName || !mobile || !city)
      return res.status(400).json({ error: "Name, owner, mobile, and city are required." });
    if (!/^\d{10}$/.test(mobile))
      return res.status(400).json({ error: "Please provide a valid 10-digit mobile number." });

    const existing = await queryOne("SELECT id FROM signup_requests WHERE mobile=?", [mobile]);
    if (existing)
      return res.status(409).json({ error: "A request with this mobile number already exists." });

    await execute(
      "INSERT INTO signup_requests (cafe_name, owner_name, mobile, email, city, plan, status) VALUES (?,?,?,?,?,?,'pending')",
      [cafeName.trim(), ownerName.trim(), mobile.trim(), email || "", city.trim(), plan || "basic"]
    );

    const subdomain = cafeName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20) || `cafe${Date.now()}`;
    res.json({ success: true, subdomain });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/tenant-info", async (req, res) => {
  try {
    if (!req.tenant) return res.status(404).json({ error: "No tenant context" });
    const { queryOne: qOne } = require("../db/db");
    const cafeInfo   = await qOne("SELECT * FROM cafe_info WHERE tenant_id=? LIMIT 1", [req.tenantId]);
    const bizSettings = await qOne("SELECT * FROM business_settings WHERE tenant_id=? LIMIT 1", [req.tenantId]);
    res.json({
      tenant: {
        id: req.tenant.id, subdomain: req.tenant.subdomain,
        cafeName: req.tenant.cafe_name, ownerName: req.tenant.owner_name,
        mobile: req.tenant.mobile, email: req.tenant.email, city: req.tenant.city,
        plan: req.tenant.plan, status: req.tenant.status,
        planLimits: PLANS[req.tenant.plan] || PLANS.basic,
      },
      cafeInfo: cafeInfo || null,
      bizSettings: bizSettings || null,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = { router, PLANS };
