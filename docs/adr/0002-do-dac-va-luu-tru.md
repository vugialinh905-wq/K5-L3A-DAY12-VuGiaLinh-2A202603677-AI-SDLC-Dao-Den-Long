# ADR 0002 — Benchmark bằng trình duyệt thật, bảng xếp hạng lưu qua server Node

- Trạng thái: chấp nhận (Phase 4, Ticket-04, Contract v1.3)

## Bối cảnh
Ticket-04 yêu cầu `<bench_cmd>` đo FPS ở 1280×720, `<soak_cmd>` chạy headless 10 Đêm, bảng xếp hạng còn sau khi tắt mở game và xuất được bằng `<run_cmd> --export-leaderboard`. Game là bản web (Three.js) nên có hai câu hỏi: đo hình ảnh ở đâu, và lưu dữ liệu ở đâu để dòng lệnh đọc được.

## Quyết định
1. **Benchmark** chạy trong trình duyệt Chromium thật do `bench.js` mở (cờ tắt vsync, cửa sổ tạm), dùng chính mã vẽ của game ở chế độ `?bench=1`. Số đo `dt` lấy từ `requestAnimationFrame` rồi gửi về Node; Node tính thống kê (`src/benchstats.js`, có test) và ghi `bench.json`. Cảnh chuẩn dựng bằng `createBenchGame`/`benchStep` trong lõi để cùng seed cho cùng cảnh; phần trang trí sáng tạo bị tắt.
2. **Soak** chạy hoàn toàn trong Node (`soak.js`) với lõi thuần, không cần trình duyệt; làm nóng JIT trước khi đo `mem_start_mb` và xuất thêm số đo heap để phân biệt khởi động với rò rỉ.
3. **Bảng xếp hạng** do `serve.js` ghi vào `data/leaderboard.json` (nguyên tử, tuần tự hóa); trình duyệt gọi `/api/leaderboard`. `--export-leaderboard` đọc cùng file đó. Thuật toán (kiểm tên, sắp xếp, top 10) nằm trong `src/leaderboard.js` thuần, dùng chung cho server, trình duyệt (dự phòng `localStorage`) và test.

## Phương án đã cân nhắc
- **`localStorage` làm nơi lưu chính:** dòng lệnh không đọc được, trái yêu cầu xuất ra file. Chỉ giữ làm dự phòng khi không có server.
- **Đo FPS trong trình duyệt headless (SwiftShader):** không có GPU nên số đo vô nghĩa. Chọn cửa sổ thật.
- **Thêm puppeteer / playwright:** dễ điều khiển hơn nhưng thêm phụ thuộc nặng, trái yêu cầu cài đặt gọn; dùng `child_process` + cờ Chromium là đủ.
- **Chỉ ghi `peak_mem_mb = null` cho bản web:** được phép nhưng đo thử được nên đo; vẫn ghi rõ phương pháp và giới hạn (tính trùng bộ nhớ dùng chung).

## Hệ quả
- Benchmark cần Chrome/Edge/Chromium trên máy chạy (có `--manual` làm đường lui).
- Chơi bằng bản web tĩnh không có server thì bảng xếp hạng chỉ lưu trong trình duyệt đó.
