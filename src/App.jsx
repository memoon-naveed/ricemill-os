import React, { useState, useEffect } from "react";
import {
  LayoutDashboard, ShoppingCart, Users, Boxes, Factory, TrendingUp,
  UserCircle, Receipt, FileBarChart, ShieldCheck, Settings, Menu,
  ChevronLeft, LogOut, Download, Share, X, PlusSquare,
} from "lucide-react";import { supabase } from "./supabaseClient";
import {
  INK, INK_MUTED, BG, SURFACE, SURFACE_RAISED, BORDER, GREEN, GREEN_DIM,
  FONT_HEAD, FONT_BODY, FONT_NUM,
} from "./shared";

import Dashboard from "./pages/Dashboard";
import PurchasingPage from "./pages/Purchasing";
import SalesPage from "./pages/Sales";
import SuppliersPage from "./pages/Suppliers";
import CustomersPage from "./pages/Customers";
import InventoryPage from "./pages/Inventory";
import ProductionPage from "./pages/Production";
import ExpensesPage from "./pages/Expenses";
import ReportsPage from "./pages/Reports";
import UsersRolesPage from "./pages/UsersRoles";
import SettingsPage from "./pages/Settings";

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "purchasing", label: "Purchasing", icon: ShoppingCart },
  { key: "suppliers", label: "Suppliers", icon: Users },
  { key: "inventory", label: "Inventory", icon: Boxes },
  { key: "production", label: "Production", icon: Factory },
  { key: "sales", label: "Sales", icon: TrendingUp },
  { key: "customers", label: "Customers", icon: UserCircle },
  { key: "expenses", label: "Expenses", icon: Receipt },
  { key: "reports", label: "Reports", icon: FileBarChart },
  { key: "users", label: "Users & Roles", icon: ShieldCheck },
  { key: "settings", label: "Settings", icon: Settings },
];

const ROLE_LABEL = { owner: "Owner", manager: "Manager", accountant: "Accountant", operator: "Operator" };

// ---------- PWA install ----------

function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}
function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(isStandalone());

  useEffect(() => {
    const onBeforeInstall = (e) => { e.preventDefault(); setDeferredPrompt(e); };
    const onInstalled = () => { setInstalled(true); setDeferredPrompt(null); };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return "unavailable";
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return choice.outcome;
  };

  return { canPromptNatively: !!deferredPrompt, installed, promptInstall };
}

function IosInstallModal({ onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: SURFACE, border: `1px solid ${BORDER}`, borderTopLeftRadius: 16, borderTopRightRadius: 16,
        padding: 22, width: "100%", maxWidth: 420, fontFamily: FONT_BODY, color: INK,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontFamily: FONT_HEAD, fontSize: 15, fontWeight: 600 }}>Install RiceMillOS</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: INK_MUTED, cursor: "pointer" }}><X size={18} /></button>
        </div>
        <div style={{ fontSize: 13, color: INK_MUTED, lineHeight: 1.7 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ background: SURFACE_RAISED, borderRadius: 8, padding: 6, display: "flex" }}><Share size={16} color={GREEN} /></span>
            1. Tap the <b style={{ color: INK }}>Share</b> button in Safari's toolbar
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ background: SURFACE_RAISED, borderRadius: 8, padding: 6, display: "flex" }}><PlusSquare size={16} color={GREEN} /></span>
            2. Scroll down and tap <b style={{ color: INK }}>Add to Home Screen</b>
          </div>
        </div>
      </div>
    </div>
  );
}

function InstallButton() {
  const { canPromptNatively, installed, promptInstall } = useInstallPrompt();
  const [showIosModal, setShowIosModal] = useState(false);

  if (installed) return null;
  if (!canPromptNatively && !isIOS()) return null;

  const handleClick = () => {
    if (canPromptNatively) promptInstall();
    else if (isIOS()) setShowIosModal(true);
  };

  return (
    <>
      <button onClick={handleClick} title="Install RiceMillOS as an app" style={{
        display: "flex", alignItems: "center", gap: 6, background: SURFACE_RAISED,
        border: `1px solid ${BORDER}`, borderRadius: 8, padding: "7px 12px", cursor: "pointer",
        color: INK, fontSize: 12.5, fontFamily: FONT_BODY,
      }}>
        <Download size={14} color={GREEN} /> Install
      </button>
      {showIosModal && <IosInstallModal onClose={() => setShowIosModal(false)} />}
    </>
  );
}

