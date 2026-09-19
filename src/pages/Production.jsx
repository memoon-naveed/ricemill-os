import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, FileDown, Eye } from "lucide-react";
import { supabase } from "../supabaseClient";
import { INK, INK_MUTED, SURFACE, BORDER, RED, GREEN, FONT_NUM, money, num, pct, fmtDate, todayISO, downloadCSV, fieldInput, PAGE_SIZE } from "../shared";
import { Modal, Field, PrimaryButton, GhostButton, KpiCard, Row, Pager, TableShell, FilterBar, PageHeader } from "../components";

const OUTPUT_TYPES = [
  { key: "rice", label: "Rice" },
  { key: "broken_rice", label: "Broken rice" },
  { key: "bran", label: "Bran" },
  { key: "husk", label: "Husk" },
  { key: "waste_other", label: "Waste / other" },
];

export default function ProductionPage() {
  const [batches, setBatches] = useState([]);
  const [paddyProducts, setPaddyProducts] = useState([]);
  const [outputProducts, setOutputProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const [sumR, batchR, paddyR, prodR] = await Promise.all([
        supabase.from("v_production_summary").select("*").order("batch_date", { ascending: false }),
        supabase.from("production_batches").select("*, products(name,unit)").order("created_at", { ascending: false }),
        supabase.from("products").select("*").eq("status", "active").eq("category", "raw_material").order("name"),
        supabase.from("products").select("*").eq("status", "active").eq("category", "finished_product").order("name"),
      ]);
      if (sumR.error) throw sumR.error;
      const summaryMap = {};
      (sumR.data || []).forEach((s) => { summaryMap[s.batch_id] = s; });
      setBatches((batchR.data || []).map((b) => ({ ...b, summary: summaryMap[b.id] })));
      setPaddyProducts(paddyR.data || []);
      setOutputProducts(prodR.data || []);
    } catch (e) {
      setErr(e.message || "Failed to load production batches.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => batches.filter((b) => {
    if (dateFrom && b.batch_date < dateFrom) return false;
    if (dateTo && b.batch_date > dateTo) return false;
    return true;
  }), [batches, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totals = useMemo(() => ({
    paddyIn: filtered.reduce((a, b) => a + Number(b.paddy_input_qty), 0),
    riceOut: filtered.reduce((a, b) => a + Number(b.summary?.rice_output || 0), 0),
  }), [filtered]);
  const avgRecovery = totals.paddyIn > 0 ? (totals.riceOut / totals.paddyIn) * 100 : null;

  const exportCsv = () => downloadCSV("production.csv", filtered, [
    { label: "Date", get: (r) => r.batch_date }, { label: "Paddy type", get: (r) => r.products?.name },
    { label: "Paddy input", get: (r) => r.paddy_input_qty }, { label: "Rice output", get: (r) => r.summary?.rice_output || 0 },
    { label: "Broken rice", get: (r) => r.summary?.broken_rice_output || 0 }, { label: "Bran", get: (r) => r.summary?.bran_output || 0 },
    { label: "Husk", get: (r) => r.summary?.husk_output || 0 }, { label: "Recovery %", get: (r) => r.summary?.recovery_pct || "" },
  ]);

  return (
    <div style={{ padding: "20px 24px 40px" }}>
      <PageHeader title="Production" subtitle="Milling batches and yield" right={<>
        <GhostButton onClick={exportCsv}><FileDown size={14} /> Export</GhostButton>
        <PrimaryButton onClick={() => setShowAdd(true)}><Plus size={15} /> New batch</PrimaryButton>
      </>} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 16 }}>
        <KpiCard label="Paddy processed" value={num(totals.paddyIn, "kg")} />
        <KpiCard label="Rice produced" value={num(totals.riceOut, "kg")} />
        <KpiCard label="Average recovery" value={pct(avgRecovery)} />
        <KpiCard label="Batches" value={filtered.length} />
      </div>

      <FilterBar>
        <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} style={{ ...fieldInput, width: 145 }} />
        <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} style={{ ...fieldInput, width: 145 }} />
      </FilterBar>

      {err && <div style={{ color: RED, fontSize: 13, marginBottom: 14 }}>{err}</div>}

      <TableShell headers={["Date", "Paddy type", "Input", "Rice out", "Recovery", "Broken %", ""]} loading={loading} empty={pageRows.length === 0} colSpan={7}>
        {pageRows.map((b) => (
          <tr key={b.id} style={{ borderBottom: `1px solid ${BORDER}`, opacity: b.status === "cancelled" ? 0.5 : 1 }}>
            <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>{fmtDate(b.batch_date)}</td>
            <td style={{ padding: "10px 14px", color: INK }}>{b.products?.name}</td>
            <td style={{ padding: "10px 14px", fontFamily: FONT_NUM }}>{num(b.paddy_input_qty, b.products?.unit)}</td>
            <td style={{ padding: "10px 14px", fontFamily: FONT_NUM }}>{num(b.summary?.rice_output)}</td>
            <td style={{ padding: "10px 14px", fontFamily: FONT_NUM, color: GREEN }}>{pct(b.summary?.recovery_pct)}</td>
            <td style={{ padding: "10px 14px", fontFamily: FONT_NUM }}>{pct(b.summary?.broken_pct)}</td>
            <td style={{ padding: "10px 14px" }}>
              <button onClick={() => setSelected(b)} title="View details" style={{ background: "transparent", border: "none", color: INK_MUTED, cursor: "pointer", display: "flex" }}><Eye size={15} /></button>
            </td>
          </tr>
        ))}
      </TableShell>
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderTop: "none", borderRadius: "0 0 10px 10px" }}>
        <Pager page={page} setPage={setPage} totalPages={totalPages} count={filtered.length} pageSize={PAGE_SIZE} />
      </div>

      {showAdd && <AddBatchModal paddyProducts={paddyProducts} outputProducts={outputProducts} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
      {selected && <BatchDetailModal batch={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function AddBatchModal({ paddyProducts, outputProducts, onClose, onSaved }) {
  const [paddyId, setPaddyId] = useState(paddyProducts[0]?.id || "");
  const [date, setDate] = useState(todayISO());
  const [inputQty, setInputQty] = useState("");
  const [outputs, setOutputs] = useState(() => Object.fromEntries(OUTPUT_TYPES.map((t) => [t.key, { productId: "", qty: "" }])));
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const setOutput = (key, field, value) => setOutputs((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));

  const totalOutput = Object.values(outputs).reduce((a, o) => a + (Number(o.qty) || 0), 0);
  const qty = Number(inputQty) || 0;

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!paddyId) return setErr("Choose a paddy type.");
    if (qty <= 0) return setErr("Paddy input must be greater than zero.");
    const activeOutputs = OUTPUT_TYPES.filter((t) => Number(outputs[t.key].qty) > 0);
    if (activeOutputs.length === 0) return setErr("Enter at least one output quantity.");
    for (const t of activeOutputs) {
      if (t.key !== "waste_other" && !outputs[t.key].productId) return setErr(`Choose which product "${t.label}" output goes to.`);
    }
    setSaving(true);
    const { data: batch, error } = await supabase.from("production_batches")
      .insert({ batch_date: date, paddy_product_id: paddyId, paddy_input_qty: qty })
      .select().single();
    if (error) { setSaving(false); return setErr(error.message); }

    const rows = activeOutputs.map((t) => ({
      batch_id: batch.id, product_id: outputs[t.key].productId || null, output_type: t.key, quantity: Number(outputs[t.key].qty),
    }));
    const { error: outErr } = await supabase.from("production_outputs").insert(rows);
    setSaving(false);
    if (outErr) return setErr(outErr.message);
    onSaved();
  };

  return (
    <Modal title="New production batch" onClose={onClose} width={520}>
      <form onSubmit={submit}>
        <Field label="Paddy type">
          <select value={paddyId} onChange={(e) => setPaddyId(e.target.value)} style={fieldInput}>
            {paddyProducts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}><Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={fieldInput} /></Field></div>
          <div style={{ flex: 1 }}><Field label="Paddy input (kg)"><input type="number" min="0" step="0.01" value={inputQty} onChange={(e) => setInputQty(e.target.value)} style={fieldInput} /></Field></div>
        </div>

        <div style={{ fontSize: 12.5, fontWeight: 600, margin: "6px 0 10px" }}>Outputs</div>
        {OUTPUT_TYPES.map((t) => (
          <div key={t.key} style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "flex-end" }}>
            <div style={{ width: 90, fontSize: 12.5, color: INK_MUTED, paddingBottom: 9 }}>{t.label}</div>
            {t.key !== "waste_other" && (
              <select value={outputs[t.key].productId} onChange={(e) => setOutput(t.key, "productId", e.target.value)} style={{ ...fieldInput, flex: 1 }}>
                <option value="">Select product…</option>
                {outputProducts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            <input type="number" min="0" step="0.01" value={outputs[t.key].qty} onChange={(e) => setOutput(t.key, "qty", e.target.value)} style={{ ...fieldInput, width: t.key === "waste_other" ? "100%" : 110 }} placeholder="kg" />
          </div>
        ))}

        <div style={{ display: "flex", justifyContent: "space-between", background: SURFACE, borderRadius: 8, padding: "10px 12px", marginBottom: 14, fontSize: 13 }}>
          <span style={{ color: INK_MUTED }}>Total output vs input</span>
          <span style={{ fontFamily: FONT_NUM }}>{num(totalOutput)} / {num(qty)} {qty > 0 ? `(${pct((totalOutput / qty) * 100)})` : ""}</span>
        </div>

        {err && <div style={{ color: RED, fontSize: 12.5, marginBottom: 12 }}>{err}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton type="submit" disabled={saving}>{saving ? "Saving…" : "Confirm batch"}</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

function BatchDetailModal({ batch, onClose }) {
  const [outputs, setOutputs] = useState([]);
  useEffect(() => {
    supabase.from("production_outputs").select("*, products(name,unit)").eq("batch_id", batch.id).then(({ data }) => setOutputs(data || []));
  }, [batch.id]);

  return (
    <Modal title="Batch details" onClose={onClose} width={440}>
      <div style={{ fontSize: 13, marginBottom: 16 }}>
        <Row label="Date" value={fmtDate(batch.batch_date)} />
        <Row label="Paddy type" value={batch.products?.name} />
        <Row label="Paddy input" value={num(batch.paddy_input_qty, batch.products?.unit)} />
        <Row label="Recovery" value={pct(batch.summary?.recovery_pct)} />
        <Row label="Broken %" value={pct(batch.summary?.broken_pct)} />
        <Row label="Total output %" value={pct(batch.summary?.total_output_pct)} />
        {batch.notes && <Row label="Notes" value={batch.notes} />}
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>Outputs</div>
      {outputs.map((o) => (
        <div key={o.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "5px 0", borderBottom: "1px solid #293240" }}>
          <span style={{ color: INK_MUTED }}>{o.products?.name || o.output_type}</span>
          <span style={{ fontFamily: FONT_NUM }}>{num(o.quantity, o.products?.unit)}</span>
        </div>
      ))}
    </Modal>
  );
}
