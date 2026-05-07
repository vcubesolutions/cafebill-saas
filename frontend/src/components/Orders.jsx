import React, { useEffect, useState } from "react";
import api from "../utils/api";

const ITEMS_API  = "/api/items";
const ORDERS_API = "/api/orders";
const SETUP_API  = "/api/setup";

const DefaultImage = ({ name }) => {
  const palettes = [
    { bg: "#fff7ed", plate: "#f97316", icon: "🍽️" },
    { bg: "#fef2f2", plate: "#ef4444", icon: "🍜" },
    { bg: "#f5f3ff", plate: "#8b5cf6", icon: "🧆" },
    { bg: "#ecfdf5", plate: "#10b981", icon: "🥗" },
    { bg: "#fffbeb", plate: "#f59e0b", icon: "☕" },
    { bg: "#fdf2f8", plate: "#ec4899", icon: "🍰" },
    { bg: "#eff6ff", plate: "#3b82f6", icon: "🥤" },
  ];
  const p = palettes[(name?.charCodeAt(0) || 0) % palettes.length];
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-1" style={{ background: p.bg }}>
      <div className="w-10 h-10 rounded-full flex items-center justify-center"
        style={{ background: `${p.plate}18`, border: `2px dashed ${p.plate}60` }}>
        <span className="text-xl">{p.icon}</span>
      </div>
    </div>
  );
};

