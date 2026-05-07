require("dotenv").config();
const express    = require("express");
const cors       = require("cors");
const path       = require("path");

const tenantMiddleware = require("./middleware/tenant");
const { router: publicRouter } = require("./routes/public");
const adminRouter  = require("./routes/admin");
const tenantRouter = require("./routes/tenant");

const app  = express();
const PORT = process.env.PORT || 5000;

// ── CORS — allow all origins in dev (lock down in prod) ───────
app.use(cors({ origin: true, credentials: true }));

// ── Body parsing ──────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ── Serve built React tenant app ─────────────────────────────
// In production the frontend is built into frontend/dist and served here.
// In development the Vite dev server (port 3001) handles the frontend.
const FRONTEND_DIST = path.join(__dirname, "../frontend/dist");
const fs = require("fs");
const frontendBuilt = fs.existsSync(FRONTEND_DIST);

if (frontendBuilt) {
  app.use("/app", express.static(FRONTEND_DIST));
}

// ── Serve landing page ────────────────────────────────────────
app.use(express.static(path.join(__dirname, "../landing")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../landing/index.html"));
});

// ── Serve admin dashboard ─────────────────────────────────────
app.use("/admin", express.static(path.join(__dirname, "../admin")));
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "../admin/index.html"));
});
app.get("/admin/", (req, res) => {
  res.sendFile(path.join(__dirname, "../admin/index.html"));
});

// ── Public routes (no tenant required) ───────────────────────
app.use("/api/public", publicRouter);

// ── Admin routes (protected) ──────────────────────────────────
app.use("/api/admin", adminRouter);

// ── Tenant middleware — resolves tenant for all /api/* below ──
app.use("/api", tenantMiddleware);

// ── Tenant-scoped billing routes ──────────────────────────────
app.use("/api", tenantRouter);

// ── Health check ──────────────────────────────────────────────
app.get("/health", (req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

// ── 404 fallback — only for /api routes ───────────────────────
app.use("/api", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ── Catch-all SPA: serve React app for /app/* routes ─────────
// This lets the React Router handle deep links inside the tenant app.
if (frontendBuilt) {
  app.get("/app/*", (req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, "index.html"));
  });
}

// ── Catch-all: send landing page for unknown routes ───────────
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "../landing/index.html"));
});

app.listen(PORT, () => {
  console.log(`\n☕ CafeBill SaaS Backend running on port ${PORT}`);
  console.log(`   Landing page : http://localhost:${PORT}`);
  console.log(`   Admin panel  : http://localhost:${PORT}/admin`);
  console.log(`   API          : http://localhost:${PORT}/api`);
  console.log(`   Tenant app   : http://localhost:${PORT}/app?tenant=yoursubdomain`);
  console.log(`\n   Dev tip: Use ?tenant=yoursubdomain in the browser URL or API calls\n`);
});
