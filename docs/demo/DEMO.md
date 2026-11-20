# Kịch bản video demo (dưới 5 phút, `.mp4`)

Quay màn hình (Windows: Game Bar `Win+G`; macOS: `Cmd+Shift+5`), xuất `.mp4`, đặt tại `docs/demo/demo.mp4` hoặc đính kèm Release v1.0.0.

| Thời gian | Cảnh | Nội dung |
|---|---|---|
| 0:00–0:20 | Menu | Giới thiệu game; mở Bảng xếp hạng rồi Cài đặt (đổi phím Nhảy sang Q, thử gán trùng để thấy cảnh báo, khôi phục mặc định) |
| 0:20–1:30 | Đêm 1 | Nhặt đom đóm (hình sao), thắp một đèn (10 đom đóm), để một đèn xuống dưới 30 dầu: nhấp nháy + phụ đề; Bóng Mực xuất hiện kèm mũi tên ở mép; Tỏa Sáng; châm dầu |
| 1:30–2:15 | Đêm 2 hoặc 3 | Cầu tre và bục nhảy (Đêm 2) hoặc dốc, tầng và gió (Đêm 3); Gió Lạc cuỗm đom đóm; Bùa Gió |
| 2:15–2:45 | Kết thúc | Màn kết quả hoặc Bình Minh, nhập tên, xem bảng xếp hạng |
| 2:45–3:30 | Bằng chứng | Terminal: `npm test` (72 test xanh); `node src/headless.js ...` rồi mở `out.jsonl`; `node soak.js ...` (0 lỗi, bộ nhớ ổn định) |
| 3:30–4:15 | Benchmark | `node bench.js --seed 42 --duration 30 --out bench.json` chạy thật (cửa sổ Chrome hiện cảnh 200 Bóng Mực); mở `bench.json` đối chiếu ngưỡng |
| 4:15–4:50 | Harness và lịch sử | Lướt `AGENTS.md`, `.claude/skills/`, `docs/adr/`, `CHANGELOG.md`, `git log --oneline` và 4 tag `phase-1…4` |
