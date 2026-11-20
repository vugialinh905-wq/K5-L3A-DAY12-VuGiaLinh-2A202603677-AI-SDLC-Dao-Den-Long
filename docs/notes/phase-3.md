# Phase 3 — giả định và nhật ký AI

Giả định của Phase 1–2 vẫn áp dụng trừ khi ghi khác bên dưới. Mỗi giả định có test khóa lại.

## Giả định mới (chỗ Ticket-03 chưa nói)
1. **Dầu hao trước bước Tương tác** (bước 2 rồi bước 5 cùng tick). Hệ quả: đèn vừa được châm đầy lại thiếu 1/60 ở lần Tương tác tiếp theo, nên 1 đom đóm vẫn châm được (`ceil((100 − 99.98)/10) = 1`). "Đèn đầy dầu không được chọn" chỉ xảy ra khi `fuel` đúng bằng 100 ở bước 5 (thực tế gần như không gặp). Test dùng `fuel + 1/60` để bù hao.
2. **Vùng an toàn xét theo `fuelU ≥ 1800` tại thời điểm xét.** Đèn vừa châm đúng 30 có vùng trong tick đó, mất ngay tick sau.
3. **Bóng `wander` đi về đèn (Phase 2 giả định lang thang ngẫu nhiên).** Ticket nói "đi về đèn tắt gần nhất như trước" nên tôi coi hành vi đó là luật `wander` ngay từ đầu: bóng `wander` đi tới đèn mục tiêu bằng tốc độ bóng (không còn 50%), dừng cách đèn tắt 1.5 m. Chỉ khi không có đèn tắt hoặc đèn yếu nào thì lang thang ngẫu nhiên chậm.
4. **Vào `drain`:** khi khoảng cách XZ tới đèn yếu mục tiêu ≤ 2 m, kiểm tra cả trước và sau khi di chuyển trong tick đó. Hút bắt đầu từ bước 2 của tick sau.
5. **`fuel_drain`:** mỗi bóng phát một sự kiện cho mỗi 60 tick nó đã hút (đếm từ lúc vào `drain`); `fuel` trong sự kiện là fuel của đèn sau lần hút đó, làm tròn 1 chữ số.
6. **Thoát `drain`:** kiểm tra theo thứ tự May ≤ 6 m (XZ, tính tới tâm bóng) → `chase`, sau đó mới tới các điều kiện về `wander`. Trường hợp "fuel được châm lên ≥ 30" đi qua cơ chế đẩy ra (bóng trong 6 m thành `recoil` 30 tick) vì người châm dầu luôn ở trong 2 m của đèn nên bóng đang hút (≤ 2 m) nằm trong 4 m của họ và sẽ `chase` ở bước 8 nếu chưa bị đẩy.
7. **Hết choáng → `wander`** (kể cả khi May rất gần: ngay trong tick đó nếu ≤ 12 m thì chuyển `chase` do luật phát hiện). Hết `recoil` giữ luật cũ (`chase` nếu ≤ 18 m).
8. **Điểm Tỏa Sáng:** +5 mỗi con, +15 tổng nếu con đó đang `drain` tại tick kích hoạt.
9. **Thưởng bình minh** chỉ tính khi thắng, dựa trên đèn còn sáng sau mọi cập nhật của tick đó (đèn cạn dầu đúng tick bình minh không được tính). `floor(fuel)` lấy từ số nguyên 1/60.
10. **`successful_lights`:** tăng ở mỗi lần thắp thành công (kể cả thắp lại); không tăng cho đèn đặt bằng scenario; không giảm; đặt lại mỗi Đêm (mỗi `createGame`).
11. **Scenario:** đèn `lit: true` mặc định `ever_lit: true`, `deposited: 10`, `fuel: 100`; `fuel` chỉ có tác dụng khi `lit: true`; `relit_count` luôn bắt đầu 0. `target_lantern_id` ghim mục tiêu của bóng `wander`/`drain` cho tới khi hết hiệu lực. Bóng `drain` không có `target_lantern_id` thì lấy đèn sáng gần nhất.
12. **Snapshot:** `shades[].target_lantern_id` (null nếu không có); `lanterns[].fuel` là số thực 1 chữ số, đèn tắt là 0.
13. **Web:** mũi tên chỉ tới đèn chưa sáng gần nhất, nếu không còn thì tới đèn yếu gần nhất; nhắc "Thắp lại" / "Nạp ánh sáng" / "Châm dầu (x%)".

## Nhật ký dùng AI (ước tính)
- Công cụ: Claude Code (Sonnet 5.5). Đọc ticket → rút ra danh sách thay đổi phá vỡ → ADR → vá lõi → chạy bộ test cũ để thấy chính xác 6 test bị luật mới làm sai → cập nhật/thay có lý do → viết test mới → làm web.
- Lỗi của AI tìm được nhờ test: (a) test vùng an toàn của tôi tự giả định vùng còn sau tick châm đúng 30 (sai vì dầu hao tiếp); (b) test bóng hút dầu đặt bóng ngoài 12 m nên nó là `wander` đi hút đèn, không phải `chase` — đúng luật, sai test.
- Chưa xác minh: thang cảm nhận độ khó mới (240 s, đèn hao), âm thanh `lantern_out` bằng tai, FPS trên máy thật.
- Ước tính token cả phase: _điền số thực tế từ usage của session_.
