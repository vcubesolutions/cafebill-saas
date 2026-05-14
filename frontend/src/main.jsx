import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// ── Register Service Worker ───────────────────────────────────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/app/sw.js", { scope: "/app/" })
      .then((reg) => {
        console.log("[CafeBill] Service worker registered, scope:", reg.scope);

        // Check for SW updates
        reg.addEventListener("updatefound", () => {
          const newSW = reg.installing;
          newSW?.addEventListener("statechange", () => {
            if (newSW.state === "installed" && navigator.serviceWorker.controller) {
              // New version available — notify the app
              window.dispatchEvent(new CustomEvent("sw-update-available"));
            }
          });
        });
      })
      .catch((err) => console.warn("[CafeBill] SW registration failed:", err));
  });
}

// ── Tenant bootstrap (runs synchronously before React renders) ───
// 1. Resolve tenant from ?tenant= param OR localStorage
// 2. Always write tenant_id to localStorage (so future loads without ?tenant= still work)
// 3. Always inject ?tenant= into the address bar (so iOS "Add to Home Screen"
//    saves the full correct URL including tenant)
// 4. Point the PWA manifest link to the server-side dynamic endpoint
(function bootstrapTenant() {
  const params  = new URLSearchParams(window.location.search);
  const fromUrl = params.get("tenant");
  const fromStorage = localStorage.getItem("tenant_id");
  const tenant  = fromUrl || fromStorage;

  if (!tenant) return; // no tenant known yet — app will show "no-tenant" screen

  // Persist tenant so app works even after URL loses the param (e.g. browser reload)
  try { localStorage.setItem("tenant_id", tenant); } catch (_) {}

  // Inject ?tenant= into address bar RIGHT NOW (synchronous, before React renders)
  // This ensures iOS Safari saves the correct URL when user taps "Add to Home Screen"
  if (!fromUrl) {
    const url = new URL(window.location.href);
    url.searchParams.set("tenant", tenant);
    window.history.replaceState(null, "", url.toString());
  }

  // Point manifest link to server-side endpoint — browser fetches this when
  // the user triggers "Add to Home Screen", getting correct name + start_url
  const manifestEl = document.getElementById("pwa-manifest");
  if (manifestEl) {
    manifestEl.href = `/api/public/manifest?tenant=${encodeURIComponent(tenant)}`;
  }

  // Update iOS home-screen title (async — iOS uses meta tag for icon label)
  fetch(`/api/public/cafe-name?tenant=${encodeURIComponent(tenant)}`)
    .then((r) => r.json())
    .then((data) => {
      const name = data.cafeName || "CafeBill";
      document.title = `${name} — CafeBill`;
      const appleTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
      if (appleTitleMeta) appleTitleMeta.content = name;
    })
    .catch(() => {});
})();

// ── Render app ────────────────────────────────────────────────
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
