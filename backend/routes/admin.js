/**
 * admin.js — Super admin routes (protected by username+password)
 * All routes prefixed /api/admin/
 *
 * POST /api/admin/login           → Admin login
 * GET  /api/admin/tenants         → List all tenants
 * GET  /api/admin/requests        → List pending signup requests
 * POST /api/admin/activate        → Activate a signup request → creates tenant
 * PUT  /api/admin/tenants/:id     → Update plan / status
 * DELETE /api/admin/tenants/:id   → Delete tenant + DB
 * GET  /api/admin/stats           → Dashboard stats
 */
const express = require("express");
const router = express.Router();
const masterDb = require("../db/masterDb");
const { getTenantDb, deleteTenantDb } = require("../db/tenantDb");

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
      ? `https://${subdomain}.${BASE_DOMAIN}/app`
      : `https://${subdomain}.onrender.com/app`;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: EMAIL_USER, pass: EMAIL_PASS },
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
            <p style="color:#9ca3af;font-size:12px;margin:0">Powered by CafeBill SaaS · vcubesolultions.in</p>
          </div>
        </div>
      `,
    });
    console.log(`✅ Welcome email sent to ${email}`);
  } catch (e) {
    console.warn("⚠️  Welcome email failed:", e.message);
  }
}

// ── Simple auth middleware ─────────────────────────────────────
function requireAdmin(req, res, next) {
  const { username, password } = req.headers;
  if (!username || !password) return res.status(401).json({ error: "Admin credentials required" });
  const admin = masterDb.prepare("SELECT * FROM admins WHERE username=? AND password=?").get(username, password);
  if (!admin) return res.status(401).json({ error: "Invalid admin credentials" });
  next();
}

// ── POST /api/admin/login ─────────────────────────────────────
router.post("/login", (req, res) => {
  const { username, password } = req.body;
  const admin = masterDb.prepare("SELECT * FROM admins WHERE username=? AND password=?").get(username, password);
  if (!admin) return res.status(401).json({ error: "Invalid credentials" });
  res.json({ success: true, username: admin.username });
});

// ── GET /api/admin/stats ──────────────────────────────────────
router.get("/stats", requireAdmin, (req, res) => {
  const total    = masterDb.prepare("SELECT COUNT(*) as c FROM tenants").get().c;
  const active   = masterDb.prepare("SELECT COUNT(*) as c FROM tenants WHERE status='active'").get().c;
  const trial    = masterDb.prepare("SELECT COUNT(*) as c FROM tenants WHERE status='trial'").get().c;
  const expired  = masterDb.prepare("SELECT COUNT(*) as c FROM tenants WHERE status='expired'").get().c;
  const pending  = masterDb.prepare("SELECT COUNT(*) as c FROM signup_requests WHERE status='pending'").get().c;
  const basic    = masterDb.prepare("SELECT COUNT(*) as c FROM tenants WHERE plan='basic'").get().c;
  const pro      = masterDb.prepare("SELECT COUNT(*) as c FROM tenants WHERE plan='pro'").get().c;
  const business = masterDb.prepare("SELECT COUNT(*) as c FROM tenants WHERE plan='business'").get().c;

  // Estimated MRR
  const mrr = (basic * 299) + (pro * 699) + (business * 1499);

  res.json({ total, active, trial, expired, pending, basic, pro, business, mrr });
});

// ── GET /api/admin/tenants ────────────────────────────────────
router.get("/tenants", requireAdmin, (req, res) => {
  const tenants = masterDb.prepare("SELECT * FROM tenants ORDER BY created_at DESC").all();
  res.json(tenants);
});

// ── GET /api/admin/requests ───────────────────────────────────
router.get("/requests", requireAdmin, (req, res) => {
  const requests = masterDb.prepare("SELECT * FROM signup_requests ORDER BY created_at DESC").all();
  res.json(requests);
});

// ── POST /api/admin/activate — Approve a request, create tenant ──
router.post("/activate", requireAdmin, (req, res) => {
  const { requestId, subdomain, plan } = req.body;

  if (!requestId || !subdomain) return res.status(400).json({ error: "requestId and subdomain required" });

  // Validate subdomain
  if (!/^[a-z0-9][a-z0-9-]{1,20}[a-z0-9]$/.test(subdomain)) {
    return res.status(400).json({ error: "Subdomain must be 3-22 lowercase letters/numbers/hyphens" });
  }

  const request = masterDb.prepare("SELECT * FROM signup_requests WHERE id=?").get(requestId);
  if (!request) return res.status(404).json({ error: "Request not found" });

  // Check subdomain availability
  const exists = masterDb.prepare("SELECT id FROM tenants WHERE subdomain=?").get(subdomain);
  if (exists) return res.status(409).json({ error: "Subdomain already taken. Choose another." });

  // Create tenant in master DB
  const trialEnds = Date.now() + (14 * 24 * 60 * 60 * 1000); // 14 days
  const result = masterDb.prepare(`
    INSERT INTO tenants (subdomain, cafe_name, owner_name, mobile, email, city, plan, status, trial_ends)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'trial', ?)
  `).run(
    subdomain, request.cafe_name, request.owner_name,
    request.mobile, request.email, request.city,
    plan || request.plan, trialEnds
  );

  // Initialize tenant database with cafe info
  const db = getTenantDb(subdomain);
  db.prepare("DELETE FROM cafe_info").run();
  db.prepare("INSERT INTO cafe_info (cafe_name, owner_name, mobile, email, city) VALUES (?,?,?,?,?)")
    .run(request.cafe_name, request.owner_name, request.mobile, request.email || "", request.city || "");

  // Mark request as approved
  masterDb.prepare("UPDATE signup_requests SET status='approved' WHERE id=?").run(requestId);

  // Send welcome email to owner
  sendWelcomeEmail(request.owner_name, request.email, subdomain);

  res.json({
    success: true,
    tenant: masterDb.prepare("SELECT * FROM tenants WHERE id=?").get(result.lastInsertRowid),
  });
});

// ── POST /api/admin/tenants/create — Create tenant directly ──
router.post("/tenants/create", requireAdmin, (req, res) => {
  const { cafeName, ownerName, mobile, email, city, subdomain, plan } = req.body;

  if (!cafeName || !ownerName || !mobile || !subdomain) {
    return res.status(400).json({ error: "cafeName, ownerName, mobile, subdomain are required" });
  }
  if (!/^[a-z0-9][a-z0-9-]{1,20}[a-z0-9]$/.test(subdomain)) {
    return res.status(400).json({ error: "Invalid subdomain format" });
  }

  const exists = masterDb.prepare("SELECT id FROM tenants WHERE subdomain=?").get(subdomain);
  if (exists) return res.status(409).json({ error: "Subdomain already taken" });

  const trialEnds = Date.now() + (14 * 24 * 60 * 60 * 1000);
  const result = masterDb.prepare(`
    INSERT INTO tenants (subdomain, cafe_name, owner_name, mobile, email, city, plan, status, trial_ends)
    VALUES (?,?,?,?,?,?,?,'trial',?)
  `).run(subdomain, cafeName, ownerName, mobile, email || "", city || "", plan || "basic", trialEnds);

  const db = getTenantDb(subdomain);
  db.prepare("DELETE FROM cafe_info").run();
  db.prepare("INSERT INTO cafe_info (cafe_name, owner_name, mobile, email, city) VALUES (?,?,?,?,?)")
    .run(cafeName, ownerName, mobile, email || "", city || "");

  // Send welcome email to owner
  sendWelcomeEmail(ownerName, email, subdomain);

  res.json({ success: true, id: result.lastInsertRowid, subdomain });
});

// ── PUT /api/admin/tenants/:id — Update plan / status ────────
router.put("/tenants/:id", requireAdmin, (req, res) => {
  const { plan, status } = req.body;
  const { id } = req.params;

  const tenant = masterDb.prepare("SELECT * FROM tenants WHERE id=?").get(id);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });

  masterDb.prepare("UPDATE tenants SET plan=?, status=? WHERE id=?")
    .run(plan || tenant.plan, status || tenant.status, id);

  res.json({ success: true });
});

// ── DELETE /api/admin/tenants/:id — Delete tenant ────────────
router.delete("/tenants/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const tenant = masterDb.prepare("SELECT * FROM tenants WHERE id=?").get(id);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });

  deleteTenantDb(tenant.subdomain);
  masterDb.prepare("DELETE FROM tenants WHERE id=?").run(id);

  res.json({ success: true });
});

// ── POST /api/admin/tenants/:id/reset-pin — Reset owner PIN ──
router.post("/tenants/:id/reset-pin", requireAdmin, (req, res) => {
  const { id } = req.params;
  const { pin } = req.body;

  if (!pin || !/^\d{4}$/.test(pin)) {
    return res.status(400).json({ error: "PIN must be exactly 4 digits" });
  }

  const tenant = masterDb.prepare("SELECT * FROM tenants WHERE id=?").get(id);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });

  // Update PIN directly in the tenant's DB
  const db = getTenantDb(tenant.subdomain);
  db.prepare("UPDATE cafe_info SET pin=? WHERE id=1").run(pin);

  res.json({ success: true });
});

// ── DELETE /api/admin/requests/:id — Delete request ──────────
router.delete("/requests/:id", requireAdmin, (req, res) => {
  masterDb.prepare("DELETE FROM signup_requests WHERE id=?").run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
