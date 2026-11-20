// Bang xep hang cuc bo (top 10). Thuan JS, KHONG import module Node => dung chung cho server va trinh duyet.
export const MAX_ENTRIES = 10;
export const NAME_MIN = 3;
export const NAME_MAX = 12;
// Ky tu hop le: chu cai (ke ca tieng Viet co dau), chu so, gach duoi
const NAME_RE = /^[\p{L}\p{M}0-9_]+$/u;

export const normalizeName = (name) => String(name ?? '').normalize('NFC').trim();

export function validateName(name) {
  const n = normalizeName(name);
  const len = [...n].length;
  if (len < NAME_MIN || len > NAME_MAX) return { ok: false, reason: `Tên phải dài ${NAME_MIN}–${NAME_MAX} ký tự.` };
  if (!NAME_RE.test(n)) return { ok: false, reason: 'Tên chỉ gồm chữ cái (có dấu được), số và dấu gạch dưới _.' };
  return { ok: true, name: n };
}

// ISO 8601 co mui gio dia phuong, vi du 2026-11-20T15:03:00.123+07:00
export function isoWithOffset(d = new Date()) {
  const p = (n, w = 2) => String(Math.abs(n)).padStart(w, '0');
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}${sign}${p(Math.floor(Math.abs(off) / 60))}:${p(Math.abs(off) % 60)}`;
}

const isInt = (v) => Number.isInteger(v);

export function makeEntry({ name, score, nights_won, seed }, now = new Date()) {
  const v = validateName(name);
  if (!v.ok) throw new RangeError(v.reason);
  if (!isInt(score) || score < 0) throw new RangeError('score phải là số nguyên ≥ 0');
  if (!isInt(nights_won) || nights_won < 0 || nights_won > 3) throw new RangeError('nights_won phải trong 0–3');
  if (!isInt(seed)) throw new RangeError('seed phải là số nguyên');
  return { name: v.name, score, nights_won, achieved_at: isoWithOffset(now), seed };
}

// Diem giam dan; bang diem thi ai dat truoc dung tren
export function compareEntries(a, b) {
  if (b.score !== a.score) return b.score - a.score;
  return Date.parse(a.achieved_at) - Date.parse(b.achieved_at);
}

function sortTop(list) {
  return list.map((e, i) => ({ e, i })).sort((x, y) => compareEntries(x.e, y.e) || x.i - y.i).map((x) => x.e).slice(0, MAX_ENTRIES);
}

export function addEntry(entries, entry) {
  const top = sortTop([...entries, entry]);
  return { entries: top, rank: top.indexOf(entry) }; // rank -1 neu khong vao top 10
}

const validShape = (e) => e && typeof e === 'object' && validateName(e.name).ok && isInt(e.score) && e.score >= 0
  && isInt(e.nights_won) && e.nights_won >= 0 && e.nights_won <= 3 && typeof e.achieved_at === 'string'
  && !Number.isNaN(Date.parse(e.achieved_at)) && isInt(e.seed);

// Loc muc hong / sai dinh dang (file bi sua tay) va sap xep lai
export function sanitizeEntries(raw) {
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.entries) ? raw.entries : [];
  return sortTop(list.filter(validShape).map((e) => ({ name: normalizeName(e.name), score: e.score, nights_won: e.nights_won, achieved_at: e.achieved_at, seed: e.seed })));
}
