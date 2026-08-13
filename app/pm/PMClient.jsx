"use client";
import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabaseClient";
import TripForm from "../../components/TripForm";

export default function PMClient({ userId }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [roster, setRoster] = useState([]);
  const [settings, setSettings] = useState(null);
  const [nextTripNo, setNextTripNo] = useState(1);
  const [formKey, setFormKey] = useState(0);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: p }, { data: e }, { data: s }, { data: t }] = await Promise.all([
      supabase.from("projects").select("*").order("code"),
      supabase.from("engineers").select("*").order("name"),
      supabase.from("settings").select("*").eq("id", 1).single(),
      supabase.from("trips").select("trip_no").order("trip_no", { ascending: false }).limit(1)
    ]);
    setProjects(p || []);
    setRoster((e || []).map((x) => x.name));
    setSettings(s || null);
    setNextTripNo((t && t[0] ? t[0].trip_no + 1 : 1));
    setLoading(false);
  }

  const addToRoster = async (name) => {
    if (roster.includes(name)) return;
    setRoster((r) => [...r, name]);
    const { error } = await supabase.from("engineers").insert({ name });
    if (error && error.code !== "23505") console.error(error); // ignore duplicate-name race
  };

  const handleSave = async (trip) => {
    setErr(""); setSaving(true);
    const { data: tripRow, error: tripErr } = await supabase.from("trips").insert({
      trip_no: trip.trip_no,
      start_date: trip.start_date,
      end_date: trip.end_date,
      work_days_per_month: trip.work_days_per_month,
      engineers: trip.engineers,
      created_by: userId
    }).select().single();

    if (tripErr) { setErr("บันทึกทริปไม่สำเร็จ: " + tripErr.message); setSaving(false); return; }

    const allocRows = trip.allocations.map((a) => ({
      trip_id: tripRow.id, project_code: a.project_code, dates: a.dates, people: a.people
    }));
    const { error: allocErr } = await supabase.from("allocations").insert(allocRows);
    setSaving(false);

    if (allocErr) { setErr("บันทึกโครงการในทริปไม่สำเร็จ: " + allocErr.message); return; }

    setFormKey((k) => k + 1);
    setNextTripNo(trip.trip_no + 1);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (loading) return <div className="loadingbox">กำลังโหลดข้อมูล…</div>;
  if (!settings || projects.length === 0) return <div className="loadingbox">ไม่พบข้อมูลโครงการหรือการตั้งค่า</div>;

  const blank = () => ({
    trip_no: nextTripNo, start_date: "", end_date: "", work_days_per_month: 26,
    engineers: [], allocations: []
  });

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 19 }}>กรอกทริปใหม่</h2>
        <p style={{ margin: "3px 0 0", color: "var(--sub)", fontSize: 13 }}>PM เพิ่มข้อมูลได้อย่างเดียว — แก้/ลบ ต้องให้ Admin</p>
      </div>
      {saved && <div className="banner ok">บันทึกทริปเรียบร้อย — ไปดูผลได้ที่หน้า Dashboard</div>}
      {err && <div className="banner err">{err}</div>}
      <TripForm key={formKey} projects={projects} settings={settings} roster={roster} addToRoster={addToRoster}
        initial={blank()} mode="create" onSave={handleSave} saving={saving} />
    </div>
  );
}
