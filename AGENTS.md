# AGENTS.md — Đảo Đèn Lồng

Game 3D, JS thuần + Three.js (CDN). Lõi logic không phụ thuộc đồ họa. Hiện ở Phase 3 (Test Contract v1.2: đèn có nhiên liệu, thắng khi giữ đèn sáng tới bình minh).

## Lệnh
- Chạy game: `node serve.js` (http://localhost:8080)
- Test: `npm test` (phải xanh trước mỗi commit)
- Headless: `node src/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl [--scenario s.json] [--inputs i.json]`

## Cấu trúc
- `src/core.js` — toàn bộ luật chơi, bản đồ chuẩn (`nightDef`), số chuẩn (`TUNING`, `CONSTANTS`). Hàm `step()` có đánh số 11 bước đúng thứ tự trong ticket (bước 2 trừ dầu, ngay sau đó đèn `fuel ≤ 0` tắt).
- `src/headless.js` — CLI contract. `src/main.js`, `src/world.js`, `src/audio.js`, `index.html` — chỉ hiển thị, âm thanh, màn hình.
- `tests/headless.test.js` — mỗi tính năng có scenario riêng. Spec + tiêu chí nghiệm thu: `docs/spec/phase-N.md` (hiện `phase-3.md`).

## Quy ước bắt buộc
- Mọi luật chơi nằm trong `src/core.js`. Lớp web không chứa luật, chỉ đọc state và gửi input.
- Số liệu chuẩn chỉ khai báo ở `TUNING`/`K` trong `core.js`; `game.contract.json` phải khớp (test kiểm).
- Tick: 60/s; khoảng cách đo trên XZ (trừ Tỏa Sáng đo 3D); "trong bán kính r" là `<= r`; sự kiện ghi tick = bước sau (k+1).
- Thứ tự trong tick là bắt buộc (xem comment trong `step()`); thực thể mới sinh chỉ tương tác từ tick sau.
- Tính tất định: mọi ngẫu nhiên đi qua `g.rng` (mulberry32). Cấm `Math.random()`, `Date.now()` trong `core.js`. Gió dùng hàm băm theo seed và chỉ số cơn gió.
- Nhiên liệu đèn là **số nguyên theo đơn vị 1/60** (`fuelU`; 1 tick hao 1 đơn vị, hút 5 đơn vị, 1 đom đóm = 600). Không dùng số thực cho dầu; chỉ làm tròn khi xuất snapshot. Vùng an toàn = `zoneActive(l)` (`lit && fuelU >= 1800`), đừng viết lại điều kiện này ở chỗ khác.
- Bóng Mực `wander` chọn mục tiêu bằng `pickWanderTarget` (đèn sáng yếu → đèn tắt → ngẫu nhiên); `drain` đứng yên hút dầu.
- Mô hình đèn và luật thắng: xem `docs/adr/0001-den-can-dau-va-luat-thang.md`. Đổi luật cốt lõi thì thêm ADR mới và mục vào `CHANGELOG.md` (kèm lý do cho mỗi test bị đổi; không `skip` test âm thầm).
- Tọa độ cực: `x = cx + r·cos(a)`, `z = r·sin(a)`, góc từ +X.
- Phần sáng tạo/hiển thị thêm phải tắt hoặc không có trong headless; không được đổi đầu ra theo contract.
- Đổi luật thì cập nhật test, `docs/spec` và `docs/notes/phase-N.md` (giả định) trong cùng commit.
- Khi một yêu cầu mơ hồ: chọn giả định hợp lý, ghi vào `docs/notes/phase-N.md`, kèm test khóa lại giả định đó.
- Không commit `.env`/khóa API. Không thêm dòng đồng tác giả vào commit (yêu cầu của chủ repo).

## Skill
- `.claude/skills/headless-scenario/SKILL.md` — cách viết scenario headless cho một tính năng mới và đọc output.
