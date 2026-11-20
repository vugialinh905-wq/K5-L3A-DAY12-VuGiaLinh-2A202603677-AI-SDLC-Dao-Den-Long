# Spec Phase 2 — Ticket-02 "Ba hòn đảo" (Contract v1.1)

> **Đã bị Ticket-03 thay thế một phần:** luật thắng, điểm, thời lượng Đêm, sức chứa, vùng an toàn và hành vi `wander` (mục A5–A7, A12–A13 ở dưới). Xem [spec Phase 3](phase-3.md) và [CHANGELOG](../../CHANGELOG.md). Test tương ứng đã được thay có lý do.

Mỗi mục có tiêu chí nghiệm thu (AC) kiểm được, kèm test (`tests/headless.test.js`, tìm theo tên) hoặc cách kiểm thủ công trên bản web.

## A. Số liệu chuẩn (Phần 1)
| AC | Kiểm bằng |
|---|---|
| A1. `game.contract.json` có `contract_version: "1.1"`, tuning khớp số chuẩn và có `dash_speed`, `dash_duration_s`, `dash_cooldown_s`, `night2_duration_s`, `night3_duration_s` | test "contract v1.1" (so khớp với `TUNING` trong `src/core.js`) |
| A2. Chạy 6.0 m/s, đạt tốc độ tối đa ≤ 0.1 s; vector > 1 được chuẩn hóa | test "Tốc độ chạy" |
| A3. Nhảy 7.0 m/s, trọng lực 20, chỉ nhảy khi chạm đất | test "Nhảy" |
| A4. Lướt 14 m/s × 12 tick, hồi 90 tick tính từ lúc bắt đầu; hướng = hướng đi, đứng yên thì hướng mặt; giữ độ cao; không bất tử | 2 test "Lướt" |
| A5. Đom đóm: sức chứa 10, nhặt ≤ 1.0 m XZ và chênh cao ≤ 1.5; 20 lúc đầu ở 20 điểm khác nhau; +1 mỗi 240 tick tới trần 30 | test "Nhặt", "Sức chứa", "đom đóm: 1 con mỗi 240 tick", snapshot tick 0 |
| A6. Đèn: chi phí 10, nạp nhiều lần, nhớ tiến độ, bán kính 2.0, chọn đèn gần nhất (hòa → id nhỏ) | test "Nạp ánh sáng", "Tương tác" |
| A7. Vùng an toàn 6 m chặn bóng ngoài; bóng trong lúc thắp bị đẩy ra ≤ 30 tick, không gây sát thương | test "vùng an toàn" |
| A8. Tỏa Sáng: 3 đom đóm, 5 m 3D từ chân+0.8, hồi 180 tick, choáng 120 tick, đẩy 4 m trong 15 tick, làm mới được | 2 test "Tỏa Sáng" |
| A9. Bóng Mực: 4.0 m/s (Đêm 3: 4.5), phát hiện 12 / bỏ đuổi 18, chạm ≤ 1.0 m XZ & cao ≤ 1.5, ≤ 1 lần/tick, lùi 2 m/60 tick, chạm lúc bất tử không làm gì | test "Bóng Mực: phát hiện", "Bị Bóng Mực chạm", "chỉ mất tối đa 1 lửa" |
| A10. Bị đánh: −1 lửa, rơi floor(mang/2) vành 1.5–2.5 m tồn tại 480 tick, bất tử 90 tick | test "Bị Bóng Mực chạm", "đom đóm rơi ... 480 tick" |
| A11. Rơi (Y < −10): đúng 1 lần, −1 lửa, mất hết đom đóm, chờ 60 tick rồi hồi sinh tại xuất phát, vận tốc 0, bất tử 90; hết lửa thì thua ngay | 2 test "rơi khỏi đảo" |
| A12. Thời gian 300/330/360; thắng/thua theo đúng thứ tự (hết lửa luôn thua; thắng kể cả đúng tick hết giờ) | test "bản đồ chuẩn", "thắng kể cả đúng tick", "hết lửa luôn thua" |
| A13. Điểm: +10/đom đóm nạp, +100/đèn, +5/bóng trúng Tỏa Sáng, thắng: floor(giây còn)×2 + 50×lửa | test "thắng: điểm = ...", "Tỏa Sáng" |
| A14. Thứ tự xử lý 12 bước trong tick đúng như ticket | cấu trúc `step()` trong `src/core.js` có đánh số bước 1–11; tạm dừng test bước 1 |

## B. Bản đồ chuẩn (Phần 2)
| AC | Kiểm bằng |
|---|---|
| B1. Đêm 1: đảo bán kính 40, 5 đèn đúng tọa độ, 24 điểm đom đóm (8 + 16), 12 điểm bóng bán kính 37; bóng sinh ≥ 15 m người chơi | test "bản đồ chuẩn", "lịch sinh Bóng Mực" |
| B2. Đêm 2: hai đảo r28 tâm (0,0,0) và (70,0,0), cầu tre x∈[26,44], |z|≤2, không lan can; 6 đèn; bục nhảy bay sang đảo kia (~1.4 s) | test "Đêm 2: cầu tre đi được; bục nhảy" |
| B3. Đêm 3: đảo r45, tầng 1 (Y=3) vành 12–24 nửa z>0, tầng 2 (Y=6) đĩa r8, vách đứng chặn, 2 dốc 30°/150°, bục (0,3,13) → tầng 2, tháp chuông r2 chặn đường, 7 đèn | test "Đêm 3: dốc, vách, bục nhảy", "tháp chuông" |
| B4. Gió mạnh Đêm 3: mỗi 30 s kéo dài 5 s, báo trước 2 s, đẩy 2 m/s, `wind` trong snapshot | test "Gió mạnh" (snapshot) + lá bay và âm thanh trên bản web |

