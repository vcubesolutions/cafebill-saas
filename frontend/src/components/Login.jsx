import React, { useState, useEffect } from "react";
import api from "../utils/api";

// ── Reusable 4-box PIN input ──────────────────────────────────
function PinBoxes({ prefix, pin, setPin }) {
  const handleChange = (val, idx) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const updated = [...pin];
    updated[idx] = digit;
    setPin(updated);
    if (digit && idx < 3) document.getElementById(`${prefix}-${idx + 1}`)?.focus();
  };

  const handleKeyDown = (e, idx) => {
    if (e.key === "Backspace") {
      if (pin[idx]) {
        const updated = [...pin]; updated[idx] = ""; setPin(updated);
      } else if (idx > 0) {
        document.getElementById(`${prefix}-${idx - 1}`)?.focus();
      }
    }
  };

  return (
    <div className="flex gap-3 justify-center">
      {pin.map((digit, idx) => (
        <input
          key={idx}
          id={`${prefix}-${idx}`}
          type="password"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          autoFocus={idx === 0}
          onChange={e => handleChange(e.target.value, idx)}
          onKeyDown={e => handleKeyDown(e, idx)}
          className="w-14 h-14 text-center text-2xl font-bold border-2 rounded-xl focus:outline-none focus:border-orange-500 bg-gray-50"
        />
      ))}
    </div>
  );
}

