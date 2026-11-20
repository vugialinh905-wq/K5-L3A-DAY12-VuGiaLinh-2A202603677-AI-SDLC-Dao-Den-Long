# Changelog

## Phase 4 — Ticket-04 "Bình minh: phát hành v1.0.0" (Contract v1.3)

Luật, số liệu và đầu ra headless **không đổi** so với v1.2.

### Thêm mới
- `bench.js` (benchmark 1280×720, cảnh chuẩn 200 Bóng Mực + 100 đom đóm) và `soak.js` (10 Đêm liên tiếp); `bench.json`, `soak.json` do chính các lệnh tạo ra. `game.contract.json` thêm `bench_cmd`, `soak_cmd`, `contract_version` "1.3".
- Bảng xếp hạng cục bộ (top 10, lưu trên đĩa `data/leaderboard.json`), màn Bảng xếp hạng từ menu, nhập tên sau Bình Minh hoặc khi thua; `node serve.js --export-leaderboard out.json`.
- Tiếp cận: đổi phím (9 hành động, báo trùng, khôi phục mặc định), phụ đề / chỉ báo hình ảnh (Bóng Mực xuất hiện kèm mũi tên, gió sắp thổi, 10 giây cuối, đèn dưới 30 dầu), giảm chuyển động, chữ lớn ×1.25, chữ UI tối thiểu 18 px ở 1280×720.
- Three.js 0.160.0 vendor vào `vendor/` (chạy không cần mạng); `npm run release` tạo zip web tĩnh; README, CREDITS, retro, kịch bản demo.

### Thay đổi hành vi (không đổi luật chơi)
- Phím **↑ ↓** không còn là phím đi mặc định (vẫn gán được); mặc định đi bằng W A S D. Phím cố định: ← → Z C (camera), P (tạm dừng phụ), H (trợ giúp).
- Bảng trợ giúp phím ẩn mặc định, hiện 15 giây đầu mỗi Đêm và bấm H để bật/tắt (trước đây luôn hiện).
- Cỡ chữ HUD và menu tăng để đạt 18 px; màn hình tạm dừng/menu cuộn được khi nội dung dài.
- Thêm rung camera ngắn khi bị đánh / tỏa sáng (tắt được bằng "Giảm chuyển động").
- `serve.js` giờ dựa trên `src/server.js` và có API `/api/leaderboard`. Không có thay đổi phá vỡ tương thích với `headless_cmd`.

### Test
72 test (59 → 72): thêm `tests/phase4.test.js` (bảng xếp hạng, API, xuất, đổi phím, thống kê benchmark, cảnh benchmark, soak). Đổi tên một test: "contract v1.2" → "contract v1.3" (phiên bản contract nâng lên 1.3, tuning không đổi). Không test nào bị skip hay xóa.

## Phase 3 — Ticket-03 "Đèn cạn dầu" (Contract v1.2)

### Thay đổi phá vỡ tương thích (breaking changes)
1. **`game.contract.json`:** `contract_version` `1.2`; `night1/2/3_duration_s` từ 300/330/360 thành **240/270/300**; thêm `fuel_max`, `fuel_decay_per_s`, `fuel_per_mote`, `relight_cost`, `win_ratio`, `drain_per_s`, `low_fuel_threshold`, `capacity_max`.
2. **Luật thắng:** không còn thắng sớm khi thắp đủ đèn. Thắng = còn sống khi hết giờ và số đèn sáng ≥ `ceil(0.6 × tổng)` (3/5, 4/6, 5/7). `game_over.reason`: `dawn_survived` (thắng), `dawn` / `no_flames` (thua); **`all_lit` không còn được phát.**
3. **Mô hình đèn:** đèn sáng có nhiên liệu (100, hao 1/giây), có thể tắt (`lantern_out`), thắp lại chỉ cần 5 đom đóm. Snapshot thêm `lanterns[].fuel`, `ever_lit`, `relit_count`; `player.capacity`.
4. **Tương tác:** bấm Tương tác ở đèn đang sáng chưa đầy dầu là **châm dầu** (`refuel`), không còn bị bỏ qua. Đèn nhận được = chưa sáng hoặc sáng chưa đầy dầu.
5. **Vùng an toàn:** chỉ còn khi `fuel ≥ 30` (trước: mọi đèn sáng). Bóng Mực vào được vùng của đèn yếu.
6. **Bóng Mực:** thêm trạng thái `drain` và hút 5 fuel/giây (`fuel_drain` mỗi 60 tick); bóng `wander` giờ đi tới đèn yếu / đèn tắt gần nhất (trước: lang thang ngẫu nhiên); **hết choáng thì về `wander`** (trước: `chase` nếu ≤ 18 m).
7. **Điểm (thay toàn bộ):** nạp +5/đom đóm (trước +10); thắp lần đầu +100; thắp lại +40; Tỏa Sáng +5 (+15 nếu bóng đang drain); bình minh thắng: +(50 + floor(fuel)) mỗi đèn sáng, +50 mỗi Ngọn Lửa; **bỏ thưởng thời gian** (`per_second_left` = 0).
8. **Sức chứa:** `10 + 2 × successful_lights`, tối đa 20 (trước: cố định 10).
9. **Sự kiện:** thêm `refuel`, `lantern_out`, `fuel_drain`; `lantern_lit` thêm `relight`.
10. **Scenario:** đèn thêm `fuel`, `ever_lit`; `player.successful_lights`; `shades[].target_lantern_id`; đèn `lit: true` không có `fuel` mặc định 100.
11. **Bản web:** thanh dầu và nhấp nháy 1 Hz khi `fuel < 30`; HUD hiển thị mang/sức chứa và mục tiêu "giữ ≥ N đèn"; cài đặt "Bảng màu dễ phân biệt" (lưu được).

### Test thay đổi (không có test nào bị `skip`)
| Test cũ | Xử lý | Lý do |
|---|---|---|
| "contract v1.1: tuning khớp…" | đổi tên và cập nhật thành "contract v1.2" | số liệu và phiên bản contract đổi |
| "bản đồ chuẩn…" | sửa giá trị thời lượng 300/330/360 → 240/270/300 | ticket đổi thời lượng |
| "nạp ánh sáng: …+10/đom đóm +100/đèn" | viết lại: +5/đom đóm, `lantern_lit.relight`, `fuel`, `capacity` | công thức điểm và mô hình đèn mới |
| "tương tác: …chỉ đèn chưa sáng" | viết lại: đèn nhận được gồm cả đèn sáng chưa đầy dầu | luật chọn đèn mới |
| "thắng: điểm = nạp + đèn + giây\*2 + 50\*lửa" | **thay** bằng "không còn thắng sớm" | thắng sớm bị bỏ |
| "thắng kể cả đúng tick hết giờ" | **thay** bằng 3 test bình minh (điểm, ngưỡng theo đêm, `no_flames` ưu tiên) | luật thắng dời sang bình minh |

Các test còn lại của Phase 1–2 (nhặt, lướt, nhảy, rơi, Gió Lạc, Bùa, gió, tạm dừng, tất định, hiệu năng, vùng an toàn lúc thắp...) giữ nguyên và vẫn đạt.

## Phase 2 — Ticket-02 "Ba hòn đảo" (Contract v1.1)
Số liệu và bản đồ chuẩn, Lướt, Gió Lạc, Bùa Gió, rơi khỏi đảo, tạm dừng, cài đặt, âm thanh, HUD. Tag `phase-2`.

## Phase 1 — PRD-0 (Contract v1.0)
Lõi game, headless, bản web 3D. Tag `phase-1`.
