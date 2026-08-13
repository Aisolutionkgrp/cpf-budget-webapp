/* ============================================================
   Cost engine — same formulas as the prototype.
   trip.dates from Postgres date[] arrive as "YYYY-MM-DD" strings.
   ============================================================ */

export const fmtTHB = (n) => "฿" + Math.round(n || 0).toLocaleString("en-US");
export const fmtInt = (n) => Math.round(n || 0).toLocaleString("en-US");
const iso = (d) => d.toISOString().slice(0, 10);

export function daysInclusive(start, end) {
  if (!start || !end) return 0;
  const d = Math.round((new Date(end) - new Date(start)) / 86400000) + 1;
  return d > 0 ? d : 0;
}
export function eachDate(start, end) {
  const out = [];
  if (!start || !end) return out;
  let c = new Date(start);
  const e = new Date(end);
  while (c <= e) { out.push(iso(c)); c = new Date(c.getTime() + 86400000); }
  return out;
}
export const thDay = (isoStr) => new Date(isoStr).getDate();

/* trip = { start_date, end_date, work_days_per_month, engineers: [names],
            allocations: [{ project_code, dates:[iso], people:[names] }] } */
export function computeTripCosts(trip, settings) {
  const tripDays = daysInclusive(trip.start_date, trip.end_date);
  const dailyRate = settings.avg_salary / (trip.work_days_per_month || 1);
  const peopleInTrip = (trip.engineers || []).length;
  const nProjects = (trip.allocations || []).length || 1;

  const perDiemTrip = Math.max(tripDays - 1, 0) * peopleInTrip * settings.per_diem_usd * settings.usd_rate;
  const flightTrip = peopleInTrip * settings.flight_per_person;
  const perDiemEach = perDiemTrip / nProjects;
  const flightEach = flightTrip / nProjects;

  const lines = (trip.allocations || []).map((a) => {
    const nDays = (a.dates || []).length;
    const nPpl = (a.people || []).length;
    const manday = dailyRate * nDays * nPpl;
    return {
      projectCode: a.project_code,
      dates: a.dates || [], nDays, people: a.people || [],
      manday, perDiem: perDiemEach, flight: flightEach,
      total: manday + perDiemEach + flightEach
    };
  });
  return { tripDays, dailyRate, peopleInTrip, nProjects, perDiemTrip, flightTrip, perDiemEach, flightEach, lines };
}

/* Build the per-project rollup used by the Dashboard.
   projects: [{code,name,name_th,category,budget}]
   trips: [{...trip, allocations:[...]}]  (allocations joined in)
   settings: {avg_salary, per_diem_usd, usd_rate, flight_per_person}
   logistics: [{amount}]
   hardware: [{project_code, price, qty}] */
export function buildProjectCosts(projects, trips, settings, logistics, hardware) {
  const map = {};
  projects.forEach((p) => {
    map[p.code] = { ...p, manday: 0, perDiem: 0, flight: 0, logistic: 0, hardware: 0, tripLines: [] };
  });
  trips.forEach((trip) => {
    const c = computeTripCosts(trip, settings);
    c.lines.forEach((ln) => {
      const m = map[ln.projectCode];
      if (!m) return;
      m.manday += ln.manday; m.perDiem += ln.perDiem; m.flight += ln.flight;
      m.tripLines.push({ tripNo: trip.trip_no, ...ln });
    });
  });
  const totalLogistic = logistics.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const logisticPerProject = totalLogistic / (projects.length || 1);
  Object.values(map).forEach((m) => { m.logistic = logisticPerProject; });
  hardware.forEach((h) => {
    if (map[h.project_code]) map[h.project_code].hardware += (Number(h.price) || 0) * (Number(h.qty) || 0);
  });
  Object.values(map).forEach((m) => {
    m.totalCost = m.manday + m.perDiem + m.flight + m.logistic + m.hardware;
    m.profit = m.budget - m.totalCost;
  });
  return map;
}

export const CATEGORIES = [
  "Slaughterhouse & Meat AI",
  "Swine Farm AI",
  "Poultry & Hatchery AI",
  "Feedmill & Logistics AI",
  "Aqua-Feed & Machinery AI"
];
export const CAT_TH = {
  "Slaughterhouse & Meat AI": "โรงเชือด & เนื้อสัตว์",
  "Swine Farm AI": "ฟาร์มสุกร",
  "Poultry & Hatchery AI": "สัตว์ปีก & โรงฟัก",
  "Feedmill & Logistics AI": "โรงอาหารสัตว์ & โลจิสติกส์",
  "Aqua-Feed & Machinery AI": "อาหารสัตว์น้ำ & เครื่องจักร"
};
export const CAT_COLOR = {
  "Slaughterhouse & Meat AI": "#b3261e",
  "Swine Farm AI": "#a15c00",
  "Poultry & Hatchery AI": "#0e7a4d",
  "Feedmill & Logistics AI": "#1f4e5f",
  "Aqua-Feed & Machinery AI": "#5b3a91"
};
