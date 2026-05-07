import React, { useEffect, useState, useRef } from "react";
import { apiFetch } from "../utils/api";

const API = "/api/items";

const compressImage = (file) =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 400;
        let w = img.width, h = img.height;
        if (w > h) { if (w > MAX) { h = (h * MAX) / w; w = MAX; } }
        else       { if (h > MAX) { w = (w * MAX) / h; h = MAX; } }
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      };
    };
  });

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
      <div className="w-16 h-16 rounded-full flex items-center justify-center shadow-inner"
        style={{ background: `${p.plate}18`, border: `2.5px dashed ${p.plate}60` }}>
        <span className="text-3xl">{p.icon}</span>
      </div>
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full mt-1"
        style={{ background: `${p.plate}18`, color: p.plate }}>
        {name?.split(" ").slice(0, 2).join(" ") || "Item"}
      </span>
    </div>
  );
};

export default function MenuItems() {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem]   = useState(null);
  const [search, setSearch]       = useState("");

  const [form, setForm]               = useState({ name: "", price: "", category: "", image: null });
  const [imagePreview, setImagePreview] = useState(null);
  const [saving, setSaving]           = useState(false);
  const [formError, setFormError]     = useState("");
  const fileRef = useRef();

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res  = await apiFetch(API);
      const data = await res.json();
      setItems(data);
    } catch { setError("Failed to load items."); }
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, []);

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setFormError("Image must be under 10MB."); return; }
    setFormError("");
    try {
      const compressed = await compressImage(file);
      setImagePreview(compressed);
      setForm(f => ({ ...f, image: compressed }));
    } catch { setFormError("Failed to process image."); }
  };

  const removeImage = () => {
    setImagePreview(null);
    setForm(f => ({ ...f, image: "" }));
    if (fileRef.current) fileRef.current.value = "";
  };

  const openAdd = () => {
    setEditItem(null);
    setForm({ name: "", price: "", category: "", image: null });
    setImagePreview(null);
    setFormError("");
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setForm({ name: item.name, price: item.price, category: item.category || "", image: item.image || null });
    setImagePreview(item.image || null);
    setFormError("");
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditItem(null); };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!form.name.trim()) { setFormError("Item name is required."); return; }
    if (!form.price || isNaN(form.price) || parseFloat(form.price) < 0) { setFormError("Enter a valid price."); return; }
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), price: parseFloat(form.price), category: form.category, image: form.image };
      if (editItem) {
        await apiFetch(`${API}/${editItem.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      } else {
        await apiFetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      }
      closeModal();
      fetchItems();
    } catch { setFormError("Failed to save item."); }
    setSaving(false);
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    try {
      await apiFetch(`${API}/${id}`, { method: "DELETE" });
      fetchItems();
    } catch { setError("Failed to delete item."); }
  };

  const filtered = items.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.category || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto p-4">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-orange-700">🍽️ Menu Items</h2>
          <p className="text-gray-400 text-sm">{items.length} items in your menu</p>
        </div>
        <button onClick={openAdd}
          className="bg-orange-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-orange-700 transition-all flex items-center gap-2">
          ➕ Add Item
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-lg mb-4 text-sm">{error}</div>}

      <div className="relative mb-5">
        <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search items..."
          className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-300 text-sm bg-white shadow-sm" />
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3 animate-spin">⏳</div>
          <p>Loading menu...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-6xl mb-4">🍽️</div>
          <p className="font-semibold text-gray-500">{search ? "No items match your search" : "No items yet"}</p>
          <p className="text-sm mt-1">{!search && "Click '+ Add Item' to add your first menu item"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(item => (
            <div key={item.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all group">
              <div className="h-36 bg-gray-50 relative overflow-hidden">
                {item.image
                  ? <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  : <DefaultImage name={item.name} />
                }
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(item)}
                    className="w-7 h-7 bg-white rounded-full shadow flex items-center justify-center text-xs hover:bg-blue-50">✏️</button>
                  <button onClick={() => handleDelete(item.id, item.name)}
                    className="w-7 h-7 bg-white rounded-full shadow flex items-center justify-center text-xs hover:bg-red-50">🗑️</button>
                </div>
                {item.category && (
                  <span className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">{item.category}</span>
                )}
              </div>
              <div className="p-3">
                <p className="font-semibold text-gray-800 text-sm truncate">{item.name}</p>
                <p className="text-orange-600 font-bold text-base mt-0.5">₹{parseFloat(item.price).toFixed(2)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-orange-600 px-6 py-4 text-white flex items-center justify-between">
              <h3 className="font-bold text-lg">{editItem ? "✏️ Edit Item" : "➕ Add New Item"}</h3>
              <button onClick={closeModal} className="text-orange-200 hover:text-white text-xl">✕</button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-lg text-sm">⚠️ {formError}</div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Item Photo</label>
                <div className="flex gap-3 items-start">
                  <div className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 overflow-hidden flex-shrink-0 bg-gray-50">
                    {imagePreview
                      ? <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                      : <div className="w-full h-full"><DefaultImage name={form.name || "?"} /></div>
                    }
                  </div>
                  <div className="flex-1 space-y-2">
                    <button type="button" onClick={() => fileRef.current?.click()}
                      className="w-full border-2 border-orange-300 text-orange-600 py-2 rounded-xl text-sm font-semibold hover:bg-orange-50 transition-all">
                      📷 {imagePreview ? "Change Photo" : "Upload Photo"}
                    </button>
                    {imagePreview && (
                      <button type="button" onClick={removeImage}
                        className="w-full border border-red-200 text-red-400 py-1.5 rounded-xl text-xs hover:bg-red-50">
                        🗑️ Remove Photo
                      </button>
                    )}
                    <p className="text-xs text-gray-400">JPG, PNG up to 10MB.</p>
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Item Name <span className="text-red-500">*</span></label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Cappuccino, Masala Dosa"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm" required />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Price (₹) <span className="text-red-500">*</span></label>
                <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  placeholder="0.00" min="0" step="0.50"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm" required />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Category <span className="text-gray-400 font-normal">(optional)</span></label>
                <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  placeholder="e.g. Coffee, Snacks, Drinks"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal}
                  className="flex-1 border-2 border-gray-200 text-gray-600 py-2.5 rounded-xl font-semibold hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-orange-600 text-white py-2.5 rounded-xl font-bold hover:bg-orange-700 disabled:opacity-50 transition-all">
                  {saving ? "Saving..." : editItem ? "Update Item" : "Add Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
