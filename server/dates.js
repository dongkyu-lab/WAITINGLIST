export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
export function addDays(value, days) {
  if (!validDate(value)) throw new Error('올바른 날짜를 입력해 주세요.');
  const date = new Date(value + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function koreaClock(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).formatToParts(now).map(p=>[p.type,p.value]));
  return { today: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), minute: Number(parts.minute) };
}
export function daysLeft(end, today = koreaClock().today) {
  if (!validDate(end)) return null;
  return Math.round((Date.parse(end) - Date.parse(today)) / 86400000);
}
export function statusFor(end, today) {
  const days = daysLeft(end, today);
  if (days === null) return 'unset';
  if (days < 0) return 'ended';
  if (days <= 3) return 'urgent';
  if (days <= 5) return 'soon';
  if (days <= 7) return 'upcoming';
  return 'active';
}
export function dueSlot(now = new Date()) {
  const clock = koreaClock(now);
  return [9,12,15].includes(clock.hour) ? `${clock.today}/${clock.hour}` : null;
}
