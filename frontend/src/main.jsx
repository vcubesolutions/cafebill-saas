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

// ── Set per-tenant manifest (SYNCHRONOUS) ────────────────────
// Point <link rel="manifest"> to the server-side dynamic endpoint RIGHT NOW,
// before the browser fetches it. The server returns the correct cafe name
// and start_url (with ?tenant=) so "Add to Home Screen" works properly.
(function setDynamicManifest() {
  const params = new URLSearchParams(window.location.search);
  const tenant = params.get("tenant");
  if (!tenant) return;

  // Save to localStorage so PWA can recover tenant if URL loses the param
  try { localStorage.setItem("tenant_id", tenant); } catch (_) {}

  // Synchronously redirect the manifest link to our server endpoint.
  // The browser fetches this URL when the user triggers "Add to Home Screen",
  // and the server will return the right cafe name + start_url at that moment.
  const manifestEl = document.getElementById("pwa-manifest");
  if (manifestEl) {
    manifestEl.href = `/api/public/manifest?tenant=${encodeURIComponent(tenant)}`;
  }

  // Also update iOS home-screen title asynchronously (iOS uses the meta tag, not manifest name)
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
