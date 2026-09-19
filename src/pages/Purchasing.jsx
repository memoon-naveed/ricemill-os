import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Search as SearchIcon, FileDown, Eye, CreditCard, XCircle } from "lucide-react";
import { supabase } from "../supabaseClient";
import {
  INK, INK_MUTED, SURFACE, SURFACE_RAISED, BORDER, RED, AMBER, FONT_NUM,
  money, num, fmtDate, todayISO, downloadCSV, fieldInput, PAGE_SIZE,
} from "../shared";
import {
  Modal, Field, StatusPill, PrimaryButton, GhostButton, KpiCard,
  Row, Pager, TableShell, FilterBar, PageHeader,
} from "../components";

export default function PurchasingPage() {
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [paddyProducts, setPaddyProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState(null);
  const [payments, setPayments] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const [purR, supR, prodR] = await Promise.all([
        supabase.from("purchases").select("*, suppliers(id,name), products(id,name,unit)").order("created_at", { ascending: false }),
        supabase.from("suppliers").select("*").eq("status", "active").order("name"),
        supabase.from("products").select("*").eq("status", "active").eq("category", "raw_material").order("name"),
      ]);
      if (purR.error) throw purR.error;
      setPurchases(purR.data || []);
      setSuppliers(supR.data || []);
      setPaddyProducts(prodR.data || []);
    } catch (e) {
      setErr(e.message || "Failed to load purchases.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadPayments = useCallback(async (purchaseId) => {
    const { data } = await supabase.from("payments").select("*").eq("related_type", "purchase").eq("related_id", purchaseId).order("payment_date", { ascending: false });
    setPayments(data || []);
  }, []);

  useEffect(() => { if (selected) loadPayments(selected.id); }, [selected, loadPayments]);

  const filtered = useMemo(() => purchases.filter((p) => {
    if (supplierFilter && p.supplier_id !== supplierFilter) return false;
    if (statusFilter && p.payment_status !== statusFilter) return false;
    if (dateFrom && p.purchase_date < dateFrom) return false;
    if (dateTo && p.purchase_date > dateTo) return false;
    if (search) {
      const hay = `${p.suppliers?.name || ""} ${p.products?.name || ""} ${p.notes || ""}`.toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  }), [purchases, supplierFilter, statusFilter, dateFrom, dateTo, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const summary = useMemo(() => ({
    total: filtered.reduce((a, p) => a + Number(p.total_amount), 0),
    outstanding: filtered.reduce((a, p) => a + (Number(p.total_amount) - Number(p.paid_amount)), 0),
  }), [filtered]);

  const exportCsv = () => downloadCSV("purchases.csv", filtered, [
    { label: "Date", get: (r) => r.purchase_date },
    { label: "Supplier", get: (r) => r.suppliers?.name },
    { label: "Product", get: (r) => r.products?.name },
    { label: "Quantity", get: (r) => r.quantity },
    { label: "Unit", get: (r) => r.unit },
    { label: "Rate", get: (r) => r.rate },
    { label: "Total", get: (r) => r.total_amount },
    { label: "Paid", get: (r) => r.paid_amount },
    { label: "Outstanding", get: (r) => Number(r.total_amount) - Number(r.paid_amount) },
    { label: "Status", get: (r) => r.payment_status },
  ]);

  return (
    <div style={{ padding: "20px 24px 40px" }}>
      <PageHeader title="Purchasing" subtitle="Paddy purchases from suppliers" right={<>
        <GhostButton onClick={exportCsv}><FileDown size={14} /> Export</GhostButton>
        <PrimaryButton onClick={() => setShowAdd(true)}><Plus size={15} /> Add purchase</PrimaryButton>
      </>} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
        <KpiCard label="Purchases (filtered)" value={money(summary.total)} />
        <KpiCard label="Outstanding to suppliers" value={money(summary.outstanding)} tone={summary.outstanding > 0 ? "warn" : undefined} />
        <KpiCard label="Records" value={filtered.length} />
      </div>

      <FilterBar>
        <div style={{ position: "relative", flex: "1 1 200px" }}>
          <SearchIcon size={14} color={INK_MUTED} style={{ position: "absolute", left: 10, top: 10 }} />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search supplier, paddy, notes…"
            style={{ ...fieldInput, paddingLeft: 30 }} />
        </div>
        <select value={supplierFilter} onChange={(e) => { setSupplierFilter(e.target.value); setPage(1); }} style={{ ...fieldInput, width: 170 }}>
          <option value="">All suppliers</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} style={{ ...fieldInput, width: 140 }}>
          <option value="">All statuses</option>
          <option value="unpaid">Unpaid</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
        </select>
        <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} style={{ ...fieldInput, width: 145 }} />
        <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} style={{ ...fieldInput, width: 145 }} />
      </FilterBar>

      {err && <div style={{ color: RED, fontSize: 13, marginBottom: 14 }}>{err}</div>}

      <TableShell headers={["Date", "Supplier", "Paddy", "Qty", "Rate", "Total", "Paid", "Status", ""]} loading={loading} empty={pageRows.length === 0} colSpan={9}>
        {pageRows.map((p) => (
          <tr key={p.id} style={{ borderBottom: `1px solid ${BORDER}`, opacity: p.status === "cancelled" ? 0.5 : 1 }}>
            <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>{fmtDate(p.purchase_date)}</td>
            <td style={{ padding: "10px 14px", color: INK }}>{p.suppliers?.name}</td>
            <td style={{ padding: "10px 14px", color: INK }}>{p.products?.name}</td>
            <td style={{ padding: "10px 14px", fontFamily: FONT_NUM }}>{num(p.quantity, p.unit)}</td>
            <td style={{ padding: "10px 14px", fontFamily: FONT_NUM }}>{money(p.rate)}</td>
            <td style={{ padding: "10px 14px", fontFamily: FONT_NUM }}>{money(p.total_amount)}</td>
            <td style={{ padding: "10px 14px", fontFamily: FONT_NUM }}>{money(p.paid_amount)}</td>
            <td style={{ padding: "10px 14px" }}><StatusPill status={p.status === "cancelled" ? "cancelled" : p.payment_status} /></td>
            <td style={{ padding: "10px 14px" }}>
              <button onClick={() => setSelected(p)} title="View details" style={{ background: "transparent", border: "none", color: INK_MUTED, cursor: "pointer", display: "flex" }}><Eye size={15} /></button>
            </td>
          </tr>
        ))}
      </TableShell>
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderTop: "none", borderRadius: "0 0 10px 10px" }}>
        <Pager page={page} setPage={setPage} totalPages={totalPages} count={filtered.length} pageSize={PAGE_SIZE} />
      </div>

      {showAdd && (
        <AddPurchaseModal suppliers={suppliers} products={paddyProducts} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />
      )}
      {selected && (
        <PurchaseDetailModal purchase={selected} payments={payments} onClose={() => setSelected(null)}
          onChanged={async () => { await load(); await loadPayments(selected.id); }} />
      )}
    </div>
  );
}

