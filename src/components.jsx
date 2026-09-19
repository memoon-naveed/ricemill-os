import React from "react";
import { X, ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight, AlertTriangle } from "lucide-react";
import {
  INK, INK_MUTED, BG, SURFACE, SURFACE_RAISED, BORDER, GREEN, AMBER, RED,
  FONT_HEAD, FONT_BODY, FONT_NUM, fieldInput, fieldLabel, pagerBtn,
} from "./shared";

export function Modal({ title, onClose, children, width = 480 }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 60,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 22,
        width: "100%", maxWidth: width, fontFamily: FONT_BODY, color: INK,
        maxHeight: "88vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontFamily: FONT_HEAD, fontSize: 15, fontWeight: 600 }}>{title}</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: INK_MUTED, cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children }) {
  return <div style={{ marginBottom: 14 }}><label style={fieldLabel}>{label}</label>{children}</div>;
}

const BLUE_FALLBACK = "#5B8DB8";

export function StatusPill({ status }) {
  const map = {
    paid: { c: GREEN, l: "Paid" },
    partial: { c: AMBER, l: "Partial" },
    unpaid: { c: RED, l: "Unpaid" },
    active: { c: GREEN, l: "Active" },
    cancelled: { c: INK_MUTED, l: "Cancelled" },
    pending: { c: AMBER, l: "Pending" },
    dispatched: { c: BLUE_FALLBACK, l: "Dispatched" },
    delivered: { c: GREEN, l: "Delivered" },
  };
  const m = map[status] || { c: INK_MUTED, l: status };
  return (
    <span style={{
      fontSize: 10.5, padding: "2px 8px", borderRadius: 20, color: m.c,
      border: `1px solid ${m.c}55`, background: `${m.c}18`, whiteSpace: "nowrap",
    }}>{m.l}</span>
  );
}

export function PrimaryButton({ children, onClick, type = "button", disabled }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      display: "flex", alignItems: "center", gap: 6, background: GREEN, color: "#FFFFFF",
      border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 600,
      cursor: disabled ? "default" : "pointer", fontFamily: FONT_BODY, opacity: disabled ? 0.6 : 1,
    }}>{children}</button>
  );
}

export function GhostButton({ children, onClick, title, danger }) {
  return (
    <button type="button" onClick={onClick} title={title} style={{
      display: "flex", alignItems: "center", gap: 6, background: SURFACE_RAISED,
      border: `1px solid ${danger ? RED + "55" : BORDER}`, borderRadius: 8, padding: "7px 11px",
      fontSize: 12.5, cursor: "pointer", color: danger ? RED : INK, fontFamily: FONT_BODY,
    }}>{children}</button>
  );
}

export function KpiCard({ label, value, sub, tone }) {
  const toneColor = tone === "up" ? GREEN : tone === "down" ? RED : tone === "warn" ? AMBER : INK_MUTED;
  return (
    <div style={{
      background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "14px 16px", minWidth: 0,
    }}>
      <div style={{ fontSize: 11.5, color: INK_MUTED, marginBottom: 8, fontFamily: FONT_BODY }}>{label}</div>
      <div style={{ fontFamily: FONT_NUM, fontSize: 21, fontWeight: 500, color: INK, lineHeight: 1.1 }}>{value}</div>
      {sub && (
        <div style={{ fontSize: 11.5, marginTop: 6, color: toneColor, display: "flex", alignItems: "center", gap: 4 }}>
          {tone === "up" && <ArrowUpRight size={12} />}
          {tone === "down" && <ArrowDownRight size={12} />}
          {tone === "warn" && <AlertTriangle size={12} />}
          {sub}
        </div>
      )}
    </div>
  );
}

export function SectionCard({ title, children, right }) {
  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: INK, fontFamily: FONT_BODY }}>{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

export function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
      <span style={{ color: INK_MUTED }}>{label}</span>
      <span style={{ textAlign: "right" }}>{value}</span>
    </div>
  );
}

export function Pager({ page, setPage, totalPages, count, pageSize }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px",
      borderTop: `1px solid ${BORDER}`, fontSize: 12, color: INK_MUTED,
    }}>
      <span>{count === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, count)} of {count}</span>
      <div style={{ display: "flex", gap: 6 }}>
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={pagerBtn(page <= 1)}><ChevronLeft size={14} /></button>
        <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} style={pagerBtn(page >= totalPages)}><ChevronRight size={14} /></button>
      </div>
    </div>
  );
}

export function TableShell({ headers, children, loading, empty, colSpan }) {
  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
              {headers.map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "10px 14px", color: INK_MUTED, fontWeight: 500, fontSize: 11.5, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={colSpan} style={{ padding: 20, color: INK_MUTED }}>Loading…</td></tr>
            ) : empty ? (
              <tr><td colSpan={colSpan} style={{ padding: 20, color: INK_MUTED }}>Nothing to show yet.</td></tr>
            ) : children}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function FilterBar({ children }) {
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14, background: SURFACE,
      border: `1px solid ${BORDER}`, borderRadius: 10, padding: 12,
    }}>{children}</div>
  );
}

export function PageHeader({ title, subtitle, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
      <div>
        <div style={{ fontFamily: FONT_HEAD, fontSize: 20, fontWeight: 600, color: INK }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12.5, color: INK_MUTED, marginTop: 2 }}>{subtitle}</div>}
      </div>
      {right && <div style={{ display: "flex", gap: 8 }}>{right}</div>}
    </div>
  );
}