// ---------- Auth ----------

const inputStyle = {
  width: "100%", boxSizing: "border-box", background: BG, border: `1px solid ${BORDER}`,
  borderRadius: 8, padding: "10px 12px", color: INK, fontSize: 13.5, fontFamily: FONT_BODY, outline: "none",
};

function LoginScreen() {
  const [email, setEmail] = useState("owner@ricemillos.demo");
  const [password, setPassword] = useState("RiceMill@2026");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email || !password) return setError("Enter both email and password.");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_BODY, color: INK, padding: 24 }}>
      <div style={{ width: 380, maxWidth: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: GREEN_DIM, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Factory size={20} color={GREEN} />
            </div>
            <div>
              <div style={{ fontFamily: FONT_HEAD, fontSize: 18, fontWeight: 600, letterSpacing: -0.2 }}>RiceMillOS</div>
              <div style={{ fontSize: 12, color: INK_MUTED }}>Mill management & analytics</div>
            </div>
          </div>
          <InstallButton />
        </div>

        <form onSubmit={submit} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Sign in</div>
          <div style={{ fontSize: 12.5, color: INK_MUTED, marginBottom: 20 }}>
            Demo accounts use password <span style={{ fontFamily: FONT_NUM }}>RiceMill@2026</span>
          </div>

          <label style={{ fontSize: 12, color: INK_MUTED, display: "block", marginBottom: 6 }}>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" style={inputStyle} placeholder="owner@ricemillos.demo" />

          <label style={{ fontSize: 12, color: INK_MUTED, display: "block", margin: "16px 0 6px" }}>Password</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" style={inputStyle} placeholder="••••••••" />

          {error && (
            <div style={{ marginTop: 14, fontSize: 12.5, color: "#C5564C", background: "rgba(197,86,76,0.1)", border: "1px solid rgba(197,86,76,0.3)", borderRadius: 8, padding: "8px 10px" }}>{error}</div>
          )}

          <button type="submit" disabled={loading} style={{
            marginTop: 20, width: "100%", background: GREEN, color: "#FFFFFF", border: "none",
            borderRadius: 8, padding: "11px 0", fontSize: 14, fontWeight: 600, cursor: "pointer",
            fontFamily: FONT_BODY, opacity: loading ? 0.7 : 1,
          }}>{loading ? "Signing in…" : "Sign in"}</button>

          <div style={{ marginTop: 18, borderTop: `1px solid ${BORDER}`, paddingTop: 14 }}>
            <div style={{ fontSize: 11.5, color: INK_MUTED }}>Demo account: owner@ricemillos.demo</div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------- Sidebar ----------

function Sidebar({ collapsed, setCollapsed, active, setActive, isMobile, mobileOpen, onCloseMobile }) {
  // On mobile the sidebar is a fixed-position slide-in drawer that overlays
  // the page instead of sitting inline in the flex row (which is what made
  // it eat up half the screen width on small viewports).
  const mobileStyle = {
    position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 60,
    width: "78vw", maxWidth: 260,
    transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
    transition: "transform 0.2s ease",
    boxShadow: mobileOpen ? "2px 0 16px rgba(0,0,0,0.35)" : "none",
  };
  const desktopStyle = {
    position: "relative", width: collapsed ? 64 : 224, flexShrink: 0,
    transition: "width 0.15s ease",
  };

  const handleSelect = (key) => {
    setActive(key);
    if (isMobile) onCloseMobile();
  };

  const showLabels = isMobile || !collapsed;

  return (
    <>
      {isMobile && mobileOpen && (
        <div onClick={onCloseMobile} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 55 }} />
      )}
      <div style={{
        ...(isMobile ? mobileStyle : desktopStyle),
        background: SURFACE, borderRight: `1px solid ${BORDER}`,
        display: "flex", flexDirection: "column", height: "100%",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: showLabels ? "18px 16px" : "18px 0", justifyContent: showLabels ? "space-between" : "center", borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 7, background: GREEN_DIM, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Factory size={16} color={GREEN} />
            </div>
            {showLabels && <div style={{ fontFamily: FONT_HEAD, fontSize: 15, fontWeight: 600, color: INK, whiteSpace: "nowrap" }}>RiceMillOS</div>}
          </div>
          {isMobile && (
            <button onClick={onCloseMobile} style={{ background: "transparent", border: "none", color: INK_MUTED, cursor: "pointer", padding: 4 }}>
              <X size={18} />
            </button>
          )}
        </div>

        <div style={{ flex: 1, padding: "10px 8px", overflowY: "auto" }}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.key;
            return (
              <button key={item.key} onClick={() => handleSelect(item.key)} title={item.label} style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                background: isActive ? SURFACE_RAISED : "transparent",
                border: "none", borderRadius: 8, padding: showLabels ? "9px 10px" : "10px 0",
                marginBottom: 2, cursor: "pointer", color: isActive ? INK : INK_MUTED,
                justifyContent: showLabels ? "flex-start" : "center",
                borderLeft: isActive ? `2px solid ${GREEN}` : "2px solid transparent",
              }}>
                <Icon size={17} strokeWidth={1.8} />
                {showLabels && <span style={{ fontSize: 13, fontFamily: FONT_BODY }}>{item.label}</span>}
              </button>
            );
          })}
        </div>

        {!isMobile && (
          <button onClick={() => setCollapsed(!collapsed)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "transparent", border: "none", borderTop: `1px solid ${BORDER}`, color: INK_MUTED, padding: "12px 0", cursor: "pointer" }}>
            {collapsed ? <Menu size={16} /> : <><ChevronLeft size={16} /><span style={{ fontSize: 12 }}>Collapse</span></>}
          </button>
        )}
      </div>
    </>
  );
}

