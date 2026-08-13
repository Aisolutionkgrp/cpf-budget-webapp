"use client";
import { useState } from "react";
import { computeTripCosts, daysInclusive, eachDate, thDay, fmtTHB, fmtInt } from "../lib/costEngine";

/* initial = { trip_no, start_date, end_date, work_days_per_month, engineers:[names],
               allocations:[{ project_code, dates:[iso], people:[names] }] }
   mode: "create" | "edit" */
export default function TripForm({ projects, settings, roster, addToRoster, initial, mode, onSave, onCancel, saveLabel, saving }) {
  const [form, setForm] = useState(initial);
  const [newName, setNewName] = useState("");

  const tripDays = daysInclusive(form.start_date, form.end_date);
  const tripDates = eachDate(form.start_date, form.end_date);
  const engList = (form.engineers || []).filter((e) => e && e.trim());

  const toggleEng = (name) => {
    const has = form.engineers.includes(name);
    setForm({ ...form, engineers: has ? form.engineers.filter((e) => e !== name) : [...form.engineers, name] });
  };
  const addNewEng = () => {
    const n = newName.trim();
    if (!n) return;
    addToRoster(n);
    if (!form.engineers.includes(n)) setForm({ ...form, engineers: [...form.engineers, n] });
    setNewName("");
  };

  const addAlloc = () => setForm({ ...form, allocations: [...form.allocations, { project_code: projects[0].code, dates: [], people: [] }] });
  const setAlloc = (i, patch) => { const a = [...form.allocations]; a[i] = { ...a[i], ...patch }; setForm({ ...form, allocations: a }); };
  const rmAlloc = (i) => setForm({ ...form, allocations: form.allocations.filter((_, x) => x !== i) });
  const toggleDate = (ai, d) => {
    const a = form.allocations[ai];
    const has = a.dates.includes(d);
    setAlloc(ai, { dates: has ? a.dates.filter((x) => x !== d) : [...a.dates, d].sort() });
  };
  const togglePerson = (ai, name) => {
    const a = form.allocations[ai];
    const has = a.people.includes(name);
    setAlloc(ai, { people: has ? a.people.filter((p) => p !== name) : [...a.people, name] });
  };

  const cleanPeople = (people) => people.filter((p) => engList.includes(p));

  const valid = form.start_date && form.end_date && tripDays > 0 && engList.length > 0 &&
    form.allocations.length > 0 && form.allocations.every((a) => a.dates.length > 0 && cleanPeople(a.people).length > 0);

  const preview = valid ? computeTripCosts({ ...form, engineers: engList }, settings) : null;

  const doSave = () => {
    if (!valid) return;
    onSave({
      ...form,
      engineers: engList,
      allocations: form.allocations.map((a) => ({ ...a, people: cleanPeople(a.people) }))
    });
  };

  return (
    <div>
      <div className="card">
        <div className="grid4">
          <Field label="ทริปที่"><input type="number" value={form.trip_no} onChange={(e) => setForm({ ...form, trip_no: +e.target.value })} className="inp" /></Field>
          <Field label="วันที่เริ่ม"><input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="inp" /></Field>
          <Field label="วันที่สิ้นสุด"><input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="inp" /></Field>
          <Field label="วันทำงาน/เดือน (ตัวหารเงินเดือน)"><input type="number" value={form.work_days_per_month} onChange={(e) => setForm({ ...form, work_days_per_month: +e.target.value })} className="inp" /></Field>
        </div>
        <div className="tripmeta">
          จำนวนวันทริป (ปฏิทิน): <b>{tripDays || "–"}</b> วัน · เบี้ยเลี้ยงคิด <b>{tripDays ? tripDays - 1 : "–"}</b> วัน ·
          ค่าแรง/คน/วัน = {fmtInt(settings.avg_salary)} ÷ {form.work_days_per_month} = <b>{fmtTHB(settings.avg_salary / (form.work_days_per_month || 1))}</b>
        </div>
      </div>

      <div className="card">
        <div className="cardhd">วิศวกรที่ไปทริปนี้ <span className="dimlabel">(กดเลือกจากรายชื่อ · เลือกแล้ว {engList.length} คน)</span></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {roster.map((name) => {
            const on = form.engineers.includes(name);
            return (
              <button key={name} onClick={() => toggleEng(name)} className="tagbtn"
                style={{ background: on ? "var(--brand)" : "#fff", color: on ? "#fff" : "var(--sub)", borderColor: on ? "var(--brand)" : "var(--line)" }}>
                {on ? "✓ " : ""}{name}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12, maxWidth: 420 }}>
          <input placeholder="เพิ่มวิศวกรคนใหม่…" value={newName} onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addNewEng(); }} className="inp" style={{ flex: 1 }} />
          <button onClick={addNewEng} className="btn-add" style={{ marginTop: 0 }}>+ เพิ่ม</button>
        </div>
      </div>

      <div className="card">
        <div className="cardhd">โครงการที่ทำในทริปนี้ <span className="dimlabel">(1 ทริปทำได้หลายโครงการ · ติ๊กเลือกวันที่ทำจากปฏิทิน)</span></div>
        {form.allocations.length === 0 && <div className="empty">ยังไม่มีโครงการ — กด "เพิ่มโครงการ"</div>}
        {!form.start_date && form.allocations.length > 0 && <div className="banner err">ใส่วันที่เริ่ม–สิ้นสุดทริปก่อน ถึงจะเลือกวันได้</div>}
        {form.allocations.map((a, i) => (
          <div key={i} className="alloc">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
              <Field label="โครงการ" grow>
                <select value={a.project_code} onChange={(e) => setAlloc(i, { project_code: e.target.value })} className="inp">
                  {projects.map((p) => <option key={p.code} value={p.code}>{p.code} — {p.name_th || "–"} / {p.name || "–"}</option>)}
                </select>
              </Field>
              <div style={{ fontSize: 12.5, color: "var(--brand)", fontWeight: 600, marginBottom: 8 }}>เลือกแล้ว {a.dates.length} วัน</div>
              <button onClick={() => rmAlloc(i)} className="btn-x" style={{ marginBottom: 2 }}>✕</button>
            </div>
            <div style={{ marginTop: 6 }}>
              <div className="dimlabel" style={{ marginBottom: 5 }}>ทำวันไหนบ้าง (ติ๊กเลือก):</div>
              {tripDates.length === 0 ? <span className="empty">↑ ใส่วันที่ทริปก่อน</span> : (
                <div className="daypick">
                  {tripDates.map((d) => {
                    const on = a.dates.includes(d);
                    return (
                      <button key={d} onClick={() => toggleDate(i, d)} className="daybtn"
                        style={{ background: on ? "var(--brand)" : "#fff", color: on ? "#fff" : "var(--sub)", borderColor: on ? "var(--brand)" : "var(--line)" }}>
                        {thDay(d)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div style={{ marginTop: 10 }}>
              <div className="dimlabel" style={{ marginBottom: 5 }}>ใครทำโครงการนี้:</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {engList.length === 0 && <span className="empty">↑ เลือกวิศวกรด้านบนก่อน</span>}
                {engList.map((name) => (
                  <button key={name} onClick={() => togglePerson(i, name)} className="tagbtn"
                    style={{ background: a.people.includes(name) ? "var(--brand)" : "#fff", color: a.people.includes(name) ? "#fff" : "var(--sub)", borderColor: a.people.includes(name) ? "var(--brand)" : "var(--line)" }}>{name}</button>
                ))}
              </div>
            </div>
          </div>
        ))}
        <button onClick={addAlloc} className="btn-add" disabled={engList.length === 0 || !form.start_date}>+ เพิ่มโครงการ</button>
      </div>

      {preview && (
        <div className="card" style={{ background: "var(--brandSoft)", borderColor: "#bfe6de" }}>
          <div className="cardhd">ตัวอย่างต้นทุนทริปนี้ (คำนวณสด)</div>
          <table className="tbl mini">
            <thead><tr><th style={{ textAlign: "left" }}>โครงการ</th><th>วัน</th><th>คน</th><th>แมนเดย์</th><th>เบี้ยเลี้ยง*</th><th>ตั๋ว*</th><th>รวม</th></tr></thead>
            <tbody>
              {preview.lines.map((l, i) => (
                <tr key={i}>
                  <td style={{ textAlign: "left" }}>{l.projectCode}</td>
                  <td className="num">{l.nDays}</td><td className="num">{l.people.length}</td>
                  <td className="num">{fmtInt(l.manday)}</td><td className="num">{fmtInt(l.perDiem)}</td>
                  <td className="num">{fmtInt(l.flight)}</td><td className="num" style={{ fontWeight: 600 }}>{fmtInt(l.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint" style={{ marginTop: 8 }}>* เบี้ยเลี้ยงทั้งทริป {fmtInt(preview.perDiemTrip)} + ตั๋วทั้งทริป {fmtInt(preview.flightTrip)} · หารเท่ากัน {preview.nProjects} โครงการ</p>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button onClick={doSave} disabled={!valid || saving} className="btn-primary">{saving ? "กำลังบันทึก…" : (saveLabel || "บันทึกทริป")}</button>
        {mode === "edit" && <button onClick={onCancel} className="btn-secondary">ยกเลิก</button>}
      </div>
      {!valid && <span className="needhint">กรอกวันที่ทริป · วิศวกรอย่างน้อย 1 คน · แต่ละโครงการต้องเลือกวันและมีคนทำ</span>}
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
