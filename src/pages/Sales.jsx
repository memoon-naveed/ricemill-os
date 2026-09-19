import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Search as SearchIcon, FileDown, Eye, CreditCard, XCircle, Truck } from "lucide-react";
import { supabase } from "../supabaseClient";
import {
  INK, INK_MUTED, SURFACE, SURFACE_RAISED, BORDER, RED, FONT_NUM,
  money, num, fmtDate, todayISO, downloadCSV, fieldInput, PAGE_SIZE,
} from "../shared";
import {
  Modal, Field, StatusPill, PrimaryButton, GhostButton, KpiCard,
  Row, Pager, TableShell, FilterBar, PageHeader,
} from "../components";

export default function SalesPage() {
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [finishedProducts, setFinishedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [search, setSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
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
      const [saleR, custR, prodR] = await Promise.all([
        supabase.from("sales").select("*, customers(id,name), products(id,name,unit)").order("created_at", { ascending: false }),
        supabase.from("customers").select("*").eq("status", "active").order("name"),
        supabase.from("products").select("*").eq("status", "active").eq("category", "finished_product").order("name"),
      ]);
      if (saleR.error) throw saleR.error;
      setSales(saleR.data || []);
      setCustomers(custR.data || []);
      setFinishedProducts(prodR.data || []);
    } catch (e) {
      setErr(e.message || "Failed to load sales.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadPayments = useCallback(async (saleId) => {
    const { data } = await supabase.from("payments").select("*").eq("related_type", "sale").eq("related_id", saleId).order("payment_date", { ascending: false });
    setPayments(data || []);
  }, []);

  useEffect(() => { if (selected) loadPayments(selected.id); }, [selected, loadPayments]);

  const filtered = useMemo(() => sales.filter((s) => {
    if (customerFilter && s.customer_id !== customerFilter) return false;
    if (statusFilter && s.payment_status !== statusFilter) return false;
    if (dateFrom && s.sale_date < dateFrom) return false;
    if (dateTo && s.sale_date > dateTo) return false;
    if (search) {
      const hay = `${s.customers?.name || ""} ${s.products?.name || ""} ${s.notes || ""}`.toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  }), [sales, customerFilter, statusFilter, dateFrom, dateTo, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const summary = useMemo(() => ({
    total: filtered.reduce((a, s) => a + Number(s.total_amount), 0),
    receivable: filtered.reduce((a, s) => a + (Number(s.total_amount) - Number(s.paid_amount)), 0),
  }), [filtered]);

  const exportCsv = () => downloadCSV("sales.csv", filtered, [
    { label: "Date", get: (r) => r.sale_date },
    { label: "Customer", get: (r) => r.customers?.name },
    { label: "Product", get: (r) => r.products?.name },
    { label: "Quantity", get: (r) => r.quantity },
    { label: "Rate", get: (r) => r.rate },
    { label: "Total", get: (r) => r.total_amount },
    { label: "Paid", get: (r) => r.paid_amount },
    { label: "Status", get: (r) => r.payment_status },
    { label: "Dispatch", get: (r) => r.dispatch_status },
  ]);

  return (
    <div style={{ padding: "20px 24px 40px" }}>
      <PageHeader title="Sales" subtitle="Finished-product sales to customers" right={<>
        <GhostButton onClick={exportCsv}><FileDown size={14} /> Export</GhostButton>
        <PrimaryButton onClick={() => setShowAdd(true)}><Plus size={15} /> Add sale</PrimaryButton>
      </>} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
        <KpiCard label="Sales (filtered)" value={money(summary.total)} />
        <KpiCard label="Receivable from customers" value={money(summary.receivable)} tone={summary.receivable > 0 ? "warn" : undefined} />
        <KpiCard label="Records" value={filtered.length} />
      </div>

      <FilterBar>
        <div style={{ position: "relative", flex: "1 1 200px" }}>
          <SearchIcon size={14} color={INK_MUTED} style={{ position: "absolute", left: 10, top: 10 }} />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search customer, product, notes…" style={{ ...fieldInput, paddingLeft: 30 }} />
        </div>
        <select value={customerFilter} onChange={(e) => { setCustomerFilter(e.target.value); setPage(1); }} style={{ ...fieldInput, width: 170 }}>
          <option value="">All customers</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} style={{ ...fieldInput, width: 140 }}>
          <option value="">All statuses</option>
          <option value="unpaid">Unpaid</option><option value="partial">Partial</option><option value="paid">Paid</option>
        </select>
        <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} style={{ ...fieldInput, width: 145 }} />
        <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} style={{ ...fieldInput, width: 145 }} />
      </FilterBar>

      {err && <div style={{ color: RED, fontSize: 13, marginBottom: 14 }}>{err}</div>}

      <TableShell headers={["Date", "Customer", "Product", "Qty", "Rate", "Total", "Paid", "Status", "Dispatch", ""]} loading={loading} empty={pageRows.length === 0} colSpan={10}>
        {pageRows.map((s) => (
          <tr key={s.id} style={{ borderBottom: `1px solid ${BORDER}`, opacity: s.status === "cancelled" ? 0.5 : 1 }}>
            <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>{fmtDate(s.sale_date)}</td>
            <td style={{ padding: "10px 14px", color: INK }}>{s.customers?.name}</td>
            <td style={{ padding: "10px 14px", color: INK }}>{s.products?.name}</td>
            <td style={{ padding: "10px 14px", fontFamily: FONT_NUM }}>{num(s.quantity, s.unit)}</td>
            <td style={{ padding: "10px 14px", fontFamily: FONT_NUM }}>{money(s.rate)}</td>
            <td style={{ padding: "10px 14px", fontFamily: FONT_NUM }}>{money(s.total_amount)}</td>
            <td style={{ padding: "10px 14px", fontFamily: FONT_NUM }}>{money(s.paid_amount)}</td>
            <td style={{ padding: "10px 14px" }}><StatusPill status={s.status === "cancelled" ? "cancelled" : s.payment_status} /></td>
            <td style={{ padding: "10px 14px" }}><StatusPill status={s.dispatch_status} /></td>
            <td style={{ padding: "10px 14px" }}>
              <button onClick={() => setSelected(s)} title="View details" style={{ background: "transparent", border: "none", color: INK_MUTED, cursor: "pointer", display: "flex" }}><Eye size={15} /></button>
            </td>
          </tr>
        ))}
      </TableShell>
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderTop: "none", borderRadius: "0 0 10px 10px" }}>
        <Pager page={page} setPage={setPage} totalPages={totalPages} count={filtered.length} pageSize={PAGE_SIZE} />
      </div>

      {showAdd && (
        <AddSaleModal customers={customers} products={finishedProducts} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />
      )}
      {selected && (
        <SaleDetailModal sale={selected} payments={payments} onClose={() => setSelected(null)}
          onChanged={async () => { await load(); await loadPayments(selected.id); }} />
      )}
    </div>
  );
}

