# Bằng chứng Phase 1

Chạy lại: `npm test` (16 test, tất cả `pass`) tại tag `phase-1`. Mỗi test chạy CLI headless thật (`node src/headless.js`) với scenario/inputs riêng rồi kiểm tra file JSONL.

| Yêu cầu | Cách kiểm chứng | Kết quả |
|---|---|---|
| `game.contract.json` khớp số liệu thật | test "game.contract.json khop voi tuning..." so sánh với `TUNING` | đạt |
| Tick 0 = trạng thái sau scenario, có dòng `end`, snapshot mỗi N tick | test "tick 0 la snapshot..." | đạt |
| Nhặt đom đóm trong `pickup_radius`, +điểm | test "nhat dom dom" (nhặt đúng tick 38) | đạt |
| Nạp ánh sáng, thắp đèn, +điểm | test "nap anh sang va thap den" | đạt |
| Thắng `all_lit`, điểm thưởng; đèn `lit` đặt sẵn không cộng điểm | test "thang..." (điểm 100+299+150) | đạt |
| Tỏa sáng: choáng + đẩy lùi + chi phí | 2 test "toa sang" | đạt |
| Bị chạm: mất lửa, rơi đom đóm, bất tử 1.5 s | test "bi Bong Muc cham" (lần chạm 2 đúng sau 90 tick) | đạt |
| Thua `no_flames`, `dawn` | 2 test tương ứng | đạt |
| Bóng Mực không vào `safe_radius` đèn sáng | test "safe_radius" | đạt |
| Tất định (cùng seed → output giống hệt; khác seed → khác) | test "tat dinh" | đạt |
| Quy ước di chuyển theo `cam_yaw_deg`, chuẩn hóa vector | 2 test | đạt |
| Lỗi file → exit 2; thiếu tham số → exit ≠ 0 + stderr | 2 test | đạt |
| Game web chơi được (render, HUD, điều khiển) | mở `http://localhost:8080` trong trình duyệt, không có lỗi console; phím W di chuyển nhân vật, HUD cập nhật | đạt ở mức kiểm thủ công, **chưa chơi trọn một ván thắng/thua bằng tay** |

Chưa đạt / chưa kiểm: chưa đo hiệu năng web; chưa thử trên macOS/Linux thật (chỉ Windows, nhưng code thuần Node không dùng API riêng của hệ điều hành).
