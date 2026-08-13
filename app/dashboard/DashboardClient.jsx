"use client";
import { useEffect, useState, useMemo } from "react";
import { createClient } from "../../lib/supabaseClient";
import { Wallet, TrendingDown, TrendingUp, Plane, ClipboardList, ChevronLeft, ChevronRight } from "lucide-react";
import {
  buildProjectCosts, computeTripCosts, daysInclusive, eachDate, thDay,
  fmtTHB, fmtInt, CATEGORIES, CAT_TH, CAT_COLOR
} from "../../lib/costEngine";

export default function DashboardClient() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [trips, setTrips] = useState([]);
  const [settings, setSettings] = useState(null);
  const [logistics, setLogistics] = useState([]);
  const [hardware, setHardware] = useState([]);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: p }, { data: t }, { data: s }, { data: l }, { data: h }] = await Promise.all([
      supabase.from("projects").select("*").order("code"),
      supabase.from("trips").select("*, allocations(*)").order("trip_no"),
      supabase.from("settings").select("*").eq("id", 1).single(),
      supabase.from("logistics").select("*"),
      supabase.from("hardware").select("*")
    ]);
    setProjects(p || []); setTrips(t || []); setSettings(s || null);
    setLogistics(l || []); setHardware(h || []);
    setLoading(false);
  }

  const costMap = useMemo(() => {
    if (!settings) return {};
    return buildProjectCosts(projects, trips, settings, logistics, hardware);
  }, [projects, trips, settings, logistics, hardware]);

  if (loading) return <div className="loadingbox">กำลังโหลดข้อมูล…</div>;
  if (!settings) return <div className="loadingbox">ไม่พบข้อมูลตั้งค่า (settings)</div>;

  return <DashboardView costMap={costMap} trips={trips} settings={settings} projects={projects} />;
}

