import React, { useState, useRef } from "react";
import api from "../utils/api";

function PinInput({ id, value, onChange, onKeyDown, autoFocus }) {
  return (
    <input
      id={id}
      type="password"
      inputMode="numeric"
      maxLength={1}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      autoFocus={autoFocus}
      className="w-14 h-14 text-center text-2xl font-bold border-2 rounded-xl focus:outline-none focus:border-orange-500 bg-gray-50"
    />
  );
}

export default function SetPin({ onPinSet }) {
  const [pin, setPin]         = useState(["", "", "", ""]);
  const [confirm, setConfirm] = useState(["", "", "", ""]);
  const [error, setError]     = useState("");
  const [saving, setSaving]   = useState(false);

  const handleChange = (val, idx, arr, setArr, prefix) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const updated = [...arr];
    updated[idx] = digit;
    setArr(updated);
    // Auto-advance to next box
    if (digit && idx < 3) {
      document.getElementById(`${prefix}-${idx + 1}`)?.focus();
    }
  };

  const handleKeyDown = (e, idx, arr, setArr, prefix) => {
    if (e.key === "Backspace") {
      if (arr[idx]) {
        // Clear current box
        const updated = [...arr];
        updated[idx] = "";
        setArr(updated);
      } else if (idx > 0) {
        // Move to previous box
        document.getElementById(`${prefix}-${idx - 1}`)?.focus();
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const p = pin.join("");
    const c = confirm.join("");
    if (p.length !== 4) { setError("Please enter a complete 4-digit PIN."); return; }
    if (p !== c)        { setError("PINs do not match. Try again."); setConfirm(["","","",""]); setTimeout(() => document.getElementById("confirm-0")?.focus(), 50); return; }

    setSaving(true);
    try {
      await api.post("/api/setup/complete", { pin: p });
      onPinSet();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to set PIN. Please try again.");
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="bg-orange-600 px-6 py-8 text-center text-white">
          <div className="text-5xl mb-3">☕</div>
          <h1 className="text-2xl font-bold">Welcome to CafeBill!</h1>
          <p className="text-orange-200 text-sm mt-2">
            Set a 4-digit owner PIN to secure your account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm text-center">
              ⚠️ {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3 text-center">
              Enter your PIN
            </label>
            <div className="flex gap-3 justify-center">
              {pin.map((digit, idx) => (
                <PinInput
                  key={idx}
                  id={`pin-${idx}`}
                  value={digit}
                  autoFocus={idx === 0}
                  onChange={e => handleChange(e.target.value, idx, pin, setPin, "pin")}
                  onKeyDown={e => handleKeyDown(e, idx, pin, setPin, "pin")}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3 text-center">
              Confirm PIN
            </label>
            <div className="flex gap-3 justify-center">
              {confirm.map((digit, idx) => (
                <PinInput
                  key={idx}
                  id={`confirm-${idx}`}
                  value={digit}
                  onChange={e => handleChange(e.target.value, idx, confirm, setConfirm, "confirm")}
                  onKeyDown={e => handleKeyDown(e, idx, confirm, setConfirm, "confirm")}
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold hover:bg-orange-700 disabled:opacity-50 transition-all text-base"
          >
            {saving ? "Setting PIN..." : "🔐 Set PIN & Continue"}
          </button>

          <p className="text-xs text-gray-400 text-center">
            You'll use this PIN to log in as the cafe owner.
          </p>
        </form>
      </div>
    </div>
  );
}
