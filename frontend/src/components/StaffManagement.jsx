import React, { useEffect, useState } from "react";
import api from "../utils/api";

const API   = "/api/setup";
const ROLES = ["Cashier", "Manager", "Waiter", "Kitchen"];

export default function StaffManagement() {
  const [staff, setStaff]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg]       = useState("");

  const [showAdd, setShowAdd]   = useState(false);
  const [newName, setNewName]   = useState("");
  const [newRole, setNewRole]   = useState("Cashier");
  const [newPin, setNewPin]     = useState(["", "", "", ""]);
  const [addErr, setAddErr]     = useState("");
  const [adding, setAdding]     = useState(false);

  const [resetStaffId, setResetStaffId] = useState(null);
  const [resetPin, setResetPin]         = useState(["", "", "", ""]);
  const [resetErr, setResetErr]         = useState("");
  const [resetting, setResetting]       = useState(false);

  useEffect(() => { fetchStaff(); }, []);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const res = await api.get(`${API}/staff`);
      setStaff(res.data);
    } catch { flash("❌ Failed to load staff."); }
    setLoading(false);
  };

  const flash = (text) => { setMsg(text); setTimeout(() => setMsg(""), 3500); };

  const handlePinInput = (val, idx, pins, setPins) => {
    const digit   = val.replace(/\D/g, "").slice(-1);
    const updated = [...pins];
    updated[idx]  = digit;
    setPins(updated);
    // Auto-advance to next box
    if (digit && idx < 3) document.getElementById(`pin-${idx + 1}`)?.focus();
  };

  const handlePinKeyDown = (e, idx, pins, setPins) => {
    if (e.key === "Backspace") {
      if (pins[idx]) {
        const u = [...pins]; u[idx] = ""; setPins(u);
      } else if (idx > 0) {
        document.getElementById(`pin-${idx - 1}`)?.focus();
      }
    }
  };

  const handleAdd = async () => {
    setAddErr("");
    if (!newName.trim()) { setAddErr("Name is required."); return; }
    const pin = newPin.join("");
    if (pin.length !== 4) { setAddErr("Enter a 4-digit PIN."); return; }
    setAdding(true);
    try {
      await api.post(`${API}/staff/add`, { name: newName.trim(), role: newRole, pin });
      flash(`✅ ${newName} added as ${newRole}!`);
      setShowAdd(false);
      setNewName(""); setNewRole("Cashier"); setNewPin(["", "", "", ""]);
      fetchStaff();
    } catch (e) { setAddErr(e.response?.data?.error || "Failed to add staff."); }
    setAdding(false);
  };

  const toggleActive = async (member) => {
    try {
      await api.put(`${API}/staff/${member.id}`, { name: member.name, role: member.role, active: !member.active });
      setStaff(prev => prev.map(s => s.id === member.id ? { ...s, active: s.active ? 0 : 1 } : s));
      flash(member.active ? `⏸️ ${member.name} deactivated.` : `▶️ ${member.name} activated.`);
    } catch { flash("❌ Failed to update."); }
  };

  const handleDelete = async (member) => {
    if (!window.confirm(`Remove ${member.name} from staff?`)) return;
    try {
      await api.delete(`${API}/staff/${member.id}`);
      setStaff(prev => prev.filter(s => s.id !== member.id));
      flash(`🗑️ ${member.name} removed.`);
    } catch { flash("❌ Failed to delete."); }
  };

  const openResetPin = (member) => {
    setResetStaffId(member.id);
    setResetPin(["", "", "", ""]);
    setResetErr("");
    setTimeout(() => document.getElementById("pin-0")?.focus(), 100);
  };

  const handleResetPin = async () => {
    const pin = resetPin.join("");
    if (pin.length !== 4) { setResetErr("Enter a 4-digit PIN."); return; }
    setResetting(true);
    try {
      await api.post(`${API}/staff/${resetStaffId}/reset-pin`, { pin });
      flash("✅ PIN updated successfully!");
      setResetStaffId(null);
    } catch (e) { setResetErr(e.response?.data?.error || "Failed to reset PIN."); }
    setResetting(false);
  };

  const activeCount = staff.filter(s => s.active).length;

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-2xl font-bold text-orange-700">👥 Staff Management</h2>
        <button onClick={() => { setShowAdd(true); setAddErr(""); setNewPin(["","","",""]); }}
          className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1">
          + Add Staff
        </button>
      </div>
      <p className="text-gray-500 text-sm mb-5">
        {staff.length} staff member{staff.length !== 1 ? "s" : ""} · {activeCount} active
      </p>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium ${
          msg.startsWith("✅") || msg.startsWith("▶️") ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
        }`}>{msg}</div>
      )}

      {loading ? (
        <div className="text-center py-10 text-gray-400">Loading staff...</div>
      ) : staff.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-3">👤</div>
          <p className="text-gray-400 font-medium">No staff added yet.</p>
          <p className="text-gray-400 text-sm mt-1">Click "+ Add Staff" to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {staff.map(member => (
            <div key={member.id}
              className={`bg-white rounded-2xl shadow flex items-center gap-4 px-4 py-4 ${!member.active ? "opacity-60" : ""}`}>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0 ${
                member.active ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-400"
              }`}>
                {member.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-800">{member.name}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 font-medium">{member.role}</span>
                  {!member.active && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-500 font-medium">Inactive</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">PIN: ••••</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => openResetPin(member)}
                  className="p-2 rounded-lg text-blue-500 hover:bg-blue-50 text-sm" title="Reset PIN">🔑</button>
                <button onClick={() => toggleActive(member)}
                  className={`p-2 rounded-lg text-sm ${member.active ? "text-yellow-500 hover:bg-yellow-50" : "text-green-500 hover:bg-green-50"}`}
                  title={member.active ? "Deactivate" : "Activate"}>
                  {member.active ? "⏸️" : "▶️"}
                </button>
                <button onClick={() => handleDelete(member)}
                  className="p-2 rounded-lg text-red-400 hover:bg-red-50 text-sm" title="Remove">🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Staff Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-4">➕ Add New Staff</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Full Name *</label>
                <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Ravi Kumar"
                  className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" autoFocus />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Role</label>
                <div className="flex flex-wrap gap-2">
                  {ROLES.map(r => (
                    <button key={r} onClick={() => setNewRole(r)}
                      className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                        newRole === r ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-600 border-gray-300 hover:border-orange-400"
                      }`}>{r}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Set 4-Digit PIN *</label>
                <div className="flex gap-3 justify-center my-2">
                  {newPin.map((digit, idx) => (
                    <input key={idx} id={`pin-${idx}`} type="password" inputMode="numeric" maxLength={1} value={digit}
                      onChange={e => handlePinInput(e.target.value, idx, newPin, setNewPin)}
                      onKeyDown={e => handlePinKeyDown(e, idx, newPin, setNewPin)}
                      className="w-12 h-12 text-center text-xl font-bold border-2 rounded-xl focus:outline-none focus:border-orange-500" />
                  ))}
                </div>
              </div>
              {addErr && <p className="text-red-500 text-xs text-center">{addErr}</p>}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowAdd(false); setAddErr(""); }}
                className="flex-1 py-2.5 rounded-xl border text-gray-600 font-semibold text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={handleAdd} disabled={adding}
                className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm disabled:opacity-60">
                {adding ? "Adding..." : "Add Staff"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset PIN Modal */}
      {resetStaffId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-1">🔑 Reset Staff PIN</h3>
            <p className="text-sm text-gray-500 mb-4">
              New PIN for {staff.find(s => s.id === resetStaffId)?.name}
            </p>
            <div className="flex gap-3 justify-center my-4">
              {resetPin.map((digit, idx) => (
                <input key={idx} id={`pin-${idx}`} type="password" inputMode="numeric" maxLength={1} value={digit}
                  onChange={e => handlePinInput(e.target.value, idx, resetPin, setResetPin)}
                  onKeyDown={e => handlePinKeyDown(e, idx, resetPin, setResetPin)}
                  className="w-12 h-12 text-center text-xl font-bold border-2 rounded-xl focus:outline-none focus:border-orange-500" />
              ))}
            </div>
            {resetErr && <p className="text-red-500 text-xs text-center mb-2">{resetErr}</p>}
            <div className="flex gap-3">
              <button onClick={() => setResetStaffId(null)}
                className="flex-1 py-2.5 rounded-xl border text-gray-600 font-semibold text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={handleResetPin} disabled={resetting}
                className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm disabled:opacity-60">
                {resetting ? "Saving..." : "Update PIN"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
