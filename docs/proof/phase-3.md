# Bằng chứng Phase 3

Chạy lại tại tag `phase-3`: `npm test` → **59 test, 0 lỗi, 0 skip**. Mỗi test chạy CLI headless thật (`node src/headless.js`) rồi đọc JSONL. Tiêu chí nghiệm thu theo từng mục: [docs/spec/phase-3.md](../spec/phase-3.md). Thay đổi phá vỡ tương thích và lý do đổi từng test: [CHANGELOG.md](../../CHANGELOG.md).

## Regression Phase 1–2 (các luật không bị thay thế)
Giữ nguyên và vẫn đạt: nhặt đom đóm (tầm, chênh cao, sức chứa nền), chạy/nhảy/lướt, tỏa sáng (tầm, hồi, choáng, đẩy lùi), bị Bóng Mực chạm (rơi đồ, bất tử, lùi), rơi khỏi đảo và hồi sinh, 3 bản đồ (cầu, bục, dốc, vách, tháp), gió, Gió Lạc, Bùa Gió, tạm dừng, tất định cả 3 Đêm, hiệu năng (21 600 tick ≈ 0.2 s), lỗi file → exit 2. Phần bị thay thế: xem bảng "Test thay đổi" trong CHANGELOG (6 test, không test nào bị `skip` hay xóa im lặng).

## Kết quả theo yêu cầu
| Yêu cầu | Cách kiểm chứng | Kết quả |
|---|---|---|
| Contract v1.2 (phiên bản, khóa mới, thời lượng 240/270/300, điểm) | test "contract v1.2" so với `TUNING` | đạt |
| Snapshot/scenario mới; `lit:true` không `fuel` → 100; đèn đặt sẵn không tính `successful_lights` | test "snapshot v1.2" | đạt |
| Hao dầu 1.0/giây | test "hao dầu": 600 tick → 90.0 | đạt |
| Hết dầu → tắt đúng tick 30, `deposited` 0, `ever_lit`, `lantern_out`; thắp lại 5 | test "hết dầu" | đạt |
| Thắp lại +40, không +100; `relight`; `relit_count`; sức chứa | test "thắp lại", "nạp ánh sáng" | đạt |
| Châm dầu: `used`, `fuel`, điểm, trường hợp mang 0 | test "châm dầu" (4 ca) + "dầu hao trước Tương tác" | đạt |
| Chọn đèn khi tương tác (gần nhất, id nhỏ, đèn sáng chưa đầy) | test "tương tác" | đạt |
| Sức chứa 10 + 2n, tối đa 20, nhặt đúng trần | test "Sức chứa tăng dần" | đạt |
| Vùng an toàn: đúng 30 còn, 29.9 mất; đèn yếu không chặn bóng; châm lên ≥ 30 đẩy bóng ra ≤ 30 tick không sát thương | test "vùng an toàn chỉ còn khi fuel ≥ 30" | đạt |
| Chọn mục tiêu `wander` (yếu trước tắt, hòa → id nhỏ; `chase` không đổi) | test "wander: nhắm đèn sáng..." | đạt |
| `drain`: vào ở ≤ 2 m, đứng yên, hút 5 + 1/giây (đo 6.0 trong 60 tick), `fuel_drain` mỗi 60 tick, đèn tắt thì `wander` | test "drain: bóng tới đèn yếu" | đạt |
| Cộng dồn 2 con → 11/giây | test "drain cộng dồn" | đạt |
| `drain` → `chase` / `stunned` (+15) / `wander`; hết choáng → `wander` | test "drain -> chase...", "hết choáng -> wander" | đạt |
| Luật thắng: không thắng sớm; bình minh thắng/thua; ngưỡng 3/5, 4/6, 5/7; điểm bình minh; `no_flames` ưu tiên | 4 test "không còn thắng sớm", "bình minh" ×2, "ngưỡng thắng" | đạt |
| Đêm 2 và 3 dùng chung cơ chế nhiên liệu | test "Đêm 2 và 3: nhiên liệu" | đạt |
| Scenario sai (fuel ngoài [0,100], ever_lit, target_lantern_id, successful_lights) → exit 2 | test "v1.2: scenario sai" | đạt |
| Tất định có đèn đang bị hút | test "tất định với nhiên liệu" | đạt |
| **Bản web:** thanh dầu và nhấp nháy khi `fuel < 30`; vòng an toàn chỉ hiện khi ≥ 30; tia tím nối bóng với đèn đang bị hút; HUD hiện mang/sức chứa (ví dụ 6/14) và "Giữ ≥ 3/5 đèn sáng · hiện 1"; nhắc Thắp lại / Châm dầu | dựng tình huống trong trình duyệt (đèn fuel 20, bóng `drain`, sức chứa 14) và chụp màn hình; không có lỗi console | đạt |
| **Chế độ mù màu (web):** viền và mắt Bóng Mực `#00B3FF`; cảnh báo và thanh dầu yếu màu trắng, ⚠ trên đồng hồ và thông báo; đèn tắt xẹp 20% có vết rách; lưu được | bật checkbox: `body.cb` đặt, `localStorage.ddl_settings.cb = true`, ảnh chụp thấy viền xanh dương và mục tiêu màu trắng | đạt (xẹp và vết rách của đèn tắt chưa có ảnh riêng) |

## Chưa đạt / chưa kiểm chứng (trung thực)
- **Đèn tắt xẹp 20% và có vết rách:** mã có (`lg.scale.y = 0.8`, hai mảnh `tears`) nhưng chưa chụp ảnh một đèn tắt trong chế độ mù màu.
- **Tia hút dầu:** ống tím mảnh có trong mã; ở ảnh chụp nó bị khuất sau thân đèn nên chưa thấy rõ.
- **Cân bằng độ khó mới** (240 s, đèn hao 1/giây, Bóng Mực hút 5/giây): chưa chơi trọn một ván thật; số liệu cố định theo ticket.
- **FPS ≥ 30, âm thanh `lantern_out`, macOS/Linux:** chưa đo hoặc thử trên máy thật.