function DashboardView({ costMap, trips, settings, projects }) {
  const rows = Object.values(costMap);
  const [tabView, setTabView] = useState("projects");
  const [view, setView] = useState("all");
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");

  const active = rows.filter((r) => r.totalCost > 0);
  let shown = view === "active" ? active : rows;
  if (cat !== "all") shown = shown.filter((r) => r.category === cat);
  if (q.trim()) {
    const s = q.toLowerCase();
    shown = shown.filter((r) => r.name.toLowerCase().includes(s) || (r.name_th || "").includes(q) || r.code.includes(s));
  }
  const grouped = CATEGORIES
    .map((c) => ({ cat: c, items: shown.filter((r) => r.category === c).sort((a, b) => b.totalCost - a.totalCost) }))
    .filter((g) => g.items.length > 0);

  const totBudget = rows.reduce((s, r) => s + r.budget, 0);
  const totCost = rows.reduce((s, r) => s + r.totalCost, 0);
  const totProfit = totBudget - totCost;
  const usedPct = totBudget ? (totCost / totBudget) * 100 : 0;

  return (
    <div>
      <div className="section-head first">
        <div className="section-head-left">
          <div className="section-icon ink"><Wallet size={17} strokeWidth={2.2} /></div>
          <div className="section-title">ภาพรวมงบประมาณ</div>
        </div>
      </div>
      <div className="kpis">
        <KpiHero variant="ink" icon={Wallet}
          label="มูลค่าโครงการรวม" value={fmtTHB(totBudget)} note={`${rows.length} โครงการ · 5 หมวดหมู่`} />
        <KpiHero variant="brand" icon={TrendingDown}
          label="ต้นทุนที่ใช้ไปแล้ว" value={fmtTHB(totCost)} note={`${active.length} โครงการมีค่าใช้จ่าย`} />
        <Kpi icon={TrendingUp} iconBg={totProfit >= 0 ? "var(--greenBg)" : "var(--redBg)"} iconColor={totProfit >= 0 ? "var(--green)" : "var(--red)"}
          label={totProfit >= 0 ? "คงเหลือ / กำไร" : "เกินงบ / ขาดทุน"} value={fmtTHB(totProfit)}
          note={`${usedPct.toFixed(1)}% ของงบถูกใช้`} accent={totProfit >= 0 ? "var(--green)" : "var(--red)"} strong />
        <Kpi icon={Plane} iconBg="var(--brandSoft)" iconColor="var(--brandDark)"
          label="ทริปทั้งหมด" value={fmtInt(trips.length)} note={`เรต ${settings.usd_rate} ฿/USD`} />
      </div>

      <div className="section-head">
        <div className="section-head-left">
          <div className="section-icon ink"><Plane size={17} strokeWidth={2.2} /></div>
          <div className="section-title">% การใช้ต้นทุนรายโครงการ</div>
        </div>
        <div className="section-stats">
          <div className="section-stat"><div className="section-stat-l">ใช้งบไปแล้ว</div><div className="section-stat-v">{usedPct.toFixed(1)}%</div></div>
          <div className="section-stat"><div className="section-stat-l">โครงการมีต้นทุน</div><div className="section-stat-v">{active.length} / {rows.length}</div></div>
        </div>
      </div>
      <ProjectUsageChart rows={rows} />

      <div className="section-head">
        <div className="section-head-left">
          <div className="section-icon brand"><ClipboardList size={17} strokeWidth={2.2} /></div>
          <div className="section-title">รายละเอียดต้นทุนรายโครงการ</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {[["projects", "ต้นทุนรายโครงการ"], ["trips", "แดชบอร์ดทริป"]].map(([k, l]) => (
          <button key={k} onClick={() => setTabView(k)} className="subtab"
            style={{ background: tabView === k ? "var(--brand)" : "#fff", color: tabView === k ? "#fff" : "var(--ink)", borderColor: tabView === k ? "var(--brand)" : "var(--line)" }}>{l}</button>
        ))}
      </div>

      {tabView === "projects" && (
        <>
          <div className="toolbar">
            <div style={{ display: "flex", gap: 6 }}>
              {[["all", "ทั้งหมด"], ["active", "เฉพาะที่มีต้นทุน"]].map(([k, l]) => (
                <button key={k} onClick={() => setView(k)} className="chip"
                  style={{ background: view === k ? "var(--deep)" : "#fff", color: view === k ? "#fff" : "var(--ink)" }}>{l}</button>
              ))}
            </div>
            <input placeholder="ค้นหาชื่อไทย / อังกฤษ / รหัส…" value={q} onChange={(e) => setQ(e.target.value)} className="search" />
          </div>
          <div className="toolbar" style={{ marginTop: -4 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button onClick={() => setCat("all")} className="chip"
                style={{ background: cat === "all" ? "var(--brand)" : "#fff", color: cat === "all" ? "#fff" : "var(--ink)", borderColor: cat === "all" ? "var(--brand)" : "var(--line)" }}>ทุกหมวด</button>
              {CATEGORIES.map((c) => (
                <button key={c} onClick={() => setCat(c)} className="chip"
                  style={{ background: cat === c ? CAT_COLOR[c] : "#fff", color: cat === c ? "#fff" : CAT_COLOR[c], borderColor: CAT_COLOR[c] }}>
                  {CAT_TH[c]}
                </button>
              ))}
            </div>
          </div>
          <div className="tablewrap">
            <table className="tbl">
              <thead><tr>
                <th>รหัส</th><th style={{ textAlign: "left" }}>โครงการ</th>
                <th>มูลค่า</th><th>แมนเดย์</th><th>เบี้ยเลี้ยง</th><th>ตั๋ว</th>
                <th>Logistic</th><th>Hardware</th><th>ต้นทุนรวม</th><th>กำไร/ขาดทุน</th>
              </tr></thead>
              <tbody>
                {grouped.map((g) => {
                  const gBudget = g.items.reduce((s, r) => s + r.budget, 0);
                  const gCost = g.items.reduce((s, r) => s + r.totalCost, 0);
                  const gProfit = gBudget - gCost;
                  return (
                    <FragmentGroup key={g.cat} g={g} gBudget={gBudget} gCost={gCost} gProfit={gProfit} />
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="hint">จัดกลุ่มตามหมวดหมู่ · สีเขียว = กำไร/งบเหลือ · สีแดง = ขาดทุน/เกินงบ</p>
        </>
      )}

      {tabView === "trips" && <TripDashboard trips={trips} settings={settings} projects={projects} />}
    </div>
  );
}

function FragmentGroup({ g, gBudget, gCost, gProfit }) {
  return (
    <>
      <tr className="catrow">
        <td colSpan={2} style={{ textAlign: "left" }}>
          <span className="catdot" style={{ background: CAT_COLOR[g.cat] }} />
          <b>{CAT_TH[g.cat]}</b> <span className="dimlabel">{g.cat} · {g.items.length} โครงการ</span>
        </td>
        <td className="num">{fmtInt(gBudget)}</td>
        <td colSpan={5} className="num dim" style={{ textAlign: "right" }}>ต้นทุนรวมหมวด</td>
        <td className="num" style={{ fontWeight: 700 }}>{fmtInt(gCost)}</td>
        <td className="num">
          <span className="pill" style={{ background: gProfit >= 0 ? "var(--greenBg)" : "var(--redBg)", color: gProfit >= 0 ? "var(--green)" : "var(--red)" }}>
            {gProfit >= 0 ? "" : "-"}฿{fmtInt(Math.abs(gProfit))}</span>
        </td>
      </tr>
      {g.items.map((r) => (
        <tr key={r.code}>
          <td className="mono">{r.code}</td>
          <td style={{ textAlign: "left", maxWidth: 260 }}>
            <div style={{ fontWeight: 600 }}>{r.name_th || r.name}</div>
            <div className="dimlabel" style={{ fontSize: 11 }}>{r.name}</div>
          </td>
          <td className="num">{fmtInt(r.budget)}</td>
          <td className="num dim">{r.manday ? fmtInt(r.manday) : "–"}</td>
          <td className="num dim">{r.perDiem ? fmtInt(r.perDiem) : "–"}</td>
          <td className="num dim">{r.flight ? fmtInt(r.flight) : "–"}</td>
          <td className="num dim">{r.logistic ? fmtInt(r.logistic) : "–"}</td>
          <td className="num dim">{r.hardware ? fmtInt(r.hardware) : "–"}</td>
          <td className="num" style={{ fontWeight: 600 }}>{r.totalCost ? fmtInt(r.totalCost) : "–"}</td>
          <td className="num">
            <span className="pill" style={{ background: r.profit >= 0 ? "var(--greenBg)" : "var(--redBg)", color: r.profit >= 0 ? "var(--green)" : "var(--red)" }}>
              {r.profit >= 0 ? "" : "-"}฿{fmtInt(Math.abs(r.profit))}</span>
          </td>
        </tr>
      ))}
    </>
  );
}

function TripDashboard({ trips, settings, projects }) {
  const pname = (code) => { const p = projects.find((x) => x.code === code); return p ? `${p.name_th || "–"} / ${p.name || "–"}` : code; };
  if (trips.length === 0) return <div className="empty">ยังไม่มีทริป</div>;
  return (
    <div>
      {trips.map((t) => {
        const trip = { ...t, allocations: t.allocations || [] };
        const c = computeTripCosts(trip, settings);
        const allDates = eachDate(t.start_date, t.end_date);
        const tripTotal = c.lines.reduce((s, l) => s + l.total, 0);
        return (
          <div key={t.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, alignItems: "baseline" }}>
              <div className="cardhd" style={{ margin: 0 }}>ทริปที่ {t.trip_no}
                <span className="dimlabel"> · {t.start_date} → {t.end_date} · {c.tripDays} วัน · {(t.engineers || []).length} คน</span>
              </div>
              <div style={{ fontWeight: 700, color: "var(--brand)" }}>ต้นทุนทริป {fmtTHB(tripTotal)}</div>
            </div>
            <div className="tripmeta" style={{ marginTop: 10 }}>
              เบี้ยเลี้ยงทั้งทริป {fmtTHB(c.perDiemTrip)} · ตั๋วทั้งทริป {fmtTHB(c.flightTrip)} ·
              หารเท่ากัน {c.nProjects} โครงการ = เบี้ยเลี้ยง {fmtTHB(c.perDiemEach)} + ตั๋ว {fmtTHB(c.flightEach)} ต่อโครงการ
            </div>
            <div style={{ overflowX: "auto", marginTop: 14 }}>
              <table className="cal">
                <thead><tr>
                  <th className="calproj">โครงการ \ วันที่</th>
                  {allDates.map((d) => <th key={d} className="calday">{thDay(d)}</th>)}
                </tr></thead>
                <tbody>
                  {c.lines.map((l, i) => (
                    <tr key={i}>
                      <td className="calproj" title={pname(l.projectCode)}>
                        <b>{l.projectCode}</b> · {l.nDays} วัน · {l.people.length} คน
                        <div className="dimlabel" style={{ fontSize: 10 }}>{l.people.join(", ")}</div>
                      </td>
                      {allDates.map((d) => {
                        const on = l.dates.includes(d);
                        return <td key={d} className="calcell" style={{ background: on ? "var(--brand)" : "transparent" }} />;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <table className="tbl mini" style={{ marginTop: 14 }}>
              <thead><tr><th style={{ textAlign: "left" }}>โครงการ</th><th>วัน</th><th>คน</th><th>แมนเดย์</th><th>เบี้ยเลี้ยง</th><th>ตั๋ว</th><th>รวม</th></tr></thead>
              <tbody>
                {c.lines.map((l, i) => (
                  <tr key={i}>
                    <td style={{ textAlign: "left" }}>{l.projectCode}</td>
                    <td className="num">{l.nDays}</td><td className="num">{l.people.length}</td>
                    <td className="num">{fmtInt(l.manday)}</td><td className="num">{fmtInt(l.perDiem)}</td>
                    <td className="num">{fmtInt(l.flight)}</td><td className="num" style={{ fontWeight: 600 }}>{fmtInt(l.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

function usagePctColor(pct) {
  if (pct >= 100) return "var(--red)";
  if (pct >= 80) return "var(--amber)";
  return "var(--green)";
}

function ProjectUsageChart({ rows }) {
  const hasData = rows.some((r) => r.budget > 0 || r.totalCost > 0);
  const [batch, setBatch] = useState(0);

  const groups = CATEGORIES
    .map((c) => ({ cat: c, catTh: CAT_TH[c], color: CAT_COLOR[c], items: rows.filter((r) => r.category === c) }))
    .filter((g) => g.items.length > 0);

  if (!hasData) {
    return (
      <div className="chartcard" style={{ textAlign: "center", padding: "36px 20px" }}>
        <div className="chartcard-title" style={{ marginBottom: 6 }}>% การใช้ต้นทุนรายโครงการ</div>
        <p className="hint" style={{ marginTop: 0 }}>
          ยังไม่มีข้อมูลต้นทุนของโครงการไหนเลย เพราะยังไม่มีทริปถูกกรอกเข้าระบบ<br />
          ไปที่หน้า <b>"PM — กรอกทริป"</b> เพื่อเริ่มกรอกทริปแรก แล้วกราฟนี้จะขึ้นข้อมูลอัตโนมัติ
        </p>
      </div>
    );
  }

  const trackPx = 150;
  const active = Math.min(batch, groups.length - 1);

  return (
    <div className="chartcard">
      <div className="chartcard-hd" style={{ justifyContent: "flex-end" }}>
        <div className="chartcard-tag">{rows.length} โครงการ</div>
      </div>

      <div className="batch-viewport">
        <div className="batch-track" style={{ transform: `translateX(-${active * 100}%)` }}>
          {groups.map((g, gi) => (
            <div key={g.cat} className="batch-slide">
              <div className="barbox-group-hd">
                <span className="catdot" style={{ background: g.color, marginRight: 0 }} />
                {g.catTh} <span className="dimlabel">{g.cat} · {g.items.length} โครงการ</span>
              </div>
              <div className="barbox-row">
                {g.items.map((r, i) => {
                  const pct = r.budget ? (r.totalCost / r.budget) * 100 : 0;
                  const fillH = Math.min(pct, 100) / 100 * trackPx;
                  const overH = pct > 100 ? Math.min((pct - 100) / 100, 0.4) * trackPx : 0;
                  const color = usagePctColor(pct);
                  return (
                    <div key={r.code} className="barbox-col" title={`${r.name_th || "–"} / ${r.name || "–"} · งบ ${fmtTHB(r.budget)} · ใช้ไป ${fmtTHB(r.totalCost)} (${pct.toFixed(1)}%)`}>
                      <div className="barbox-track" style={{ height: trackPx }}>
                        <div className="barbox-fill barbox-fill-anim" style={{ "--fill-h": `${fillH + overH}px`, background: color, animationDelay: `${Math.min(i * 18, 400)}ms` }} />
                      </div>
                      <div className="barbox-pct" style={{ color }}>{pct.toFixed(0)}%</div>
                      <div className="barbox-label">{r.code}</div>
                      <div className="barbox-name">{r.name_th}</div>
                      <div className="barbox-name barbox-name-en">{r.name}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="batch-nav">
        <button className="batch-arrow" onClick={() => setBatch((b) => Math.max(0, b - 1))} disabled={active === 0} aria-label="แบชก่อนหน้า">
          <ChevronLeft size={16} strokeWidth={2.4} />
        </button>
        <div className="batch-dots">
          {groups.map((g, gi) => (
            <button key={g.cat} className={`batch-dot${gi === active ? " active" : ""}`} onClick={() => setBatch(gi)}
              style={gi === active ? { background: g.color } : undefined} title={`แบช ${gi + 1} — ${g.catTh}`} />
          ))}
        </div>
        <button className="batch-arrow" onClick={() => setBatch((b) => Math.min(groups.length - 1, b + 1))} disabled={active === groups.length - 1} aria-label="แบชถัดไป">
          <ChevronRight size={16} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}

function KpiHero({ variant, icon: Icon, label, value, note }) {
  return (
    <div className={`kpi-hero ${variant}`}>
      <div className="kpi-hero-top">
        <div className="kpi-hero-label">{label}</div>
        {Icon && (
          <div className="kpi-hero-icon">
            <Icon size={16} strokeWidth={2.2} color="#fff" />
          </div>
        )}
      </div>
      <div>
        <div className="kpi-hero-value">{value}</div>
        <div className="kpi-hero-note">{note}</div>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, iconBg, iconColor, label, value, note, accent, strong }) {
  return (
    <div className="kpi">
      {Icon && (
        <div className="kpi-icon" style={{ background: iconBg || "var(--brandSoft)" }}>
          <Icon size={19} strokeWidth={2.2} color={iconColor || "var(--brand)"} />
        </div>
      )}
      <div className="kpi-body">
        <div className="kpi-l">{label}</div>
        <div className="kpi-v" style={{ color: accent || "var(--ink)", fontSize: strong ? 22 : 19 }}>{value}</div>
        <div className="kpi-n">{note}</div>
      </div>
    </div>
  );
}
