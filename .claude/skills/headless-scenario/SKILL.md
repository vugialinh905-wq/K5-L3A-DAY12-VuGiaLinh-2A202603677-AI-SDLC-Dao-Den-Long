---
name: headless-scenario
description: Viết và chạy một scenario headless cho Đảo Đèn Lồng để kiểm chứng một tính năng (nhặt, thắp đèn, tỏa sáng, lướt, Gió Lạc, bùa, gió, pause...). Dùng khi thêm hoặc sửa luật chơi trong src/core.js.
---

# Viết scenario headless

1. Chọn đêm (`--night 1|2|3`) và dựng tình huống nhỏ nhất chứng minh tính năng. Tắt nhiễu bằng
   `{"random_motes":false,"random_shades":false,"random_drifters":false,"wind_enabled":false,"motes":[],"shades":[]}`.
2. Đặt đúng chỗ cần: `player.pos/carried/flames/charm_ticks/...`, `shades[]` (`state`, `state_ticks_left`), `drifters[]`, `lanterns[{id,pos,lit,deposited}]`, `time_left_s`.
3. Tạo inputs: `frames` có `tick` tăng nghiêm ngặt (không trùng!). Nút (`jump, interact, pulse, dash, pause`) chỉ kích hoạt khi chuyển false→true nên bấm ở tick `t`, nhả ở `t+1`.
4. Chạy: `node src/headless.js --seed 1 --night N --scenario s.json --inputs i.json --ticks T --out o.jsonl --snapshot-every 1`.
5. Đọc `o.jsonl`: sự kiện có `tick = bước + 1`; snapshot tick 0 là trạng thái sau dựng scenario. Kiểm đúng con số trong ticket (không dùng "xấp xỉ" cho số nguyên tick).
6. Thêm test vào `tests/headless.test.js` (dùng helper `run`, `snapAt`, `events`) rồi `npm test`.
7. Thêm một dòng vào `docs/spec/phase-2.md` (tiêu chí nghiệm thu) nếu là tính năng mới.

Bẫy thường gặp: frame trùng tick → exit 2; đèn sát người khiến bóng bị đẩy ra (vùng an toàn); người chơi ở Đêm 3 mặc định xuất phát (0,0,-14) vì (0,0,0) nằm trong tháp.
