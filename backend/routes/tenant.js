/**
 * tenant.js — All tenant billing routes (items, orders, setup, auth, staff)
 * Mounted at /api/ and requires req.tenant + req.tenantDb from middleware.
 */
const express = require("express");
const router = express.Router();
const { PLANS } = require("./public");
const { generateOtp, sendSms, sendEmailOtp } = require("../utils/otp");

// ── Helper: enforce plan limits ───────────────────────────────
function checkPlanLimit(req, res, type) {
  const plan = PLANS[req.tenant.plan] || PLANS.basic;
  const db = req.tenantDb;

  if (type === "items" && plan.itemLimit !== -1) {
    const count = db.prepare("SELECT COUNT(*) as c FROM items").get().c;
    if (count >= plan.itemLimit) {
      res.status(403).json({ error: `Your ${plan.name} plan allows max ${plan.itemLimit} menu items. Upgrade to add more.` });
      return false;
    }
  }
  if (type === "staff" && plan.staffLimit !== -1) {
    const count = db.prepare("SELECT COUNT(*) as c FROM staff WHERE active=1").get().c;
    if (count >= plan.staffLimit) {
      res.status(403).json({ error: `Your ${plan.name} plan allows max ${plan.staffLimit} staff. Upgrade to add more.` });
      return false;
    }
  }
  return true;
}

// ── ITEMS ─────────────────────────────────────────────────────

router.get("/items", (req, res) => {
  const items = req.tenantDb.prepare("SELECT * FROM items ORDER BY name").all();
  res.json(items);
});

router.post("/items", (req, res) => {
  if (!checkPlanLimit(req, res, "items")) return;
  const { name, price, category, image } = req.body;
  if (!name || price == null) return res.status(400).json({ error: "Name and price required" });
  const r = req.tenantDb.prepare("INSERT INTO items (name, price, category, image) VALUES (?,?,?,?)")
    .run(name.trim(), parseFloat(price), category || "", image || null);
  res.json({ success: true, id: r.lastInsertRowid });
});

router.put("/items/:id", (req, res) => {
  const { name, price, category, image } = req.body;
  const { id } = req.params;
  const item = req.tenantDb.prepare("SELECT * FROM items WHERE id=?").get(id);
  if (!item) return res.status(404).json({ error: "Item not found" });
  req.tenantDb.prepare("UPDATE items SET name=?, price=?, category=?, image=? WHERE id=?")
    .run(name || item.name, price != null ? parseFloat(price) : item.price, category ?? item.category, image !== undefined ? image : item.image, id);
  res.json({ success: true });
});

router.delete("/items/:id", (req, res) => {
  req.tenantDb.prepare("DELETE FROM items WHERE id=?").run(req.params.id);
  res.json({ success: true });
});

// ── ORDERS ────────────────────────────────────────────────────

router.get("/orders", (req, res) => {
  const orders = req.tenantDb.prepare("SELECT * FROM orders ORDER BY createdAt DESC").all();
  res.json(orders);
});

router.post("/orders", (req, res) => {
  const { customerName, tableNo, items, total, paymentMode } = req.body;
  if (!customerName || !items || total == null) return res.status(400).json({ error: "Missing fields" });
  const r = req.tenantDb.prepare("INSERT INTO orders (customerName, tableNo, items, total, paymentMode) VALUES (?,?,?,?,?)")
    .run(customerName.trim(), tableNo || "", JSON.stringify(items), parseFloat(total), paymentMode || "cash");
  res.json({ success: true, id: r.lastInsertRowid });
});

router.delete("/orders/:id", (req, res) => {
  req.tenantDb.prepare("DELETE FROM orders WHERE id=?").run(req.params.id);
  res.json({ success: true });
});

// ── SETUP — Business settings ─────────────────────────────────

router.get("/setup/business", (req, res) => {
  const s = req.tenantDb.prepare("SELECT * FROM business_settings ORDER BY id DESC LIMIT 1").get();
  res.json(s || {});
});

router.post("/setup/business", (req, res) => {
  const { currency, gstEnabled, gstPercentage, serviceCharge, serviceChargePercent, billPrefix } = req.body;
  req.tenantDb.prepare("DELETE FROM business_settings").run();
  req.tenantDb.prepare("INSERT INTO business_settings (currency, gstEnabled, gstPercentage, serviceCharge, serviceChargePercent, billPrefix) VALUES (?,?,?,?,?,?)")
    .run(currency || "INR", gstEnabled ? 1 : 0, parseFloat(gstPercentage) || 5, serviceCharge ? 1 : 0, parseFloat(serviceChargePercent) || 10, billPrefix || "BILL");
  res.json({ success: true });
});

// ── SETUP — Categories ────────────────────────────────────────

