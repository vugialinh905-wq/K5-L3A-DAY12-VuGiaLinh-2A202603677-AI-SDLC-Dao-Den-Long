# Bằng chứng Phase 4

Chạy lại tại tag `phase-4`: `npm test` → **72 test, 0 lỗi, 0 skip**. Tiêu chí theo từng mục: [docs/spec/phase-4.md](../spec/phase-4.md). Mọi số đo dưới đây do chính lệnh trong đề tạo ra, trên máy tác giả (Windows 11, Intel Iris Xe, Chrome 158, Node 24).

## Số đo
| Lệnh | Kết quả | Ngưỡng | Đạt |
|---|---|---|---|
| `node bench.js --seed 42 --duration 30 --out bench.json` | `avg_fps` **98.6** · `p1_low_fps` **41.7** · `frame_ms_p95` 14.1 · `frames` 2961 · `load_ms` **1282** · `peak_mem_mb` 893 (tổng tiến trình trình duyệt) · `vsync_off` true · cửa sổ 1280×722 · renderer: Three.js r160 / WebGL2 / ANGLE (Intel Iris Xe, D3D11) / Chrome 158 | ≥ 60 · ≥ 30 · ≤ 10 000 ms | có |
| `node soak.js --seed 7 --nights 10 --out soak.json` | `crashes` **0** · 10 Đêm (đều `lost`: input ngẫu nhiên) · bộ nhớ **49.3 → 51.3 MB** (1.04×) · heap JS 4.9 → 5.1 MB · 0.4 s | crashes = 0; mem_end ≤ 1.2 × mem_start | có |

File gốc: [bench.json](../../bench.json), [soak.json](../../soak.json) (do chính các lệnh trên tạo, commit nguyên văn). Soak chạy 5 lần liên tiếp cho tỉ lệ 0.99–1.12; bench lần thử 8 s trước đó cho 148 FPS (số đo dao động theo trạng thái máy, nhất là nhiệt/nguồn của laptop). Máy chấm của giảng viên có thể cho số khác.

## Kết quả theo yêu cầu
| Yêu cầu | Cách kiểm chứng | Kết quả |
|---|---|---|
| Contract v1.3 (`bench_cmd`, `soak_cmd`, giữ v1.0–v1.2) | test "contract v1.3" + 59 test luật cũ vẫn xanh | đạt |
| Thống kê benchmark đúng định nghĩa | test "thong ke benchmark" với các mảng `dt` đã biết (kể cả `k = ceil(0.01·N)`, N nhỏ) | đạt |
| Cảnh benchmark chuẩn | test "canh benchmark": 200 `wander` rải đều, 100 đom đóm, L1–L3 fuel 100, mô phỏng 10 s không đổi số lượng / dầu / ngọn lửa / trạng thái, bóng vẫn di chuyển, tất định theo seed | đạt |
| Soak: dạng output, 0 crash, bộ nhớ, tất định theo seed, tham số sai → lỗi | 2 test "soak.js", chạy lặp 6 lần không chập chờn | đạt |
| Bảng xếp hạng: tên, mục lưu, ISO 8601 có múi giờ, sắp xếp, top 10, lọc file hỏng | 5 test đơn vị | đạt |
| Lưu trên đĩa, còn sau khi mở lại, API từ chối dữ liệu sai | test "API bang xep hang" (đóng rồi mở lại server, mã 400/405) | đạt |
| `--export-leaderboard` đúng thứ tự, top 10, mã 0, thiếu tham số → lỗi | test "--export-leaderboard" + chạy thật sau khi chơi (thua → nhập "Mây_Linh" → xuất) | đạt |
| Giao diện bảng xếp hạng: thua → nhập tên → lưu → hiện bảng; báo lỗi tên ngắn / dài / ký tự cấm; tên tiếng Việt có dấu | thao tác thật trong trình duyệt; ảnh [leaderboard.jpg](../img/leaderboard.jpg) | đạt |
| Đổi phím: 9 hành động, báo trùng (kể cả phím cố định), khôi phục mặc định, lưu | test "doi phim" + thao tác thật (đổi Nhảy → Q, gán Tỏa Sáng → Q bị từ chối, ← bị từ chối, khôi phục) | đạt |
| Chỉ báo hình ảnh | thao tác thật: Bóng Mực xuất hiện (phụ đề + mũi tên mép phải), đèn fuel 24% (phụ đề), 10 giây cuối (số đếm lớn + phụ đề); gió: phụ đề khi cảnh báo; tắt "Phụ đề" thì ẩn hết | đạt (chỉ báo gió chưa chụp, có trong mã) |
| Giảm chuyển động | bật: `body.reduce-motion`; mã bỏ rung camera, chớp màn hình, lá bay, animation CSS | đạt (kiểm bằng mã và lớp CSS, chưa quay video) |
| Chữ UI ≥ 18 px ở 1280×720 | `window.__auditFonts()` ở 1280×720, cỡ mặc định: **mảng rỗng** ở cả 7 màn hình (menu, giới thiệu, tạm dừng, cài đặt, bảng xếp hạng, kết quả có ô nhập tên, bình minh) và ở HUD khi đang chơi (kể cả phụ đề và bảng trợ giúp); chữ lớn: cỡ gốc 22.5 px, vẫn rỗng | đạt |
| Đóng gói: Three.js vendor, `npm run release` ra zip web tĩnh | `vendor/three.module.js` (r160, MIT); `scripts/make-release.mjs` | zip tạo ở bước phát hành |

## Chưa đạt / chưa kiểm chứng (trung thực)
- **Máy chấm của giảng viên:** số đo ở trên chỉ để tham khảo. Cảnh benchmark vẽ Bóng Mực bằng nhiều mesh riêng (chưa dùng instancing) nên p1 low (41.7) chỉ hơn ngưỡng 30 một khoảng vừa phải trên GPU tích hợp.
- **macOS/Linux:** chưa thử trên máy thật. `bench.js` có đường dẫn trình duyệt và lấy mẫu bộ nhớ cho cả hai hệ nhưng chưa chạy ở đó.
- **Video demo `.mp4`:** chưa có. Máy không có công cụ quay/encode; kịch bản nằm ở [docs/demo/DEMO.md](../demo/DEMO.md), tác giả cần tự quay.
- **GitHub Release v1.0.0:** tạo sau khi có xác nhận của tác giả (hành động công khai).
- **Phụ đề gió, giảm chuyển động:** kiểm bằng mã và trạng thái DOM, chưa có ảnh/video chứng minh hiệu ứng.
- **`peak_mem_mb`:** là tổng working set của mọi tiến trình trình duyệt (có tính trùng bộ nhớ dùng chung), không phải RSS chính xác của một tiến trình.
