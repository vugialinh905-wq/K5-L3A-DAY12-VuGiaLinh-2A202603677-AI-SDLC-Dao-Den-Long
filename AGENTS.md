# AGENTS.md — Đảo Đèn Lồng

Game 3D, JS thuần + Three.js (CDN). Lõi logic không phụ thuộc đồ họa.

## Lệnh
- Chạy game: `node serve.js` (http://localhost:8080)
- Test: `npm test` (phải xanh trước mỗi commit)
- Headless: `node src/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl`

## Quy ước bắt buộc
- Mọi luật chơi nằm trong `src/core.js`. `src/main.js` chỉ hiển thị và đọc phím, không chứa luật.
- Số liệu cân bằng chỉ khai báo ở `TUNING` trong `core.js` và phải khớp `game.contract.json` (có test kiểm).
- Test Contract v1.0: 60 tick/s, khoảng cách đo trên mặt phẳng XZ, "trong bán kính r" là `<= r`, sự kiện ghi tick = bước sau (k+1).
- Tính tất định: mọi ngẫu nhiên đi qua `g.rng` (mulberry32 theo seed). Cấm `Math.random()`, `Date.now()` trong `core.js`.
- Phần sáng tạo thêm phải tắt được khi headless để không đổi output theo contract.
- Đổi luật thì cập nhật test và `docs/notes/phase-N.md` (giả định) trong cùng commit.
- Không commit `.env`/khóa API.
