-- ============================================================
-- CPF Philippines AI Program — Budget Control
-- Supabase schema: tables + RLS for 3 roles (pm / admin / executive)
-- Run this whole file once in Supabase SQL Editor.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- PROFILES (1 row per auth user, holds role) ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'executive' check (role in ('pm','admin','executive')),
  created_at timestamptz not null default now()
);

-- auto-create profile row when a new user signs up (default role = executive;
-- an admin must promote the PM / other admins manually afterwards, see DEPLOY_GUIDE.md)
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'executive');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- helper: current user's role (security definer so it can read profiles under RLS)
create function public.my_role()
returns text as $$
  select role from public.profiles where id = auth.uid();
$$ language sql security definer stable;

-- ---------- PROJECTS ----------
create table public.projects (
  code text primary key,
  name text not null,
  name_th text,
  category text not null,
  budget numeric not null default 0
);

-- ---------- GLOBAL SETTINGS (single row, id = 1) ----------
create table public.settings (
  id int primary key default 1,
  avg_salary numeric not null default 33000,
  per_diem_usd numeric not null default 50,
  usd_rate numeric not null default 33.8,
  flight_per_person numeric not null default 20000,
  constraint single_row check (id = 1)
);
insert into public.settings (id) values (1);

-- ---------- ENGINEER ROSTER ----------
create table public.engineers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- ---------- TRIPS ----------
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  trip_no int not null,
  start_date date not null,
  end_date date not null,
  work_days_per_month numeric not null default 26,
  engineers text[] not null default '{}',   -- names, snapshot at save time
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- ---------- ALLOCATIONS (which project(s) a trip worked on) ----------
create table public.allocations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  project_code text not null references public.projects(code),
  dates date[] not null default '{}',       -- picked calendar days
  people text[] not null default '{}'       -- subset of trip.engineers
);

