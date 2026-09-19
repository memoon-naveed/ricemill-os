import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Search as SearchIcon, FileDown, Eye } from "lucide-react";
import { supabase } from "../supabaseClient";
import { INK, INK_MUTED, SURFACE, BORDER, RED, FONT_NUM, money, num, fmtDate, downloadCSV, fieldInput, PAGE_SIZE } from "../shared";
import { Modal, Field, PrimaryButton, GhostButton, KpiCard, Row, Pager, TableShell, FilterBar, PageHeader } from "../components";

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [outstanding, setOutstanding] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [profileFor, setProfileFor] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [supR, outR] = await Promise.all([
      supabase.from("suppliers").select("*").eq("status", "active").order("name"),
      supabase.from("v_supplier_outstanding").select("*"),
    ]);
    setSuppliers(supR.data || []);
    const map = {};
    (outR.data || []).forEach((o) => { map[o.supplier_id] = o; });
    setOutstanding(map);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => suppliers.filter((s) => {
    if (!search) return true;
    const hay = `${s.name} ${s.phone || ""} ${s.paddy_type || ""}`.toLowerCase();
    return hay.includes(search.toLowerCase());
  }), [suppliers, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportCsv = () => downloadCSV("suppliers.csv", filtered, [
    { label: "Name", get: (r) => r.name }, { label: "Phone", get: (r) => r.phone },
    { label: "Paddy type", get: (r) => r.paddy_type },
    { label: "Total purchased", get: (r) => outstanding[r.id]?.total_purchased || 0 },
    { label: "Total paid", get: (r) => outstanding[r.id]?.total_paid || 0 },
    { label: "Outstanding", get: (r) => outstanding[r.id]?.outstanding || 0 },
  ]);

  return (
    <div style={{ padding: "20px 24px 40px" }}>
      <PageHeader title="Suppliers" subtitle="Paddy suppliers and their balances" right={<>
        <GhostButton onClick={exportCsv}><FileDown size={14} /> Export</GhostButton>
        <PrimaryButton onClick={() => setShowAdd(true)}><Plus size={15} /> Add supplier</PrimaryButton>
      </>} />

      <FilterBar>
        <div style={{ position: "relative", flex: "1 1 240px" }}>
          <SearchIcon size={14} color={INK_MUTED} style={{ position: "absolute", left: 10, top: 10 }} />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name, phone, paddy type…" style={{ ...fieldInput, paddingLeft: 30 }} />
        </div>
      </FilterBar>

      <TableShell headers={["Name", "Phone", "Paddy type", "Total purchased", "Outstanding", ""]} loading={loading} empty={pageRows.length === 0} colSpan={6}>
        {pageRows.map((s) => {
          const o = outstanding[s.id];
          return (
            <tr key={s.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
              <td style={{ padding: "10px 14px", color: INK }}>{s.name}</td>
              <td style={{ padding: "10px 14px" }}>{s.phone || "—"}</td>
              <td style={{ padding: "10px 14px" }}>{s.paddy_type || "—"}</td>
              <td style={{ padding: "10px 14px", fontFamily: FONT_NUM }}>{money(o?.total_purchased)}</td>
              <td style={{ padding: "10px 14px", fontFamily: FONT_NUM, color: Number(o?.outstanding) > 0 ? "#D2A24C" : undefined }}>{money(o?.outstanding)}</td>
              <td style={{ padding: "10px 14px" }}>
                <button onClick={() => setProfileFor(s)} title="View profile" style={{ background: "transparent", border: "none", color: INK_MUTED, cursor: "pointer", display: "flex" }}><Eye size={15} /></button>
              </td>
            </tr>
          );
        })}
      </TableShell>
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderTop: "none", borderRadius: "0 0 10px 10px" }}>
        <Pager page={page} setPage={setPage} totalPages={totalPages} count={filtered.length} pageSize={PAGE_SIZE} />
      </div>

      {showAdd && <SupplierFormModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
      {profileFor && <SupplierProfileModal supplier={profileFor} outstanding={outstanding[profileFor.id]} onClose={() => setProfileFor(null)} onEdit={() => { setEditing(profileFor); setProfileFor(null); }} />}
      {editing && <SupplierFormModal initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function SupplierFormModal({ initial, onClose, onSaved }) {
  const [name, setName] = useState(initial?.name || "");
  const [phone, setPhone] = useState(initial?.phone || "");
  const [address, setAddress] = useState(initial?.address || "");
  const [referenceId, setReferenceId] = useState(initial?.reference_id || "");
  const [paddyType, setPaddyType] = useState(initial?.paddy_type || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!name.trim()) return setErr("Name is required.");
    setSaving(true);
    const payload = { name: name.trim(), phone: phone || null, address: address || null, reference_id: referenceId || null, paddy_type: paddyType || null, notes: notes || null };
    const { error } = initial ? await supabase.from("suppliers").update(payload).eq("id", initial.id) : await supabase.from("suppliers").insert(payload);
    setSaving(false);
    if (error) return setErr(error.message);
    onSaved();
  };

  return (
    <Modal title={initial ? "Edit supplier" : "Add supplier"} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} style={fieldInput} /></Field>
        <Field label="Phone"><input value={phone} onChange={(e) => setPhone(e.target.value)} style={fieldInput} /></Field>
        <Field label="Address"><input value={address} onChange={(e) => setAddress(e.target.value)} style={fieldInput} /></Field>
        <Field label="Reference (CNIC, etc.)"><input value={referenceId} onChange={(e) => setReferenceId(e.target.value)} style={fieldInput} /></Field>
        <Field label="Paddy type"><input value={paddyType} onChange={(e) => setPaddyType(e.target.value)} style={fieldInput} placeholder="e.g. IRRI, Basmati" /></Field>
        <Field label="Notes"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ ...fieldInput, resize: "vertical" }} /></Field>
        {err && <div style={{ color: RED, fontSize: 12.5, marginBottom: 12 }}>{err}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

function SupplierProfileModal({ supplier, outstanding, onClose, onEdit }) {
  const [purchases, setPurchases] = useState([]);
  useEffect(() => {
    supabase.from("purchases").select("*, products(name)").eq("supplier_id", supplier.id).order("purchase_date", { ascending: false }).limit(10)
      .then(({ data }) => setPurchases(data || []));
  }, [supplier.id]);

  return (
    <Modal title={supplier.name} onClose={onClose} width={480}>
      <div style={{ fontSize: 13, marginBottom: 16 }}>
        <Row label="Phone" value={supplier.phone || "—"} />
        <Row label="Address" value={supplier.address || "—"} />
        <Row label="Paddy type" value={supplier.paddy_type || "—"} />
        {supplier.notes && <Row label="Notes" value={supplier.notes} />}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
        <KpiCard label="Total purchased" value={money(outstanding?.total_purchased)} />
        <KpiCard label="Total paid" value={money(outstanding?.total_paid)} />
        <KpiCard label="Outstanding" value={money(outstanding?.outstanding)} tone={Number(outstanding?.outstanding) > 0 ? "warn" : undefined} />
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>Recent purchases</div>
      {purchases.length === 0 ? <div style={{ fontSize: 12.5, color: INK_MUTED, marginBottom: 14 }}>No purchases yet.</div> : (
        <div style={{ marginBottom: 16 }}>
          {purchases.map((p) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "5px 0", borderBottom: "1px solid #293240" }}>
              <span style={{ color: INK_MUTED }}>{fmtDate(p.purchase_date)} · {p.products?.name} · {num(p.quantity, p.unit)}</span>
              <span style={{ fontFamily: FONT_NUM }}>{money(p.total_amount)}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <GhostButton onClick={onEdit}>Edit supplier</GhostButton>
      </div>
    </Modal>
  );
}
