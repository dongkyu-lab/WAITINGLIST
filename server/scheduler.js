import { dueSlot, koreaClock, daysLeft } from './dates.js';
export function notificationTargets(companies, today) {
  return companies.filter(c => { const d=daysLeft(c.endDate,today); return d !== null && d >= 0 && d <= 7; });
}
export function createScheduler(db) {
  async function tick(now = new Date()) {
    const slot=dueSlot(now), {today}=koreaClock(now);
    if(!slot) return;
    const targets=notificationTargets(db.prepare('SELECT * FROM companies').all(),today);
    if(targets.length) db.prepare('INSERT OR IGNORE INTO notifications(slot,payload,createdAt) VALUES(?,?,?)').run(slot,JSON.stringify(targets.map(c=>({id:c.id,name:c.name,endDate:c.endDate,days:daysLeft(c.endDate,today)}))),now.toISOString());
  }
  return {tick};
}
