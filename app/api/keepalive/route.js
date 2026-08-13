import { createClient } from "@supabase/supabase-js";

// Pinged automatically by Vercel Cron (see vercel.json) so the Supabase project
// keeps seeing API traffic and doesn't auto-pause after 7 days of inactivity.
// The query itself doesn't need to succeed (RLS may reject it) — just reaching
// Supabase's API counts as activity.
export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    await supabase.from("settings").select("id").limit(1);
  } catch (e) {
    // ignore — reaching Supabase is what matters, not the result
  }
  return Response.json({ ok: true, ts: new Date().toISOString() });
}
