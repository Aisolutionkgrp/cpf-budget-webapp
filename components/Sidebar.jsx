"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, ClipboardPlus, ShieldCheck, LogOut } from "lucide-react";
import { createClient } from "../lib/supabaseClient";

export default function Sidebar({ role, fullName, hasLogo }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [logoError, setLogoError] = useState(false);
  const showLogo = hasLogo && !logoError;

  const groups = [
    { label: null, tabs: [{ href: "/dashboard", label: "Dashboard", sub: "ทุกคนดูได้", icon: LayoutDashboard, show: true }] },
    {
      label: "การทำงาน", tabs: [
        { href: "/pm", label: "PM — กรอกทริป", sub: "เพิ่มอย่างเดียว", icon: ClipboardPlus, show: role === "pm" || role === "admin" },
        { href: "/admin", label: "Admin", sub: "แก้ไขได้ทุกอย่าง", icon: ShieldCheck, show: role === "admin" }
      ]
    }
  ].map((g) => ({ ...g, tabs: g.tabs.filter((t) => t.show) })).filter((g) => g.tabs.length > 0);

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const initials = (fullName || "?").trim().slice(0, 1).toUpperCase();

  return (
    <aside className="sidebar collapsed">
      <div className="sidebar-panel">
        <div className="sidebar-logo">
          <div className="sidebar-logo-box">
            {showLogo ? (
              <img src="/logo.png" alt="logo" onError={() => setLogoError(true)} />
            ) : (
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="9" width="3" height="6" rx="1" fill="currentColor" />
                <rect x="6.5" y="5" width="3" height="10" rx="1" fill="currentColor" />
                <rect x="12" y="1" width="3" height="14" rx="1" fill="currentColor" />
              </svg>
            )}
          </div>
          <div className="sidebar-logo-txt">
            <div className="sidebar-logo-text">CPF Philippines</div>
            <div className="sidebar-logo-sub">AI Program</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {groups.map((g, gi) => (
            <div key={gi}>
              {g.label && <div className="sidebar-group-label">{g.label}</div>}
              {g.tabs.map((t) => {
                const active = pathname.startsWith(t.href);
                const Icon = t.icon;
                return (
                  <Link key={t.href} href={t.href} className={`sidebar-link${active ? " active" : ""}`}>
                    <Icon size={18} strokeWidth={2.2} className="sidebar-link-icon" />
                    <span className="sidebar-link-txt">
                      {t.label}
                      <span className="lbl-sub">{t.sub}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{initials}</div>
            <div className="sidebar-user-txt">
              <div className="sidebar-username">{fullName || "—"}</div>
              <div className="sidebar-role">{role}</div>
            </div>
          </div>
          <button onClick={logout} className="sidebar-logout">
            <LogOut size={14} /> <span className="sidebar-link-txt">ออกจากระบบ</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