function AddPurchaseModal({ suppliers, products, onClose, onSaved }) {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || "");
  const [productId, setProductId] = useState(products[0]?.id || "");
  const [date, setDate] = useState(todayISO());
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("kg");
  const [rate, setRate] = useState("");
  const [paid, setPaid] = useState("0");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const qty = Number(quantity) || 0;
  const rt = Number(rate) || 0;
  const total = qty * rt;
  const paidNum = Number(paid) || 0;

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!supplierId || !productId) return setErr("Choose a supplier and a paddy type.");
    if (qty <= 0) return setErr("Quantity must be greater than zero.");
    if (rt <= 0) return setErr("Rate must be greater than zero.");
    if (paidNum < 0 || paidNum > total) return setErr("Paid amount must be between 0 and the total.");
    setSaving(true);
    const { error } = await supabase.from("purchases").insert({
      purchase_date: date, supplier_id: supplierId, product_id: productId,
      quantity: qty, unit, rate: rt, paid_amount: paidNum, notes: notes || null,
    });
    setSaving(false);
    if (error) return setErr(error.message);
    onSaved();
  };

  return (
    <Modal title="Add purchase" onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Supplier">
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} style={fieldInput}>
            {suppliers.length === 0 && <option value="">No suppliers yet</option>}
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Paddy type">
          <select value={productId} onChange={(e) => setProductId(e.target.value)} style={fieldInput}>
            {products.length === 0 && <option value="">No paddy products yet</option>}
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={fieldInput} /></Field>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 2 }}><Field label="Quantity"><input type="number" min="0" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} style={fieldInput} placeholder="0" /></Field></div>
          <div style={{ flex: 1 }}><Field label="Unit">
            <select value={unit} onChange={(e) => setUnit(e.target.value)} style={fieldInput}>
              <option value="kg">kg</option><option value="ton">ton</option>
            </select>
          </Field></div>
        </div>
        <Field label="Rate per unit (PKR)"><input type="number" min="0" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} style={fieldInput} placeholder="0" /></Field>
        <Field label="Paid amount (PKR)"><input type="number" min="0" step="0.01" value={paid} onChange={(e) => setPaid(e.target.value)} style={fieldInput} /></Field>
        <Field label="Notes (optional)"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ ...fieldInput, resize: "vertical" }} /></Field>
        <div style={{ display: "flex", justifyContent: "space-between", background: SURFACE_RAISED, borderRadius: 8, padding: "10px 12px", marginBottom: 14, fontSize: 13 }}>
          <span style={{ color: INK_MUTED }}>Total amount</span><span style={{ fontFamily: FONT_NUM }}>{money(total)}</span>
        </div>
        {err && <div style={{ color: RED, fontSize: 12.5, marginBottom: 12 }}>{err}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton type="submit" disabled={saving}>{saving ? "Saving…" : "Confirm purchase"}</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

function PurchaseDetailModal({ purchase, payments, onClose, onChanged }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const outstanding = Number(purchase.total_amount) - Number(purchase.paid_amount);

  const addPayment = async (e) => {
    e.preventDefault();
    setErr("");
    const amt = Number(amount);
    if (!amt || amt <= 0) return setErr("Enter a valid amount.");
    if (amt > outstanding) return setErr(`Cannot exceed outstanding balance of ${money(outstanding)}.`);
    setSaving(true);
    const { error } = await supabase.from("payments").insert({ payment_date: todayISO(), direction: "out", related_type: "purchase", related_id: purchase.id, amount: amt, method });
    setSaving(false);
    if (error) return setErr(error.message);
    setAmount(""); onChanged();
  };

  const cancelPurchase = async () => {
    setCancelling(true);
    const { error } = await supabase.from("purchases").update({ status: "cancelled" }).eq("id", purchase.id);
    setCancelling(false);
    if (!error) onChanged();
  };

  return (
    <Modal title="Purchase details" onClose={onClose} width={440}>
      <div style={{ fontSize: 13, marginBottom: 16 }}>
        <Row label="Date" value={fmtDate(purchase.purchase_date)} />
        <Row label="Supplier" value={purchase.suppliers?.name} />
        <Row label="Paddy" value={purchase.products?.name} />
        <Row label="Quantity" value={num(purchase.quantity, purchase.unit)} />
        <Row label="Rate" value={money(purchase.rate)} />
        <Row label="Total" value={money(purchase.total_amount)} />
        <Row label="Paid" value={money(purchase.paid_amount)} />
        <Row label="Outstanding" value={money(outstanding)} />
        <Row label="Status" value={<StatusPill status={purchase.status === "cancelled" ? "cancelled" : purchase.payment_status} />} />
        {purchase.notes && <Row label="Notes" value={purchase.notes} />}
      </div>
      <div style={{ borderTop: "1px solid #293240", paddingTop: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>Payment history</div>
        {payments.length === 0 ? <div style={{ fontSize: 12.5, color: INK_MUTED }}>No payments recorded yet.</div> :
          payments.map((p) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "4px 0" }}>
              <span style={{ color: INK_MUTED }}>{fmtDate(p.payment_date)} · {p.method}</span>
              <span style={{ fontFamily: FONT_NUM }}>{money(p.amount)}</span>
            </div>
          ))}
      </div>
      {purchase.status === "active" && outstanding > 0 && (
        <form onSubmit={addPayment} style={{ borderTop: "1px solid #293240", paddingTop: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>Record a payment</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`Up to ${outstanding}`} style={{ ...fieldInput, flex: 1 }} />
            <select value={method} onChange={(e) => setMethod(e.target.value)} style={{ ...fieldInput, width: 100 }}>
              <option value="cash">Cash</option><option value="bank">Bank</option><option value="other">Other</option>
            </select>
            <PrimaryButton type="submit" disabled={saving}><CreditCard size={14} />{saving ? "…" : "Pay"}</PrimaryButton>
          </div>
          {err && <div style={{ color: RED, fontSize: 12, marginTop: 8 }}>{err}</div>}
        </form>
      )}
      {purchase.status === "active" && (
        <div style={{ borderTop: "1px solid #293240", paddingTop: 14 }}>
          <GhostButton danger onClick={cancelPurchase}><XCircle size={14} />{cancelling ? "Cancelling…" : "Cancel this purchase"}</GhostButton>
        </div>
      )}
    </Modal>
  );
}
