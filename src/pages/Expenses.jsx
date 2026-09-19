import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, FileDown } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { supabase } from "../supabaseClient";
import { INK_MUTED, SURFACE, BORDER, RED, GREEN, BLUE, AMBER, FONT_NUM, money, fmtDate, todayISO, downloadCSV, fieldInput, PAGE_SIZE } from "../shared";
import { Modal, Field, PrimaryButton, GhostButton, KpiCard, SectionCard, Pager, TableShell, FilterBar, PageHeader } from "../components";

const CATEGORIES = ["electricity", "labor", "transport", "fuel", "maintenance", "packaging", "repairs", "rent", "administration", "other"];
const PIE_COLORS = [GREEN, BLUE, AMBER, RED, "#8B7FD6", "#5FA8A0", "#C77DAA", "#7FA8C7", "#B0A15A", "#8FA37A"];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("expenses").select("*").eq("status", "active").order("expense_date", { ascending: false });
    setExpenses(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => expenses.filter((e) => {
    if (categoryFilter && e.category !== categoryFilter) return false;
    if (dateFrom && e.expense_date < dateFrom) return false;
    if (dateTo && e.expense_date > dateTo) return false;
    return true;
  }), [expenses, categoryFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const total = filtered.reduce((a, e) => a + Number(e.amount), 0);

  const breakdown = useMemo(() => {
    const map = {};
    filtered.forEach((e) => { map[e.category] = (map[e.category] || 0) + Number(e.amount); });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  const exportCsv = () => downloadCSV("expenses.csv", filtered, [
    { label: "Date", get: (r) => r.expense_date }, { label: "Category", get: (r) => r.category },
    { label: "Description", get: (r) => r.description }, { label: "Amount", get: (r) => r.amount },
    { label: "Payment method", get: (r) => r.payment_method }, { label: "Reference", get: (r) => r.reference },
  ]);

  return (
    <div style={{ padding: "20px 24px 40px" }}>
      <PageHeader title="Expenses" subtitle="Operating costs by category" right={<>
        <GhostButton onClick={exportCsv}><FileDown size={14} /> Export</GhostButton>
        <PrimaryButton onClick={() => setShowAdd(true)}><Plus size={15} /> Add expense</PrimaryButton>
      </>} />

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, alignContent: "start" }}>
          <KpiCard label="Total (filtered)" value={money(total)} />
          <KpiCard label="Records" value={filtered.length} />
        </div>
        <SectionCard title="By category">
          {breakdown.length === 0 ? <div style={{ color: INK_MUTED, fontSize: 12.5 }}>No expenses in range.</div> : (
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={breakdown} dataKey="value" nameKey="name" innerRadius={38} outerRadius={62} paddingAngle={2}>
                  {breakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => money(v)} contentStyle={{ background: "#1D2530", border: "1px solid #293240", fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 10.5 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      <FilterBar>
        <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }} style={{ ...fieldInput, width: 170 }}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} style={{ ...fieldInput, width: 145 }} />
        <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} style={{ ...fieldInput, width: 145 }} />
      </FilterBar>

      <TableShell headers={["Date", "Category", "Description", "Amount", "Method"]} loading={loading} empty={pageRows.length === 0} colSpan={5}>
        {pageRows.map((e) => (
          <tr key={e.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
            <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>{fmtDate(e.expense_date)}</td>
            <td style={{ padding: "10px 14px", textTransform: "capitalize" }}>{e.category}</td>
            <td style={{ padding: "10px 14px" }}>{e.description || "—"}</td>
            <td style={{ padding: "10px 14px", fontFamily: FONT_NUM }}>{money(e.amount)}</td>
            <td style={{ padding: "10px 14px", textTransform: "capitalize" }}>{e.payment_method}</td>
          </tr>
        ))}
      </TableShell>
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderTop: "none", borderRadius: "0 0 10px 10px" }}>
        <Pager page={page} setPage={setPage} totalPages={totalPages} count={filtered.length} pageSize={PAGE_SIZE} />
      </div>

      {showAdd && <AddExpenseModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}

function AddExpenseModal({ onClose, onSaved }) {
  const [date, setDate] = useState(todayISO());
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    const amt = Number(amount);
    if (!amt || amt <= 0) return setErr("Amount must be greater than zero.");
    setSaving(true);
    const { error } = await supabase.from("expenses").insert({
      expense_date: date, category, description: description || null, amount: amt,
      payment_method: method, reference: reference || null, notes: notes || null,
    });
    setSaving(false);
    if (error) return setErr(error.message);
    onSaved();
  };

  return (
    <Modal title="Add expense" onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={fieldInput} /></Field>
        <Field label="Category">
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={fieldInput}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Description"><input value={description} onChange={(e) => setDescription(e.target.value)} style={fieldInput} /></Field>
        <Field label="Amount (PKR)"><input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} style={fieldInput} /></Field>
        <Field label="Payment method">
          <select value={method} onChange={(e) => setMethod(e.target.value)} style={fieldInput}>
            <option value="cash">Cash</option><option value="bank">Bank</option><option value="other">Other</option>
          </select>
        </Field>
        <Field label="Reference (optional)"><input value={reference} onChange={(e) => setReference(e.target.value)} style={fieldInput} /></Field>
        <Field label="Notes (optional)"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ ...fieldInput, resize: "vertical" }} /></Field>
        {err && <div style={{ color: RED, fontSize: 12.5, marginBottom: 12 }}>{err}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton type="submit" disabled={saving}>{saving ? "Saving…" : "Save expense"}</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}
