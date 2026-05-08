/**
 * admin.js — Super admin routes (async, Turso-backed)
 */
const express = require("express");
const router  = express.Router();
const { queryAll, queryOne, execute } = require("../db/db");
const { initTenant, deleteTenantData } = require("../db/tenantDb");

// ── Auth middleware ───────────────────────────────────────────
async function requireAdmin(req, res, next) {
  const { username, password } = req.headers;
  if (!username || !password) return res.status(401).json({ error: "Admin credentials required" });
  const admin = await queryOne("SELECT * FROM admins WHERE username=? AND password=?", [username, password]);
  if (!admin) return res.status(401).json({ error: "Invalid admin credentials" });
  next();
}

// ── Welcome email ─────────────────────────────────────────────
async function sendWelcomeEmail(ownerName, email, subdomain) {
  if (!email || !email.includes("@")) return;
  try {
    const nodemailer = require("nodemailer");
    const EMAIL_USER = process.env.EMAIL_USER || "";
    const EMAIL_PASS = process.env.EMAIL_PASS || "";
    if (!EMAIL_USER || !EMAIL_PASS) return;
    const BASE_DOMAIN = process.env.BASE_DOMAIN || "";
    const loginUrl = BASE_DOMAIN
      ? `https://${BASE_DOMAIN}/app?tenant=${subdomain}`
      : `https://your-app.onrender.com/app?tenant=${subdomain}`;
    const transporter = require("nodemailer").createTransport({
      service: "gmail", auth: { user: EMAIL_USER, pass: EMAIL_PASS },
    });
    await transporter.sendMail({
      from: `"CafeBill" <${EMAIL_USER}>`,
      to: email,
      subject: "Your CafeBill account is ready! ☕",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;border:1px solid #eee;border-radius:12px;overflow:hidden">
          <div style="background:#ea580c;padding:28px;text-align:center">
            <h2 style="color:white;margin:0;font-size:24px">☕ CafeBill</h2>
            <p style="color:#fed7aa;margin:6px 0 0">Your billing account is ready</p>
          </div>
          <div style="padding:32px">
            <p style="color:#374151;font-size:16px">Hi <b>${ownerName}</b>,</p>
            <p style="color:#374151">Your CafeBill account has been created. You can now start managing your cafe billing.</p>
            <div style="text-align:center;margin:28px 0">
              <a href="${loginUrl}" style="background:#ea580c;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px">
                Login to Your Account →
              </a>
            </div>
            <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:16px;margin-top:20px">
              <p style="color:#92400e;margin:0 0 6px;font-weight:bold">First time login:</p>
              <ol style="color:#374151;margin:0;padding-left:20px;line-height:1.8">
                <li>Click the login button above</li>
                <li>Set your 4-digit PIN</li>
                <li>Use this PIN every time you log in</li>
              </ol>
            </div>
            <p style="color:#6b7280;font-size:13px;margin-top:24px">
              Your login URL: <a href="${loginUrl}" style="color:#ea580c">${loginUrl}</a>
            </p>
          </div>
          <div style="background:#f9fafb;padding:16px;text-align:center;border-top:1px solid #eee">
            <p style="color:#9ca3af;font-size:12px;margin:0">Powered by CafeBill SaaS · cafebilling.vcubesolultions.in</p>
          </div>
        </div>`,
    });
    console.log(`✅ Welcome email sent to ${email}`);
  } catch (e) {
    console.warn("⚠️ Welcome email failed:", e.message);
  }
}

// ── Login ─────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const admin = await queryOne("SELECT * FROM admins WHERE username=? AND password=?", [username, password]);
    if (!admin) return res.status(401).json({ error: "Invalid credentials" });
    res.json({ success: true, username: admin.username });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Stats ─────────────────────────────────────────────────────
router.get("/stats", requireAdmin, async (req, res) => {
  try {
    const get = async (sql, args=[]) => (await queryOne(sql, args))?.c || 0;
    const total    = await get("SELECT COUNT(*) as c FROM tenants");
    const active   = await get("SELECT COUNT(*) as c FROM tenants WHERE status='active'");
    const trial    = await get("SELECT COUNT(*) as c FROM tenants WHERE status='trial'");
    const expired  = await get("SELECT COUNT(*) as c FROM tenants WHERE status='expired'");
    const pending  = await get("SELECT COUNT(*) as c FROM signup_requests WHERE status='pending'");
    const basic    = await get("SELECT COUNT(*) as c FROM tenants WHERE plan='basic'");
    const pro      = await get("SELECT COUNT(*) as c FROM tenants WHERE plan='pro'");
    const business = await get("SELECT COUNT(*) as c FROM tenants WHERE plan='business'");
    const mrr = (basic * 299) + (pro * 699) + (business * 1499);
    res.json({ total, active, trial, expired, pending, basic, pro, business, mrr });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Tenants list ──────────────────────────────────────────────
router.get("/tenants", requireAdmin, async (req, res) => {
  try {
    const tenants = await queryAll("SELECT * FROM tenants ORDER BY created_at DESC");
    res.json(tenants);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Signup requests ───────────────────────────────────────────
router.get("/requests", requireAdmin, async (req, res) => {
  try {
    const requests = await queryAll("SELECT * FROM signup_requests ORDER BY created_at DESC");
    res.json(requests);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Activate request ──────────────────────────────────────────
router.post("/activate", requireAdmin, async (req, res) => {
  try {
    const { requestId, subdomain, plan } = req.body;
    if (!requestId || !subdomain) return res.status(400).json({ error: "requestId and subdomain required" });
    if (!/^[a-z0-9][a-z0-9-]{1,20}[a-z0-9]$/.test(subdomain))
      return res.status(400).json({ error: "Invalid subdomain format" });

    const request = await queryOne("SELECT * FROM signup_requests WHERE id=?", [requestId]);
    if (!request) return res.status(404).json({ error: "Request not found" });

    const exists = await queryOne("SELECT id FROM tenants WHERE subdomain=?", [subdomain]);
    if (exists) return res.status(409).json({ error: "Subdomain already taken" });

    const trialEnds = Date.now() + (14 * 24 * 60 * 60 * 1000);
    const result = await execute(
      "INSERT INTO tenants (subdomain, cafe_name, owner_name, mobile, email, city, plan, status, trial_ends) VALUES (?,?,?,?,?,?,?,'trial',?)",
      [subdomain, request.cafe_name, request.owner_name, request.mobile, request.email, request.city, plan || request.plan, trialEnds]
    );

    await initTenant(subdomain, request.cafe_name, request.owner_name, request.mobile, request.email, request.city);
    await execute("UPDATE signup_requests SET status='approved' WHERE id=?", [requestId]);
    sendWelcomeEmail(request.owner_name, request.email, subdomain);

    const tenant = await queryOne("SELECT * FROM tenants WHERE id=?", [result.lastInsertRowid]);
    res.json({ success: true, tenant });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Create tenant directly ────────────────────────────────────
router.post("/tenants/create", requireAdmin, async (req, res) => {
  try {
    const { cafeName, ownerName, mobile, email, city, subdomain, plan } = req.body;
    if (!cafeName || !ownerName || !mobile || !subdomain)
      return res.status(400).json({ error: "cafeName, ownerName, mobile, subdomain are required" });
    if (!/^[a-z0-9][a-z0-9-]{1,20}[a-z0-9]$/.test(subdomain))
      return res.status(400).json({ error: "Invalid subdomain format" });

    const exists = await queryOne("SELECT id FROM tenants WHERE subdomain=?", [subdomain]);
    if (exists) return res.status(409).json({ error: "Subdomain already taken" });

    const trialEnds = Date.now() + (14 * 24 * 60 * 60 * 1000);
    const result = await execute(
      "INSERT INTO tenants (subdomain, cafe_name, owner_name, mobile, email, city, plan, status, trial_ends) VALUES (?,?,?,?,?,?,?,'trial',?)",
      [subdomain, cafeName, ownerName, mobile, email || "", city || "", plan || "basic", trialEnds]
    );

    await initTenant(subdomain, cafeName, ownerName, mobile, email, city);
    sendWelcomeEmail(ownerName, email, subdomain);

    res.json({ success: true, id: result.lastInsertRowid, subdomain });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Update plan/status ────────────────────────────────────────
router.put("/tenants/:id", requireAdmin, async (req, res) => {
  try {
    const { plan, status } = req.body;
    const tenant = await queryOne("SELECT * FROM tenants WHERE id=?", [req.params.id]);
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });
    await execute("UPDATE tenants SET plan=?, status=? WHERE id=?",
      [plan || tenant.plan, status || tenant.status, req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Delete tenant ─────────────────────────────────────────────
router.delete("/tenants/:id", requireAdmin, async (req, res) => {
  try {
    const tenant = await queryOne("SELECT * FROM tenants WHERE id=?", [req.params.id]);
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });
    await deleteTenantData(tenant.subdomain);
    await execute("DELETE FROM tenants WHERE id=?", [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Reset PIN ─────────────────────────────────────────────────
router.post("/tenants/:id/reset-pin", requireAdmin, async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin || !/^\d{4}$/.test(pin))
      return res.status(400).json({ error: "PIN must be exactly 4 digits" });
    const tenant = await queryOne("SELECT * FROM tenants WHERE id=?", [req.params.id]);
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });
    await execute("UPDATE cafe_info SET pin=? WHERE tenant_id=?", [pin, tenant.subdomain]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Delete request ────────────────────────────────────────────
router.delete("/requests/:id", requireAdmin, async (req, res) => {
  try {
    await execute("DELETE FROM signup_requests WHERE id=?", [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
