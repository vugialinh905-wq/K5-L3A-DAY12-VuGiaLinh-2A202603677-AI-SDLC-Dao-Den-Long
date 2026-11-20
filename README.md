# Day 12 — AI SDLC: Đảo Đèn Lồng

> **Cá nhân** (1 người / 1 MSSV) · Áp dụng SDLC cùng AI để xây một **game 3D** qua **4 phase**, từ yêu cầu ban đầu tới bản phát hành.
> **Lab board + trợ giảng:** **[Đảo Đèn Lồng Lab](https://claude.ai/artifact/Q1RYyv1dxjUczzCbd2ZnoW)**

---

## Đảo Đèn Lồng — bản game (Phase 2, Test Contract v1.1)

> Video demo: _(bổ sung ở Phase 4)_

Mây, người giữ đèn nhỏ tuổi, gom đom đóm, nạp ánh sáng vào các Đèn Lồng Lớn và né Bóng Mực trong sương đen qua **3 Đêm**: Đảo Bến (5 đèn), Đảo Cau (2 đảo nối bằng cầu tre, bục nhảy, 6 đèn) và Đảo Chuông (3 tầng, dốc, gió mạnh, 7 đèn). Thắp hết đèn thì thắng, hết 3 ngọn lửa hoặc hết giờ (bình minh) thì thua. Thắng Đêm 3 thì tới màn Bình Minh với tổng điểm.

### Cài đặt và chạy (cần Node ≥ 18)

```bash
npm install          # không có phụ thuộc, chỉ để khớp build_cmd
node serve.js        # mở http://localhost:8080 (Three.js nạp qua CDN, cần mạng)
npm test             # 40 test headless
```

### Điều khiển

| Phím | Hành động |
|---|---|
| Giữ chuột trái | Đi về phía con trỏ (gần con trỏ thì chậm lại) |
| W A S D | Di chuyển (theo hướng camera; ưu tiên hơn chuột) |
| Space | Nhảy (chỉ khi chạm đất) |
| Shift | Lướt 14 m/s trong 0.2 s, hồi 1.5 s (hướng đang đi, đứng yên thì hướng mặt) |
| E | Nạp ánh sáng vào đèn gần nhất (trong 2 m) |
| F | Tỏa Sáng: tốn 3 đom đóm, làm choáng và đẩy lùi Bóng Mực trong 5 m, hồi 3 s |
| Chuột phải kéo, ← → hoặc Z C | Xoay camera (độ nhạy chỉnh trong Cài đặt) |
| Esc hoặc P | Tạm dừng (Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu) |

Gió Lạc (Đêm 2, 3) cuỗm đom đóm của người mang ≥ 5: tỏa sáng để đuổi hoặc đòi lại. Bùa Gió (lá bùa đỏ viền vàng) cho chạy 7.2 m/s và lướt không hồi chiêu trong 10 s.

### Cách tính điểm
+10 mỗi đom đóm nạp vào đèn · +100 mỗi đèn thắp · +5 mỗi Bóng Mực trúng Tỏa Sáng · khi thắng một Đêm: +2 mỗi giây còn lại (làm tròn xuống) và +50 mỗi ngọn lửa còn lại. Tổng điểm game là tổng điểm các Đêm đã thắng.

### Chế độ headless (Test Contract v1.1)

```bash
node src/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl      [--scenario s.json] [--inputs i.json] [--snapshot-every 10]     # --night 1, 2 hoặc 3
```

Cấu hình khai báo trong [game.contract.json](game.contract.json) (`contract_version` "1.1") và được test khớp với số liệu thật trong `src/core.js`. Mọi khái niệm của contract đều có trong game nên không trường `tuning` nào là `null`; `fall_enabled` = `true` (rơi khỏi đảo bị phạt theo ticket). Một Đêm đầy đủ (21 600 tick) chạy headless trong khoảng 0.2 s.

### Cấu trúc
- `src/core.js` — lõi logic thuần (không DOM/GPU), bản đồ và số liệu chuẩn, dùng chung cho headless và web.
- `src/headless.js` — CLI theo Test Contract.
- `src/main.js`, `src/world.js`, `src/audio.js`, `index.html` — hiển thị 3D, âm thanh, menu và HUD.
- `tests/headless.test.js` — scenario kiểm chứng cho từng tính năng.
- Tài liệu: spec và tiêu chí nghiệm thu [docs/spec/phase-2.md](docs/spec/phase-2.md); giả định [docs/notes/phase-2.md](docs/notes/phase-2.md); bằng chứng [docs/proof/phase-2.md](docs/proof/phase-2.md). Phase 1: [notes](docs/notes/phase-1.md), [proof](docs/proof/phase-1.md).
- `AGENTS.md`, `.claude/skills/` — harness cho agent AI.

### Sáng tạo của tôi
Toàn bộ phần này chỉ nằm ở lớp hiển thị; lõi `src/core.js` và đầu ra headless không bị đổi (40 test vẫn xanh).
- Điều khiển bằng chuột: giữ chuột trái để đi về phía con trỏ, kéo chuột phải để xoay camera.
- Đom đóm hình ngôi sao xoay có quầng sáng; bụi cây, hoa nhỏ, cây cau, đèn lồng giấy treo lơ lửng sáng dần khi thắp thêm đèn.
- Lời Ông Đăng ở mỗi màn giới thiệu Đêm, thông báo nhanh khi có sự kiện, viền đỏ khi bị đánh, lá bay báo gió.

---

## Tài liệu của lab

| File | Nội dung |
|---|---|
| [GUIDE.md](GUIDE.md) | Hướng dẫn làm lab: vòng làm việc mỗi phase, harness, kiểm chứng, token |
| [CHECKPOINTS.md](CHECKPOINTS.md) | Các mốc tự kiểm tra từ chuẩn bị đến nộp bài |
| [SUBMISSION.md](SUBMISSION.md) | Đặt tên repo, hạn nộp, tag, Release, video, checklist |
| [RULES.md](RULES.md) | Quy định: AI, trung thực về bằng chứng, bản quyền, bảo mật |
| [RUBRIC.md](RUBRIC.md) | Thang điểm chi tiết |

## Lab board

Yêu cầu dự án được phát hành tại **[Đảo Đèn Lồng Lab](https://claude.ai/artifact/Q1RYyv1dxjUczzCbd2ZnoW)**. Mỗi phase là một tab (tab chưa phát hành bị khóa), mỗi tab có trợ giảng AI riêng chỉ trả lời trong phạm vi phase đó. Trợ giảng cần đăng nhập claude.ai và dùng lượt Claude của bạn.

## Dự án

**Đảo Đèn Lồng**: game 3D góc nhìn thứ ba. Mây, người giữ đèn nhỏ tuổi, gom đom đóm để thắp lại các Đèn Lồng Lớn và né Bóng Mực trong sương đen.

- Không ràng buộc công nghệ; chạy được trên macOS hoặc Linux.
- Tuân theo **Test Contract** (chế độ headless) để được chấm tự động và so sánh với nhau.

| Phase | Bạn nhận | Nộp |
|---|---|---|
| 1 | **PRD-0** (mô tả tổng quát) + Test Contract | tag `phase-1` |
| 2 | **Ticket-02**, phát hành khi Phase 1 kết thúc | tag `phase-2` |
| 3 | **Ticket-03**, phát hành khi Phase 2 kết thúc | tag `phase-3` |
| 4 | **Ticket-04**, phát hành khi Phase 3 kết thúc | tag `phase-4` + Release `v1.0.0` |

Yêu cầu sẽ được bổ sung và có thể thay đổi giữa các phase, giống dự án thật.

### Lịch 4 giờ

Bài lab kéo dài **4 giờ**. Phase 1 và 2 khoảng **1 giờ**, Phase 3 khoảng **30 phút**, Phase 4 khoảng **1 giờ 30 phút**. Mỗi phase phát hành đúng mốc giờ. Phase mới xuất hiện trên lab board khi tới mốc.

| Mốc | Sự kiện | Hạn tag |
|---|---|---|
| 0h | Phát hành **Phase 1** (PRD-0), gồm cả phần chuẩn bị | `phase-1` trước mốc 1h |
| 1h | Phát hành **Phase 2** | `phase-2` trước mốc 2h |
| 2h | Phát hành **Phase 3** | `phase-3` trước mốc 2h30 |
| 2h30 | Phát hành **Phase 4** | `phase-4`, Release `v1.0.0` và video trước mốc 4h |
| 4h | Hết giờ lab, chốt bài | |

Hết giờ mỗi phase thì tag và chuyển sang phase tiếp theo, dù phase chưa hoàn hảo. Chỗ chưa xong ghi trung thực trong bằng chứng.

---

## Gợi ý SDLC (cách làm là của bạn)

Mỗi phase là một vòng nhỏ. Công cụ, thứ tự, định dạng tài liệu đều tự do; đây chỉ là gợi ý:

1. **Requirements:** biến yêu cầu thành tiêu chí nghiệm thu kiểm chứng được. Chỗ mơ hồ thì tự giả định và ghi lại.
2. **Plan:** nghĩ cách kiểm chứng **trước** khi để agent viết code.
3. **Build:** để agent viết, bạn điều phối và review.
4. **Verify:** chạy thật, kiểm tra hành vi thật. *Không có bằng chứng thì chưa xong*: "agent bảo chạy rồi" không phải bằng chứng.
5. **Evaluate:** cái gì đạt, AI sai ở đâu, harness (AGENTS.md, skill, hook) cần chỉnh gì.
6. **Release:** gắn tag.

## Ba điều cần nhớ

> Bạn được **tự do sáng tạo thêm** quanh phần lõi (nhân vật, cơ chế nhỏ, câu chuyện, hiệu ứng, âm thanh…). Sáng tạo gọn và không phá yêu cầu được tính điểm trong hạng mục F của [RUBRIC](RUBRIC.md); ghi mục "Sáng tạo của tôi" trong README của bạn.

- **Game tốt là game đúng yêu cầu của khách hàng**, không phải game phức tạp hay đẹp nhất. Làm đúng và chứng minh được là đúng trước, trau chuốt sau.
- **Cân nhắc kỹ quota token của bạn.** Đốt nhiều token không làm bài tốt hơn. Ngữ cảnh gọn, kế hoạch rõ, kiểm chứng sớm thường vừa rẻ vừa đúng hơn chạy agent liên tục.
- **Kiểm chứng là phần quan trọng nhất.** Bằng chứng (test, output headless, ảnh, số đo) đáng giá hơn lời mô tả.

---

## Bàn giao cuối cùng

Một **repo GitHub cá nhân, public**, gồm:

1. **Toàn bộ mã nguồn** của game qua 4 phase, tag `phase-1` … `phase-4`, Release `v1.0.0`.
2. **Video demo `.mp4` dưới 5 phút** (đính kèm Release `v1.0.0` hoặc `docs/demo/demo.mp4`, link ở đầu README): chơi thử và cho thấy bằng chứng game chạy đúng.
3. **Bằng chứng kiểm chứng** của từng phase (định dạng tự chọn).
4. **Harness AI đã dùng** (AGENTS.md / CLAUDE.md, skills, hooks, plugins…), giữ nguyên trong repo và lịch sử git.
5. **Ghi chép ngắn:** spec/giả định mỗi phase, nhật ký dùng AI (gồm token/chi phí ước tính), retro.

Không commit API key, token hay `.env`. Gửi link repo theo hướng dẫn của Coach.

## Đánh giá (100 điểm)

| Hạng mục | Điểm |
|---|---|
| Test tự động ẩn (headless, gồm kiểm tra lại phase trước) | 30 |
| Kiểm chứng & bằng chứng của bạn | 20 |
| Quy trình SDLC & harness AI | 15 |
| Evaluation & retro (gồm cách bạn dùng token) | 10 |
| Hiệu năng & ổn định | 10 |
| Chất lượng sản phẩm (đúng yêu cầu, chơi được) | 10 |
| Video demo | 5 |

## Quy định

- Dùng AI thoải mái; không sao chép repo của người khác.
- Bằng chứng phải thật: test luôn đạt hay output sửa tay là vi phạm.
- Nhân vật, bối cảnh là bản gốc của lab; asset bên ngoài chỉ dùng loại CC0/CC-BY/MIT hoặc tự tạo, ghi nguồn trong `CREDITS.md`.
