import React, { useState, useEffect } from "react";
import Login from "./components/Login";
import SetPin from "./components/SetPin";
import Navbar from "./components/Navbar";
import Orders from "./components/Orders";
import Bills from "./components/Bills";
import MenuItems from "./components/MenuItems";
import StaffManagement from "./components/StaffManagement";
import Settings from "./components/Settings";
import api, { getTenantId } from "./utils/api";

export default function App() {
  // States: loading | no-tenant | setpin | login | app
  const [appState, setAppState]   = useState("loading");
  const [cafeInfo, setCafeInfo]   = useState(null);
  const [userRole, setUserRole]   = useState("owner");
  const [staffInfo, setStaffInfo] = useState(null);
  const [activePage, setActivePage] = useState("orders");

  useEffect(() => {
    const tenantId = getTenantId();
    if (!tenantId) {
      setAppState("no-tenant");
      return;
    }

    const token = localStorage.getItem("cafe_token");
    const cafe  = localStorage.getItem("cafe_info");
    const role  = localStorage.getItem("user_role") || "owner";
    const staff = localStorage.getItem("staff_info");

    if (token && cafe) {
      // Already logged in — restore session
      setCafeInfo(JSON.parse(cafe));
      setUserRole(role);
      if (staff) setStaffInfo(JSON.parse(staff));
      setActivePage("orders");
      setAppState("app");
    } else {
      // Not logged in — check if setup is done
      api.get("/api/setup/cafe-status")
        .then(res => {
          if (res.data.setupDone) {
            setAppState("login");
          } else {
            // hasCafe but no PIN set yet → first-time PIN setup
            setAppState("setpin");
          }
        })
        .catch(() => {
          // If request fails (e.g. tenant not found), show login anyway
          setAppState("login");
        });
    }
  }, []);

  const handlePinSet = () => {
    setAppState("login");
  };

  const handleLoggedIn = (data) => {
    const role  = data.role || "owner";
    const staff = data.staff || null;
    setCafeInfo(data.cafe || data);
    setUserRole(role);
    setStaffInfo(staff);
    setActivePage("orders");
    setAppState("app");
  };

  const handleLogout = () => {
    localStorage.removeItem("cafe_token");
    localStorage.removeItem("cafe_info");
    localStorage.removeItem("user_role");
    localStorage.removeItem("staff_info");
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

  // ── No tenant configured ─────────────────────────────────
  if (appState === "no-tenant") {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">☕</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">CafeBill SaaS</h1>
          <p className="text-gray-500 mb-6">
            No cafe found. Please open this app from your cafe's unique URL.
          </p>
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-left">
            <p className="text-xs font-semibold text-orange-700 mb-2">For development:</p>
            <p className="text-xs text-gray-600">
              Add <code className="bg-gray-100 px-1 rounded">?tenant=yourcafe</code> to the URL, or set{" "}
              <code className="bg-gray-100 px-1 rounded">tenant_id</code> in localStorage.
            </p>
          </div>
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
    <div className="min-h-screen bg-orange-50">
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
    </div>
  );
}
