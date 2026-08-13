"use client";
import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabaseClient";
import TripForm from "../../components/TripForm";
import { daysInclusive, fmtTHB, fmtInt, CATEGORIES, CAT_TH, CAT_COLOR } from "../../lib/costEngine";

export default function AdminClient() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [roster, setRoster] = useState([]);
  const [settings, setSettings] = useState(null);
  const [logistics, setLogistics] = useState([]);
  const [hardware, setHardware] = useState([]);
  const [trips, setTrips] = useState([]);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [newProj, setNewProj] = useState({ code: "", name_th: "", name: "", category: CATEGORIES[0], budget: 0 });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: p }, { data: e }, { data: s }, { data: lg }, { data: hw }, { data: t }] = await Promise.all([
      supabase.from("projects").select("*").order("code"),
      supabase.from("engineers").select("*").order("name"),
      supabase.from("settings").select("*").eq("id", 1).single(),
      supabase.from("logistics").select("*").order("created_at"),
      supabase.from("hardware").select("*").order("created_at"),
      supabase.from("trips").select("*, allocations(*)").order("trip_no")
    ]);
    setProjects(p || []); setRoster((e || []).map((x) => x.name)); setSettings(s || null);
    setLogistics(lg || []); setHardware(hw || []); setTrips(t || []);
    setLoading(false);
  }

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 2500); };

  const addToRoster = async (name) => {
    if (roster.includes(name)) return;
    setRoster((r) => [...r, name]);
    await supabase.from("engineers").insert({ name });
  };

  // ---------- settings ----------
  const saveSettings = async (patch) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    await supabase.from("settings").update(patch).eq("id", 1);
  };

  // ---------- project budgets / info ----------
  const saveBudget = async (code, budget) => {
    setProjects((ps) => ps.map((p) => (p.code === code ? { ...p, budget } : p)));
    await supabase.from("projects").update({ budget }).eq("code", code);
  };

  const saveProjectField = async (code, field, value) => {
    setProjects((ps) => ps.map((p) => (p.code === code ? { ...p, [field]: value } : p)));
    await supabase.from("projects").update({ [field]: value }).eq("code", code);
  };

  const addProject = async () => {
    const code = newProj.code.trim();
    if (!code) { flash("กรอกรหัสโครงการก่อน"); return; }
    if (projects.some((p) => p.code === code)) { flash("มีรหัสนี้อยู่แล้ว"); return; }
    const row = { code, name_th: newProj.name_th.trim(), name: newProj.name.trim(), category: newProj.category, budget: Number(newProj.budget) || 0 };
    const { data, error } = await supabase.from("projects").insert(row).select().single();
    if (error) { flash("เพิ่มโครงการไม่สำเร็จ: " + error.message); return; }
    setProjects((ps) => [...ps, data].sort((a, b) => a.code.localeCompare(b.code)));
    setNewProj({ code: "", name_th: "", name: "", category: CATEGORIES[0], budget: 0 });
    flash("เพิ่มโครงการแล้ว");
  };

  // ---------- logistics ----------
  const addLogistic = async () => {
    const { data } = await supabase.from("logistics").insert({ label: "", amount: 0 }).select().single();
    if (data) setLogistics((l) => [...l, data]);
  };
  const updateLogistic = async (id, patch) => {
    setLogistics((l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    await supabase.from("logistics").update(patch).eq("id", id);
  };
  const removeLogistic = async (id) => {
    setLogistics((l) => l.filter((x) => x.id !== id));
    await supabase.from("logistics").delete().eq("id", id);
  };

  // ---------- hardware ----------
  const addHardware = async () => {
    const { data } = await supabase.from("hardware").insert({ project_code: projects[0].code, label: "", price: 0, qty: 1 }).select().single();
    if (data) setHardware((h) => [...h, data]);
  };
  const updateHardware = async (id, patch) => {
    setHardware((h) => h.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    await supabase.from("hardware").update(patch).eq("id", id);
  };
  const removeHardware = async (id) => {
    setHardware((h) => h.filter((x) => x.id !== id));
    await supabase.from("hardware").delete().eq("id", id);
  };

  // ---------- trips ----------
  const deleteTrip = async (id) => {
    setTrips((ts) => ts.filter((t) => t.id !== id));
    await supabase.from("trips").delete().eq("id", id); // allocations cascade
    flash("ลบทริปแล้ว");
  };

  const saveTripEdit = async (updated) => {
    setSaving(true);
    const { error: tripErr } = await supabase.from("trips").update({
      trip_no: updated.trip_no, start_date: updated.start_date, end_date: updated.end_date,
      work_days_per_month: updated.work_days_per_month, engineers: updated.engineers
    }).eq("id", editId);

    if (tripErr) { setSaving(false); flash("แก้ไขไม่สำเร็จ: " + tripErr.message); return; }

    await supabase.from("allocations").delete().eq("trip_id", editId);
    const allocRows = updated.allocations.map((a) => ({
      trip_id: editId, project_code: a.project_code, dates: a.dates, people: a.people
    }));
    const { error: allocErr } = await supabase.from("allocations").insert(allocRows);
    setSaving(false);
    if (allocErr) { flash("บันทึกโครงการไม่สำเร็จ: " + allocErr.message); return; }

    setEditId(null);
    flash("บันทึกการแก้ไขแล้ว");
    load();
  };

  if (loading) return <div className="loadingbox">กำลังโหลดข้อมูล…</div>;
  if (!settings || projects.length === 0) return <div className="loadingbox">ไม่พบข้อมูลโครงการหรือการตั้งค่า</div>;

  const editing = trips.find((t) => t.id === editId) || null;

  if (editing) {
    return (
      <div>
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 19 }}>แก้ไขทริปที่ {editing.trip_no}</h2>
          <p style={{ margin: "3px 0 0", color: "var(--sub)", fontSize: 13 }}>Admin แก้ได้ทุกอย่าง — วันที่ วิศวกร โครงการ วันที่ทำ และคนทำ</p>
        </div>
        <TripForm projects={projects} settings={settings} roster={roster} addToRoster={addToRoster}
          initial={{
            trip_no: editing.trip_no, start_date: editing.start_date, end_date: editing.end_date,
            work_days_per_month: editing.work_days_per_month, engineers: editing.engineers || [],
            allocations: (editing.allocations || []).map((a) => ({ project_code: a.project_code, dates: a.dates || [], people: a.people || [] }))
          }}
          mode="edit" saveLabel="บันทึกการแก้ไข" saving={saving}
          onSave={saveTripEdit} onCancel={() => setEditId(null)} />
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 19 }}>Admin — แก้ไขค่าและข้อมูล</h2>
        <p style={{ margin: "3px 0 0", color: "var(--sub)", fontSize: 13 }}>แก้เรตต้นทุน มูลค่าโครงการ logistic hardware และข้อมูลที่ PM กรอก</p>
      </div>
      {msg && <div className="banner ok">{msg}</div>}

      <div className="card">
        <div className="cardhd">เรตต้นทุน (ใช้กับทุกทริป)</div>
        <div className="grid4">
          <Field label="เงินเดือนเฉลี่ย/คน (บาท)"><input type="number" className="inp" value={settings.avg_salary} onChange={(e) => saveSettings({ avg_salary: +e.target.value })} /></Field>
          <Field label="เบี้ยเลี้ยง (USD/คน/วัน)"><input type="number" className="inp" value={settings.per_diem_usd} onChange={(e) => saveSettings({ per_diem_usd: +e.target.value })} /></Field>
          <Field label="เรต USD → บาท"><input type="number" step="0.01" className="inp" value={settings.usd_rate} onChange={(e) => saveSettings({ usd_rate: +e.target.value })} /></Field>
          <Field label="ค่าตั๋วเครื่องบิน/คน (บาท)"><input type="number" className="inp" value={settings.flight_per_person} onChange={(e) => saveSettings({ flight_per_person: +e.target.value })} /></Field>
        </div>
      </div>

      <div className="card">
        <div className="cardhd">มูลค่าโครงการ — แก้ได้ <span className="dimlabel">แก้ชื่อโครงการหรือเพิ่มโครงการใหม่ได้ที่นี่</span></div>
        <div className="alloc" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Field label="รหัส"><input className="inp" style={{ width: 90 }} placeholder="เช่น 4.5.4" value={newProj.code} onChange={(e) => setNewProj((n) => ({ ...n, code: e.target.value }))} /></Field>
          <Field label="ชื่อไทย" grow><input className="inp" placeholder="ชื่อภาษาไทย" value={newProj.name_th} onChange={(e) => setNewProj((n) => ({ ...n, name_th: e.target.value }))} /></Field>
          <Field label="ชื่ออังกฤษ" grow><input className="inp" placeholder="English name" value={newProj.name} onChange={(e) => setNewProj((n) => ({ ...n, name: e.target.value }))} /></Field>
          <Field label="หมวด">
            <select className="inp" value={newProj.category} onChange={(e) => setNewProj((n) => ({ ...n, category: e.target.value }))}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{CAT_TH[c]}</option>)}
            </select>
          </Field>
          <Field label="มูลค่า (บาท)"><input type="number" className="inp inp-sm" value={newProj.budget} onChange={(e) => setNewProj((n) => ({ ...n, budget: e.target.value }))} /></Field>
          <button onClick={addProject} className="btn-add" style={{ marginTop: 0 }}>+ เพิ่มโครงการ</button>
        </div>
        <div className="scrollbox">
          <table className="tbl mini">
            <thead><tr><th>รหัส</th><th style={{ textAlign: "left" }}>โครงการ</th><th style={{ textAlign: "left" }}>หมวด</th><th>มูลค่า (บาท)</th></tr></thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.code}>
                  <td className="mono">{p.code}</td>
                  <td style={{ textAlign: "left" }}>
                    <input className="inp" style={{ fontWeight: 600, marginBottom: 4 }} defaultValue={p.name_th}
                      placeholder="ชื่อภาษาไทย" onBlur={(e) => saveProjectField(p.code, "name_th", e.target.value)} />
                    <input className="inp" style={{ fontSize: 11, color: "var(--sub)" }} defaultValue={p.name}
                      placeholder="English name" onBlur={(e) => saveProjectField(p.code, "name", e.target.value)} />
                  </td>
                  <td style={{ textAlign: "left" }}>
                    <span className="catchip" style={{ color: CAT_COLOR[p.category], borderColor: CAT_COLOR[p.category] }}>{CAT_TH[p.category] || "–"}</span>
                  </td>
                  <td className="num"><input type="number" className="inp inp-sm" defaultValue={p.budget}
                    onBlur={(e) => saveBudget(p.code, +e.target.value)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="cardhd">ค่า Logistic <span className="dimlabel">เพิ่มได้หลายรอบ · หารเฉลี่ยลงทุกโครงการเท่ากัน</span></div>
        {logistics.length === 0 && <div className="empty">ยังไม่มีรายการ</div>}
        {logistics.map((row) => (
          <div key={row.id} className="alloc" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            <Field label="รายละเอียด" grow>
              <input className="inp" defaultValue={row.label} onBlur={(e) => updateLogistic(row.id, { label: e.target.value })} />
            </Field>
            <Field label="จำนวนเงิน">
              <input type="number" className="inp" style={{ width: 120 }} defaultValue={row.amount} onBlur={(e) => updateLogistic(row.id, { amount: +e.target.value })} />
            </Field>
            <button onClick={() => removeLogistic(row.id)} className="btn-x" style={{ marginBottom: 2 }}>✕</button>
          </div>
        ))}
        <button onClick={addLogistic} className="btn-add">+ เพิ่มรายการ</button>
        <div className="tripmeta" style={{ marginTop: 12 }}>
          รวม Logistic {fmtTHB(logistics.reduce((s, l) => s + (Number(l.amount) || 0), 0))} ÷ {projects.length} โครงการ =
          {" "}<b>{fmtTHB(logistics.reduce((s, l) => s + (Number(l.amount) || 0), 0) / (projects.length || 1))}</b> ต่อโครงการ
        </div>
      </div>

      <div className="card">
        <div className="cardhd">ค่าอุปกรณ์ Hardware และอื่น ๆ <span className="dimlabel">ราคา × จำนวน</span></div>
        {hardware.length === 0 && <div className="empty">ยังไม่มีรายการ</div>}
        {hardware.map((row) => (
          <div key={row.id} className="alloc" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            <Field label="โครงการ" grow>
              <select className="inp" defaultValue={row.project_code} onChange={(e) => updateHardware(row.id, { project_code: e.target.value })}>
                {projects.map((p) => <option key={p.code} value={p.code}>{p.code} — {p.name_th || "–"} / {p.name || "–"}</option>)}
              </select>
            </Field>
            <Field label="รายการ"><input className="inp" style={{ width: 160 }} defaultValue={row.label} onBlur={(e) => updateHardware(row.id, { label: e.target.value })} /></Field>
            <Field label="ราคา/หน่วย"><input type="number" className="inp" style={{ width: 120 }} defaultValue={row.price} onBlur={(e) => updateHardware(row.id, { price: +e.target.value })} /></Field>
            <Field label="จำนวน"><input type="number" className="inp" style={{ width: 90 }} defaultValue={row.qty} onBlur={(e) => updateHardware(row.id, { qty: +e.target.value })} /></Field>
            <button onClick={() => removeHardware(row.id)} className="btn-x" style={{ marginBottom: 2 }}>✕</button>
          </div>
        ))}
        <button onClick={addHardware} className="btn-add">+ เพิ่มรายการ</button>
      </div>

      <div className="card">
        <div className="cardhd">ทริปที่ PM กรอก — แก้ไข / ลบได้</div>
        {trips.length === 0 && <div className="empty">ยังไม่มีทริป</div>}
        {trips.map((t) => (
          <div key={t.id} className="triprow">
            <div>
              <b>ทริปที่ {t.trip_no}</b> · {t.start_date} → {t.end_date} · {daysInclusive(t.start_date, t.end_date)} วัน · {(t.engineers || []).length} คน · {(t.allocations || []).length} โครงการ
              <div className="dimlabel" style={{ marginTop: 3 }}>{(t.engineers || []).join(", ")}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setEditId(t.id)} className="btn-edit">แก้ไข</button>
              <button onClick={() => deleteTrip(t.id)} className="btn-x">ลบ</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children, grow }) {
  return (
    <label style={{ display: "block", flex: grow ? "1 1 200px" : "none" }}>
      <span className="fieldlbl">{label}</span>
      {children}
    </label>
  );
}
