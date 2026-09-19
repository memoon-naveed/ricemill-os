export const INK = "#F2EEE4";
export const INK_MUTED = "#C4CBD3";
export const BG = "#10151B";
export const SURFACE = "#161D25";
export const SURFACE_RAISED = "#1D2530";
export const BORDER = "#293240";
export const GREEN = "#4FA875";
export const GREEN_DIM = "#2E5F45";
export const AMBER = "#D2A24C";
export const RED = "#C5564C";
export const BLUE = "#5B8DB8";

export const FONT_HEAD = "'Space Grotesk', sans-serif";
export const FONT_BODY = "'IBM Plex Sans', sans-serif";
export const FONT_NUM = "'IBM Plex Mono', monospace";

export const PAGE_SIZE = 8;

export function money(n) {
  const v = Number(n || 0);
  return "PKR " + v.toLocaleString("en-PK", { maximumFractionDigits: 0 });
}
export function num(n, unit) {
  const v = Number(n || 0);
  return v.toLocaleString("en-PK", { maximumFractionDigits: 0 }) + (unit ? " " + unit : "");
}
export function pct(n) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return Number(n).toFixed(1) + "%";
}
export function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}
export function fmtDateTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
export function todayISO() { return new Date().toISOString().slice(0, 10); }
export function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function downloadCSV(filename, rows, columns) {
  const escape = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => escape(c.label)).join(",");
  const body = rows.map((r) => columns.map((c) => escape(c.get(r))).join(",")).join("\n");
  const csv = header + "\n" + body;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const fieldLabel = { fontSize: 12, color: INK_MUTED, display: "block", marginBottom: 6 };
export const fieldInput = {
  width: "100%", boxSizing: "border-box", background: BG, border: `1px solid ${BORDER}`,
  borderRadius: 8, padding: "9px 11px", color: INK, fontSize: 13, fontFamily: FONT_BODY, outline: "none",
};

export function pagerBtn(disabled) {
  return {
    background: SURFACE_RAISED, border: `1px solid ${BORDER}`, borderRadius: 6, width: 26, height: 26,
    display: "flex", alignItems: "center", justifyContent: "center", cursor: disabled ? "default" : "pointer",
    color: disabled ? INK_MUTED + "66" : INK_MUTED,
  };
}
