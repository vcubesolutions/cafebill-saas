import React, { useState } from "react";

export default function Navbar({ activePage, setActivePage, cafeInfo, userRole, staffInfo, onLogout }) {
  const isOwner  = userRole === "owner";
  const [menuOpen, setMenuOpen] = useState(false);

  const tabs = [
    { id: "orders",   label: "🛒 New Order", ownerOnly: false },
    { id: "bills",    label: "🧾 Bills",      ownerOnly: false },
    { id: "menu",     label: "🍽️ Menu Items", ownerOnly: true  },
    { id: "staff",    label: "👥 Staff",      ownerOnly: true  },
    { id: "settings", label: "⚙️ Settings",   ownerOnly: true  },
  ].filter(t => isOwner || !t.ownerOnly);

  const displayName = isOwner
    ? (cafeInfo?.ownerName || "Owner")
    : (staffInfo?.name || "Staff");

  return (
    <nav className="bg-orange-600 text-white shadow-lg">
      <div className="max-w-6xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-2">

          {/* Cafe name + user info */}
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-wide truncate">
              ☕ {cafeInfo?.cafeName || "CafeBill"}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${
                isOwner ? "bg-orange-800 text-orange-100" : "bg-orange-500 text-white"
              }`}>
                {isOwner ? "👑 Owner" : "👤 Staff"}
              </span>
              <p className="text-orange-200 text-xs truncate">{displayName}</p>
            </div>
          </div>

          {/* Desktop tabs + logout */}
          <div className="hidden sm:flex items-center gap-1.5 flex-wrap justify-end">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActivePage(tab.id)}
                className={`px-3 py-2 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                  activePage === tab.id
                    ? "bg-white text-orange-600 shadow"
                    : "bg-orange-500 hover:bg-orange-400 text-white"
                }`}>
                {tab.label}
              </button>
            ))}
            <button
              onClick={onLogout}
              className="px-3 py-2 rounded-full text-xs font-semibold bg-orange-800 hover:bg-orange-900 text-white transition-all ml-1"
              title="Logout">
              🚪 Logout
            </button>
          </div>

          {/* Mobile hamburger */}
          <div className="sm:hidden">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="bg-orange-500 hover:bg-orange-400 px-3 py-2 rounded-xl text-sm font-bold"
            >☰</button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="sm:hidden mt-3 space-y-1 pb-1 border-t border-orange-500 pt-3">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActivePage(tab.id); setMenuOpen(false); }}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  activePage === tab.id
                    ? "bg-white text-orange-600"
                    : "bg-orange-500 hover:bg-orange-400 text-white"
                }`}>
                {tab.label}
              </button>
            ))}
            <button
              onClick={() => { onLogout(); setMenuOpen(false); }}
              className="w-full text-left px-4 py-2.5 rounded-xl text-sm font-semibold bg-orange-800 hover:bg-orange-900 text-white"
            >🚪 Logout</button>
          </div>
        )}
      </div>
    </nav>
  );
}
