import React, { useState } from "react";
import api from "../utils/api";

const STEPS = [
  { id: "welcome",    icon: "☕", title: "Welcome to CafeBill!"      },
  { id: "business",   icon: "🏪", title: "Business Settings"         },
  { id: "categories", icon: "📂", title: "Menu Categories"           },
  { id: "items",      icon: "🍽️", title: "Add Your First Menu Items" },
  { id: "payment",    icon: "💳", title: "Payment Methods"           },
  { id: "done",       icon: "🎉", title: "You're All Set!"           },
];

const CATEGORY_PRESETS = [
  { name: "Beverages",   icon: "☕" },
  { name: "Snacks",      icon: "🍿" },
  { name: "Main Course", icon: "🍽️" },
  { name: "Desserts",    icon: "🍰" },
  { name: "Juices",      icon: "🥤" },
  { name: "Starters",    icon: "🥗" },
  { name: "Breads",      icon: "🍞" },
  { name: "Rice",        icon: "🍚" },
];

export default function SetupWizard({ cafeInfo, onComplete }) {
  const [stepIdx, setStepIdx]   = useState(0);
  const [saving,  setSaving]    = useState(false);
  const [error,   setError]     = useState("");

  // Business
  const [biz, setBiz] = useState({
    currency: "INR", gstEnabled: true, gstPercentage: 5,
    serviceCharge: false, serviceChargePercent: 10, billPrefix: "BILL",
  });

  // Categories
  const [selCats, setSelCats]     = useState(["Beverages", "Snacks", "Main Course"]);
  const [customCat, setCustomCat] = useState("");

  // Items
  const [items, setItems] = useState([
    { name: "", price: "", category: "" },
  ]);

  // Payment
  const [payment, setPayment] = useState({ cash: true, upi: false, upiId: "", card: false });

  const step = STEPS[stepIdx];
  const isLast = stepIdx === STEPS.length - 1;

  const next = () => { setError(""); setStepIdx(s => s + 1); };
  const back = () => { setError(""); setStepIdx(s => s - 1); };

  /* ── Step handlers ─────────────────────────────────── */
  const saveBusiness = async () => {
    setSaving(true);
    try {
      await api.post("/api/setup/business", biz);
      next();
    } catch { setError("Failed to save. Please try again."); }
    setSaving(false);
  };

  const saveCategories = async () => {
    setSaving(true);
    try {
      const cats = selCats.filter(Boolean);
      for (const name of cats) {
        const preset = CATEGORY_PRESETS.find(p => p.name === name);
        await api.post("/api/setup/categories/add", { name, icon: preset?.icon || "🍽️" });
      }
      next();
    } catch { setError("Failed to save categories."); }
    setSaving(false);
  };

  const saveItems = async () => {
    const valid = items.filter(i => i.name.trim() && parseFloat(i.price) > 0);
    if (valid.length === 0) { next(); return; } // skip if none added
    setSaving(true);
    try {
      for (const item of valid) {
        await api.post("/api/items", {
          name:     item.name.trim(),
          price:    parseFloat(item.price),
          category: item.category || "",
          available: true,
        });
      }
      next();
    } catch { setError("Failed to save items."); }
    setSaving(false);
  };

  const savePayment = async () => {
    setSaving(true);
    try {
      await api.post("/api/setup/payment", payment);
      next();
    } catch { setError("Failed to save payment settings."); }
    setSaving(false);
  };

  const toggleCat = (name) => {
    setSelCats(prev =>
      prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]
    );
  };

  const addCustomCat = () => {
    const n = customCat.trim();
    if (n && !selCats.includes(n)) setSelCats(prev => [...prev, n]);
    setCustomCat("");
  };

  const updateItem = (idx, field, val) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  };

  const addItemRow = () => setItems(prev => [...prev, { name: "", price: "", category: "" }]);
  const removeItemRow = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  /* ── Progress bar ──────────────────────────────────── */
  const progress = Math.round((stepIdx / (STEPS.length - 1)) * 100);

  return (
    <div className="fixed inset-0 z-50 bg-orange-50 flex flex-col overflow-hidden">

      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{step.icon}</span>
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
              {stepIdx === 0 || isLast ? "Setup" : `Step ${stepIdx} of ${STEPS.length - 2}`}
            </p>
            <h2 className="font-bold text-gray-800 text-base leading-tight">{step.title}</h2>
          </div>
        </div>
        {!isLast && (
          <button onClick={onComplete}
            className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition">
            Skip setup
          </button>
        )}
      </div>

      {/* Progress bar */}
      {stepIdx > 0 && !isLast && (
        <div className="h-1 bg-gray-100 shrink-0">
          <div className="h-full bg-orange-500 transition-all duration-500"
            style={{ width: `${progress}%` }} />
        </div>
      )}

      {/* Step dots */}
      {stepIdx > 0 && !isLast && (
        <div className="flex justify-center gap-2 py-3 shrink-0">
          {STEPS.slice(1, -1).map((s, i) => (
            <div key={s.id}
              className={`w-2 h-2 rounded-full transition-all ${
                i + 1 === stepIdx ? "bg-orange-500 w-4" : i + 1 < stepIdx ? "bg-orange-300" : "bg-gray-200"
              }`} />
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">

        {/* ── Welcome ──────────────────────────────────── */}
        {step.id === "welcome" && (
          <div className="max-w-md mx-auto text-center pt-8">
            <div className="text-7xl mb-5 animate-bounce">☕</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-3">
              Welcome, {cafeInfo?.ownerName || cafeInfo?.cafeName || "there"}!
            </h1>
            <p className="text-gray-500 mb-8 leading-relaxed">
              Let's set up <span className="font-semibold text-orange-600">{cafeInfo?.cafeName || "your cafe"}</span> in
              just a few quick steps so you can start taking orders.
            </p>
            <div className="bg-white rounded-2xl shadow p-5 text-left space-y-3 mb-8">
              {STEPS.slice(1, -1).map((s) => (
                <div key={s.id} className="flex items-center gap-3">
                  <span className="text-xl w-8 text-center">{s.icon}</span>
                  <span className="text-sm font-medium text-gray-700">{s.title}</span>
                </div>
              ))}
            </div>
            <button onClick={next}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3.5 rounded-2xl font-bold text-base transition-all shadow-lg shadow-orange-200">
              Let's Get Started →
            </button>
          </div>
        )}

        {/* ── Business Settings ─────────────────────────── */}
        {step.id === "business" && (
          <div className="max-w-md mx-auto space-y-4">
            <p className="text-sm text-gray-500">Configure how your bills will look and what taxes apply.</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Currency</label>
                <select value={biz.currency} onChange={e => setBiz(p => ({ ...p, currency: e.target.value }))}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white">
                  <option value="INR">₹ INR (Indian Rupee)</option>
                  <option value="USD">$ USD</option>
                  <option value="EUR">€ EUR</option>
                  <option value="GBP">£ GBP</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Bill Prefix</label>
                <input type="text" maxLength={8} value={biz.billPrefix}
                  onChange={e => setBiz(p => ({ ...p, billPrefix: e.target.value.toUpperCase() }))}
                  placeholder="BILL"
                  className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                <p className="text-xs text-gray-400 mt-1">Bills will be: {biz.billPrefix || "BILL"}-001</p>
              </div>
            </div>

            {/* GST */}
            <div className="bg-white border rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-700">GST</p>
                  <p className="text-xs text-gray-400">Goods & Services Tax on orders</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={biz.gstEnabled}
                    onChange={e => setBiz(p => ({ ...p, gstEnabled: e.target.checked }))} />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-orange-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
                </label>
              </div>
              {biz.gstEnabled && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-2">GST Rate</p>
                  <div className="flex gap-2">
                    {[5, 12, 18].map(v => (
                      <button key={v} onClick={() => setBiz(p => ({ ...p, gstPercentage: v }))}
                        className={`flex-1 py-2 rounded-xl text-sm font-bold border-2 transition-all ${
                          biz.gstPercentage === v
                            ? "bg-orange-500 text-white border-orange-500"
                            : "bg-white text-gray-600 border-gray-200 hover:border-orange-300"
                        }`}>{v}%</button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Service Charge */}
            <div className="bg-white border rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-700">Service Charge</p>
                  <p className="text-xs text-gray-400">Additional charge added to orders</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={biz.serviceCharge}
                    onChange={e => setBiz(p => ({ ...p, serviceCharge: e.target.checked }))} />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-orange-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
                </label>
              </div>
              {biz.serviceCharge && (
                <div className="mt-3 flex items-center gap-2">
                  <input type="number" min={1} max={20} value={biz.serviceChargePercent}
                    onChange={e => setBiz(p => ({ ...p, serviceChargePercent: parseFloat(e.target.value) || 0 }))}
                    className="w-20 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  <span className="text-gray-500">%</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Categories ────────────────────────────────── */}
        {step.id === "categories" && (
          <div className="max-w-md mx-auto space-y-4">
            <p className="text-sm text-gray-500">Select categories to organize your menu. You can add more later.</p>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORY_PRESETS.map(({ name, icon }) => (
                <button key={name} onClick={() => toggleCat(name)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-2xl border-2 text-sm font-semibold transition-all ${
                    selCats.includes(name)
                      ? "bg-orange-500 text-white border-orange-500 shadow"
                      : "bg-white text-gray-600 border-gray-200 hover:border-orange-300"
                  }`}>
                  <span>{icon}</span> {name}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="text" value={customCat} onChange={e => setCustomCat(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addCustomCat()}
                placeholder="+ Custom category"
                className="flex-1 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              <button onClick={addCustomCat}
                className="bg-orange-100 text-orange-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-orange-200">
                Add
              </button>
            </div>
            {selCats.filter(c => !CATEGORY_PRESETS.find(p => p.name === c)).map(c => (
              <div key={c} className="flex items-center justify-between bg-orange-50 rounded-xl px-4 py-2.5">
                <span className="text-sm font-medium">🏷️ {c}</span>
                <button onClick={() => toggleCat(c)} className="text-red-400 text-xs font-bold">✕</button>
              </div>
            ))}
            <p className="text-xs text-gray-400 text-center">
              {selCats.length} {selCats.length === 1 ? "category" : "categories"} selected
            </p>
          </div>
        )}

        {/* ── Menu Items ────────────────────────────────── */}
        {step.id === "items" && (
          <div className="max-w-md mx-auto space-y-3">
            <p className="text-sm text-gray-500">Add a few items to get started. You can add more from the Menu page.</p>
            {items.map((item, idx) => (
              <div key={idx} className="bg-white border rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Item {idx + 1}</span>
                  {items.length > 1 && (
                    <button onClick={() => removeItemRow(idx)}
                      className="text-red-400 hover:text-red-600 text-xs font-semibold">✕ Remove</button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <input type="text" placeholder="Item name (e.g. Masala Chai)"
                      value={item.name} onChange={e => updateItem(idx, "name", e.target.value)}
                      className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  </div>
                  <div>
                    <input type="number" placeholder="Price (₹)" min={1}
                      value={item.price} onChange={e => updateItem(idx, "price", e.target.value)}
                      className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  </div>
                  <div>
                    <select value={item.category} onChange={e => updateItem(idx, "category", e.target.value)}
                      className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white">
                      <option value="">Category (optional)</option>
                      {selCats.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            ))}
            <button onClick={addItemRow}
              className="w-full py-3 border-2 border-dashed border-orange-300 text-orange-500 rounded-2xl text-sm font-semibold hover:bg-orange-50 transition-all">
              + Add Another Item
            </button>
            <p className="text-xs text-gray-400 text-center">Skip if you want to add items later from the Menu page.</p>
          </div>
        )}

        {/* ── Payment ───────────────────────────────────── */}
        {step.id === "payment" && (
          <div className="max-w-md mx-auto space-y-3">
            <p className="text-sm text-gray-500">Choose which payment methods your cafe accepts.</p>
            {[
              { key: "cash", icon: "💵", label: "Cash",       desc: "Accept cash payments at counter" },
              { key: "upi",  icon: "📲", label: "UPI",        desc: "Google Pay, PhonePe, Paytm etc." },
              { key: "card", icon: "💳", label: "Card / POS", desc: "Debit / Credit via POS machine"  },
            ].map(({ key, icon, label, desc }) => (
              <div key={key}
                className={`bg-white border-2 rounded-2xl p-4 transition-all cursor-pointer ${
                  payment[key] ? "border-orange-400 shadow" : "border-gray-200"
                }`}
                onClick={() => setPayment(p => ({ ...p, [key]: !p[key] }))}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{icon}</span>
                    <div>
                      <p className="font-semibold text-gray-800">{label}</p>
                      <p className="text-xs text-gray-400">{desc}</p>
                    </div>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    payment[key] ? "bg-orange-500 border-orange-500" : "border-gray-300"
                  }`}>
                    {payment[key] && <span className="text-white text-xs font-bold">✓</span>}
                  </div>
                </div>
                {key === "upi" && payment.upi && (
                  <div className="mt-3" onClick={e => e.stopPropagation()}>
                    <input type="text" placeholder="Your UPI ID (e.g. cafe@upi)"
                      value={payment.upiId}
                      onChange={e => setPayment(p => ({ ...p, upiId: e.target.value }))}
                      className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Done ──────────────────────────────────────── */}
        {step.id === "done" && (
          <div className="max-w-md mx-auto text-center pt-8">
            <div className="text-7xl mb-5">🎉</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-3">You're all set!</h2>
            <p className="text-gray-500 mb-8 leading-relaxed">
              <span className="font-semibold text-orange-600">{cafeInfo?.cafeName || "Your cafe"}</span> is ready.
              Start taking orders right away!
            </p>
            <div className="bg-white rounded-2xl shadow p-5 text-left space-y-3 mb-8">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">What's next</p>
              <div className="flex items-start gap-3">
                <span className="text-lg">🍽️</span>
                <div>
                  <p className="text-sm font-semibold text-gray-700">Add more menu items</p>
                  <p className="text-xs text-gray-400">Go to Menu tab to add photos, categories & more</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-lg">👥</span>
                <div>
                  <p className="text-sm font-semibold text-gray-700">Add staff</p>
                  <p className="text-xs text-gray-400">Give cashiers their own PIN login from Staff tab</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-lg">🧾</span>
                <div>
                  <p className="text-sm font-semibold text-gray-700">Take your first order</p>
                  <p className="text-xs text-gray-400">Tap items → add to cart → print bill</p>
                </div>
              </div>
            </div>
            <button onClick={onComplete}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white py-4 rounded-2xl font-bold text-base transition-all shadow-lg shadow-orange-200">
              🚀 Start Taking Orders
            </button>
          </div>
        )}

        {error && (
          <p className="text-center text-red-500 text-sm mt-4">⚠️ {error}</p>
        )}
      </div>

      {/* Footer nav */}
      {step.id !== "welcome" && step.id !== "done" && (
        <div className="bg-white border-t px-4 py-3 flex gap-3 shrink-0">
          <button onClick={back}
            className="px-5 py-3 border-2 border-gray-200 rounded-2xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all">
            ← Back
          </button>
          <button
            onClick={
              step.id === "business"   ? saveBusiness   :
              step.id === "categories" ? saveCategories :
              step.id === "items"      ? saveItems      :
              step.id === "payment"    ? savePayment    : next
            }
            disabled={saving}
            className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white py-3 rounded-2xl font-bold text-sm transition-all">
            {saving ? "Saving…" : step.id === "payment" ? "Save & Finish →" : "Save & Continue →"}
          </button>
        </div>
      )}
    </div>
  );
}