// ── Forgot PIN flow ───────────────────────────────────────────
function ForgotPin({ onBack, onSuccess }) {
  const [step, setStep]       = useState("mobile"); // mobile | otp | newpin
  const [mobile, setMobile]   = useState("");
  const [otp, setOtp]         = useState("");
  const [newPin, setNewPin]   = useState(["", "", "", ""]);
  const [confirm, setConfirm] = useState(["", "", "", ""]);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [demoOtp, setDemoOtp] = useState(""); // shown in dev mode

  const sendOtp = async () => {
    setError("");
    if (!mobile.trim()) { setError("Please enter your registered mobile number."); return; }
    setLoading(true);
    try {
      const res = await api.post("/api/auth/send-otp", { mobile });
      if (res.data.demo && res.data.otp) setDemoOtp(res.data.otp);
      setStep("otp");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to send OTP.");
    }
    setLoading(false);
  };

  const verifyOtp = async () => {
    setError("");
    if (otp.length < 6) { setError("Enter the 6-digit OTP."); return; }
    setLoading(true);
    try {
      await api.post("/api/auth/verify-otp", { mobile, otp });
      setStep("newpin");
    } catch (err) {
      setError(err.response?.data?.error || "Invalid or expired OTP.");
    }
    setLoading(false);
  };

  const resetPin = async () => {
    setError("");
    const p = newPin.join("");
    const c = confirm.join("");
    if (p.length !== 4) { setError("Enter a complete 4-digit PIN."); return; }
    if (p !== c) { setError("PINs do not match."); setConfirm(["","","",""]); return; }
    setLoading(true);
    try {
      await api.post("/api/auth/reset-pin", { mobile, pin: p });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to reset PIN.");
    }
    setLoading(false);
  };

  return (
    <div className="p-6 space-y-5">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-orange-600 hover:underline">
        ← Back to login
      </button>

      <div className="text-center">
        <div className="text-4xl mb-2">🔑</div>
        <h2 className="text-lg font-bold text-gray-800">Reset Owner PIN</h2>
        <p className="text-xs text-gray-400 mt-1">
          {step === "mobile" && "Enter your registered mobile number"}
          {step === "otp"    && `OTP sent to ${mobile}`}
          {step === "newpin" && "Set your new PIN"}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm text-center">
          ⚠️ {error}
        </div>
      )}

      {/* Step 1 — Mobile */}
      {step === "mobile" && (
        <div className="space-y-4">
          <input
            type="tel"
            value={mobile}
            onChange={e => setMobile(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendOtp()}
            placeholder="Registered mobile number"
            autoFocus
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <button onClick={sendOtp} disabled={loading}
            className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold hover:bg-orange-700 disabled:opacity-50">
            {loading ? "Sending OTP..." : "📱 Send OTP"}
          </button>
        </div>
      )}

      {/* Step 2 — OTP */}
      {step === "otp" && (
        <div className="space-y-4">
          {demoOtp && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-xl text-sm text-center">
              🧪 Dev mode — OTP: <strong className="text-lg tracking-widest">{demoOtp}</strong>
            </div>
          )}
          <input
            type="number"
            value={otp}
            onChange={e => setOtp(e.target.value.slice(0, 6))}
            onKeyDown={e => e.key === "Enter" && verifyOtp()}
            placeholder="Enter 6-digit OTP"
            autoFocus
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-center tracking-widest text-lg font-bold focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <button onClick={verifyOtp} disabled={loading}
            className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold hover:bg-orange-700 disabled:opacity-50">
            {loading ? "Verifying..." : "✅ Verify OTP"}
          </button>
          <button onClick={() => { setStep("mobile"); setOtp(""); setDemoOtp(""); }}
            className="w-full text-sm text-gray-400 hover:text-orange-600">
            Resend OTP
          </button>
        </div>
      )}

      {/* Step 3 — New PIN */}
      {step === "newpin" && (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3 text-center">New PIN</label>
            <PinBoxes prefix="new" pin={newPin} setPin={setNewPin} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3 text-center">Confirm PIN</label>
            <PinBoxes prefix="cnf" pin={confirm} setPin={setConfirm} />
          </div>
          <button onClick={resetPin} disabled={loading}
            className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold hover:bg-orange-700 disabled:opacity-50">
            {loading ? "Saving..." : "🔐 Set New PIN"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Login component ──────────────────────────────────────
export default function Login({ onLoggedIn }) {
  const [mode, setMode]           = useState("owner"); // "owner" | "staff"
  const [pin, setPin]             = useState(["", "", "", ""]);
  const [staffList, setStaffList] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    if (mode === "staff") {
      api.get("/api/setup/staff")
        .then(res => setStaffList(res.data.filter(s => s.active)))
        .catch(() => {});
    }
  }, [mode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const p = pin.join("");
    if (p.length !== 4) { setError("Please enter your 4-digit PIN."); return; }
    setLoading(true);
    try {
      if (mode === "owner") {
        const res = await api.post("/api/auth/login-pin", { pin: p });
        const { token, cafe, role } = res.data;
        localStorage.setItem("cafe_token", token);
        localStorage.setItem("cafe_info", JSON.stringify(cafe));
        localStorage.setItem("user_role", role || "owner");
        onLoggedIn({ ...res.data, cafe });
      } else {
        if (!selectedStaff) { setError("Please select a staff member."); setLoading(false); return; }
        const res = await api.post("/api/auth/login-staff", { staffId: selectedStaff.id, pin: p });
        const { token, cafe, role, staff } = res.data;
        localStorage.setItem("cafe_token", token);
        localStorage.setItem("cafe_info", JSON.stringify(cafe));
        localStorage.setItem("user_role", role || "staff");
        localStorage.setItem("staff_info", JSON.stringify(staff));
        onLoggedIn({ ...res.data, cafe });
      }
    } catch (err) {
      setError(err.response?.data?.error || "Login failed. Please try again.");
      setPin(["", "", "", ""]);
      setTimeout(() => document.getElementById("login-pin-0")?.focus(), 50);
    }
    setLoading(false);
  };

  const switchMode = (m) => {
    setMode(m); setPin(["", "", "", ""]);
    setSelectedStaff(null); setError("");
  };

  return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">

        {/* Header */}
        <div className="bg-orange-600 px-6 py-8 text-center text-white">
          <div className="text-5xl mb-3">☕</div>
          <h1 className="text-2xl font-bold">CafeBill</h1>
          <p className="text-orange-200 text-sm mt-1">Enter your PIN to continue</p>
        </div>

        {/* Forgot PIN flow */}
        {showForgot ? (
          <ForgotPin
            onBack={() => { setShowForgot(false); setResetSuccess(false); }}
            onSuccess={() => { setShowForgot(false); setResetSuccess(true); }}
          />
        ) : (
          <>
            {resetSuccess && (
              <div className="mx-6 mt-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm text-center">
                ✅ PIN reset successfully! Login with your new PIN.
              </div>
            )}

            {/* Mode tabs */}
            <div className="flex border-b">
              <button onClick={() => switchMode("owner")}
                className={`flex-1 py-3 text-sm font-semibold transition-all ${
                  mode === "owner" ? "text-orange-600 border-b-2 border-orange-600" : "text-gray-400 hover:text-gray-600"
                }`}>
                👑 Owner Login
              </button>
              <button onClick={() => switchMode("staff")}
                className={`flex-1 py-3 text-sm font-semibold transition-all ${
                  mode === "staff" ? "text-orange-600 border-b-2 border-orange-600" : "text-gray-400 hover:text-gray-600"
                }`}>
                👤 Staff Login
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm text-center">
                  ⚠️ {error}
                </div>
              )}

              {/* Staff selector */}
              {mode === "staff" && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Select Staff Member</label>
                  {staffList.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-3">No active staff found.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                      {staffList.map(s => (
                        <button key={s.id} type="button" onClick={() => setSelectedStaff(s)}
                          className={`px-3 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all text-left ${
                            selectedStaff?.id === s.id
                              ? "border-orange-500 bg-orange-50 text-orange-700"
                              : "border-gray-200 text-gray-700 hover:border-orange-300"
                          }`}>
                          <div className="font-bold truncate">{s.name}</div>
                          <div className="text-xs text-gray-400">{s.role}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* PIN input */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3 text-center">
                  {mode === "owner" ? "Owner PIN" : "Your PIN"}
                </label>
                <div className="flex gap-3 justify-center">
                  {pin.map((digit, idx) => (
                    <input
                      key={idx}
                      id={`login-pin-${idx}`}
                      type="password"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      autoFocus={idx === 0}
                      onChange={e => {
                        const d = e.target.value.replace(/\D/g, "").slice(-1);
                        const u = [...pin]; u[idx] = d; setPin(u);
                        if (d && idx < 3) document.getElementById(`login-pin-${idx + 1}`)?.focus();
                      }}
                      onKeyDown={e => {
                        if (e.key === "Backspace") {
                          if (pin[idx]) { const u = [...pin]; u[idx] = ""; setPin(u); }
                          else if (idx > 0) document.getElementById(`login-pin-${idx - 1}`)?.focus();
                        }
                      }}
                      className="w-14 h-14 text-center text-2xl font-bold border-2 rounded-xl focus:outline-none focus:border-orange-500 bg-gray-50"
                    />
                  ))}
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold hover:bg-orange-700 disabled:opacity-50 transition-all text-base">
                {loading ? "Logging in..." : "🔓 Login"}
              </button>

              {/* Forgot PIN — only for owner */}
              {mode === "owner" && (
                <button type="button" onClick={() => { setShowForgot(true); setError(""); }}
                  className="w-full text-sm text-orange-500 hover:text-orange-700 hover:underline text-center">
                  Forgot PIN?
                </button>
              )}
            </form>
          </>
        )}
      </div>
    </div>
  );
}
