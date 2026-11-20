---
name: perf-check
description: Đo và đọc benchmark (bench.js) và soak test (soak.js) của Đảo Đèn Lồng. Dùng sau khi đổi phần vẽ, thêm thực thể, hoặc trước khi phát hành để kiểm ngưỡng của Ticket-04.
---

# Đo hiệu năng và ổn định

1. **Soak (nhanh, ~0.5 s):** `node soak.js --seed 7 --nights 10 --out soak.json`. Đạt khi `crashes = 0` và `mem_end_mb ≤ 1.2 × mem_start_mb`. Nếu tỉ lệ cao: so `heap_start_mb`/`heap_end_mb` — heap phẳng thì chỉ là RSS khởi động (đã làm nóng JIT trong `warmUp`), heap tăng đều mới là rò rỉ (thường do tích sự kiện/snapshot hoặc mảng không dọn).
2. **Benchmark (~40 s, mở Chrome):** `node bench.js --seed 42 --duration 30 --out bench.json`. Ngưỡng: `avg_fps ≥ 60`, `p1_low_fps ≥ 30`, `load_ms ≤ 10000`. Đóng các cửa sổ nặng trước khi đo, cắm nguồn, và chạy 2–3 lần vì số đo dao động. Không có Chrome: `--manual`.
3. **Cảnh bench là cảnh chuẩn:** đừng đổi `createBenchGame`/`benchStep` (200 bóng, 100 đom đóm, L1–L3). Phần trang trí sáng tạo phải tắt qua `buildWorld(..., { bench: true })`; thêm hiệu ứng mới thì kiểm nó có bị tắt trong bench.
4. **Nếu FPS thấp:** thủ phạm thường là số mesh riêng (mỗi Bóng Mực vài mesh) và đèn điểm; hướng sửa là `InstancedMesh` cho Bóng Mực hoặc giảm số `PointLight`.
5. Commit `bench.json`/`soak.json` chỉ khi do chính lệnh trên tạo ra.
