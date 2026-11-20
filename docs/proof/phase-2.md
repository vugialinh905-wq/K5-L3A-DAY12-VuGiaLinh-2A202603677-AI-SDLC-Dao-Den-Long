# Bằng chứng Phase 2

Chạy lại tại tag `phase-2`: `npm test` → **40 test, 0 lỗi**. Mỗi test chạy CLI headless thật (`node src/headless.js`) rồi đọc JSONL. Tiêu chí nghiệm thu theo từng mục: [docs/spec/phase-2.md](../spec/phase-2.md).

## Regression Phase 1 với số chuẩn
Các hành vi của test Phase 1 (nhặt, thắp đèn, thắng/thua, tỏa sáng, bị chạm, vùng an toàn, tất định, lỗi file → exit 2) được viết lại với số chuẩn mới và vẫn đạt (xem các test cùng tên trong `tests/headless.test.js`). Những thay đổi cố ý so với v1.0: điểm tính lúc nạp đèn thay vì lúc nhặt; tỏa sáng tốn 3 đom đóm; thua do rơi; tên trạng thái Bóng Mực.

## Kết quả theo yêu cầu
| Yêu cầu | Cách kiểm chứng | Kết quả |
|---|---|---|
| Số liệu chuẩn khớp contract v1.1 | test "contract v1.1" | đạt |
| Chạy/nhảy/lướt đúng số | 5 test (tốc độ, nhảy, 2 test lướt, bùa) | đạt |
| Bản đồ 3 Đêm: đèn, thời lượng, 20 điểm đom đóm | test "bản đồ chuẩn", snapshot tick 0 | đạt |
| Cầu tre + bục nhảy (Đêm 2) | test "Đêm 2: cầu tre...": đi qua cầu không rơi; phóng sang đảo B và đáp xuống đúng | đạt |
| Tầng, dốc, vách, bục, tháp (Đêm 3) | 2 test "Đêm 3": lên dốc tới Y=3, vách đứng chặn, bục đáp tầng 2, tháp chặn | đạt |
| Rơi khỏi đảo | 2 test: −1 lửa, mất đồ, hồi sinh sau 60 tick bất tử 90; hết lửa thì thua ngay | đạt |
| Gió Lạc | 3 test (đuổi/cướp/bay đi; tỏa sáng đuổi và đòi lại; lịch sinh) | đạt |
| Bùa Gió | test 3 phần: 600 tick, 7.2 m/s, hiện lại sau 2700, lướt không hồi | đạt |
| Gió mạnh Đêm 3 | test: `wind.active` ở tick 1800–2099; quãng đường bị đẩy 10 m (2 m/s × 5 s) đúng hướng `dir_deg`; tắt `wind_enabled` thì không đẩy | đạt |
| Tạm dừng | 2 test: `sim_tick`, thời gian, vị trí, lịch sinh đứng yên; `paused`/`resumed` | đạt |
| Tất định cả 3 Đêm | test "tất định" (cùng seed → output giống hệt; khác seed → khác) | đạt |
| Một Đêm đầy đủ ≤ 30 s | test "hiệu năng": 21 600 tick ≈ 0.2–0.3 s | đạt |
| Chuỗi 3 Đêm, pause/resume, cài đặt (bản web) | chạy thật trong trình duyệt: menu → Đêm 1 → ép thắng → màn kết quả "Đêm kế tiếp" → Đêm 2; ép thắng Đêm 3 → Bình Minh (tổng 1614); ép thua → "Chơi lại Đêm 2"; Esc đóng băng đồng hồ; chỉnh thanh trượt lưu `localStorage` | đạt (kiểm bằng thao tác DOM) |
| HUD đầy đủ, bảng màu | DOM có đủ phần tử và vị trí đúng (đã đọc tọa độ phần tử ở khung 1280×720); ảnh chụp công cụ chỉ lấy được góc trái-trên nên chưa có ảnh toàn khung | đạt một phần (thiếu ảnh toàn khung) |

## Chưa đạt / chưa kiểm chứng (trung thực)
- **FPS ≥ 30 ở 1280×720:** chưa đo trên máy thật (trình duyệt trong công cụ bị giới hạn khung hình). Mã có cơ chế hạ độ phân giải tự động nếu < 30 FPS sau 4 s.
- **Âm thanh:** viết bằng WebAudio, chưa nghe thử bằng tai; cần bấm một lần trong trang để trình duyệt cho phát.
- **Chưa chơi trọn một ván thật bằng tay** cả 3 Đêm; cân bằng độ khó chưa chỉnh (ticket cố định số liệu).
- Chỉ chạy trên Windows; code là Node thuần nên dự kiến chạy được trên macOS/Linux nhưng chưa thử.