-- ---------- LOGISTIC (spread equally across all projects, program-wide) ----------
create table public.logistics (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  amount numeric not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- HARDWARE (per project) ----------
create table public.hardware (
  id uuid primary key default gen_random_uuid(),
  project_code text not null references public.projects(code),
  label text not null,
  price numeric not null default 0,
  qty numeric not null default 1,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- Rules recap:
--   - Dashboard: every signed-in user (pm/admin/executive) can SELECT everything.
--   - PM: can INSERT trips/allocations only. Cannot UPDATE/DELETE.
--   - Admin: full INSERT/UPDATE/DELETE on everything.
--   - Executive: read-only everywhere.
-- ============================================================

alter table public.profiles   enable row level security;
alter table public.projects   enable row level security;
alter table public.settings   enable row level security;
alter table public.engineers  enable row level security;
alter table public.trips      enable row level security;
alter table public.allocations enable row level security;
alter table public.logistics  enable row level security;
alter table public.hardware   enable row level security;

-- profiles: everyone can read all profiles (needed to show names); only the row owner or admin can update
create policy "profiles_select_all" on public.profiles for select using (auth.role() = 'authenticated');
create policy "profiles_update_admin_or_self" on public.profiles for update
  using (public.my_role() = 'admin' or id = auth.uid());

-- projects: read for all signed-in users; write for admin only
create policy "projects_select_all" on public.projects for select using (auth.role() = 'authenticated');
create policy "projects_write_admin" on public.projects for all
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- settings: read for all; write for admin only
create policy "settings_select_all" on public.settings for select using (auth.role() = 'authenticated');
create policy "settings_write_admin" on public.settings for update
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- engineers: read for all; pm + admin can add new names
create policy "engineers_select_all" on public.engineers for select using (auth.role() = 'authenticated');
create policy "engineers_insert_pm_admin" on public.engineers for insert
  with check (public.my_role() in ('pm','admin'));
create policy "engineers_write_admin" on public.engineers for delete
  using (public.my_role() = 'admin');

-- trips: read for all; pm+admin can insert; admin only can update/delete
create policy "trips_select_all" on public.trips for select using (auth.role() = 'authenticated');
create policy "trips_insert_pm_admin" on public.trips for insert
  with check (public.my_role() in ('pm','admin'));
create policy "trips_update_admin" on public.trips for update
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');
create policy "trips_delete_admin" on public.trips for delete
  using (public.my_role() = 'admin');

-- allocations: same pattern as trips
create policy "alloc_select_all" on public.allocations for select using (auth.role() = 'authenticated');
create policy "alloc_insert_pm_admin" on public.allocations for insert
  with check (public.my_role() in ('pm','admin'));
create policy "alloc_update_admin" on public.allocations for update
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');
create policy "alloc_delete_admin" on public.allocations for delete
  using (public.my_role() = 'admin');

-- logistics & hardware: read for all; write for admin only
create policy "logistics_select_all" on public.logistics for select using (auth.role() = 'authenticated');
create policy "logistics_write_admin" on public.logistics for all
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

create policy "hardware_select_all" on public.hardware for select using (auth.role() = 'authenticated');
create policy "hardware_write_admin" on public.hardware for all
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- ============================================================
-- SEED DATA — 35 projects (Thai name + category) + engineer roster
-- ============================================================
insert into public.projects (code, name, name_th, category, budget) values
('4.1.1','Anomaly Detection for Food Defense','ระบบตรวจจับความผิดปกติ','Slaughterhouse & Meat AI',3000000),
('4.1.2','AI Safety & Anomaly Detection (Slaughter & Deboning)','ระบบความปลอดภัยและตรวจจับความผิดปกติ (ชำแหละ/แล่กระดูก)','Slaughterhouse & Meat AI',3000000),
('4.1.3','AI Pork Carcass Grading','ระบบให้เกรดซากสุกร','Slaughterhouse & Meat AI',2000000),
('4.1.4','AI Pork Carcass Defect Detection & Sorting','ระบบตรวจจับตำหนิและคัดแยกซากสุกร','Slaughterhouse & Meat AI',2000000),
('4.1.5','AI Hygiene & PPE Compliance','ระบบตรวจสอบสุขอนามัยและการสวมอุปกรณ์ป้องกัน','Slaughterhouse & Meat AI',1500000),
('4.1.6','AI Live Pig Unloading Quality','ระบบตรวจคุณภาพการขนถ่ายสุกรมีชีวิต','Slaughterhouse & Meat AI',1400000),
('4.1.7','PSE Quality Analytics System','ระบบวิเคราะห์คุณภาพเนื้อ PSE','Slaughterhouse & Meat AI',700000),
('4.1.8','Smart Fire & Hazard Detection','ระบบตรวจจับอัคคีภัยและอันตรายอัจฉริยะ','Slaughterhouse & Meat AI',400000),
('4.2.1','AI Sow & Piglet Health Monitoring','ระบบเฝ้าระวังสุขภาพแม่สุกรและลูกสุกร','Swine Farm AI',2000000),
('4.2.2','AI Gilt Heat Detection','ระบบตรวจจับการเป็นสัดของสุกรสาว','Swine Farm AI',2000000),
('4.2.3','AI Piglet Crushing Prevention','ระบบป้องกันลูกสุกรถูกทับ','Swine Farm AI',1000000),
('4.2.4','AI Pig Weight Estimation','ระบบประเมินน้ำหนักสุกร','Swine Farm AI',1500000),
('4.2.5','AI Swine BCS Assessment','ระบบประเมินสภาพร่างกายสุกร (BCS)','Swine Farm AI',1000000),
('4.2.6','AI Pig Inventory Tracking','ระบบติดตามจำนวนสุกรคงเหลือ','Swine Farm AI',1000000),
('4.2.7','AI Pig Receiving Counter','ระบบนับสุกรขาเข้า','Swine Farm AI',1000000),
('4.2.8','AI Pig Export Counter & Fraud Detection','ระบบนับสุกรส่งออกและตรวจจับการทุจริต','Swine Farm AI',1500000),
('4.3.1','AI Breeder Feeding Behavior','ระบบวิเคราะห์พฤติกรรมการกินของพ่อแม่พันธุ์','Poultry & Hatchery AI',1000000),
('4.3.2','AI Disease Prediction (Breeder)','ระบบพยากรณ์โรคในพ่อแม่พันธุ์','Poultry & Hatchery AI',1000000),
('4.3.3','AI Poultry Droppings Health','ระบบตรวจสุขภาพจากมูลสัตว์ปีก','Poultry & Hatchery AI',1500000),
('4.3.4','Dead-in-Shell Diagnosis AI','ระบบวินิจฉัยไข่ตายในเปลือก','Poultry & Hatchery AI',500000),
('4.3.5','5Star Packing & Weight Compliance','ระบบตรวจสอบการบรรจุและน้ำหนักมาตรฐาน 5 ดาว','Poultry & Hatchery AI',500000),
('4.3.6','Poultry Portioning & Weight System','ระบบแบ่งชิ้นส่วนและชั่งน้ำหนักสัตว์ปีก','Poultry & Hatchery AI',500000),
('4.3.7','5Star Product Loss Prevention','ระบบป้องกันการสูญเสียผลิตภัณฑ์ 5 ดาว','Poultry & Hatchery AI',500000),
('4.4.1','RM Reception & Anti-Fraud AI','ระบบรับวัตถุดิบและป้องกันการทุจริต','Feedmill & Logistics AI',1000000),
('4.4.2','FG Logistics Integrity','ระบบตรวจสอบความถูกต้องโลจิสติกส์สินค้าสำเร็จรูป','Feedmill & Logistics AI',400000),
('4.4.3','Smart HSE Vision','ระบบวิสัยทัศน์ความปลอดภัยอาชีวอนามัย','Feedmill & Logistics AI',400000),
('4.4.4','Auto Production Planning','ระบบวางแผนการผลิตอัตโนมัติ','Feedmill & Logistics AI',400000),
('4.4.5','RM Cost Forecast AI','ระบบพยากรณ์ต้นทุนวัตถุดิบ','Feedmill & Logistics AI',400000),
('4.4.6','Project Management AI','ระบบบริหารจัดการโครงการ','Feedmill & Logistics AI',400000),
('4.4.7','Pellet Line OEE','ระบบวัดประสิทธิภาพสายการผลิตเพลเลท','Feedmill & Logistics AI',400000),
('4.4.8','Smart Energy AI','ระบบบริหารจัดการพลังงานอัจฉริยะ','Feedmill & Logistics AI',400000),
('4.4.9','AI Loading Monitor & Counting','ระบบเฝ้าระวังและนับการขนถ่ายสินค้า','Feedmill & Logistics AI',4000000),
('4.5.1','Aqua Feed Logistics Integrity','ระบบตรวจสอบความถูกต้องโลจิสติกส์อาหารสัตว์น้ำ','Aqua-Feed & Machinery AI',400000),
('4.5.2','Aqua Feed OEE System','ระบบวัดประสิทธิภาพสายการผลิตอาหารสัตว์น้ำ','Aqua-Feed & Machinery AI',400000),
('4.5.3','Predictive Maintenance','ระบบบำรุงรักษาเชิงพยากรณ์เครื่องจักรหลัก','Aqua-Feed & Machinery AI',400000);

insert into public.engineers (name) values
('ธัญพิสิษฐ์ รางแดง'),
('ธีรภัทร สุขวงษ์'),
('รชต สิงห์เขตต์'),
('อมรศักดิ์ สุขแจ่ม'),
('วรากร เชื้อแพ่ง'),
('วัฒนา สุขอยู่');
