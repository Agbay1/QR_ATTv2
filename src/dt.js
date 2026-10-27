// Date / time helpers. The database keeps 24-hour times; the UI shows regular 12-hour time.
// All events are on Philippine time (Asia/Manila, UTC+8, no daylight saving) - same as the SQL.
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const pad = (n) => String(n).padStart(2, '0');

export function parseDate(s) {                      // 'YYYY-MM-DD' -> local Date (or null)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '').trim());
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3], dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d ? dt : null;
}
export const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function fmtDate(s, short) {                 // '2026-10-21' -> 'Wed, Oct 21, 2026' (short: 'Oct 21, 2026')
  const d = parseDate(String(s || '').slice(0, 10));
  return d ? `${short ? '' : DAY[d.getDay()] + ', '}${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` : String(s || '');
}

// '14:30' / '14:30:00' (from the database) -> '2:30 PM'
export function t12(s) {
  const [h, m] = String(s || '').split(':'), H = Number(h);
  if (!h || isNaN(H) || m === undefined) return '';
  return `${H % 12 || 12}:${m.slice(0, 2)} ${H < 12 ? 'AM' : 'PM'}`;
}
// Typed text -> 'HH:MM' (24h) | null (invalid) | 'AMBIG' (like "2:30" with no AM/PM)
export function parseTime(s) {
  const t = String(s || '').trim().toLowerCase().replace(/^(\d{1,2}:\d{2}):\d{2}/, '$1');
  const m = /^(\d{1,2})(?::?(\d{2}))?\s*([ap])?\.?m?\.?$/.exec(t);
  if (!m) return null;
  const h = Number(m[1]), mi = m[2] === undefined ? 0 : Number(m[2]), ap = m[3];
  if (mi > 59) return null;
  if (ap) { if (h < 1 || h > 12) return null; return `${pad((h % 12) + (ap === 'p' ? 12 : 0))}:${pad(mi)}`; }
  if (h > 23) return null;
  if (h === 0 || h >= 13) return `${pad(h)}:${pad(mi)}`;      // clearly 24-hour (13:00, 00:30)
  return 'AMBIG';
}

// Manila-time helpers (events store date + time; end_at is a real timestamp)
export const manilaMs = (date, hm) => new Date(`${date}T${hm}:00+08:00`).getTime();
export const manilaParts = (iso) => { const x = new Date(new Date(iso).getTime() + 8 * 3600000).toISOString(); return { date: x.slice(0, 10), time: x.slice(11, 16) }; };
// 'closed' automatically once the end time has passed (server also closes it)
export const effStatus = (e) => (e.status === 'open' && e.end_at && new Date(e.end_at).getTime() <= Date.now() ? 'closed' : e.status);
export const fmtRange = (e) => t12(e.event_time) + (e.end_at ? ' – ' + t12(manilaParts(e.end_at).time) : '');

// Ticket stub parts: '2026-10-21' -> { mon: 'Oct', day: '21', dow: 'Wed' }
export function dayParts(s) {
  const d = parseDate(String(s || '').slice(0, 10));
  return d ? { mon: MON[d.getMonth()], day: String(d.getDate()), dow: DAY[d.getDay()] } : { mon: '', day: '–', dow: '' };
}
