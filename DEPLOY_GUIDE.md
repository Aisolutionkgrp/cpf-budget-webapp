# คู่มือ Deploy — CPF Budget Control (Next.js + Supabase + Vercel)

ระบบนี้มี 3 สิทธิ์: **PM** (กรอกทริปเพิ่มอย่างเดียว), **Admin** (แก้/ลบได้ทุกอย่าง), **Executive** (ดู Dashboard อย่างเดียว — เป็นสิทธิ์ default ของทุกคนที่สมัครใหม่)

---

## ขั้นที่ 1 — สร้างโปรเจค Supabase (ฐานข้อมูล + Auth)

1. ไปที่ https://supabase.com → สมัคร/ล็อกอิน → **New project**
2. ตั้งชื่อโปรเจค เช่น `cpf-budget` เลือก region ใกล้ที่สุด (Singapore) ตั้งรหัสผ่าน DB แล้วรอสร้างโปรเจคสัก 1-2 นาที
3. ไปที่เมนู **SQL Editor** (แถบซ้าย) → New query
4. เปิดไฟล์ `supabase/schema.sql` ที่แนบมา คัดลอกทั้งหมด วางในช่อง SQL Editor แล้วกด **Run**
   - จะสร้างตารางทั้งหมด, RLS policies, และ seed ข้อมูล 35 โครงการ + วิศวกร 6 คนให้อัตโนมัติ
5. ไปที่เมนู **Project Settings → API** — คัดลอก 2 ค่านี้เก็บไว้ใช้ในขั้นตอนถัดไป:
   - **Project URL** (เช่น `https://xxxx.supabase.co`)
   - **anon public key** (กุญแจสาธารณะ ใช้ฝั่ง client ได้ปลอดภัยเพราะมี RLS ป้องกันอยู่แล้ว)

---

## ขั้นที่ 2 — สร้างบัญชีผู้ใช้ + กำหนดสิทธิ์

1. ไปที่เมนู **Authentication → Users → Add user → Create new user**
   - สร้างบัญชีให้ PM คนเดียว (เช่น `pm@cpf.co.th`) และ Admin อย่างน้อย 1 คน (เช่น `admin@cpf.co.th`)
   - ตั้งรหัสผ่านให้แต่ละคน (หรือใช้ "Send invite" ให้ผู้ใช้ตั้งรหัสเอง)
   - ผู้บริหารที่ต้องการดู Dashboard ก็สร้างบัญชีแบบเดียวกัน — ไม่ต้องทำอะไรเพิ่ม เพราะ role default คือ `executive` อยู่แล้ว
2. พอสร้าง user แล้ว ระบบจะสร้างแถวใน `profiles` ให้อัตโนมัติ (role = `executive`) — ต้องไปอัปเกรด role ให้ PM และ Admin ด้วยมือ:
   - ไปที่ **SQL Editor** รันคำสั่ง (แก้อีเมลให้ตรงของจริง):
   ```sql
   update public.profiles set role = 'pm'
   where id = (select id from auth.users where email = 'pm@cpf.co.th');

   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'admin@cpf.co.th');
   ```
3. เท่านี้ระบบสิทธิ์ก็พร้อมใช้งาน — ทุกครั้งที่มีผู้ใช้ใหม่ (เช่น ผู้บริหารเพิ่มคน) ทำซ้ำแค่ขั้นตอนที่ 1 (สร้าง user) พอ ไม่ต้องรัน SQL เพิ่มถ้าต้องการแค่สิทธิ์ดูอย่างเดียว

---

## ขั้นที่ 3 — รันทดสอบในเครื่องตัวเอง (ไม่บังคับ แต่แนะนำ)

```bash
cd cpf-webapp
npm install
cp .env.local.example .env.local
```
เปิดไฟล์ `.env.local` แล้วใส่ค่าที่คัดลอกจาก Supabase (ขั้นที่ 1 ข้อ 5):
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxxxxxxxxxxxxx
```
แล้วรัน:
```bash
npm run dev
```
เปิด http://localhost:3000 ล็อกอินด้วยบัญชีที่สร้างไว้ ทดสอบทั้ง 3 role ก่อน deploy จริง

---

## ขั้นที่ 4 — Deploy ขึ้น Vercel

**วิธีที่ง่ายที่สุด — ผ่าน GitHub:**

1. สร้าง repo ใหม่บน GitHub แล้ว push โค้ดทั้งโฟลเดอร์ `cpf-webapp` ขึ้นไป
   ```bash
   cd cpf-webapp
   git init
   git add .
   git commit -m "initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/cpf-budget.git
   git push -u origin main
   ```
2. ไปที่ https://vercel.com → สมัคร/ล็อกอินด้วย GitHub → **Add New → Project**
3. เลือก repo `cpf-budget` ที่เพิ่ง push → กด **Import**
4. ในหน้า Configure Project → เปิด **Environment Variables** ใส่ 2 ตัวเดียวกับที่ใช้ตอน dev:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. กด **Deploy** — รอสัก 1-2 นาที จะได้ URL จริง เช่น `https://cpf-budget.vercel.app`