## C. Tính năng mới (Phần 3)
| Mục | Tiêu chí nghiệm thu | Kiểm bằng |
|---|---|---|
| **Gió Lạc** | C1. Idle lượn 2 m/s → chase khi mang ≥ 5 và cách ≤ 15 m (kiểm tra mỗi tick), mất điều kiện thì về idle | test "Gió Lạc: đuổi ..." |
| | C2. Chạm ≤ 1.2 m XZ: cướp min(3, đang mang), `drifter_steal`, chuyển flee 240 tick rồi biến mất cùng số đã cướp; không mất Ngọn Lửa | cùng test |
| | C3. Tỏa Sáng trúng khi chase → flee không cướp; trúng khi flee có đồ → `drifter_drop`, thả đom đóm tại chỗ, biến mất sau 120 tick | test "Gió Lạc: Tỏa Sáng ..." |
| | C4. Tối đa 2 con, sinh tick 1200, 2400…; id D1, D2…; chỉ Đêm 2 và 3 | test "Gió Lạc: lịch sinh" |
| **Bùa Gió** | C5. Nhặt như đom đóm, hiệu lực 600 tick (nhặt lại làm mới), chạy 7.2 m/s, Lướt không hồi chiêu nhưng vẫn cần bấm lại, bấm khi đang lướt bị bỏ qua | test "Bùa Gió" (3 phần) |
| | C6. Xuất hiện lại sau 2700 tick; vị trí Đêm 2 (35,0,0), Đêm 3 (30,0,25) và (−30,0,25) | test "Bùa Gió", "bản đồ chuẩn" |
| **Chuỗi 3 Đêm** | C7. Menu → giới thiệu Đêm (tên đảo, lời Ông Đăng) → chơi → kết quả → Đêm kế tiếp; thắng Đêm 3 ra màn Bình Minh với tổng điểm; thua thì chơi lại đúng Đêm đó | thủ công trên web (đã chạy: thắng Đêm 1 → intro Đêm 2; thắng Đêm 3 → Bình Minh 1614 điểm; thua Đêm 2 → "Chơi lại Đêm 2") |
| **Tạm dừng** | C8. Esc/P dừng hoàn toàn logic; `sim_tick`, thời gian, hồi chiêu, spawn, TTL đứng yên; snapshot `state: "paused"`; menu Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu | test "Tạm dừng", test "không thay đổi hành vi ..."; web: đồng hồ đứng khi pause |
| **Cài đặt** | C9. Âm lượng và độ nhạy chuột chỉnh được và lưu giữa các lần mở (localStorage) | thủ công: chỉnh thanh trượt rồi kiểm `localStorage.ddl_settings` |
| **Âm thanh** | C10. Nhạc nền đêm và hiệu ứng: nhặt, thắp đèn, tỏa sáng, bị đánh, nhảy, lướt, thắng, thua, Bóng Mực xuất hiện, đếm ngược 10 s cuối (cả cướp, bùa, gió) | `src/audio.js` (tổng hợp WebAudio, bật sau lần click đầu); kiểm bằng tai trên máy thật |
| **HUD** | C11. Ngọn Lửa (trên trái), đồng hồ mm:ss đổi đỏ và nhấp nháy ≤ 30 s (trên giữa), đèn k/n + điểm (trên phải), thanh 10 ô đom đóm (dưới giữa), hồi chiêu Lướt/Tỏa Sáng (dưới phải), nhắc "E — Nạp ánh sáng (x/10)" gần đèn, mũi tên tới đèn chưa sáng gần nhất khi ngoài màn hình | thủ công (xem docs/proof/phase-2.md) |
| **Bảng màu** | C12. Dùng đúng mã màu chuẩn cho trời, sương, cỏ, cát, gỗ, biển mây, đèn, đom đóm, Bóng Mực, áo/khăn Mây, bùa, viền vàng, Gió Lạc, UI; ánh sáng môi trường = 0.15 + 0.55 × (đèn sáng / tổng) | `PAL` trong `src/world.js`, biến CSS trong `index.html`, `syncViews` trong `src/main.js` |

## D. Test Contract v1.1 (Phần 4)
- D1. `--night` nhận 1, 2, 3; giá trị khác thoát mã ≠ 0 (test "file sai định dạng ...").
- D2. Snapshot thêm `night`, `wind {active, dir_deg}`, `player.{vel, grounded, invuln, dash_cd_s, pulse_cd_s, charm_s}`, mảng `motes` (`kind`, `ttl_s`), `drifters`, `charms` (test "snapshot tick 0").
- D3. Scenario thêm `player.{invuln_ticks, dash_cd_ticks, pulse_cd_ticks, charm_ticks}`, `shades[].{state, state_ticks_left}`, `drifters`, `charms`, `random_drifters`, `wind_enabled`; input thêm `dash`, `pause`.
- D4. Sự kiện mới `dash`, `charm_picked`, `drifter_steal`, `drifter_drop`, `night_start`, `paused`, `resumed`; `player_hit` do rơi có `lost`.
- D5. Trạng thái Bóng Mực dùng đúng tên: `spawning`, `wander`, `chase`, `recoil`, `stunned`.
- D6. Một Đêm đầy đủ 21 600 tick chạy ≤ 30 s (thực tế ~0.2 s; test "hiệu năng").
- D7. Tất định cho cả 3 Đêm (test "tất định").
