# Spec Phase 4 — Ticket-04 "Bình minh: phát hành v1.0.0" (Contract v1.3)

Luật, số liệu và đầu ra headless không đổi so với v1.2. Test: `tests/phase4.test.js`, `tests/headless.test.js`. Bằng chứng số đo: [proof/phase-4.md](../proof/phase-4.md).

| Mục | Tiêu chí nghiệm thu | Kiểm bằng |
|---|---|---|
| **1. Benchmark** | B1. `node bench.js --seed 42 --duration 30 --out bench.json` xong với mã 0, ghi đủ trường (`contract_version "1.3"`, `avg_fps`, `p1_low_fps`, `frame_ms_p95`, `frames`, `load_ms`, `peak_mem_mb`, `vsync_off`, `renderer`, `os`) | chạy thật, [bench.json](../../bench.json) |
| | B2. Cảnh chuẩn: Đêm 1, 200 Bóng Mực `wander` rải đều, 100 đom đóm, L1–L3 sáng fuel 100, Mây đứng yên (0,0,0); tắt sinh thêm / sát thương / nhặt / hao dầu / kết thúc Đêm; bóng vẫn đi theo luật wander | test "canh benchmark" |
| | B3. Camera quay bán kính 30 m, Y = 15, nhìn (0,0,0), bắt đầu (30,15,0), ngược chiều kim đồng hồ, 15 s/vòng; 3 s khởi động rồi đo đúng `--duration` | `runBench()` trong `src/main.js` |
| | B4. Định nghĩa thống kê: `avg_fps = 1000·N/Σdt`; `p1_low_fps` với `k = max(1, ceil(0.01·N))`; `frame_ms_p95` (nearest-rank) | test "thong ke benchmark" |
| | B5. Cửa sổ 1280×720, vsync tắt, `load_ms` từ lúc tiến trình bắt đầu tới khung hình đầu tiên | cờ Chrome trong `bench.js`; `bench.json.window`, `vsync_off` |
| | B6. Ngưỡng: `avg_fps ≥ 60`, `p1_low_fps ≥ 30`, `load_ms ≤ 10000` | bench.json (máy tác giả) |
| **2. Soak** | S1. `node soak.js --seed 7 --nights 10 --out soak.json`: 10 Đêm trong một tiến trình, xoay 1→2→3, Đêm i seed 7+i, input ngẫu nhiên (30 tick đổi hướng; 5% nhảy, 3% lướt, 2% tỏa sáng, 10% tương tác) | test "soak.js" |
| | S2. `crashes = 0` và `mem_end_mb ≤ 1.2 × mem_start_mb` | test + [soak.json](../../soak.json) |
| **3. Bảng xếp hạng** | L1. Nhập tên sau Bình Minh hoặc khi thua ở bất kỳ Đêm nào; tên 3–12 ký tự `[A-Za-z0-9_]` (+ chữ có dấu) | test "ten: 3-12 ky tu", chạy thật trong trình duyệt |
| | L2. Mục `{name, score, nights_won, achieved_at (ISO 8601 có múi giờ), seed}`; top 10; điểm giảm dần, bằng điểm thì ai đạt trước | test "muc luu", "sap xep" |
| | L3. Lưu trên đĩa, còn sau khi tắt mở lại; màn Bảng xếp hạng từ menu | test "API bang xep hang" (đóng rồi mở lại server), ảnh `docs/img/leaderboard.jpg` |
| | L4. `node serve.js --export-leaderboard out.json` → `{"entries": [...]}` đúng thứ tự | test "--export-leaderboard" |
| **4. Tiếp cận** | A1. Đổi phím cho di chuyển (4 hướng), nhảy, lướt, tương tác, tỏa sáng, tạm dừng; báo trùng phím; "Khôi phục mặc định"; được lưu | test "doi phim" + thao tác thật |
| | A2. Chỉ báo hình ảnh: Bóng Mực xuất hiện (mũi tên ở mép), gió sắp thổi, 10 s cuối, đèn fuel < 30 | thao tác thật (proof) |
| | A3. Giảm chuyển động: tắt rung camera và chớp màn hình | `settings.reduceMotion` trong `src/main.js` |
| | A4. Chữ UI ≥ 18 px ở 1280×720; tuỳ chọn chữ lớn ×1.25 | `window.__auditFonts()` trả mảng rỗng (proof) |
| **5. Đóng gói** | P1. Clone sạch → ≤ 3 lệnh → chơi được (Three.js vendor, không cần mạng) | README, `vendor/` |
| | P2. README đủ mục; CHANGELOG 4 phase; CREDITS; LICENSE | các file ở gốc repo |
| | P3. Release v1.0.0 có thư mục web tĩnh (zip) | `npm run release` → `dist/` |
| **6. Contract v1.3** | C1. `contract_version "1.3"`, `bench_cmd`, `soak_cmd`; v1.0–v1.2 giữ nguyên | test "contract v1.3" |
| **7. Retro & demo** | R1. Retro 1–2 trang | [retro.md](../retro.md) |
| | R2. Video `.mp4` < 5 phút | kịch bản [DEMO.md](../demo/DEMO.md); video do tác giả quay |
