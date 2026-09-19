import React, { useState, useEffect, useMemo } from "react";
import { Printer, FileDown } from "lucide-react";
import { supabase } from "../supabaseClient";
import { INK_MUTED, SURFACE, BORDER, FONT_NUM, money, num, pct, fmtDate, daysAgoISO, todayISO, downloadCSV, fieldInput } from "../shared";
import { GhostButton, TableShell, FilterBar, PageHeader } from "../components";

const REPORTS = [
  { key: "daily", label: "Daily mill report" },
  { key: "purchases", label: "Purchase report" },
  { key: "sales", label: "Sales report" },
  { key: "production", label: "Production report" },
  { key: "inventory", label: "Inventory report" },
  { key: "expenses", label: "Expense report" },
  { key: "supplier_outstanding", label: "Supplier outstanding" },
  { key: "customer_outstanding", label: "Customer outstanding" },
  { key: "product_performance", label: "Product performance" },
];

export default function ReportsPage() {
  const [reportKey, setReportKey] = useState("daily");
  const [dateFrom, setDateFrom] = useState(daysAgoISO(29));
  const [dateTo, setDateTo] = useState(todayISO());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchReport(reportKey, dateFrom, dateTo).then((r) => { if (!cancelled) { setRows(r); setLoading(false); } });
    return () => { cancelled = true; };
  }, [reportKey, dateFrom, dateTo]);

  const columns = REPORT_COLUMNS[reportKey];
  const needsDateRange = !["inventory", "supplier_outstanding", "customer_outstanding"].includes(reportKey);

  const total = useMemo(() => {
    const numericCol = columns.find((c) => c.numeric && c.total);
    if (!numericCol) return null;
    return rows.reduce((a, r) => a + Number(numericCol.get(r) || 0), 0);
  }, [rows, columns]);

  const exportCsv = () => downloadCSV(`${reportKey}.csv`, rows, columns.map((c) => ({ label: c.label, get: c.get })));
  const printReport = () => window.print();

  return (
    <div style={{ padding: "20px 24px 40px" }}>
      <PageHeader title="Reports" subtitle="Management reporting center" right={<>
        <GhostButton onClick={printReport}><Printer size={14} /> Print</GhostButton>
        <GhostButton onClick={exportCsv}><FileDown size={14} /> Export</GhostButton>
      </>} />

      <FilterBar>
        <select value={reportKey} onChange={(e) => setReportKey(e.target.value)} style={{ ...fieldInput, width: 220 }}>
          {REPORTS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
        {needsDateRange && (
          <>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ ...fieldInput, width: 145 }} />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ ...fieldInput, width: 145 }} />
          </>
        )}
      </FilterBar>

      <TableShell headers={columns.map((c) => c.label)} loading={loading} empty={rows.length === 0} colSpan={columns.length}>
        {rows.map((r, i) => (
          <tr key={i} style={{ borderBottom: `1px solid ${BORDER}` }}>
            {columns.map((c) => (
              <td key={c.label} style={{ padding: "10px 14px", fontFamily: c.numeric ? FONT_NUM : undefined }}>{c.render ? c.render(r) : c.get(r)}</td>
            ))}
          </tr>
        ))}
      </TableShell>
      {total !== null && (
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderTop: "none", borderRadius: "0 0 10px 10px", padding: "10px 14px", display: "flex", justifyContent: "flex-end", fontSize: 13 }}>
          <span style={{ color: INK_MUTED, marginRight: 8 }}>Total</span><span style={{ fontFamily: FONT_NUM }}>{money(total)}</span>
        </div>
      )}
    </div>
  );
}

