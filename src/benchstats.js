// Thong ke benchmark theo dung dinh nghia Ticket-04 (dt tinh bang ms).
export function computeStats(dts) {
  const N = dts.length;
  const sum = dts.reduce((a, b) => a + b, 0);
  const sorted = [...dts].sort((a, b) => a - b);
  const k = Math.max(1, Math.ceil(0.01 * N));
  const worst = sorted.slice(N - k);
  const p95 = sorted[Math.max(0, Math.ceil(0.95 * N) - 1)];
  const r1 = (n) => Math.round(n * 10) / 10;
  return {
    frames: N,
    avg_fps: r1((1000 * N) / sum),
    p1_low_fps: r1(1000 / (worst.reduce((a, b) => a + b, 0) / worst.length)),
    frame_ms_p95: r1(p95),
  };
}

