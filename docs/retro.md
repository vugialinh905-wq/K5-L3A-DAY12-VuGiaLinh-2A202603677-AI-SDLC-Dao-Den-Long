# Retro — Đảo Đèn Lồng (4 phase, AI SDLC)

## Evaluation từng phase
| Phase | Yêu cầu | Kết quả | Điều học được |
|---|---|---|---|
| 1 — PRD-0 | Game 3D + Test Contract v1.0 | Lõi thuần + headless + web; 16 test | Tách lõi khỏi hiển thị ngay từ đầu là quyết định đáng giá nhất của cả dự án: mọi ticket sau đều đổi luật mà không phải sửa hiển thị |
| 2 — Ticket-02 | Số liệu chuẩn, 3 bản đồ, Lướt, Gió Lạc, Bùa, pause | 40 test; web có menu, âm thanh, HUD | Ticket chi tiết nhưng vẫn có chỗ mơ hồ (xuất phát Đêm 3, trạng thái `spawning`, hướng cực); mỗi giả định được ghi và khóa bằng test |
| 3 — Ticket-03 | Đổi luật cốt lõi: đèn cạn dầu | 59 test; 6 test cũ được thay có lý do | Chạy bộ test cũ trên luật mới cho thấy chính xác cái gì bị phá; ADR + CHANGELOG giúp ghi lại "vì sao" |
| 4 — Ticket-04 | Đo đạc, soak, xếp hạng, tiếp cận, phát hành | 72 test; bench 98.6 FPS, soak 0 lỗi | Yêu cầu phi chức năng chỉ có giá trị khi đo thật; số đo đầu tiên thường làm lộ giả định sai |

## Điều gì hiệu quả khi làm với AI
- **Test trước, giao diện sau.** Lỗi logic (đếm lệch một tick, hẹn giờ Gió Lạc, vùng an toàn) lộ ngay ở test headless chạy trong vài giây, không cần chơi tay.
- **Yêu cầu có số cụ thể.** Ticket-02 và 04 đưa số đo rõ ràng nên AI viết được test từ chính đề, ít phải đoán.
- **Ghi giả định thay vì hỏi lại.** Mỗi chỗ mơ hồ → một dòng trong `docs/notes/phase-N.md` + một test; người duyệt chỉ phải đọc danh sách giả định.
- **Vá bằng script có `assert`** (mỗi chuỗi cũ phải xuất hiện đúng một lần): lỗi khớp sai thì dừng ngay thay vì sửa nhầm.

## Điều gì không hiệu quả
- Viết lại cả file lớn bằng một lần ghi (`index.html`, `main.js`) dễ vỡ khi file đã bị sửa giữa chừng; vá theo đoạn tốt hơn nhưng `main.js` quá dài (~800 dòng) và nên tách sớm.
- Ảnh chụp trong khung trình duyệt của công cụ chỉ lấy một phần cửa sổ ở các phase đầu, làm mất thời gian; sau đó chuyển sang kiểm bằng truy vấn DOM và ảnh ở 1280×720.
- Lệnh shell dài với heredoc nhiều dòng thất bại; ghi script ra file rồi chạy ổn định hơn.

## Những lần AI sai và cách phát hiện
| Lỗi | Cách phát hiện |
|---|---|
| Test tự viết sai (frame input trùng tick, kỳ vọng sai thời điểm, một assertion `\|\| true` cho qua) | Test đỏ / đọc lại; assertion giả được thay bằng kiểm thật |
| Hẹn giờ bay của Gió Lạc giảm ở bước sai → biến mất sớm 1 tick | Test "Gió Lạc: Tỏa Sáng ... biến mất sau 120 tick" |
| Lùi 2 m chỉ đi 1.97 m (đếm lệch một bước) | Test "Bị Bóng Mực chạm" đo quãng đường |
| Giả định vùng an toàn còn ở tick sau khi châm đúng 30 (dầu hao tiếp) | Test vùng an toàn |
| Bụi cây quá tối / che hết lá; đèn treo ngoài khung nhìn | Ảnh chụp thật trong trình duyệt |
| Soak cho tỉ lệ bộ nhớ 1.37× | Đo từng giai đoạn: heap phẳng, RSS tăng ở lần chạy đầu → làm nóng + ghi rõ + xuất số đo heap |
| Màn Cài đặt bị cắt ở chữ lớn | Ảnh chụp; sửa căn giữa bằng `margin: auto` |
| Đề Ticket-03 nói "thắng khi đủ đèn" nhưng ticket mới yêu cầu bỏ | Đọc ADR/CHANGELOG, chạy lại toàn bộ test cũ để tìm chỗ phá |

## Harness giúp nhiều nhất
1. **`AGENTS.md`** ngắn (lệnh, quy ước bắt buộc như "mọi luật trong `core.js`", "dầu là số nguyên 1/60", "cấm `Math.random` trong lõi") — giữ cho AI không lệch kiến trúc qua 4 phase.
2. **Skill `headless-scenario`** — cách dựng scenario nhỏ nhất cho một tính năng và các bẫy (frame trùng tick, đèn sát người).
3. **Test như hook thủ công**: `npm test` trước mỗi commit. Chưa dùng hook tự động; đó là việc nên làm nếu làm lại.

## Token / chi phí AI (ước tính)
- Toàn bộ dự án làm trong một phiên dài với Claude Code (Claude Sonnet 5.5), gói Pro, không tính phí theo token. Tại thời điểm viết retro, cửa sổ ngữ cảnh của phiên đã dùng **khoảng 0.73 triệu token** (73% của 1 triệu), trong đó ~67% là hội thoại và kết quả công cụ; giới hạn 5 giờ của gói đã dùng 69% và giới hạn tuần 39% (số liệu từ công cụ báo cáo của ứng dụng). Không có số token cộng dồn chính xác theo từng phase.
- **Cách đã tiết kiệm:** đọc đề một lần rồi trích thành văn bản gọn; vá file bằng script thay vì viết lại; ưu tiên test headless (rẻ) hơn ảnh chụp (đắt); kiểm tra giao diện bằng truy vấn DOM; module nhỏ thuần có test riêng; không chạy lại cả suite lớn khi chỉ đổi giao diện (trừ lúc chốt).

## Nếu làm lại
- Tách `main.js` thành module (input, HUD, màn hình, thực thể) từ Phase 2.
- Dựng hook chạy `npm test` trước khi kết thúc lượt làm việc của agent.
- Viết ADR ngay khi nhận ticket đổi luật, trước khi sửa mã.
- Dựng khung benchmark và soak từ Phase 2 để thấy hồi quy hiệu năng sớm thay vì đo một lần ở cuối.
- Dùng instancing cho Bóng Mực từ đầu (hiện mỗi con là vài mesh riêng; p1 low 41.7 FPS còn dư địa).