const REPORT_COLUMNS = {
  daily: [
    { label: "Date", get: (r) => fmtDate(r.day) },
    { label: "Sales", get: (r) => r.sales_total, numeric: true, total: true, render: (r) => money(r.sales_total) },
    { label: "Purchases", get: (r) => r.purchases_total, numeric: true, render: (r) => money(r.purchases_total) },
    { label: "Expenses", get: (r) => r.expenses_total, numeric: true, render: (r) => money(r.expenses_total) },
    { label: "Paddy processed", get: (r) => r.paddy_processed, numeric: true, render: (r) => num(r.paddy_processed, "kg") },
  ],
  purchases: [
    { label: "Date", get: (r) => fmtDate(r.purchase_date) },
    { label: "Supplier", get: (r) => r.suppliers?.name },
    { label: "Product", get: (r) => r.products?.name },
    { label: "Qty", get: (r) => r.quantity, numeric: true, render: (r) => num(r.quantity, r.unit) },
    { label: "Total", get: (r) => r.total_amount, numeric: true, total: true, render: (r) => money(r.total_amount) },
    { label: "Status", get: (r) => r.payment_status },
  ],
  sales: [
    { label: "Date", get: (r) => fmtDate(r.sale_date) },
    { label: "Customer", get: (r) => r.customers?.name },
    { label: "Product", get: (r) => r.products?.name },
    { label: "Qty", get: (r) => r.quantity, numeric: true, render: (r) => num(r.quantity, r.unit) },
    { label: "Total", get: (r) => r.total_amount, numeric: true, total: true, render: (r) => money(r.total_amount) },
    { label: "Status", get: (r) => r.payment_status },
  ],
  production: [
    { label: "Date", get: (r) => fmtDate(r.batch_date) },
    { label: "Paddy input", get: (r) => r.paddy_input_qty, numeric: true, render: (r) => num(r.paddy_input_qty, "kg") },
    { label: "Rice output", get: (r) => r.rice_output, numeric: true, render: (r) => num(r.rice_output, "kg") },
    { label: "Recovery %", get: (r) => r.recovery_pct, numeric: true, render: (r) => pct(r.recovery_pct) },
    { label: "Broken %", get: (r) => r.broken_pct, numeric: true, render: (r) => pct(r.broken_pct) },
  ],
  inventory: [
    { label: "Product", get: (r) => r.name },
    { label: "Category", get: (r) => r.category },
    { label: "Current stock", get: (r) => r.current_stock, numeric: true, render: (r) => num(r.current_stock, r.unit) },
    { label: "Low-stock threshold", get: (r) => r.low_stock_threshold, numeric: true, render: (r) => num(r.low_stock_threshold, r.unit) },
  ],
  expenses: [
    { label: "Date", get: (r) => fmtDate(r.expense_date) },
    { label: "Category", get: (r) => r.category },
    { label: "Description", get: (r) => r.description },
    { label: "Amount", get: (r) => r.amount, numeric: true, total: true, render: (r) => money(r.amount) },
  ],
  supplier_outstanding: [
    { label: "Supplier", get: (r) => r.name },
    { label: "Total purchased", get: (r) => r.total_purchased, numeric: true, render: (r) => money(r.total_purchased) },
    { label: "Total paid", get: (r) => r.total_paid, numeric: true, render: (r) => money(r.total_paid) },
    { label: "Outstanding", get: (r) => r.outstanding, numeric: true, total: true, render: (r) => money(r.outstanding) },
  ],
  customer_outstanding: [
    { label: "Customer", get: (r) => r.name },
    { label: "Total sales", get: (r) => r.total_sales, numeric: true, render: (r) => money(r.total_sales) },
    { label: "Total received", get: (r) => r.total_received, numeric: true, render: (r) => money(r.total_received) },
    { label: "Outstanding", get: (r) => r.outstanding, numeric: true, total: true, render: (r) => money(r.outstanding) },
  ],
  product_performance: [
    { label: "Product", get: (r) => r.name },
    { label: "Quantity sold", get: (r) => r.qty, numeric: true, render: (r) => num(r.qty) },
    { label: "Revenue", get: (r) => r.revenue, numeric: true, total: true, render: (r) => money(r.revenue) },
  ],
};

async function fetchReport(key, from, to) {
  switch (key) {
    case "daily": {
      const { data } = await supabase.from("v_daily_summary").select("*").gte("day", from).lte("day", to).order("day");
      return data || [];
    }
    case "purchases": {
      const { data } = await supabase.from("purchases").select("*, suppliers(name), products(name)").eq("status", "active").gte("purchase_date", from).lte("purchase_date", to).order("purchase_date", { ascending: false });
      return data || [];
    }
    case "sales": {
      const { data } = await supabase.from("sales").select("*, customers(name), products(name)").eq("status", "active").gte("sale_date", from).lte("sale_date", to).order("sale_date", { ascending: false });
      return data || [];
    }
    case "production": {
      const { data } = await supabase.from("v_production_summary").select("*").gte("batch_date", from).lte("batch_date", to).order("batch_date", { ascending: false });
      return data || [];
    }
    case "inventory": {
      const { data } = await supabase.from("v_current_stock").select("*").order("category").order("name");
      return data || [];
    }
    case "expenses": {
      const { data } = await supabase.from("expenses").select("*").eq("status", "active").gte("expense_date", from).lte("expense_date", to).order("expense_date", { ascending: false });
      return data || [];
    }
    case "supplier_outstanding": {
      const { data } = await supabase.from("v_supplier_outstanding").select("*").order("outstanding", { ascending: false });
      return data || [];
    }
    case "customer_outstanding": {
      const { data } = await supabase.from("v_customer_outstanding").select("*").order("outstanding", { ascending: false });
      return data || [];
    }
    case "product_performance": {
      const { data } = await supabase.from("sales").select("quantity, total_amount, products(name)").eq("status", "active").gte("sale_date", from).lte("sale_date", to);
      const map = {};
      (data || []).forEach((s) => {
        const name = s.products?.name || "Unknown";
        if (!map[name]) map[name] = { name, qty: 0, revenue: 0 };
        map[name].qty += Number(s.quantity);
        map[name].revenue += Number(s.total_amount);
      });
      return Object.values(map).sort((a, b) => b.revenue - a.revenue);
    }
    default:
      return [];
  }
}
