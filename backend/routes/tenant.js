/**
 * tenant.js — All tenant billing routes (async, Turso-backed)
 * Mounted at /api/ — requires req.tenant + req.tenantId from middleware.
 */
const express = require("express");
const router  = express.Router();
const { PLANS } = require("./public");
const { queryAll, queryOne, execute } = require("../db/db");
const { generateOtp, sendSms, sendEmailOtp } = require("../utils/otp");

const T = (req) => req.tenantId; // shorthand

// ── Plan limit helper ─────────────────────────────────────────
async function checkPlanLimit(req, res, type) {
  const plan = PLANS[req.tenant.plan] || PLANS.basic;
  if (type === "items" && plan.itemLimit !== -1) {
    const row = await queryOne("SELECT COUNT(*) as c FROM items WHERE tenant_id=?", [T(req)]);
    if (Number(row.c) >= plan.itemLimit) {
      res.status(403).json({ error: `Your ${plan.name} plan allows max ${plan.itemLimit} menu items. Upgrade to add more.` });
      return false;
    }
  }
  if (type === "staff" && plan.staffLimit !== -1) {
    const row = await queryOne("SELECT COUNT(*) as c FROM staff WHERE tenant_id=? AND active=1", [T(req)]);
    if (Number(row.c) >= plan.staffLimit) {
      res.status(403).json({ error: `Your ${plan.name} plan allows max ${plan.staffLimit} staff. Upgrade to add more.` });
      return false;
    }
  }
  return true;
}

