import React, { useEffect, useState } from "react";
import api from "../utils/api";

const API = "/api/setup";
const CATEGORY_ICONS = ["🍽️","☕","🍕","🍜","🥗","🍰","🥤","🍛","🍔","🍟","🌮","🥪","🍱","🍣","🥞","🍩","🧁","🍦","🧃","🍺"];

export default function Settings({ cafeInfo, onCafeInfoUpdate }) {
  const [tab, setTab]     = useState("business");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]     = useState("");

  const [biz, setBiz] = useState({
    currency: "INR", gstEnabled: true, gstPercentage: 5,
    serviceCharge: false, serviceChargePercent: 10, billPrefix: "BILL",
  });

  const [categories, setCategories] = useState([]);
  const [newCatName, setNewCatName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("🍽️");

  const [payment, setPayment] = useState({ cash: true, upi: false, upiId: "", card: false });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [bizRes, catRes, payRes] = await Promise.all([
        api.get(`${API}/business`),
        api.get(`${API}/categories`),
        api.get(`${API}/payment`),
      ]);
      if (bizRes.data?.id) {
        setBiz({
          currency:             bizRes.data.currency || "INR",
          gstEnabled:           !!bizRes.data.gstEnabled,
          gstPercentage:        bizRes.data.gstPercentage ?? 5,
          serviceCharge:        !!bizRes.data.serviceCharge,
          serviceChargePercent: bizRes.data.serviceChargePercent ?? 10,
          billPrefix:           bizRes.data.billPrefix || "BILL",
        });
      }
      setCategories(catRes.data || []);
      if (payRes.data) {
        setPayment({
          cash:  !!payRes.data.cash,
          upi:   !!payRes.data.upi,
          upiId: payRes.data.upiId || "",
          card:  !!payRes.data.card,
        });
      }
    } catch (e) { console.error("Failed to load settings", e); }
  };

  const flash = (text) => { setMsg(text); setTimeout(() => setMsg(""), 3000); };

  const saveBusiness = async () => {
    setSaving(true);
    try {
      await api.post(`${API}/business`, biz);
      flash("✅ Business settings saved!");
    } catch { flash("❌ Failed to save settings."); }
    setSaving(false);
  };

  const addCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      await api.post(`${API}/categories/add`, { name: newCatName.trim(), icon: newCatIcon });
      setNewCatName(""); setNewCatIcon("🍽️");
      const res = await api.get(`${API}/categories`);
      setCategories(res.data);
      flash("✅ Category added!");
    } catch { flash("❌ Failed to add category."); }
  };

  const deleteCategory = async (id) => {
    if (!window.confirm("Delete this category?")) return;
    try {
      await api.delete(`${API}/categories/${id}`);
      setCategories(prev => prev.filter(c => c.id !== id));
      flash("✅ Category deleted.");
    } catch { flash("❌ Failed to delete."); }
  };

  const savePayment = async () => {
    setSaving(true);
    try {
      await api.post(`${API}/payment`, payment);
      flash("✅ Payment settings saved!");
    } catch { flash("❌ Failed to save."); }
    setSaving(false);
  };

  const tabs = [
    { id: "business",   label: "🏪 Business"   },
    { id: "categories", label: "📂 Categories" },
    { id: "payment",    label: "💳 Payment"    },
  ];

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h2 className="text-2xl font-bold text-orange-700 mb-1">⚙️ Settings</h2>
      <p className="text-gray-500 text-sm mb-5">Configure your cafe billing preferences</p>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium ${
          msg.startsWith("✅") ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
        }`}>{msg}</div>
      )}

      {/* Tab strip */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
              tab === t.id
                ? "bg-orange-600 text-white shadow"
                : "bg-white text-gray-600 border border-gray-200 hover:border-orange-400"
            }`}>{t.label}</button>
        ))}
      </div>

      {/* ── Business Settings ────────────────────────────────── */}
      {tab === "business" && (
        <div className="bg-white rounded-2xl shadow p-6 space-y-5">
          <div>
            <p className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">Cafe</p>
            <div className="px-4 py-3 bg-orange-50 rounded-xl text-orange-800 font-semibold">
              ☕ {cafeInfo?.cafeName || "—"}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Currency</label>
              <select value={biz.currency} onChange={e => setBiz(p => ({ ...p, currency: e.target.value }))}
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                <option value="INR">₹ INR</option>
                <option value="USD">$ USD</option>
                <option value="EUR">€ EUR</option>
                <option value="GBP">£ GBP</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Bill Prefix</label>
              <input type="text" maxLength={8} value={biz.billPrefix}
                onChange={e => setBiz(p => ({ ...p, billPrefix: e.target.value.toUpperCase() }))}
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="BILL" />
            </div>
          </div>

          {/* GST */}
          <div className="border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-700">GST</p>
                <p className="text-xs text-gray-400">Goods & Services Tax on orders</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={biz.gstEnabled}
                  onChange={e => setBiz(p => ({ ...p, gstEnabled: e.target.checked }))} />
                <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-orange-300 rounded-full peer peer-checked:bg-orange-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
              </label>
            </div>
            {biz.gstEnabled && (
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">GST Percentage</label>
                <div className="flex items-center gap-2">
                  <input type="number" min={0} max={30} step={0.5} value={biz.gstPercentage}
                    onChange={e => setBiz(p => ({ ...p, gstPercentage: parseFloat(e.target.value) || 0 }))}
                    className="w-24 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  <span className="text-gray-500 text-sm">%</span>
                  <div className="flex gap-1">
                    {[5, 12, 18].map(v => (
                      <button key={v} onClick={() => setBiz(p => ({ ...p, gstPercentage: v }))}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                          biz.gstPercentage === v ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-600 border-gray-300 hover:border-orange-400"
                        }`}>{v}%</button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Service Charge */}
          <div className="border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-700">Service Charge</p>
                <p className="text-xs text-gray-400">Additional charge on orders</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={biz.serviceCharge}
                  onChange={e => setBiz(p => ({ ...p, serviceCharge: e.target.checked }))} />
                <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-orange-300 rounded-full peer peer-checked:bg-orange-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
              </label>
            </div>
            {biz.serviceCharge && (
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Service Charge %</label>
                <div className="flex items-center gap-2">
                  <input type="number" min={0} max={20} step={0.5} value={biz.serviceChargePercent}
                    onChange={e => setBiz(p => ({ ...p, serviceChargePercent: parseFloat(e.target.value) || 0 }))}
                    className="w-24 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  <span className="text-gray-500 text-sm">%</span>
                </div>
              </div>
            )}
          </div>

          <button onClick={saveBusiness} disabled={saving}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-xl font-semibold transition-all disabled:opacity-60">
            {saving ? "Saving..." : "💾 Save Business Settings"}
          </button>
        </div>
      )}

      {/* ── Categories Tab ───────────────────────────────────── */}
      {tab === "categories" && (
        <div className="bg-white rounded-2xl shadow p-6 space-y-4">
          <p className="text-sm text-gray-500">Categories appear as filters on the New Order page.</p>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-600 block mb-1">Category Name</label>
              <input type="text" value={newCatName} onChange={e => setNewCatName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addCategory()}
                placeholder="e.g. Beverages"
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Icon</label>
              <select value={newCatIcon} onChange={e => setNewCatIcon(e.target.value)}
                className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                {CATEGORY_ICONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
              </select>
            </div>
            <button onClick={addCategory}
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-semibold">
              + Add
            </button>
          </div>
          {categories.length === 0 ? (
            <p className="text-gray-400 text-center py-6">No categories yet. Add some above.</p>
          ) : (
            <div className="space-y-2">
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center justify-between bg-orange-50 rounded-xl px-4 py-3">
                  <span className="font-medium text-gray-700">{cat.icon} {cat.name}</span>
                  <button onClick={() => deleteCategory(cat.id)}
                    className="text-red-400 hover:text-red-600 text-sm font-semibold px-2 py-1 rounded-lg hover:bg-red-50">
                    ✕ Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Payment Tab ──────────────────────────────────────── */}
      {tab === "payment" && (
        <div className="bg-white rounded-2xl shadow p-6 space-y-4">
          <p className="text-sm text-gray-500">Choose which payment modes to show at checkout.</p>
          {[
            { key: "cash", label: "💵 Cash",        desc: "Accept cash payments" },
            { key: "card", label: "💳 Card / POS",  desc: "Debit / Credit card via POS machine" },
            { key: "upi",  label: "📲 UPI",          desc: "Google Pay, PhonePe, Paytm etc." },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between border rounded-xl p-4">
              <div>
                <p className="font-semibold text-gray-700">{label}</p>
                <p className="text-xs text-gray-400">{desc}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={!!payment[key]}
                  onChange={e => setPayment(p => ({ ...p, [key]: e.target.checked }))} />
                <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-orange-300 rounded-full peer peer-checked:bg-orange-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
              </label>
            </div>
          ))}
          {payment.upi && (
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Your UPI ID</label>
              <input type="text" value={payment.upiId}
                onChange={e => setPayment(p => ({ ...p, upiId: e.target.value }))}
                placeholder="yourname@upi"
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
          )}
          <button onClick={savePayment} disabled={saving}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-xl font-semibold transition-all disabled:opacity-60">
            {saving ? "Saving..." : "💾 Save Payment Settings"}
          </button>
        </div>
      )}
    </div>
  );
}
