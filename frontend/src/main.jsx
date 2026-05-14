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

// ── Set per-tenant manifest dynamically ──────────────────────
function setDynamicManifest() {
  const params = new URLSearchParams(window.location.search);
  const tenant = params.get("tenant") || localStorage.getItem("tenant_id");
  if (!tenant) return;

  const manifestEl = document.getElementById("pwa-manifest");
  if (manifestEl) {
    // Fetch tenant info and build a custom manifest blob
    fetch(`/api/public/cafe-name?tenant=${tenant}`)
      .then((r) => r.json())
      .then((data) => {
        const name = data.cafeName || "CafeBill";
        const manifest = {
          name: `${name}`,
          short_name: name.length > 12 ? name.split(" ")[0] : name,
          description: "Smart billing for your cafe",
          start_url: `/app/?tenant=${tenant}`,
          scope: "/app/",
          display: "standalone",
          orientation: "portrait",
          background_color: "#fff7ed",
          theme_color: "#ea580c",
          icons: [
            { src: "/app/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
            { src: "/app/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
          ],
          shortcuts: [
            { name: "New Order", url: `/app/?tenant=${tenant}&page=orders`, icons: [{ src: "/app/icon.svg", sizes: "any" }] },
            { name: "Bills",     url: `/app/?tenant=${tenant}&page=bills`,  icons: [{ src: "/app/icon.svg", sizes: "any" }] },
          ],
        };
        const blob = new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" });
        manifestEl.href = URL.createObjectURL(blob);

        // Update page title and iOS title
        document.title = `${name} — CafeBill`;
        const appleTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
        if (appleTitleMeta) appleTitleMeta.content = name;
      })
      .catch(() => {}); // fallback to default manifest
  }
}

setDynamicManifest();

// ── Render app ────────────────────────────────────────────────
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
