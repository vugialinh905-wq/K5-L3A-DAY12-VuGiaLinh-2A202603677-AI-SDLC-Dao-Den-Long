// Gan phim (doi phim). Thuan JS, khong phu thuoc DOM => test duoc bang Node.
export const ACTIONS = [
  { id: 'forward', label: 'Đi lên', def: 'KeyW' },
  { id: 'back', label: 'Đi xuống', def: 'KeyS' },
  { id: 'left', label: 'Đi trái', def: 'KeyA' },
  { id: 'right', label: 'Đi phải', def: 'KeyD' },
  { id: 'jump', label: 'Nhảy', def: 'Space' },
  { id: 'dash', label: 'Lướt', def: 'ShiftLeft' },
  { id: 'interact', label: 'Tương tác (nạp / châm dầu)', def: 'KeyE' },
  { id: 'pulse', label: 'Tỏa Sáng', def: 'KeyF' },
  { id: 'pause', label: 'Tạm dừng', def: 'Escape' },
];

// Phim co dinh, khong doi duoc: xoay camera va P (phim phu cua Tam dung)
export const RESERVED = { ArrowLeft: 'Xoay camera trái', ArrowRight: 'Xoay camera phải', KeyZ: 'Xoay camera trái', KeyC: 'Xoay camera phải', KeyP: 'Tạm dừng (phím phụ)', KeyH: 'Hiện/ẩn trợ giúp' };

export const defaultBindings = () => Object.fromEntries(ACTIONS.map((a) => [a.id, a.def]));
export const actionLabel = (id) => ACTIONS.find((a) => a.id === id)?.label ?? id;
export const normalizeCode = (code) => (code === 'ShiftRight' ? 'ShiftLeft' : code === 'ControlRight' ? 'ControlLeft' : code === 'AltRight' ? 'AltLeft' : code);

// Tra ve ten hanh dong dang dung phim nay (hoac phim co dinh), null neu trong
export function findConflict(bindings, actionId, code) {
  const c = normalizeCode(code);
  if (RESERVED[c] && !(actionId === 'pause' && c === 'KeyP')) return RESERVED[c];
  for (const a of ACTIONS) if (a.id !== actionId && bindings[a.id] === c) return actionLabel(a.id);
  return null;
}

// Doi phim: khong ap dung neu trung, de giao dien bao cho nguoi dung
export function rebind(bindings, actionId, code) {
  const c = normalizeCode(code);
  if (!ACTIONS.some((a) => a.id === actionId)) return { ok: false, bindings, conflict: null, error: 'Hành động không tồn tại' };
  const conflict = findConflict(bindings, actionId, c);
  if (conflict) return { ok: false, bindings, conflict };
  return { ok: true, bindings: { ...bindings, [actionId]: c }, conflict: null };
}

// Doc tu luu tru: thieu thi lay mac dinh; neu bi trung hoac sai thi quay ve mac dinh toan bo
export function loadBindings(raw) {
  const out = defaultBindings();
  if (raw && typeof raw === 'object') {
    for (const a of ACTIONS) if (typeof raw[a.id] === 'string' && /^[A-Za-z0-9]+$/.test(raw[a.id])) out[a.id] = normalizeCode(raw[a.id]);
  }
  const used = new Set();
  for (const a of ACTIONS) {
    if (used.has(out[a.id]) || RESERVED[out[a.id]]) return defaultBindings();
    used.add(out[a.id]);
  }
  return out;
}

const NAMES = { Space: 'Space', ShiftLeft: 'Shift', ControlLeft: 'Ctrl', AltLeft: 'Alt', Escape: 'Esc', Enter: 'Enter', Tab: 'Tab', Backspace: '⌫',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=' };
export function keyLabel(code) {
  if (NAMES[code]) return NAMES[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^Numpad/.test(code)) return 'Num ' + code.slice(6);
  return code;
}
