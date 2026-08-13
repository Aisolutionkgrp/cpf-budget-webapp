"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setErr("อีเมลหรือรหัสผ่านไม่ถูกต้อง"); return; }
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="login-page" style={{
      background: "linear-gradient(rgba(8,15,15,.45), rgba(8,15,15,.45)), url('/login1.png') center/cover no-repeat"
    }}>
      <div className="login-card">
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 11, letterSpacing: 3, color: "rgba(255,255,255,.65)", fontWeight: 700 }}>CPF PHILIPPINES · AI PROGRAM</div>
          <div style={{ fontSize: 21, fontWeight: 800, marginTop: 4, color: "#fff" }}>เข้าสู่ระบบ</div>
        </div>
        {err && <div className="banner err">{err}</div>}
        <form onSubmit={submit}>
          <label style={{ display: "block", marginBottom: 12 }}>
            <span className="fieldlbl">อีเมล</span>
            <input className="inp" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label style={{ display: "block", marginBottom: 16 }}>
            <span className="fieldlbl">รหัสผ่าน</span>
            <input className="inp" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button className="btn-primary" type="submit" disabled={loading} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {loading && <span className="spinner" />}
            {loading ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
          </button>
        </form>
        <p className="hint" style={{ textAlign: "center", marginTop: 14 }}>
          ยังไม่มีบัญชี? ให้ Admin สร้างบัญชีให้ผ่าน Supabase Studio
        </p>
      </div>
    </div>
  );
}