function AddSaleModal({ customers, products, onClose, onSaved }) {
  const [customerId, setCustomerId] = useState(customers[0]?.id || "");
  const [productId, setProductId] = useState(products[0]?.id || "");
  const [date, setDate] = useState(todayISO());
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("kg");
  const [rate, setRate] = useState("");
  const [paid, setPaid] = useState("0");
  const [dispatch, setDispatch] = useState("pending");
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
    if (!customerId || !productId) return setErr("Choose a customer and a product.");
    if (qty <= 0) return setErr("Quantity must be greater than zero.");
    if (rt <= 0) return setErr("Rate must be greater than zero.");
    if (paidNum < 0 || paidNum > total) return setErr("Paid amount must be between 0 and the total.");
    setSaving(true);
    const { error } = await supabase.from("sales").insert({
      sale_date: date, customer_id: customerId, product_id: productId,
      quantity: qty, unit, rate: rt, paid_amount: paidNum, dispatch_status: dispatch, notes: notes || null,
    });
    setSaving(false);
    if (error) return setErr(error.message.includes("Insufficient stock") ? error.message : error.message);
    onSaved();
  };

  return (
    <Modal title="Add sale" onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Customer">
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} style={fieldInput}>
            {customers.length === 0 && <option value="">No customers yet</option>}
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Product">
          <select value={productId} onChange={(e) => setProductId(e.target.value)} style={fieldInput}>
            {products.length === 0 && <option value="">No finished products yet</option>}
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={fieldInput} /></Field>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 2 }}><Field label="Quantity"><input type="number" min="0" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} style={fieldInput} placeholder="0" /></Field></div>
          <div style={{ flex: 1 }}><Field label="Unit">
            <select value={unit} onChange={(e) => setUnit(e.target.value)} style={fieldInput}>
              <option value="kg">kg</option><option value="ton">ton</option><option value="pcs">pcs</option>
            </select>
          </Field></div>
        </div>
        <Field label="Rate per unit (PKR)"><input type="number" min="0" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} style={fieldInput} placeholder="0" /></Field>
        <Field label="Paid amount (PKR)"><input type="number" min="0" step="0.01" value={paid} onChange={(e) => setPaid(e.target.value)} style={fieldInput} /></Field>
        <Field label="Dispatch status">
          <select value={dispatch} onChange={(e) => setDispatch(e.target.value)} style={fieldInput}>
            <option value="pending">Pending</option><option value="dispatched">Dispatched</option><option value="delivered">Delivered</option>
          </select>
        </Field>
        <Field label="Notes (optional)"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ ...fieldInput, resize: "vertical" }} /></Field>
        <div style={{ display: "flex", justifyContent: "space-between", background: SURFACE_RAISED, borderRadius: 8, padding: "10px 12px", marginBottom: 14, fontSize: 13 }}>
          <span style={{ color: INK_MUTED }}>Total amount</span><span style={{ fontFamily: FONT_NUM }}>{money(total)}</span>
        </div>
        {err && <div style={{ color: RED, fontSize: 12.5, marginBottom: 12 }}>{err}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton type="submit" disabled={saving}>{saving ? "Saving…" : "Confirm sale"}</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

function SaleDetailModal({ sale, payments, onClose, onChanged }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [dispatchSaving, setDispatchSaving] = useState(false);
  const outstanding = Number(sale.total_amount) - Number(sale.paid_amount);

  const addPayment = async (e) => {
    e.preventDefault();
    setErr("");
    const amt = Number(amount);
    if (!amt || amt <= 0) return setErr("Enter a valid amount.");
    if (amt > outstanding) return setErr(`Cannot exceed outstanding balance of ${money(outstanding)}.`);
    setSaving(true);
    const { error } = await supabase.from("payments").insert({ payment_date: todayISO(), direction: "in", related_type: "sale", related_id: sale.id, amount: amt, method });
    setSaving(false);
    if (error) return setErr(error.message);
    setAmount(""); onChanged();
  };

  const updateDispatch = async (val) => {
    setDispatchSaving(true);
    await supabase.from("sales").update({ dispatch_status: val }).eq("id", sale.id);
    setDispatchSaving(false);
    onChanged();
  };

  const cancelSale = async () => {
    setCancelling(true);
    const { error } = await supabase.from("sales").update({ status: "cancelled" }).eq("id", sale.id);
    setCancelling(false);
    if (!error) onChanged();
  };

  return (
    <Modal title="Sale details" onClose={onClose} width={440}>
      <div style={{ fontSize: 13, marginBottom: 16 }}>
        <Row label="Date" value={fmtDate(sale.sale_date)} />
        <Row label="Customer" value={sale.customers?.name} />
        <Row label="Product" value={sale.products?.name} />
        <Row label="Quantity" value={num(sale.quantity, sale.unit)} />
        <Row label="Rate" value={money(sale.rate)} />
        <Row label="Total" value={money(sale.total_amount)} />
        <Row label="Paid" value={money(sale.paid_amount)} />
        <Row label="Outstanding" value={money(outstanding)} />
        <Row label="Status" value={<StatusPill status={sale.status === "cancelled" ? "cancelled" : sale.payment_status} />} />
        {sale.notes && <Row label="Notes" value={sale.notes} />}
      </div>

      {sale.status === "active" && (
        <div style={{ borderTop: "1px solid #293240", paddingTop: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><Truck size={14} /> Dispatch status</div>
          <div style={{ display: "flex", gap: 6 }}>
            {["pending", "dispatched", "delivered"].map((v) => (
              <button key={v} disabled={dispatchSaving} onClick={() => updateDispatch(v)} style={{
                fontSize: 12, padding: "6px 10px", borderRadius: 6, cursor: "pointer",
                background: sale.dispatch_status === v ? "#1D2530" : "transparent",
                border: `1px solid ${sale.dispatch_status === v ? "#4FA875" : "#293240"}`,
                color: sale.dispatch_status === v ? "#F2EEE4" : "#9AA3AC",
              }}>{v}</button>
            ))}
          </div>
        </div>
      )}

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

      {sale.status === "active" && outstanding > 0 && (
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
      {sale.status === "active" && (
        <div style={{ borderTop: "1px solid #293240", paddingTop: 14 }}>
          <GhostButton danger onClick={cancelSale}><XCircle size={14} />{cancelling ? "Cancelling…" : "Cancel this sale"}</GhostButton>
        </div>
      )}
    </Modal>
  );
}