**ไม่มี GitHub ก็ deploy ได้ผ่าน CLI:**
```bash
npm i -g vercel
cd cpf-webapp
vercel login
vercel --prod
```
ระบบจะถามค่า environment variables ระหว่างขั้นตอน deploy ใส่ค่าเดียวกับข้างต้น

---

## ขั้นที่ 5 — ทดสอบเว็บจริง

1. เปิด URL ที่ได้จาก Vercel
2. ล็อกอินด้วยบัญชี PM → เข้าหน้า "PM — กรอกทริป" ได้ / หน้า Admin ควรถูกเด้งกลับ Dashboard
3. ล็อกอินด้วยบัญชี Admin → เข้าได้ทั้ง 3 หน้า แก้ไข/ลบทริปได้
4. ล็อกอินด้วยบัญชีผู้บริหาร (role executive) → เห็นแค่ Dashboard อย่างเดียว

---

## โครงสร้างไฟล์สำคัญ

```
cpf-webapp/
  supabase/schema.sql       ← รันครั้งเดียวใน Supabase SQL Editor
  lib/costEngine.js         ← สูตรคำนวณต้นทุน (แมนเดย์/เบี้ยเลี้ยง/ตั๋ว/logistic/hardware)
  lib/supabaseClient.js     ← client ฝั่ง browser
  lib/supabaseServer.js     ← client ฝั่ง server (สำหรับอ่าน role ตอน render หน้า)
  middleware.js             ← เช็ค login + เด้งตาม role (กัน PM เข้า /admin เป็นต้น)
  components/TripForm.jsx   ← ฟอร์มทริป ใช้ร่วมกันทั้งหน้า PM (เพิ่ม) และ Admin (แก้)
  components/Header.jsx     ← แถบบนสุด + ปุ่ม logout
  app/dashboard/            ← หน้า Dashboard (ทุก role เข้าได้)
  app/pm/                   ← หน้า PM (เฉพาะ role pm, admin)
  app/admin/                ← หน้า Admin (เฉพาะ role admin)
  app/login/                ← หน้า login
```

## ความปลอดภัยที่ระบบมีให้แล้ว

- **Row Level Security (RLS)** ที่ฝัง DB โดยตรง — แม้แต่ถ้ามีคนแก้โค้ด frontend หรือยิง API ตรง ๆ ก็ยังถูกบล็อกตามสิทธิ์ เพราะ policy บังคับที่ database เอง ไม่ใช่แค่ที่ frontend
- **Middleware** เช็ค role ก่อนโหลดหน้า `/pm` และ `/admin` เด้งกลับถ้าไม่มีสิทธิ์
- **anon key** ปลอดภัยที่จะฝัง frontend ได้ เพราะทุก query ต้องผ่าน RLS อยู่ดี

## หมายเหตุเรื่องอัปเดตแพ็กเกจ

โปรเจคนี้ pin Next.js ไว้ที่เวอร์ชัน patched ล่าสุดของสาย 14.2.x (ปลอดภัยสำหรับใช้งานทั่วไปบน Vercel) แนะนำให้รัน `npm audit` และ `npm outdated` เป็นระยะเพื่อเช็คอัปเดตความปลอดภัย ถ้าจะอัปเกรดเป็น Next.js 15/16 ในอนาคต ต้องปรับโค้ดใน `lib/supabaseServer.js` และ `middleware.js` เพราะ API `cookies()` เปลี่ยนเป็น async ในเวอร์ชันใหม่กว่า

## ถ้าอยากปรับต่อ (ยังไม่ได้ทำในเวอร์ชันนี้)

- ตัวกรองช่วงวันที่ใน Dashboard (ดูเฉพาะไตรมาส/เดือน)
- Export เป็น Excel/PDF
- แจ้งเตือน (เช่น อีเมล) เมื่อโครงการใกล้ขาดทุน
- ประวัติการแก้ไข (audit log) เมื่อ Admin แก้ข้อมูล
