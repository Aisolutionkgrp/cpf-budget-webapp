import { createClient } from "../../lib/supabaseServer";
import Sidebar from "../../components/Sidebar";
import { hasCompanyLogo } from "../../lib/logo";
import PMClient from "./PMClient";

export default async function PMPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();

  return (
    <div className="shell">
      <Sidebar role={profile?.role || "executive"} fullName={profile?.full_name} hasLogo={hasCompanyLogo()} />
      <div className="content">
        <div className="topbar">
          <div><div className="topbar-eyebrow">CPF Philippines · AI Program</div><div className="topbar-title">PM — กรอกทริป</div></div>
          <div className="topbar-date">{new Date().toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}</div>
        </div>
        <div className="content-inner">
          <PMClient userId={user.id} />
        </div>
      </div>
    </div>
  );
}