export default function Orders({ setActivePage }) {
  const [menuItems, setMenuItems]       = useState([]);
  const [cart, setCart]                 = useState([]);
  const [customerName, setCustomerName] = useState("");
  const [tableNo, setTableNo]           = useState("");
  const [paymentMode, setPaymentMode]   = useState("cash");
  const [paymentMethods, setPaymentMethods] = useState({ cash: 1, upi: 0, upiId: "", card: 0 });
  const [search, setSearch]             = useState("");
  const [loading, setLoading]           = useState(false);
  const [success, setSuccess]           = useState("");
  const [bizSettings, setBizSettings]   = useState({
    gstEnabled: true, gstPercentage: 5,
    serviceCharge: false, serviceChargePercent: 10, currency: "INR",
  });

  useEffect(() => {
    api.get(ITEMS_API).then(res => setMenuItems(res.data)).catch(() => {});
    api.get(`${SETUP_API}/business`).then(res => { if (res.data?.id) setBizSettings(res.data); }).catch(() => {});
    api.get(`${SETUP_API}/payment`).then(res => { if (res.data) setPaymentMethods(res.data); }).catch(() => {});
  }, []);

  const addToCart = (item) => {
    setCart(prev => {
      const exists = prev.find(c => c.id === item.id);
      if (exists) return prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const updateQty = (id, delta) => {
    setCart(prev => prev.map(c => c.id === id ? { ...c, qty: c.qty + delta } : c).filter(c => c.qty > 0));
  };

  const cartQty  = (id) => cart.find(c => c.id === id)?.qty || 0;
  const subtotal = cart.reduce((sum, c) => sum + c.price * c.qty, 0);
  const gst      = bizSettings.gstEnabled ? subtotal * ((bizSettings.gstPercentage || 5) / 100) : 0;
  const sc       = bizSettings.serviceCharge ? subtotal * ((bizSettings.serviceChargePercent || 10) / 100) : 0;
  const grandTotal = subtotal + gst + sc;
  const sym      = { INR: "₹", USD: "$", EUR: "€", GBP: "£" }[bizSettings.currency] || "₹";

  const handlePlaceOrder = async () => {
    if (!customerName.trim()) { alert("Please enter customer name."); return; }
    if (cart.length === 0)    { alert("Please add at least one item."); return; }
    setLoading(true);
    try {
      await api.post(ORDERS_API, { customerName, tableNo, items: cart, total: grandTotal, paymentMode });
      setSuccess("✅ Order placed!");
      setCart([]); setCustomerName(""); setTableNo("");
      setTimeout(() => { setSuccess(""); setActivePage("bills"); }, 1500);
    } catch { alert("Failed to place order."); }
    setLoading(false);
  };

  const filtered   = menuItems.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.category || "").toLowerCase().includes(search.toLowerCase())
  );
  const categories = [...new Set(filtered.map(i => i.category || ""))].sort();

  const enabledModes = [
    paymentMethods.cash && { id: "cash", label: "💵 Cash" },
    paymentMethods.upi  && { id: "upi",  label: "📱 UPI" },
    paymentMethods.card && { id: "card", label: "💳 Card" },
  ].filter(Boolean);

  return (
    <div className="max-w-6xl mx-auto p-3">
      {success && (
        <div className="bg-green-100 text-green-700 px-4 py-3 rounded-xl mb-4 font-bold text-center text-lg animate-pulse">
          {success}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        {/* LEFT: Menu Grid */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="text-xl font-bold text-orange-700">🛒 New Order</h2>
            <span className="text-sm text-gray-400">{menuItems.length} items</span>
          </div>

          <div className="relative mb-4">
            <span className="absolute left-3 top-2.5 text-gray-400 text-sm">🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search items..."
              className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white shadow-sm" />
          </div>

          {menuItems.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-5xl mb-3">🍽️</div>
              <p className="font-semibold">No menu items yet.</p>
              <p className="text-sm mt-1">Add items from Menu Items tab first.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">No items match "{search}"</div>
          ) : (
            <div className="space-y-4">
              {categories.map(cat => (
                <div key={cat}>
                  {cat && <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">{cat}</p>}
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {filtered.filter(i => (i.category || "") === cat).map(item => {
                      const qty = cartQty(item.id);
                      return (
                        <button key={item.id} onClick={() => addToCart(item)}
                          className={`relative bg-white rounded-xl overflow-hidden shadow-sm border-2 transition-all text-left active:scale-95
                            ${qty > 0 ? "border-orange-500 shadow-orange-100 shadow-md" : "border-gray-100 hover:border-orange-300"}`}>
                          <div className="h-20 bg-gray-50 overflow-hidden">
                            {item.image
                              ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                              : <DefaultImage name={item.name} />
                            }
                          </div>
                          {qty > 0 && (
                            <span className="absolute top-1.5 right-1.5 bg-orange-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shadow">
                              {qty}
                            </span>
                          )}
                          <div className="p-2">
                            <p className="text-xs font-semibold text-gray-800 leading-tight line-clamp-2">{item.name}</p>
                            <p className="text-orange-600 font-bold text-xs mt-0.5">{sym}{parseFloat(item.price).toFixed(0)}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: Order Summary */}
        <div className="lg:w-80 w-full">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 sticky top-4 overflow-hidden">
            <div className="bg-orange-600 px-4 py-3 text-white">
              <h3 className="font-bold text-base">🧾 Order Summary</h3>
              {cart.length > 0 && (
                <p className="text-orange-200 text-xs">{cart.reduce((s, c) => s + c.qty, 0)} items</p>
              )}
            </div>

            <div className="p-4 space-y-3">
              <div className="flex gap-2">
                <input type="text" placeholder="Customer Name *" value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 flex-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
                <input type="text" placeholder="Table" value={tableNo}
                  onChange={e => setTableNo(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 w-16 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 text-center" />
              </div>

              {cart.length === 0 ? (
                <div className="text-center py-8 text-gray-300">
                  <div className="text-4xl mb-2">🛒</div>
                  <p className="text-sm">Tap items to add</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {cart.map(c => (
                    <div key={c.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-2 py-1.5">
                      <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-white border border-gray-100">
                        {c.image
                          ? <img src={c.image} alt={c.name} className="w-full h-full object-cover" />
                          : <DefaultImage name={c.name} />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{c.name}</p>
                        <p className="text-xs text-orange-600 font-bold">{sym}{(c.price * c.qty).toFixed(0)}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateQty(c.id, -1)}
                          className="w-6 h-6 rounded-full bg-white border border-gray-200 font-bold text-gray-600 text-sm flex items-center justify-center hover:bg-red-50 hover:border-red-200">−</button>
                        <span className="text-xs font-bold w-4 text-center">{c.qty}</span>
                        <button onClick={() => updateQty(c.id, 1)}
                          className="w-6 h-6 rounded-full bg-white border border-gray-200 font-bold text-gray-600 text-sm flex items-center justify-center hover:bg-green-50 hover:border-green-200">+</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {cart.length > 0 && (
                <div className="border-t pt-3 space-y-1.5 text-sm">
                  <div className="flex justify-between text-gray-500">
                    <span>Subtotal</span><span>{sym}{subtotal.toFixed(2)}</span>
                  </div>
                  {bizSettings.gstEnabled && (
                    <div className="flex justify-between text-gray-500">
                      <span>GST ({bizSettings.gstPercentage || 5}%)</span><span>{sym}{gst.toFixed(2)}</span>
                    </div>
                  )}
                  {bizSettings.serviceCharge && (
                    <div className="flex justify-between text-gray-500">
                      <span>Service ({bizSettings.serviceChargePercent || 10}%)</span><span>{sym}{sc.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-orange-700 text-base pt-1 border-t">
                    <span>Total</span><span>{sym}{grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Payment mode selector */}
              {cart.length > 0 && enabledModes.length > 1 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Payment Mode</p>
                  <div className="flex gap-2 flex-wrap">
                    {enabledModes.map(m => (
                      <button key={m.id} onClick={() => setPaymentMode(m.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          paymentMode === m.id
                            ? "bg-orange-600 text-white border-orange-600"
                            : "bg-white text-gray-600 border-gray-200 hover:border-orange-300"
                        }`}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2 pt-1">
                {cart.length > 0 && (
                  <button onClick={() => setCart([])}
                    className="w-full border border-red-200 text-red-400 py-2 rounded-xl text-sm font-semibold hover:bg-red-50 transition-all">
                    🗑️ Clear All
                  </button>
                )}
                <button onClick={handlePlaceOrder}
                  disabled={loading || cart.length === 0}
                  className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold hover:bg-orange-700 disabled:opacity-40 transition-all text-base">
                  {loading ? "Placing..." : `✅ Place Order${cart.length > 0 ? ` · ${sym}${grandTotal.toFixed(0)}` : ""}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
