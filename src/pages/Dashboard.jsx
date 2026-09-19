import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { AlertTriangle } from "lucide-react";
import { supabase } from "../supabaseClient";
import {
  INK, INK_MUTED, SURFACE, SURFACE_RAISED, BORDER, GREEN, AMBER, RED, BLUE,
  FONT_HEAD, FONT_BODY, FONT_NUM, money, num, pct, fmtDate, todayISO, daysAgoISO,
} from "../shared";
import { KpiCard, SectionCard } from "../components";

const RANGE_OPTIONS = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
];

export default function Dashboard() {
  const [range, setRange] = useState("7d");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [stock, setStock] = useState([]);
  const [daily, setDaily] = useState([]);
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [production, setProduction] = useState([]);
  const [supplierOut, setSupplierOut] = useState([]);
  const [customerOut, setCustomerOut] = useState([]);

  const rangeStart = range === "today" ? todayISO() : range === "7d" ? daysAgoISO(6) : daysAgoISO(29);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const [stockR, dailyR, salesR, purchR, expR, prodR, supOutR, custOutR] = await Promise.all([
        supabase.from("v_current_stock").select("*"),
        supabase.from("v_daily_summary").select("*").gte("day", rangeStart).order("day", { ascending: true }),
        supabase.from("sales").select("*, customers(name), products(name)").eq("status", "active").gte("sale_date", rangeStart).order("created_at", { ascending: false }),
        supabase.from("purchases").select("*, suppliers(name), products(name)").eq("status", "active").gte("purchase_date", rangeStart).order("created_at", { ascending: false }),
        supabase.from("expenses").select("*").eq("status", "active").gte("expense_date", rangeStart).order("created_at", { ascending: false }),
        supabase.from("v_production_summary").select("*").gte("batch_date", rangeStart),
        supabase.from("v_supplier_outstanding").select("*"),
        supabase.from("v_customer_outstanding").select("*"),
      ]);
      const firstError = [stockR, dailyR, salesR, purchR, expR, prodR, supOutR, custOutR].find(r => r.error);
      if (firstError) throw firstError.error;
      setStock(stockR.data || []); setDaily(dailyR.data || []); setSales(salesR.data || []);
      setPurchases(purchR.data || []); setExpenses(expR.data || []); setProduction(prodR.data || []);
      setSupplierOut(supOutR.data || []); setCustomerOut(custOutR.data || []);
    } catch (e) {
      setErr(e.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, [rangeStart]);

  useEffect(() => { load(); }, [load]);

  const kpis = useMemo(() => {
    const today = todayISO();
    const todaySales = sales.filter(s => s.sale_date === today).reduce((a, s) => a + Number(s.total_amount), 0);
    const todayPurch = purchases.filter(p => p.purchase_date === today).reduce((a, p) => a + Number(p.total_amount), 0);
    const todayProd = production.filter(p => p.batch_date === today).reduce((a, p) => a + Number(p.paddy_input_qty), 0);
    const totalExpenses = expenses.reduce((a, e) => a + Number(e.amount), 0);
    const paddyStock = stock.filter(s => s.category === "raw_material").reduce((a, s) => a + Number(s.current_stock), 0);
    const riceStock = stock.filter(s => s.category === "finished_product" && /rice/i.test(s.name) && !/broken/i.test(s.name))
      .reduce((a, s) => a + Number(s.current_stock), 0);
    const receivables = customerOut.reduce((a, c) => a + Number(c.outstanding), 0);
    const payables = supplierOut.reduce((a, s) => a + Number(s.outstanding), 0);
    return { todaySales, todayPurch, todayProd, totalExpenses, paddyStock, riceStock, receivables, payables };
  }, [sales, purchases, production, expenses, stock, customerOut, supplierOut]);

  const productionKpis = useMemo(() => {
    const paddyIn = production.reduce((a, p) => a + Number(p.paddy_input_qty), 0);
    const riceOut = production.reduce((a, p) => a + Number(p.rice_output), 0);
    const brokenOut = production.reduce((a, p) => a + Number(p.broken_rice_output), 0);
    const branOut = production.reduce((a, p) => a + Number(p.bran_output), 0);
    const huskOut = production.reduce((a, p) => a + Number(p.husk_output), 0);
    return {
      paddyIn, riceOut, branOut, huskOut,
      recovery: paddyIn > 0 ? (riceOut / paddyIn) * 100 : null,
      broken: paddyIn > 0 ? (brokenOut / paddyIn) * 100 : null,
    };
  }, [production]);

  const trendData = useMemo(() => daily.map(d => ({
    day: fmtDate(d.day), sales: Number(d.sales_total), purchases: Number(d.purchases_total),
    expenses: Number(d.expenses_total), production: Number(d.paddy_processed),
  })), [daily]);

  const expenseBreakdown = useMemo(() => {
    const map = {};
    expenses.forEach(e => { map[e.category] = (map[e.category] || 0) + Number(e.amount); });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [expenses]);

  const productSales = useMemo(() => {
    const map = {};
    sales.forEach(s => {
      const name = s.products?.name || "Unknown";
      map[name] = (map[name] || 0) + Number(s.total_amount);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [sales]);

  const lowStock = stock.filter(s => Number(s.current_stock) < Number(s.low_stock_threshold));

  const recentActivity = useMemo(() => {
    const items = [
      ...purchases.map(p => ({ type: "Purchase", detail: `${p.products?.name || ""} from ${p.suppliers?.name || ""}`, amount: p.total_amount, date: p.created_at, tone: BLUE })),
      ...sales.map(s => ({ type: "Sale", detail: `${s.products?.name || ""} to ${s.customers?.name || ""}`, amount: s.total_amount, date: s.created_at, tone: GREEN })),
      ...expenses.map(e => ({ type: "Expense", detail: e.description || e.category, amount: e.amount, date: e.created_at, tone: RED })),
    ];
    return items.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);
  }, [purchases, sales, expenses]);

  const PIE_COLORS = [GREEN, BLUE, AMBER, RED, "#8B7FD6", "#5FA8A0"];

  if (err) {
    return <div style={{ padding: 24, color: RED, fontFamily: FONT_BODY, fontSize: 13.5 }}>Couldn't load the dashboard: {err}</div>;
  }

  return (
    <div style={{ padding: "20px 24px 40px", fontFamily: FONT_BODY, color: INK }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontFamily: FONT_HEAD, fontSize: 20, fontWeight: 600 }}>Executive dashboard</div>
          <div style={{ fontSize: 12.5, color: INK_MUTED, marginTop: 2 }}>Live figures from confirmed transactions</div>
        </div>
        <div style={{ display: "flex", gap: 4, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 3 }}>
          {RANGE_OPTIONS.map(o => (
            <button key={o.key} onClick={() => setRange(o.key)} style={{
              fontSize: 12.5, padding: "6px 12px", borderRadius: 6, border: "none", cursor: "pointer",
              background: range === o.key ? SURFACE_RAISED : "transparent",
              color: range === o.key ? INK : INK_MUTED, fontFamily: FONT_BODY,
            }}>{o.label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ color: INK_MUTED, fontSize: 13 }}>Loading dashboard…</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 14 }}>
            <KpiCard label="Today's sales" value={money(kpis.todaySales)} />
            <KpiCard label="Today's purchases" value={money(kpis.todayPurch)} />
            <KpiCard label="Today's production" value={num(kpis.todayProd, "kg")} />
            <KpiCard label={`Expenses (${RANGE_OPTIONS.find(o => o.key === range).label.toLowerCase()})`} value={money(kpis.totalExpenses)} />
            <KpiCard label="Paddy stock" value={num(kpis.paddyStock, "kg")} tone={lowStock.some(s => s.category === "raw_material") ? "warn" : undefined}
              sub={lowStock.some(s => s.category === "raw_material") ? "Below threshold" : undefined} />
            <KpiCard label="Finished rice stock" value={num(kpis.riceStock, "kg")} />
            <KpiCard label="Receivables" value={money(kpis.receivables)} tone={kpis.receivables > 0 ? "warn" : undefined} />
            <KpiCard label="Payables" value={money(kpis.payables)} tone={kpis.payables > 0 ? "down" : undefined} />
          </div>

          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 20,
            background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "14px 16px",
          }}>
            {[
              ["Paddy processed", num(productionKpis.paddyIn, "kg")],
              ["Rice produced", num(productionKpis.riceOut, "kg")],
              ["Recovery", pct(productionKpis.recovery)],
              ["Broken rice", pct(productionKpis.broken)],
              ["Bran produced", num(productionKpis.branOut, "kg")],
              ["Husk produced", num(productionKpis.huskOut, "kg")],
            ].map(([label, value]) => (
              <div key={label}>
                <div style={{ fontSize: 11, color: INK_MUTED, marginBottom: 4 }}>{label}</div>
                <div style={{ fontFamily: FONT_NUM, fontSize: 16, fontWeight: 500 }}>{value}</div>
              </div>
            ))}
          </div>

          {lowStock.length > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8, background: "rgba(210,162,76,0.1)",
              border: `1px solid rgba(210,162,76,0.35)`, borderRadius: 8, padding: "10px 14px", marginBottom: 20,
              fontSize: 12.5, color: AMBER,
            }}>
              <AlertTriangle size={15} />
              Low stock: {lowStock.map(s => s.name).join(", ")}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <SectionCard title="Sales & purchases trend">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trendData}>
                  <CartesianGrid stroke={BORDER} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="day" stroke={INK_MUTED} fontSize={11} tickLine={false} axisLine={{ stroke: BORDER }} />
                  <YAxis stroke={INK_MUTED} fontSize={11} tickLine={false} axisLine={false} width={40} />
                  <Tooltip contentStyle={{ background: SURFACE_RAISED, border: `1px solid ${BORDER}`, fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="sales" stroke={GREEN} strokeWidth={2} dot={false} name="Sales" />
                  <Line type="monotone" dataKey="purchases" stroke={BLUE} strokeWidth={2} dot={false} name="Purchases" />
                </LineChart>
              </ResponsiveContainer>
            </SectionCard>

            <SectionCard title="Production trend (paddy processed, kg)">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={trendData}>
                  <CartesianGrid stroke={BORDER} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="day" stroke={INK_MUTED} fontSize={11} tickLine={false} axisLine={{ stroke: BORDER }} />
                  <YAxis stroke={INK_MUTED} fontSize={11} tickLine={false} axisLine={false} width={40} />
                  <Tooltip contentStyle={{ background: SURFACE_RAISED, border: `1px solid ${BORDER}`, fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="production" fill={AMBER} radius={[3, 3, 0, 0]} name="Paddy processed" />
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <SectionCard title="Expense breakdown">
              {expenseBreakdown.length === 0 ? (
                <div style={{ color: INK_MUTED, fontSize: 12.5, padding: "20px 0" }}>No expenses in this range.</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={expenseBreakdown} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {expenseBreakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: SURFACE_RAISED, border: `1px solid ${BORDER}`, fontSize: 12, borderRadius: 8 }} formatter={(v) => money(v)} />
                    <Legend wrapperStyle={{ fontSize: 11.5 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </SectionCard>

            <SectionCard title="Product-wise sales">
              {productSales.length === 0 ? (
                <div style={{ color: INK_MUTED, fontSize: 12.5, padding: "20px 0" }}>No sales in this range.</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={productSales} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid stroke={BORDER} strokeDasharray="2 4" horizontal={false} />
                    <XAxis type="number" stroke={INK_MUTED} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" stroke={INK_MUTED} fontSize={11} tickLine={false} axisLine={false} width={100} />
                    <Tooltip contentStyle={{ background: SURFACE_RAISED, border: `1px solid ${BORDER}`, fontSize: 12, borderRadius: 8 }} formatter={(v) => money(v)} />
                    <Bar dataKey="value" fill={GREEN} radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </SectionCard>
          </div>

          <SectionCard title="Recent activity">
            {recentActivity.length === 0 ? (
              <div style={{ color: INK_MUTED, fontSize: 12.5, padding: "10px 0" }}>Nothing recorded yet in this range.</div>
            ) : (
              <div>
                {recentActivity.map((a, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "9px 0", borderBottom: i < recentActivity.length - 1 ? `1px solid ${BORDER}` : "none",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <span style={{
                        fontSize: 10.5, padding: "2px 8px", borderRadius: 20, color: a.tone,
                        border: `1px solid ${a.tone}55`, background: `${a.tone}18`, flexShrink: 0,
                      }}>{a.type}</span>
                      <span style={{ fontSize: 13, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.detail}</span>
                    </div>
                    <span style={{ fontFamily: FONT_NUM, fontSize: 12.5, color: INK_MUTED, flexShrink: 0, marginLeft: 12 }}>{money(a.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
