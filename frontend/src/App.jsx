import React, { useState, useEffect } from "react";
import Login from "./components/Login";
import SetPin from "./components/SetPin";
import Navbar from "./components/Navbar";
import Orders from "./components/Orders";
import Bills from "./components/Bills";
import MenuItems from "./components/MenuItems";
import StaffManagement from "./components/StaffManagement";
import Settings from "./components/Settings";
import SetupWizard from "./components/SetupWizard";
import InstallPrompt from "./components/InstallPrompt";
import api, { getTenantId } from "./utils/api";

export default function App() {
  // States: loading | no-tenant | setpin | login | app
  const [appState, setAppState]     = useState("loading");
  const [cafeInfo, setCafeInfo]     = useState(null);
  const [userRole, setUserRole]     = useState("owner");
  const [staffInfo, setStaffInfo]   = useState(null);
  const [activePage, setActivePage] = useState("orders");
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    const tenantId = getTenantId();
    if (!tenantId) {
      setAppState("no-tenant");
      return;
    }

    const token        = localStorage.getItem("cafe_token");
    const cafe         = localStorage.getItem("cafe_info");
    const role         = localStorage.getItem("user_role") || "owner";
    const staff        = localStorage.getItem("staff_info");
    const savedTenant  = localStorage.getItem("active_tenant");

    if (token && cafe && savedTenant === tenantId) {
      // Already logged in for this tenant — restore session
      setCafeInfo(JSON.parse(cafe));
      setUserRole(role);
      if (staff) setStaffInfo(JSON.parse(staff));
      setActivePage("orders");
      setAppState("app");
    } else {
      // Different tenant or not logged in — clear old session
      localStorage.removeItem("cafe_token");
      localStorage.removeItem("cafe_info");
      localStorage.removeItem("user_role");
      localStorage.removeItem("staff_info");
      localStorage.removeItem("active_tenant");
      // Not logged in — check if setup is done
      api.get("/api/setup/cafe-status")
        .then(res => {
          if (res.data.setupDone) {
            // Cafe exists and PIN is set → go to login
            setAppState("login");
          } else if (res.data.hasCafe) {
            // Cafe exists but PIN not set yet → first-time PIN setup
            setAppState("setpin");
          } else {
            // Cafe record missing (shouldn't normally happen)
            setAppState("no-tenant");
          }
        })
        .catch((err) => {
          if (err?.response?.status === 404) {
            // Tenant not registered — show proper error
            setAppState("no-tenant");
          } else {
            // Other server error — still try setpin as fallback
            setAppState("setpin");
          }
        });
    }
  }, []);

  const handlePinSet = () => {
    setAppState("login");
  };

  const handleLoggedIn = (data) => {
    const role     = data.role || "owner";
    const staff    = data.staff || null;
    const tenantId = getTenantId();
    setCafeInfo(data.cafe || data);
    setUserRole(role);
    setStaffInfo(staff);
    localStorage.setItem("active_tenant", tenantId);
    setActivePage("orders");
    setAppState("app");
    // Show setup wizard on first login (owner only, not staff)
    const wizardKey = `wizard_done_${tenantId}`;
    if (role === "owner" && !localStorage.getItem(wizardKey)) {
      setShowWizard(true);
    }
  };

  const handleWizardComplete = () => {
    const wizardKey = `wizard_done_${getTenantId()}`;
    localStorage.setItem(wizardKey, "1");
    setShowWizard(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("cafe_token");
    localStorage.removeItem("cafe_info");
    localStorage.removeItem("user_role");
    localStorage.removeItem("staff_info");
    localStorage.removeItem("active_tenant");
    setCafeInfo(null);
    setUserRole("owner");
    setStaffInfo(null);
    setAppState("login");
  };

  const handleCafeInfoUpdate = (updated) => {
    setCafeInfo(updated);
    localStorage.setItem("cafe_info", JSON.stringify(updated));
  };

  // ── Loading ──────────────────────────────────────────────
  if (appState === "loading") {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">☕</div>
          <p className="text-orange-600 font-semibold">Loading CafeBill...</p>
        </div>
      </div>
    );
  }

  // ── No tenant / cafe not found ───────────────────────────
  if (appState === "no-tenant") {
    const tenantId = getTenantId();
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">☕</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Cafe Not Found</h1>
          {tenantId ? (
            <>
              <p className="text-gray-500 mb-6">
                The cafe <span className="font-semibold text-orange-600">"{tenantId}"</span> hasn't been registered yet.
                Please contact your admin or check the link in your welcome email.
              </p>
              <a
                href="/"
                className="block w-full bg-orange-600 text-white py-3 rounded-xl font-bold hover:bg-orange-700 transition-all text-base"
              >
                ← Back to Home
              </a>
            </>
          ) : (
            <>
              <p className="text-gray-500 mb-6">
                Please open this app from your cafe's unique login link.
              </p>
              <a
                href="/"
                className="block w-full bg-orange-600 text-white py-3 rounded-xl font-bold hover:bg-orange-700 transition-all text-base"
              >
                ← Go to CafeBill
              </a>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── First-time PIN setup ─────────────────────────────────
  if (appState === "setpin") {
    return <SetPin onPinSet={handlePinSet} />;
  }

  // ── Login ────────────────────────────────────────────────
  if (appState === "login") {
    return <Login onLoggedIn={handleLoggedIn} />;
  }

  // ── Main Billing App ─────────────────────────────────────
  return (
    <div className="min-h-screen bg-orange-50 overflow-x-hidden w-full">
      {/* First-time setup wizard (owner only, shown once) */}
      {showWizard && (
        <SetupWizard cafeInfo={cafeInfo} onComplete={handleWizardComplete} />
      )}

      <Navbar
        activePage={activePage}
        setActivePage={setActivePage}
        cafeInfo={cafeInfo}
        userRole={userRole}
        staffInfo={staffInfo}
        onLogout={handleLogout}
      />
      <main className="py-6 px-2">
        {activePage === "orders"   && <Orders setActivePage={setActivePage} />}
        {activePage === "bills"    && <Bills cafeInfo={cafeInfo} />}
        {activePage === "menu"     && <MenuItems />}
        {activePage === "staff"    && <StaffManagement />}
        {activePage === "settings" && <Settings cafeInfo={cafeInfo} onCafeInfoUpdate={handleCafeInfoUpdate} />}
      </main>
      <footer className="text-center text-xs text-gray-400 pb-6">
        ☕ {cafeInfo?.cafeName || "CafeBill"} — Powered by CafeBill SaaS
      </footer>

      {/* PWA install prompt (Android banner + iOS instructions) */}
      {!showWizard && <InstallPrompt />}
    </div>
  );
}
