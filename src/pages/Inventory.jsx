import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, FileDown, AlertTriangle, History, Pencil, PackagePlus } from "lucide-react";
import { supabase } from "../supabaseClient";
import { INK, INK_MUTED, SURFACE, BORDER, RED, AMBER, GREEN, FONT_NUM, money, num, fmtDateTime, downloadCSV, fieldInput } from "../shared";
import { Modal, Field, PrimaryButton, GhostButton, TableShell, FilterBar, PageHeader } from "../components";

const CATEGORY_LABEL = { raw_material: "Raw material", finished_product: "Finished product", packaging: "Packaging" };

export default function InventoryPage() {
  const [stock, setStock] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showAdjust, setShowAdjust] = useState(false);
  const [historyFor, setHistoryFor] = useState(null);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editProduct, setEditProduct] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [stockR, prodR] = await Promise.all([
      supabase.from("v_current_stock").select("*").order("category").order("name"),
      supabase.from("products").select("*").eq("status", "active").order("name"),
    ]);
    setStock(stockR.data || []);
    setProducts(prodR.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => stock.filter((s) => !categoryFilter || s.category === categoryFilter), [stock, categoryFilter]);
  const lowStock = stock.filter((s) => Number(s.current_stock) < Number(s.low_stock_threshold));

  const exportCsv = () => downloadCSV("inventory.csv", filtered, [
    { label: "Product", get: (r) => r.name }, { label: "Category", get: (r) => CATEGORY_LABEL[r.category] },
    { label: "Current stock", get: (r) => r.current_stock }, { label: "Unit", get: (r) => r.unit },
    { label: "Low stock threshold", get: (r) => r.low_stock_threshold },
  ]);

  return (
    <div style={{ padding: "20px 24px 40px" }}>
      <PageHeader title="Inventory" subtitle="Live stock, calculated from every transaction" right={<>
        <GhostButton onClick={exportCsv}><FileDown size={14} /> Export</GhostButton>
        <GhostButton onClick={() => setShowAddProduct(true)}><PackagePlus size={14} /> Add product</GhostButton>
        <PrimaryButton onClick={() => setShowAdjust(true)}><Plus size={15} /> Manual adjustment</PrimaryButton>
      </>} />

      {lowStock.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, background: "rgba(210,162,76,0.1)",
          border: "1px solid rgba(210,162,76,0.35)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12.5, color: AMBER,
        }}>
          <AlertTriangle size={15} /> Low stock: {lowStock.map((s) => s.name).join(", ")}
        </div>
      )}

      <FilterBar>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ ...fieldInput, width: 190 }}>
          <option value="">All categories</option>
          <option value="raw_material">Raw material</option>
          <option value="finished_product">Finished product</option>
          <option value="packaging">Packaging</option>
        </select>
      </FilterBar>

      <TableShell headers={["Product", "Category", "Current stock", "Low-stock threshold", ""]} loading={loading} empty={filtered.length === 0} colSpan={5}>
        {filtered.map((s) => {
          const low = Number(s.current_stock) < Number(s.low_stock_threshold);
          return (
            <tr key={s.product_id} style={{ borderBottom: `1px solid ${BORDER}` }}>
              <td style={{ padding: "10px 14px", color: INK }}>{s.name}</td>
              <td style={{ padding: "10px 14px", color: INK_MUTED }}>{CATEGORY_LABEL[s.category]}</td>
              <td style={{ padding: "10px 14px", fontFamily: FONT_NUM, color: low ? RED : GREEN }}>{num(s.current_stock, s.unit)}</td>
              <td style={{ padding: "10px 14px", fontFamily: FONT_NUM, color: INK_MUTED }}>{num(s.low_stock_threshold, s.unit)}</td>
              <td style={{ padding: "10px 14px" }}>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setHistoryFor(s)} title="Transaction history" style={{ background: "transparent", border: "none", color: INK_MUTED, cursor: "pointer", display: "flex" }}><History size={15} /></button>
                  <button onClick={() => setEditProduct(products.find((p) => p.id === s.product_id))} title="Edit product" style={{ background: "transparent", border: "none", color: INK_MUTED, cursor: "pointer", display: "flex" }}><Pencil size={14} /></button>
                </div>
              </td>
            </tr>
          );
        })}
      </TableShell>

      {showAdjust && <AdjustmentModal products={products} onClose={() => setShowAdjust(false)} onSaved={() => { setShowAdjust(false); load(); }} />}
      {historyFor && <HistoryModal product={historyFor} onClose={() => setHistoryFor(null)} />}
      {showAddProduct && <ProductFormModal onClose={() => setShowAddProduct(false)} onSaved={() => { setShowAddProduct(false); load(); }} />}
      {editProduct && <ProductFormModal initial={editProduct} onClose={() => setEditProduct(null)} onSaved={() => { setEditProduct(null); load(); }} />}
    </div>
  );
}