router.get("/setup/categories", (req, res) => {
  res.json(req.tenantDb.prepare("SELECT * FROM categories ORDER BY sortOrder").all());
});

router.post("/setup/categories", (req, res) => {
  const { categories } = req.body;
  req.tenantDb.prepare("DELETE FROM categories").run();
  categories.forEach((c, i) => {
    req.tenantDb.prepare("INSERT INTO categories (name, icon, sortOrder) VALUES (?,?,?)").run(c.name, c.icon || "🍽️", i);
  });
  res.json({ success: true });
});

router.post("/setup/categories/add", (req, res) => {
  const { name, icon } = req.body;
  if (!name) return res.status(400).json({ error: "Name required" });
  const count = req.tenantDb.prepare("SELECT COUNT(*) as c FROM categories").get().c;
  const r = req.tenantDb.prepare("INSERT INTO categories (name, icon, sortOrder) VALUES (?,?,?)").run(name.trim(), icon || "🍽️", count);
  res.json({ success: true, id: r.lastInsertRowid });
});

router.delete("/setup/categories/:id", (req, res) => {
  req.tenantDb.prepare("DELETE FROM categories WHERE id=?").run(req.params.id);
  res.json({ success: true });
});

// ── SETUP — Payment methods ───────────────────────────────────

router.get("/setup/payment", (req, res) => {
  const p = req.tenantDb.prepare("SELECT * FROM payment_methods ORDER BY id DESC LIMIT 1").get();
  res.json(p || { cash: 1, upi: 0, upiId: "", card: 0 });
});

router.post("/setup/payment", (req, res) => {
  const { cash, upi, upiId, card } = req.body;
  req.tenantDb.prepare("DELETE FROM payment_methods").run();
  req.tenantDb.prepare("INSERT INTO payment_methods (cash, upi, upiId, card) VALUES (?,?,?,?)").run(cash ? 1 : 0, upi ? 1 : 0, upiId || "", card ? 1 : 0);
  res.json({ success: true });
});

// ── STAFF ─────────────────────────────────────────────────────

router.get("/setup/staff", (req, res) => {
  res.json(req.tenantDb.prepare("SELECT id, name, role, active FROM staff").all());
});

router.post("/setup/staff", (req, res) => {
  const { staff } = req.body;
  req.tenantDb.prepare("DELETE FROM staff").run();
  staff.forEach(s => {
    req.tenantDb.prepare("INSERT INTO staff (name, role, pin, active) VALUES (?,?,?,?)").run(s.name, s.role, s.pin, s.active ? 1 : 0);
  });
  res.json({ success: true });
});

router.post("/setup/staff/add", (req, res) => {
  if (!checkPlanLimit(req, res, "staff")) return;
  const { name, role, pin } = req.body;
  if (!name || !pin || !/^\d{4}$/.test(pin)) return res.status(400).json({ error: "Name and 4-digit PIN required" });
  const r = req.tenantDb.prepare("INSERT INTO staff (name, role, pin, active) VALUES (?,?,?,1)").run(name.trim(), role || "Cashier", pin);
  res.json({ success: true, id: r.lastInsertRowid });
});

router.put("/setup/staff/:id", (req, res) => {
  const { name, role, active } = req.body;
  const s = req.tenantDb.prepare("SELECT * FROM staff WHERE id=?").get(req.params.id);
  if (!s) return res.status(404).json({ error: "Staff not found" });
  req.tenantDb.prepare("UPDATE staff SET name=?, role=?, active=? WHERE id=?")
    .run(name || s.name, role || s.role, active !== undefined ? (active ? 1 : 0) : s.active, req.params.id);
  res.json({ success: true });
});

router.post("/setup/staff/:id/reset-pin", (req, res) => {
  const { pin } = req.body;
  if (!pin || !/^\d{4}$/.test(pin)) return res.status(400).json({ error: "PIN must be 4 digits" });
  req.tenantDb.prepare("UPDATE staff SET pin=? WHERE id=?").run(pin, req.params.id);
  res.json({ success: true });
});

router.delete("/setup/staff/:id", (req, res) => {
  req.tenantDb.prepare("DELETE FROM staff WHERE id=?").run(req.params.id);
  res.json({ success: true });
});

// ── AUTH — PIN login for tenant owner ────────────────────────

router.post("/auth/set-pin", (req, res) => {
  const { pin } = req.body;
  if (!pin || !/^\d{4}$/.test(pin)) return res.status(400).json({ error: "PIN must be 4 digits" });
  req.tenantDb.prepare("UPDATE cafe_info SET pin=? WHERE id=1").run(pin);
  res.json({ success: true });
});

