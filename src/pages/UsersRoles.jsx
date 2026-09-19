import React, { useState, useEffect, useCallback } from "react";
import { Plus, KeyRound } from "lucide-react";
import { supabase } from "../supabaseClient";
import { INK, INK_MUTED, SURFACE, BORDER, RED, GREEN, fieldInput } from "../shared";
import { TableShell, PageHeader, StatusPill, Modal, Field, PrimaryButton, GhostButton } from "../components";

const ROLES = ["owner", "manager", "accountant", "operator"];

// Calls the admin-users edge function, attaching the current session's
// access token so the function can check the caller's role server-side.
async function callAdminUsers(action, payload) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  const { data, error } = await supabase.functions.invoke("admin-users", {
    body: { action, ...payload },
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (error) {
    // Supabase JS wraps non-2xx responses in a generic error; the function's
    // own message is in the response body when available.
    const detail = error.context?.body ? await parseErrorBody(error.context.body) : null;
    throw new Error(detail?.error || error.message || "Request failed.");
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

async function parseErrorBody(body) {
  try {
    if (typeof body === "string") return JSON.parse(body);
    if (body?.text) return JSON.parse(await body.text());
  } catch {
    // ignore parse failures, fall back to the generic message
  }
  return null;
}

export default function UsersRolesPage({ currentRole }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const isOwner = currentRole === "owner";
  const canManage = currentRole === "owner" || currentRole === "manager";

  const [showAdd, setShowAdd] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      if (canManage) {
        const { users: list } = await callAdminUsers("list", {});
        setUsers(list || []);
      } else {
        // Non-managers just see their own row via the regular table (RLS-safe).
        const { data, error } = await supabase.from("profiles").select("*");
        if (error) throw error;
        setUsers(data || []);
      }
    } catch (e) {
      setErr(e.message || "Failed to load team.");
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => { load(); }, [load]);

  const updateRole = async (id, role) => {
    const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
    if (!error) load();
  };
  const toggleActive = async (id, is_active) => {
    const { error } = await supabase.from("profiles").update({ is_active: !is_active }).eq("id", id);
    if (!error) load();
  };

  return (
    <div style={{ padding: "20px 24px 40px" }}>
      <PageHeader
        title="Users & Roles"
        subtitle="Team members and their access level"
        right={canManage && (
          <PrimaryButton onClick={() => setShowAdd(true)}><Plus size={15} /> Add user</PrimaryButton>
        )}
      />

      {!isOwner && (
        <div style={{ fontSize: 12.5, color: INK_MUTED, marginBottom: 14, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 14px" }}>
          {canManage
            ? "As Manager you can add teammates and reset their passwords. Only the Owner can change roles or grant Owner access."
            : "Only the Owner and Manager can change permissions. You can view the team below."}
        </div>
      )}
      {err && <div style={{ color: RED, fontSize: 13, marginBottom: 14 }}>{err}</div>}

      <TableShell headers={["Name", "Email", "Role", "Status", ""]} loading={loading} empty={users.length === 0} colSpan={5}>
        {users.map((p) => (
          <tr key={p.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
            <td style={{ padding: "10px 14px", color: INK }}>{p.full_name}</td>
            <td style={{ padding: "10px 14px", color: INK_MUTED }}>{p.email || "—"}</td>
            <td style={{ padding: "10px 14px" }}>
              {isOwner ? (
                <select value={p.role} onChange={(e) => updateRole(p.id, e.target.value)} style={{ ...fieldInput, width: 150, padding: "6px 9px" }}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              ) : <span style={{ textTransform: "capitalize" }}>{p.role}</span>}
            </td>
            <td style={{ padding: "10px 14px" }}>
              {isOwner ? (
                <button onClick={() => toggleActive(p.id, p.is_active)} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
                  <StatusPill status={p.is_active ? "active" : "cancelled"} />
                </button>
              ) : <StatusPill status={p.is_active ? "active" : "cancelled"} />}
            </td>
            <td style={{ padding: "10px 14px" }}>
              {canManage && p.email && (isOwner || p.role !== "owner") && (
                <GhostButton onClick={() => setPasswordTarget(p)} title="Set password">
                  <KeyRound size={13} /> Password
                </GhostButton>
              )}
            </td>
          </tr>
        ))}
      </TableShell>

      {canManage ? (
        <div style={{ fontSize: 12, color: INK_MUTED, marginTop: 14 }}>
          Use "Add user" to create a login for a new team member, or "Password" next to their name to set or reset it.
        </div>
      ) : (
        <div style={{ fontSize: 12, color: INK_MUTED, marginTop: 14 }}>
          New team members are added by the Owner or Manager from this page.
        </div>
      )}

      {showAdd && (
        <AddUserModal currentRole={currentRole} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />
      )}
      {passwordTarget && (
        <SetPasswordModal user={passwordTarget} onClose={() => setPasswordTarget(null)} onSaved={() => setPasswordTarget(null)} />
      )}
    </div>
  );
}

function AddUserModal({ currentRole, onClose, onSaved }) {
  const assignableRoles = currentRole === "owner" ? ROLES : ROLES.filter((r) => r !== "owner");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(assignableRoles[0]);
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!fullName.trim()) return setErr("Enter their full name.");
    if (!email.trim()) return setErr("Enter their email.");
    if (password.length < 8) return setErr("Password must be at least 8 characters.");
    setSaving(true);
    try {
      await callAdminUsers("create_user", { full_name: fullName.trim(), email: email.trim(), role, password });
      onSaved();
    } catch (e2) {
      setErr(e2.message || "Failed to create user.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Add user" onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Full name"><input value={fullName} onChange={(e) => setFullName(e.target.value)} style={fieldInput} placeholder="e.g. Ahmed Raza" /></Field>
        <Field label="Email (used to sign in)"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={fieldInput} placeholder="name@example.com" /></Field>
        <Field label="Role">
          <select value={role} onChange={(e) => setRole(e.target.value)} style={fieldInput}>
            {assignableRoles.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Set their password">
          <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} style={fieldInput} placeholder="At least 8 characters" />
        </Field>
        <div style={{ fontSize: 11.5, color: INK_MUTED, marginBottom: 14, marginTop: -6 }}>
          Share this password with them directly — they can sign in right away and change it later from Settings.
        </div>
        {err && <div style={{ color: RED, fontSize: 12.5, marginBottom: 12 }}>{err}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton type="submit" disabled={saving}>{saving ? "Creating…" : "Create user"}</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

function SetPasswordModal({ user, onClose, onSaved }) {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (password.length < 8) return setErr("Password must be at least 8 characters.");
    setSaving(true);
    try {
      await callAdminUsers("set_password", { user_id: user.id, new_password: password });
      setDone(true);
    } catch (e2) {
      setErr(e2.message || "Failed to set password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Set password — ${user.full_name}`} onClose={() => { onClose(); onSaved(); }}>
      {done ? (
        <div>
          <div style={{ color: GREEN, fontSize: 13, marginBottom: 16 }}>Password updated. Share the new password with {user.full_name} directly.</div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <PrimaryButton onClick={() => { onClose(); onSaved(); }}>Done</PrimaryButton>
          </div>
        </div>
      ) : (
        <form onSubmit={submit}>
          <div style={{ fontSize: 12.5, color: INK_MUTED, marginBottom: 14 }}>{user.email}</div>
          <Field label="New password">
            <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} style={fieldInput} placeholder="At least 8 characters" />
          </Field>
          {err && <div style={{ color: RED, fontSize: 12.5, marginBottom: 12 }}>{err}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <GhostButton onClick={onClose}>Cancel</GhostButton>
            <PrimaryButton type="submit" disabled={saving}>{saving ? "Saving…" : "Set password"}</PrimaryButton>
          </div>
        </form>
      )}
    </Modal>
  );
}