function ProductFormModal({ initial, onClose, onSaved }) {
  const [name, setName] = useState(initial?.name || "");
  const [category, setCategory] = useState(initial?.category || "raw_material");
  const [unit, setUnit] = useState(initial?.unit || "kg");
  const [threshold, setThreshold] = useState(initial?.low_stock_threshold ?? "0");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!name.trim()) return setErr("Name is required.");
    setSaving(true);
    const payload = { name: name.trim(), category, unit, low_stock_threshold: Number(threshold) || 0 };
    const { error } = initial
      ? await supabase.from("products").update(payload).eq("id", initial.id)
      : await supabase.from("products").insert(payload);
    setSaving(false);
    if (error) return setErr(error.message);
    onSaved();
  };

  return (
    <Modal title={initial ? "Edit product" : "Add product"} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} style={fieldInput} /></Field>
        <Field label="Category">
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={fieldInput}>
            <option value="raw_material">Raw material</option>
            <option value="finished_product">Finished product</option>
            <option value="packaging">Packaging</option>
          </select>
        </Field>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}><Field label="Unit">
            <select value={unit} onChange={(e) => setUnit(e.target.value)} style={fieldInput}>
              <option value="kg">kg</option><option value="ton">ton</option><option value="pcs">pcs</option>
            </select>
          </Field></div>
          <div style={{ flex: 1 }}><Field label="Low-stock threshold">
            <input type="number" min="0" step="0.01" value={threshold} onChange={(e) => setThreshold(e.target.value)} style={fieldInput} />
          </Field></div>
        </div>
        {err && <div style={{ color: RED, fontSize: 12.5, marginBottom: 12 }}>{err}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

function AdjustmentModal({ products, onClose, onSaved }) {
  const [productId, setProductId] = useState(products[0]?.id || "");
  const [direction, setDirection] = useState("increase");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    const qty = Number(quantity);
    if (!productId) return setErr("Choose a product.");
    if (!qty || qty <= 0) return setErr("Enter a quantity greater than zero.");
    if (!notes.trim()) return setErr("Add a reason for this adjustment.");
    setSaving(true);
    const { error } = await supabase.from("inventory_transactions").insert({
      product_id: productId, txn_type: "adjustment", quantity: direction === "increase" ? qty : -qty,
      source: "manual_adjustment", notes,
    });
    setSaving(false);
    if (error) return setErr(error.message);
    onSaved();
  };

  return (
    <Modal title="Manual stock adjustment" onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Product">
          <select value={productId} onChange={(e) => setProductId(e.target.value)} style={fieldInput}>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Direction">
          <div style={{ display: "flex", gap: 6 }}>
            {[["increase", "Found extra stock (+)"], ["decrease", "Shrinkage / damage (–)"]].map(([v, l]) => (
              <button key={v} type="button" onClick={() => setDirection(v)} style={{
                flex: 1, fontSize: 12.5, padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                background: direction === v ? "#1D2530" : "transparent",
                border: `1px solid ${direction === v ? "#4FA875" : "#293240"}`,
                color: direction === v ? "#F2EEE4" : "#9AA3AC",
              }}>{l}</button>
            ))}
          </div>
        </Field>
        <Field label="Quantity"><input type="number" min="0" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} style={fieldInput} /></Field>
        <Field label="Reason (required)"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ ...fieldInput, resize: "vertical" }} placeholder="e.g. physical count correction, damaged bags removed" /></Field>
        {err && <div style={{ color: RED, fontSize: 12.5, marginBottom: 12 }}>{err}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton type="submit" disabled={saving}>{saving ? "Saving…" : "Apply adjustment"}</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

const TXN_LABEL = { stock_in: "Stock in", stock_out: "Stock out", adjustment: "Adjustment", opening: "Opening balance" };
const SOURCE_LABEL = { purchase: "Purchase", production_input: "Production input", production_output: "Production output", sale: "Sale", manual_adjustment: "Manual adjustment", opening_balance: "Opening balance" };

function HistoryModal({ product, onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.from("inventory_transactions").select("*").eq("product_id", product.product_id).order("created_at", { ascending: false }).limit(30)
      .then(({ data }) => { setRows(data || []); setLoading(false); });
  }, [product.product_id]);

  return (
    <Modal title={`${product.name} — transaction history`} onClose={onClose} width={520}>
      {loading ? <div style={{ color: INK_MUTED, fontSize: 13 }}>Loading…</div> : rows.length === 0 ? (
        <div style={{ color: INK_MUTED, fontSize: 13 }}>No transactions recorded yet.</div>
      ) : (
        <div>
          {rows.map((r) => {
            const isOut = r.txn_type === "stock_out" || (r.txn_type === "adjustment" && Number(r.quantity) < 0);
            return (
              <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, padding: "7px 0", borderBottom: "1px solid #293240" }}>
                <div>
                  <div>{TXN_LABEL[r.txn_type]} · <span style={{ color: INK_MUTED }}>{SOURCE_LABEL[r.source]}</span></div>
                  <div style={{ color: INK_MUTED, fontSize: 11 }}>{fmtDateTime(r.created_at)}{r.notes ? ` · ${r.notes}` : ""}</div>
                </div>
                <span style={{ fontFamily: FONT_NUM, color: isOut ? RED : GREEN }}>{isOut ? "-" : "+"}{num(Math.abs(r.quantity))}</span>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