router.post("/auth/login-pin", (req, res) => {
  const { pin } = req.body;
  const cafe = req.tenantDb.prepare("SELECT * FROM cafe_info LIMIT 1").get();
  if (!cafe) return res.status(404).json({ error: "Cafe not set up yet." });
  if (!cafe.pin) return res.status(400).json({ error: "PIN not set. Complete setup first." });
  if (cafe.pin !== pin) return res.status(401).json({ error: "Incorrect PIN." });
  const token = Buffer.from(`${req.tenant.subdomain}:${Date.now()}`).toString("base64");
  res.json({
    success: true, token,
    cafe: { cafeName: cafe.cafe_name, ownerName: cafe.owner_name, mobile: cafe.mobile, city: cafe.city },
    role: "owner",
  });
});

router.post("/auth/login-staff", (req, res) => {
  const { staffId, pin } = req.body;
  const member = req.tenantDb.prepare("SELECT * FROM staff WHERE id=? AND active=1").get(staffId);
  if (!member) return res.status(404).json({ error: "Staff not found or inactive." });
  if (member.pin !== pin) return res.status(401).json({ error: "Incorrect PIN." });
  const token = Buffer.from(`staff:${staffId}:${Date.now()}`).toString("base64");
  res.json({
    success: true, token,
    cafe: { cafeName: req.tenant.cafe_name, ownerName: req.tenant.owner_name },
    role: "staff",
    staff: { id: member.id, name: member.name, role: member.role },
  });
});

// OTPs stored in tenant DB
router.post("/auth/send-otp", async (req, res) => {
  const { mobile } = req.body;
  if (!mobile) return res.status(400).json({ error: "Mobile is required." });

  const otp = generateOtp();
  const expiresAt = Date.now() + 5 * 60 * 1000;
  req.tenantDb.prepare("DELETE FROM otps WHERE mobile=?").run(mobile);
  req.tenantDb.prepare("INSERT INTO otps (mobile, otp, expiresAt) VALUES (?,?,?)").run(mobile, otp, expiresAt);

  // Get cafe info to include owner name in email
  const cafe = req.tenantDb.prepare("SELECT * FROM cafe_info LIMIT 1").get();

  let smsSent = false, emailSent = false, demo = false;

  // Try SMS
  try {
    const result = await sendSms(mobile, otp);
    smsSent = !result?.demo;
    demo = !!result?.demo;
  } catch (e) {
    console.warn("⚠️  SMS failed:", e.message);
  }

  // Try Email if cafe has a registered email
  if (cafe?.email && cafe.email.includes("@")) {
    try {
      const result = await sendEmailOtp(cafe.email, otp, cafe.owner_name);
      emailSent = result.emailSent;
    } catch (e) {
      console.warn("⚠️  Email OTP failed:", e.message);
    }
  }

  // If both failed — only show OTP on screen in dev mode
  if (!smsSent && !emailSent) {
    if (process.env.NODE_ENV === "production") {
      return res.status(500).json({ error: "Failed to send OTP. Please check SMS/email configuration." });
    }
    return res.json({ success: true, demo: true, otp, smsSent: false, emailSent: false });
  }

  res.json({ success: true, demo: false, smsSent, emailSent });
});

router.post("/auth/verify-otp", (req, res) => {
  const { mobile, otp } = req.body;
  const record = req.tenantDb.prepare("SELECT * FROM otps WHERE mobile=? ORDER BY id DESC LIMIT 1").get(mobile);
  if (!record || record.otp !== otp) return res.status(400).json({ error: "Invalid OTP." });
  if (Date.now() > record.expiresAt) return res.status(400).json({ error: "OTP expired." });
  req.tenantDb.prepare("DELETE FROM otps WHERE mobile=?").run(mobile);
  res.json({ success: true });
});

router.post("/auth/reset-pin", (req, res) => {
  const { mobile, pin } = req.body;
  if (!pin || !/^\d{4}$/.test(pin)) return res.status(400).json({ error: "PIN must be 4 digits" });
  req.tenantDb.prepare("UPDATE cafe_info SET pin=?").run(pin);
  res.json({ success: true });
});

// ── SETUP — Initial cafe setup ────────────────────────────────

router.get("/setup/cafe-status", (req, res) => {
  const cafe = req.tenantDb.prepare("SELECT * FROM cafe_info LIMIT 1").get();
  res.json({ setupDone: !!(cafe && cafe.pin), hasCafe: !!cafe });
});

router.post("/setup/complete", (req, res) => {
  const { pin } = req.body;
  if (!pin || !/^\d{4}$/.test(pin)) return res.status(400).json({ error: "4-digit PIN required" });
  req.tenantDb.prepare("UPDATE cafe_info SET pin=?").run(pin);
  res.json({ success: true });
});

module.exports = router;
