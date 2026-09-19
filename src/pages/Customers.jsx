import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Search as SearchIcon, FileDown, Eye } from "lucide-react";
import { supabase } from "../supabaseClient";
import { INK, INK_MUTED, SURFACE, BORDER, RED, FONT_NUM, money, num, fmtDate, downloadCSV, fieldInput, PAGE_SIZE } from "../shared";
import { Modal, Field, PrimaryButton, GhostButton, KpiCard, Row, Pager, TableShell, FilterBar, PageHeader } from "../components";

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [outstanding, setOutstanding] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [profileFor, setProfileFor] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [custR, outR] = await Promise.all([
      supabase.from("customers").select("*").eq("status", "active").order("name"),
      supabase.from("v_customer_outstanding").select("*"),
    ]);
    setCustomers(custR.data || []);
    const map = {};
    (outR.data || []).forEach((o) => { map[o.customer_id] = o; });
    setOutstanding(map);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => customers.filter((c) => {
    if (!search) return true;
    return `${c.name} ${c.phone || ""}`.toLowerCase().includes(search.toLowerCase());
  }), [customers, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportCsv = () => downloadCSV("customers.csv", filtered, [
    { label: "Name", get: (r) => r.name }, { label: "Phone", get: (r) => r.phone },
    { label: "Total sales", get: (r) => outstanding[r.id]?.total_sales || 0 },
    { label: "Total received", get: (r) => outstanding[r.id]?.total_received || 0 },
    { label: "Outstanding", get: (r) => outstanding[r.id]?.outstanding || 0 },
  ]);

  return (
    <div style={{ padding: "20px 24px 40px" }}>
      <PageHeader title="Customers" subtitle="Buyers and their outstanding balances" right={<>
        <GhostButton onClick={exportCsv}><FileDown size={14} /> Export</GhostButton>
        <PrimaryButton onClick={() => setShowAdd(true)}><Plus size={15} /> Add customer</PrimaryButton>
      </>} />

      <FilterBar>
        <div style={{ position: "relative", flex: "1 1 240px" }}>
          <SearchIcon size={14} color={INK_MUTED} style={{ position: "absolute", left: 10, top: 10 }} />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name or phone…" style={{ ...fieldInput, paddingLeft: 30 }} />
        </div>
      </FilterBar>

      <TableShell headers={["Name", "Phone", "Total sales", "Outstanding", ""]} loading={loading} empty={pageRows.length === 0} colSpan={5}>
        {pageRows.map((c) => {
          const o = outstanding[c.id];
          return (
            <tr key={c.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
              <td style={{ padding: "10px 14px", color: INK }}>{c.name}</td>
              <td style={{ padding: "10px 14px" }}>{c.phone || "—"}</td>
              <td style={{ padding: "10px 14px", fontFamily: FONT_NUM }}>{money(o?.total_sales)}</td>
              <td style={{ padding: "10px 14px", fontFamily: FONT_NUM, color: Number(o?.outstanding) > 0 ? "#D2A24C" : undefined }}>{money(o?.outstanding)}</td>
              <td style={{ padding: "10px 14px" }}>
                <button onClick={() => setProfileFor(c)} title="View profile" style={{ background: "transparent", border: "none", color: INK_MUTED, cursor: "pointer", display: "flex" }}><Eye size={15} /></button>
              </td>
            </tr>
          );
        })}
      </TableShell>
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderTop: "none", borderRadius: "0 0 10px 10px" }}>
        <Pager page={page} setPage={setPage} totalPages={totalPages} count={filtered.length} pageSize={PAGE_SIZE} />
      </div>

      {showAdd && <CustomerFormModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
      {profileFor && <CustomerProfileModal customer={profileFor} outstanding={outstanding[profileFor.id]} onClose={() => setProfileFor(null)} onEdit={() => { setEditing(profileFor); setProfileFor(null); }} />}
      {editing && <CustomerFormModal initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function CustomerFormModal({ initial, onClose, onSaved }) {
  const [name, setName] = useState(initial?.name || "");
  const [phone, setPhone] = useState(initial?.phone || "");
  const [address, setAddress] = useState(initial?.address || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!name.trim()) return setErr("Name is required.");
    setSaving(true);
    const payload = { name: name.trim(), phone: phone || null, address: address || null, notes: notes || null };
    const { error } = initial ? await supabase.from("customers").update(payload).eq("id", initial.id) : await supabase.from("customers").insert(payload);
    setSaving(false);
    if (error) return setErr(error.message);
    onSaved();
  };

  return (
    <Modal title={initial ? "Edit customer" : "Add customer"} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} style={fieldInput} /></Field>
        <Field label="Phone"><input value={phone} onChange={(e) => setPhone(e.target.value)} style={fieldInput} /></Field>
        <Field label="Address"><input value={address} onChange={(e) => setAddress(e.target.value)} style={fieldInput} /></Field>
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

function CustomerProfileModal({ customer, outstanding, onClose, onEdit }) {
  const [sales, setSales] = useState([]);
  useEffect(() => {
    supabase.from("sales").select("*, products(name)").eq("customer_id", customer.id).order("sale_date", { ascending: false }).limit(10)
      .then(({ data }) => setSales(data || []));
  }, [customer.id]);

  return (
    <Modal title={customer.name} onClose={onClose} width={480}>
      <div style={{ fontSize: 13, marginBottom: 16 }}>
        <Row label="Phone" value={customer.phone || "—"} />
        <Row label="Address" value={customer.address || "—"} />
        {customer.notes && <Row label="Notes" value={customer.notes} />}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
        <KpiCard label="Total sales" value={money(outstanding?.total_sales)} />
        <KpiCard label="Received" value={money(outstanding?.total_received)} />
        <KpiCard label="Outstanding" value={money(outstanding?.outstanding)} tone={Number(outstanding?.outstanding) > 0 ? "warn" : undefined} />
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>Recent sales</div>
      {sales.length === 0 ? <div style={{ fontSize: 12.5, color: INK_MUTED, marginBottom: 14 }}>No sales yet.</div> : (
        <div style={{ marginBottom: 16 }}>
          {sales.map((s) => (
            <div key={s.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "5px 0", borderBottom: "1px solid #293240" }}>
              <span style={{ color: INK_MUTED }}>{fmtDate(s.sale_date)} · {s.products?.name} · {num(s.quantity, s.unit)}</span>
              <span style={{ fontFamily: FONT_NUM }}>{money(s.total_amount)}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <GhostButton onClick={onEdit}>Edit customer</GhostButton>
      </div>
    </Modal>
  );
}