// ── ITEMS ─────────────────────────────────────────────────────
router.get("/items", async (req, res) => {
  try {
    const items = await queryAll("SELECT * FROM items WHERE tenant_id=? ORDER BY name", [T(req)]);
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/items", async (req, res) => {
  try {
    if (!await checkPlanLimit(req, res, "items")) return;
    const { name, price, category, image } = req.body;
    if (!name || price == null) return res.status(400).json({ error: "Name and price required" });
    const r = await execute(
      "INSERT INTO items (tenant_id, name, price, category, image) VALUES (?,?,?,?,?)",
      [T(req), name.trim(), parseFloat(price), category || "", image || null]
    );
    res.json({ success: true, id: r.lastInsertRowid });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put("/items/:id", async (req, res) => {
  try {
    const { name, price, category, image } = req.body;
    const item = await queryOne("SELECT * FROM items WHERE id=? AND tenant_id=?", [req.params.id, T(req)]);
    if (!item) return res.status(404).json({ error: "Item not found" });
    await execute("UPDATE items SET name=?, price=?, category=?, image=? WHERE id=? AND tenant_id=?",
      [name || item.name, price != null ? parseFloat(price) : item.price,
       category ?? item.category, image !== undefined ? image : item.image,
       req.params.id, T(req)]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete("/items/:id", async (req, res) => {
  try {
    await execute("DELETE FROM items WHERE id=? AND tenant_id=?", [req.params.id, T(req)]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── ORDERS ────────────────────────────────────────────────────
router.get("/orders", async (req, res) => {
  try {
    const orders = await queryAll("SELECT * FROM orders WHERE tenant_id=? ORDER BY createdAt DESC", [T(req)]);
    res.json(orders);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/orders", async (req, res) => {
  try {
    const { customerName, tableNo, items, total, paymentMode } = req.body;
    if (!customerName || !items || total == null) return res.status(400).json({ error: "Missing fields" });
    const r = await execute(
      "INSERT INTO orders (tenant_id, customerName, tableNo, items, total, paymentMode) VALUES (?,?,?,?,?,?)",
      [T(req), customerName.trim(), tableNo || "", JSON.stringify(items), parseFloat(total), paymentMode || "cash"]
    );
    res.json({ success: true, id: r.lastInsertRowid });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete("/orders/:id", async (req, res) => {
  try {
    await execute("DELETE FROM orders WHERE id=? AND tenant_id=?", [req.params.id, T(req)]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── SETUP — Business settings ─────────────────────────────────
router.get("/setup/business", async (req, res) => {
  try {
    const s = await queryOne("SELECT * FROM business_settings WHERE tenant_id=? ORDER BY id DESC LIMIT 1", [T(req)]);
    res.json(s || {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/setup/business", async (req, res) => {
  try {
    const { currency, gstEnabled, gstPercentage, serviceCharge, serviceChargePercent, billPrefix } = req.body;
    await execute("DELETE FROM business_settings WHERE tenant_id=?", [T(req)]);
    await execute(
      "INSERT INTO business_settings (tenant_id, currency, gstEnabled, gstPercentage, serviceCharge, serviceChargePercent, billPrefix) VALUES (?,?,?,?,?,?,?)",
      [T(req), currency || "INR", gstEnabled ? 1 : 0, parseFloat(gstPercentage) || 5,
       serviceCharge ? 1 : 0, parseFloat(serviceChargePercent) || 10, billPrefix || "BILL"]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── SETUP — Categories ────────────────────────────────────────
router.get("/setup/categories", async (req, res) => {
  try {
    const cats = await queryAll("SELECT * FROM categories WHERE tenant_id=? ORDER BY sortOrder", [T(req)]);
    res.json(cats);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/setup/categories", async (req, res) => {
  try {
    const { categories } = req.body;
    await execute("DELETE FROM categories WHERE tenant_id=?", [T(req)]);
    for (let i = 0; i < categories.length; i++) {
      const c = categories[i];
      await execute("INSERT INTO categories (tenant_id, name, icon, sortOrder) VALUES (?,?,?,?)",
        [T(req), c.name, c.icon || "🍽️", i]);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/setup/categories/add", async (req, res) => {
  try {
    const { name, icon } = req.body;
    if (!name) return res.status(400).json({ error: "Name required" });
    const row = await queryOne("SELECT COUNT(*) as c FROM categories WHERE tenant_id=?", [T(req)]);
    const r = await execute("INSERT INTO categories (tenant_id, name, icon, sortOrder) VALUES (?,?,?,?)",
      [T(req), name.trim(), icon || "🍽️", Number(row.c)]);
    res.json({ success: true, id: r.lastInsertRowid });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete("/setup/categories/:id", async (req, res) => {
  try {
    await execute("DELETE FROM categories WHERE id=? AND tenant_id=?", [req.params.id, T(req)]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── SETUP — Payment methods ───────────────────────────────────
router.get("/setup/payment", async (req, res) => {
  try {
    const p = await queryOne("SELECT * FROM payment_methods WHERE tenant_id=? ORDER BY id DESC LIMIT 1", [T(req)]);
    res.json(p || { cash: 1, upi: 0, upiId: "", card: 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/setup/payment", async (req, res) => {
  try {
    const { cash, upi, upiId, card } = req.body;
    await execute("DELETE FROM payment_methods WHERE tenant_id=?", [T(req)]);
    await execute("INSERT INTO payment_methods (tenant_id, cash, upi, upiId, card) VALUES (?,?,?,?,?)",
      [T(req), cash ? 1 : 0, upi ? 1 : 0, upiId || "", card ? 1 : 0]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── STAFF ─────────────────────────────────────────────────────
router.get("/setup/staff", async (req, res) => {
  try {
    const staff = await queryAll("SELECT id, name, role, active FROM staff WHERE tenant_id=?", [T(req)]);
    res.json(staff);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/setup/staff", async (req, res) => {
  try {
    const { staff } = req.body;
    await execute("DELETE FROM staff WHERE tenant_id=?", [T(req)]);
    for (const s of staff) {
      await execute("INSERT INTO staff (tenant_id, name, role, pin, active) VALUES (?,?,?,?,?)",
        [T(req), s.name, s.role, s.pin, s.active ? 1 : 0]);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/setup/staff/add", async (req, res) => {
  try {
    if (!await checkPlanLimit(req, res, "staff")) return;
    const { name, role, pin } = req.body;
    if (!name || !pin || !/^\d{4}$/.test(pin))
      return res.status(400).json({ error: "Name and 4-digit PIN required" });
    const r = await execute("INSERT INTO staff (tenant_id, name, role, pin, active) VALUES (?,?,?,?,1)",
      [T(req), name.trim(), role || "Cashier", pin]);
    res.json({ success: true, id: r.lastInsertRowid });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put("/setup/staff/:id", async (req, res) => {
  try {
    const { name, role, active } = req.body;
    const s = await queryOne("SELECT * FROM staff WHERE id=? AND tenant_id=?", [req.params.id, T(req)]);
    if (!s) return res.status(404).json({ error: "Staff not found" });
    await execute("UPDATE staff SET name=?, role=?, active=? WHERE id=? AND tenant_id=?",
      [name || s.name, role || s.role, active !== undefined ? (active ? 1 : 0) : s.active, req.params.id, T(req)]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/setup/staff/:id/reset-pin", async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin || !/^\d{4}$/.test(pin)) return res.status(400).json({ error: "PIN must be 4 digits" });
    await execute("UPDATE staff SET pin=? WHERE id=? AND tenant_id=?", [pin, req.params.id, T(req)]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete("/setup/staff/:id", async (req, res) => {
  try {
    await execute("DELETE FROM staff WHERE id=? AND tenant_id=?", [req.params.id, T(req)]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── AUTH ──────────────────────────────────────────────────────
router.post("/auth/set-pin", async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin || !/^\d{4}$/.test(pin)) return res.status(400).json({ error: "PIN must be 4 digits" });
    await execute("UPDATE cafe_info SET pin=? WHERE tenant_id=?", [pin, T(req)]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/auth/login-pin", async (req, res) => {
  try {
    const { pin } = req.body;
    const cafe = await queryOne("SELECT * FROM cafe_info WHERE tenant_id=? LIMIT 1", [T(req)]);
    if (!cafe) return res.status(404).json({ error: "Cafe not set up yet." });
    if (!cafe.pin) return res.status(400).json({ error: "PIN not set. Complete setup first." });
    if (cafe.pin !== pin) return res.status(401).json({ error: "Incorrect PIN." });
    const token = Buffer.from(`${T(req)}:${Date.now()}`).toString("base64");
    res.json({
      success: true, token,
      cafe: { cafeName: cafe.cafe_name, ownerName: cafe.owner_name, mobile: cafe.mobile, city: cafe.city },
      role: "owner",
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/auth/login-staff", async (req, res) => {
  try {
    const { staffId, pin } = req.body;
    const member = await queryOne("SELECT * FROM staff WHERE id=? AND tenant_id=? AND active=1", [staffId, T(req)]);
    if (!member) return res.status(404).json({ error: "Staff not found or inactive." });
    if (member.pin !== pin) return res.status(401).json({ error: "Incorrect PIN." });
    const token = Buffer.from(`staff:${staffId}:${Date.now()}`).toString("base64");
    res.json({
      success: true, token,
      cafe: { cafeName: req.tenant.cafe_name, ownerName: req.tenant.owner_name },
      role: "staff",
      staff: { id: member.id, name: member.name, role: member.role },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/auth/send-otp", async (req, res) => {
  try {
    const { mobile } = req.body;
    if (!mobile) return res.status(400).json({ error: "Mobile is required." });
    const otp = generateOtp();
    const expiresAt = Date.now() + 5 * 60 * 1000;
    await execute("DELETE FROM otps WHERE tenant_id=? AND mobile=?", [T(req), mobile]);
    await execute("INSERT INTO otps (tenant_id, mobile, otp, expiresAt) VALUES (?,?,?,?)",
      [T(req), mobile, otp, expiresAt]);
    const cafe = await queryOne("SELECT * FROM cafe_info WHERE tenant_id=? LIMIT 1", [T(req)]);
    let smsSent = false, emailSent = false, demo = false;
    try {
      const result = await sendSms(mobile, otp);
      smsSent = !result?.demo; demo = !!result?.demo;
    } catch (e) { console.warn("⚠️ SMS failed:", e.message); }
    if (cafe?.email && cafe.email.includes("@")) {
      try {
        const result = await sendEmailOtp(cafe.email, otp, cafe.owner_name);
        emailSent = result.emailSent;
      } catch (e) { console.warn("⚠️ Email OTP failed:", e.message); }
    }
    if (!smsSent && !emailSent) {
      if (process.env.NODE_ENV === "production")
        return res.status(500).json({ error: "Failed to send OTP. Please check SMS/email configuration." });
      return res.json({ success: true, demo: true, otp, smsSent: false, emailSent: false });
    }
    res.json({ success: true, demo: false, smsSent, emailSent });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/auth/verify-otp", async (req, res) => {
  try {
    const { mobile, otp } = req.body;
    const record = await queryOne(
      "SELECT * FROM otps WHERE tenant_id=? AND mobile=? ORDER BY id DESC LIMIT 1",
      [T(req), mobile]
    );
    if (!record || record.otp !== otp) return res.status(400).json({ error: "Invalid OTP." });
    if (Date.now() > record.expiresAt) return res.status(400).json({ error: "OTP expired." });
    await execute("DELETE FROM otps WHERE tenant_id=? AND mobile=?", [T(req), mobile]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/auth/reset-pin", async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin || !/^\d{4}$/.test(pin)) return res.status(400).json({ error: "PIN must be 4 digits" });
    await execute("UPDATE cafe_info SET pin=? WHERE tenant_id=?", [pin, T(req)]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── SETUP — Cafe status ───────────────────────────────────────
router.get("/setup/cafe-status", async (req, res) => {
  try {
    const cafe = await queryOne("SELECT * FROM cafe_info WHERE tenant_id=? LIMIT 1", [T(req)]);
    res.json({
      setupDone:  !!(cafe && cafe.pin),
      hasCafe:    !!cafe,
      wizardDone: !!(req.tenant && req.tenant.wizard_done),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Mark setup wizard as completed — stored in DB so it works across all devices
router.post("/setup/wizard-done", async (req, res) => {
  try {
    await execute("UPDATE tenants SET wizard_done=1 WHERE subdomain=?", [T(req)]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/setup/complete", async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin || !/^\d{4}$/.test(pin)) return res.status(400).json({ error: "4-digit PIN required" });
    await execute("UPDATE cafe_info SET pin=? WHERE tenant_id=?", [pin, T(req)]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
