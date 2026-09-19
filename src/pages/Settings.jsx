import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import { INK_MUTED, SURFACE, BORDER, RED, GREEN, fieldInput } from "../shared";
import { Field, PrimaryButton, SectionCard, PageHeader } from "../components";

export default function SettingsPage({ profile, sessionEmail, onProfileUpdated }) {
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const save = async (e) => {
    e.preventDefault();
    setErr(""); setMsg("");
    if (!fullName.trim()) return setErr("Name cannot be empty.");
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: fullName.trim() }).eq("id", profile.id);
    setSaving(false);
    if (error) return setErr(error.message);
    setMsg("Saved.");
    onProfileUpdated?.();
  };

  return (
    <div style={{ padding: "20px 24px 40px" }}>
      <PageHeader title="Settings" subtitle="Your profile and mill information" />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <SectionCard title="Your profile">
          <form onSubmit={save}>
            <Field label="Full name"><input value={fullName} onChange={(e) => setFullName(e.target.value)} style={fieldInput} /></Field>
            <Field label="Email"><input value={sessionEmail} disabled style={{ ...fieldInput, opacity: 0.6 }} /></Field>
            <Field label="Role"><input value={profile?.role || ""} disabled style={{ ...fieldInput, opacity: 0.6, textTransform: "capitalize" }} /></Field>
            {err && <div style={{ color: RED, fontSize: 12.5, marginBottom: 10 }}>{err}</div>}
            {msg && <div style={{ color: GREEN, fontSize: 12.5, marginBottom: 10 }}>{msg}</div>}
            <PrimaryButton type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</PrimaryButton>
          </form>
        </SectionCard>

        <ChangePasswordCard sessionEmail={sessionEmail} />

        <div style={{ gridColumn: "1 / span 2" }}>
          <SectionCard title="Mill information">
            <div style={{ fontSize: 13, color: INK_MUTED, lineHeight: 1.9 }}>
              <div>Currency: <span style={{ color: "#F2EEE4" }}>PKR</span></div>
              <div>Units: <span style={{ color: "#F2EEE4" }}>Kilograms / tons</span></div>
              <div style={{ marginTop: 10, fontSize: 12, color: INK_MUTED }}>
                This installation includes clearly-marked demo data (suppliers, customers, and
                transactions) so the dashboard has something to show. Ask your developer to remove
                rows flagged <code>is_demo = true</code> before going live.
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function ChangePasswordCard({ sessionEmail }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setMsg("");
    if (!current) return setErr("Enter your current password.");
    if (next.length < 8) return setErr("New password must be at least 8 characters.");
    if (next !== confirm) return setErr("New passwords don't match.");
    setSaving(true);
    try {
      // Re-check the current password before changing it, so someone who
      // finds this screen unlocked can't silently take over the account.
      const { error: reauthErr } = await supabase.auth.signInWithPassword({ email: sessionEmail, password: current });
      if (reauthErr) throw new Error("Current password is incorrect.");

      const { error: updateErr } = await supabase.auth.updateUser({ password: next });
      if (updateErr) throw updateErr;

      setMsg("Password updated.");
      setCurrent(""); setNext(""); setConfirm("");
    } catch (e2) {
      setErr(e2.message || "Failed to update password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard title="Change password">
      <form onSubmit={submit}>
        <Field label="Current password"><input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} style={fieldInput} /></Field>
        <Field label="New password"><input type="password" value={next} onChange={(e) => setNext(e.target.value)} style={fieldInput} placeholder="At least 8 characters" /></Field>
        <Field label="Confirm new password"><input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={fieldInput} /></Field>
        {err && <div style={{ color: RED, fontSize: 12.5, marginBottom: 10 }}>{err}</div>}
        {msg && <div style={{ color: GREEN, fontSize: 12.5, marginBottom: 10 }}>{msg}</div>}
        <PrimaryButton type="submit" disabled={saving}>{saving ? "Updating…" : "Update password"}</PrimaryButton>
      </form>
    </SectionCard>
  );
}