// ---------- App shell ----------

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [checking, setChecking] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setMobileNavOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const [active, setActive] = useState("dashboard");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecking(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => setSession(newSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  const loadProfile = () => {
    if (!session) return setProfile(null);
    supabase.from("profiles").select("*").eq("id", session.user.id).single().then(({ data }) => setProfile(data));
  };
  useEffect(loadProfile, [session]);

  const logout = async () => { await supabase.auth.signOut(); setActive("dashboard"); };

  if (checking) return <div style={{ minHeight: "100vh", background: BG }} />;
  if (!session) return <LoginScreen />;

  const pageProps = { profile, sessionEmail: session.user.email, currentRole: profile?.role, onProfileUpdated: loadProfile };

  return (
    <div style={{ display: "flex", height: "100vh", background: BG, overflow: "hidden" }}>
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        active={active}
        setActive={setActive}
        isMobile={isMobile}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "12px 14px" : "12px 24px", borderBottom: `1px solid ${BORDER}`, background: SURFACE, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            {isMobile && (
              <button onClick={() => setMobileNavOpen(true)} style={{ background: "transparent", border: "none", color: INK, cursor: "pointer", padding: 4, flexShrink: 0 }}>
                <Menu size={20} />
              </button>
            )}
            <div style={{ fontFamily: FONT_HEAD, fontSize: 14, fontWeight: 600, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{NAV_ITEMS.find(n => n.key === active)?.label}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {!isMobile && <InstallButton />}
            {!isMobile && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12.5, color: INK, fontFamily: FONT_BODY }}>{profile?.full_name || session.user.email}</div>
                <div style={{ fontSize: 11, color: INK_MUTED }}>{ROLE_LABEL[profile?.role] || "—"}</div>
              </div>
            )}
            <button onClick={logout} title="Sign out" style={{ background: SURFACE_RAISED, border: `1px solid ${BORDER}`, borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: INK_MUTED }}>
              <LogOut size={15} />
            </button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {active === "dashboard" && <Dashboard />}
          {active === "purchasing" && <PurchasingPage />}
          {active === "sales" && <SalesPage />}
          {active === "suppliers" && <SuppliersPage />}
          {active === "customers" && <CustomersPage />}
          {active === "inventory" && <InventoryPage />}
          {active === "production" && <ProductionPage />}
          {active === "expenses" && <ExpensesPage />}
          {active === "reports" && <ReportsPage />}
          {active === "users" && <UsersRolesPage currentRole={pageProps.currentRole} />}
          {active === "settings" && <SettingsPage profile={profile} sessionEmail={pageProps.sessionEmail} onProfileUpdated={loadProfile} />}
        </div>
      </div>
    </div>
  );
}
