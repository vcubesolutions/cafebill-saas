import React, { useEffect, useState, useCallback } from "react";
import api from "../utils/api";

const ORDERS_API = "/api/orders";
const SETUP_API  = "/api/setup";
const SYM        = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };

export default function Bills({ cafeInfo }) {
  const [orders, setOrders]         = useState([]);
  const [expanded, setExpanded]     = useState(null);
  const [settings, setSettings]     = useState({
    gstEnabled: true, gstPercentage: 5,
    currency: "INR", billPrefix: "BILL",
    serviceCharge: false, serviceChargePercent: 10,
  });
  const [search, setSearch]         = useState("");
  const [filterDate, setFilterDate] = useState("");

  const fetchAll = useCallback(async () => {
    try {
      const [ordRes, bizRes] = await Promise.all([
        api.get(ORDERS_API),
        api.get(`${SETUP_API}/business`),
      ]);
      setOrders(ordRes.data);
      if (bizRes.data?.id) setSettings(bizRes.data);
    } catch { console.error("Failed to load bills."); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this bill/order?")) return;
    await api.delete(`${ORDERS_API}/${id}`);
    fetchAll();
  };

  const calcTotals = (items) => {
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const gst  = settings.gstEnabled     ? subtotal * ((settings.gstPercentage || 5) / 100)        : 0;
    const sc   = settings.serviceCharge  ? subtotal * ((settings.serviceChargePercent || 10) / 100) : 0;
    return { subtotal, gst, sc, grand: subtotal + gst + sc };
  };

  const sym    = SYM[settings.currency] || "₹";
  const gstPct = settings.gstPercentage || 5;
  const scPct  = settings.serviceChargePercent || 10;

  const handlePrint = (order) => {
    const items  = JSON.parse(order.items);
    const { subtotal, gst, sc, grand } = calcTotals(items);
    const cafe   = cafeInfo?.cafeName || "Cafe";
    const addr   = cafeInfo?.city   ? `📍 ${cafeInfo.city}` : "";
    const phone  = cafeInfo?.mobile ? `📞 ${cafeInfo.mobile}` : "";
    const billNo = `${settings.billPrefix || "BILL"}-${order.id}`;
    const date   = new Date(order.createdAt).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });

    const win = window.open("", "_blank");
    win.document.write(`
      <!DOCTYPE html><html><head>
      <title>Bill #${order.id}</title><meta charset="utf-8"/>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Courier New',monospace; background:#fff; padding:24px 20px; max-width:320px; margin:0 auto; color:#1a1a1a; }
        .center{text-align:center} .bold{font-weight:bold} .big{font-size:22px} .sm{font-size:12px} .xs{font-size:10px;color:#666}
        .dash{border-top:1px dashed #aaa;margin:8px 0} .solid{border-top:2px solid #333;margin:8px 0}
        .row{display:flex;justify-content:space-between;margin:2px 0} .item-name{flex:1;padding-right:8px}
        .total-row{font-size:15px;font-weight:bold} .highlight{background:#f5f5f5;padding:6px 8px;border-radius:4px}
        @media print{body{padding:0;max-width:100%} @page{margin:5mm;size:80mm auto}}
      </style></head><body>
      <div class="center">
        <div class="big bold">☕ ${cafe}</div>
        ${addr  ? `<div class="xs">${addr}</div>`  : ""}
        ${phone ? `<div class="xs">${phone}</div>` : ""}
        <div class="xs" style="margin-top:4px">BILL RECEIPT</div>
      </div>
      <div class="solid"></div>
      <div class="row sm"><span class="bold">Bill #:</span><span>${billNo}</span></div>
      <div class="row sm"><span class="bold">Date:</span><span>${date}</span></div>
      <div class="row sm"><span class="bold">Customer:</span><span>${order.customerName}</span></div>
      ${order.tableNo ? `<div class="row sm"><span class="bold">Table:</span><span>${order.tableNo}</span></div>` : ""}
      ${order.paymentMode ? `<div class="row sm"><span class="bold">Payment:</span><span>${order.paymentMode.toUpperCase()}</span></div>` : ""}
      <div class="solid"></div>
      <div class="row xs bold"><span class="item-name">ITEM</span><span style="width:30px;text-align:center">QTY</span><span style="width:60px;text-align:right">AMOUNT</span></div>
      <div class="dash"></div>
      ${items.map(i => `<div class="row sm"><span class="item-name">${i.name}</span><span style="width:30px;text-align:center">×${i.qty}</span><span style="width:60px;text-align:right">${sym}${(i.price * i.qty).toFixed(2)}</span></div>`).join("")}
      <div class="dash"></div>
      <div class="row sm"><span>Subtotal</span><span>${sym}${subtotal.toFixed(2)}</span></div>
      ${settings.gstEnabled     ? `<div class="row sm"><span>GST (${gstPct}%)</span><span>${sym}${gst.toFixed(2)}</span></div>` : ""}
      ${settings.serviceCharge  ? `<div class="row sm"><span>Service (${scPct}%)</span><span>${sym}${sc.toFixed(2)}</span></div>` : ""}
      <div class="solid"></div>
      <div class="row total-row highlight"><span>GRAND TOTAL</span><span>${sym}${grand.toFixed(2)}</span></div>
      <div class="solid"></div>
      <div class="center" style="margin-top:16px">
        <div class="sm">Thank you for visiting! 😊</div>
        <div class="xs" style="margin-top:4px">Please come again</div>
      </div>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  const filtered = orders.filter(o => {
    const matchSearch = !search ||
      o.customerName.toLowerCase().includes(search.toLowerCase()) ||
      String(o.id).includes(search);
    const matchDate = !filterDate ||
      new Date(o.createdAt).toLocaleDateString("en-CA") === filterDate;
    return matchSearch && matchDate;
  });

  const totalRevenue = filtered.reduce((s, o) => s + parseFloat(o.total), 0);

  return (
    <div className="max-w-3xl mx-auto p-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-2xl font-bold text-orange-700">🧾 Bills History</h2>
        <div className="text-sm font-semibold text-orange-600 bg-orange-100 px-3 py-1.5 rounded-full">
          {filtered.length} bills · {sym}{totalRevenue.toFixed(2)} total
        </div>
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        <input type="text" placeholder="🔍 Search by name or bill #"
          value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-0 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
          className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
        {(search || filterDate) && (
          <button onClick={() => { setSearch(""); setFilterDate(""); }}
            className="text-sm text-gray-500 hover:text-orange-600 px-2">✕ Clear</button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-3">🧾</div>
          <p className="text-gray-400 font-medium">
            {orders.length === 0 ? "No orders yet." : "No bills match your filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const items  = JSON.parse(order.items);
            const { subtotal, gst, sc, grand } = calcTotals(items);
            const billNo = `${settings.billPrefix || "BILL"}-${order.id}`;
            return (
              <div key={order.id} className="bg-white rounded-2xl shadow overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-orange-50"
                  onClick={() => setExpanded(expanded === order.id ? null : order.id)}>
                  <div>
                    <p className="font-semibold text-gray-800">
                      👤 {order.customerName}
                      {order.tableNo && (
                        <span className="ml-2 text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                          Table {order.tableNo}
                        </span>
                      )}
                      {order.paymentMode && order.paymentMode !== "cash" && (
                        <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full capitalize">
                          {order.paymentMode}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400">
                      {billNo} · {new Date(order.createdAt).toLocaleString("en-IN", {
                        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-orange-700 text-lg">{sym}{parseFloat(order.total).toFixed(2)}</span>
                    <span className="text-gray-400 text-sm">{expanded === order.id ? "▲" : "▼"}</span>
                  </div>
                </div>

                {expanded === order.id && (
                  <div className="border-t px-4 py-4 bg-gray-50">
                    <table className="w-full text-sm mb-3">
                      <thead>
                        <tr className="text-gray-500 text-xs">
                          <th className="text-left pb-2">Item</th>
                          <th className="text-center pb-2">Qty</th>
                          <th className="text-right pb-2">Rate</th>
                          <th className="text-right pb-2">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, i) => (
                          <tr key={i} className="border-t">
                            <td className="py-1.5 text-gray-800">{item.name}</td>
                            <td className="text-center text-gray-600">×{item.qty}</td>
                            <td className="text-right text-gray-500">{sym}{item.price.toFixed(2)}</td>
                            <td className="text-right text-green-700 font-medium">{sym}{(item.price * item.qty).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="border-t pt-2 space-y-1 text-sm">
                      <div className="flex justify-between text-gray-500">
                        <span>Subtotal</span><span>{sym}{subtotal.toFixed(2)}</span>
                      </div>
                      {settings.gstEnabled && (
                        <div className="flex justify-between text-gray-500">
                          <span>GST ({gstPct}%)</span><span>{sym}{gst.toFixed(2)}</span>
                        </div>
                      )}
                      {settings.serviceCharge && (
                        <div className="flex justify-between text-gray-500">
                          <span>Service ({scPct}%)</span><span>{sym}{sc.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-gray-800 text-base border-t pt-1">
                        <span>Grand Total</span>
                        <span className="text-orange-700">{sym}{grand.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-4">
                      <button onClick={() => handlePrint(order)}
                        className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1">
                        🖨️ Print / PDF
                      </button>
                      <button onClick={() => handleDelete(order.id)}
                        className="bg-red-100 text-red-600 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-red-200">
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
