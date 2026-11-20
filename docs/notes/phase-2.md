# Phase 2 — giả định và nhật ký AI

> Một số giả định dưới đây (mục 4 về `wander`, 7 về vùng an toàn) đã được Ticket-03 điều chỉnh; xem [phase-3.md](phase-3.md).

Ticket-02 viết rất chi tiết nên giả định chỉ nằm ở những chỗ ticket không nói. Mỗi giả định có test khóa lại (trừ khi ghi khác).

## Giả định
1. **Tọa độ cực:** `x = cx + r·cos(a)`, `z = r·sin(a)`, góc từ +X. Chọn vì Đêm 3 yêu cầu dốc ở 30° và 150° nằm ở nửa `z > 0` (tầng 1 chỉ có ở nửa đó). Với quy ước này L1 (0,0,25) ứng với 90°.
2. **Xuất phát Đêm 3 là (0,0,−14)**, không phải (0,0,0): tâm đảo nằm trong tháp chuông (cao 8 m, không leo được). Đêm 2 xuất phát (0,0,0) (tâm đảo A); hồi sinh sau khi rơi dùng cùng điểm xuất phát của Đêm đó.
3. **Trạng thái `spawning` kéo dài 1 tick** (thực thể mới chỉ tương tác từ tick sau), rồi thành `wander`.
4. **`wander`:** đi chậm (50% tốc độ) theo hướng ngẫu nhiên, đổi hướng mỗi 90 tick. Ticket chỉ nêu ngưỡng phát hiện 12 m / bỏ đuổi 18 m; wander → chase khi ≤ 12 m, chase → wander khi > 18 m. Hết choáng/recoil thì về `chase` nếu ≤ 18 m, ngược lại `wander`.
5. **Vị trí Bóng Mực:** `pos.y` = mặt đất + 1.0 (tâm). Chênh cao khi chạm tính giữa chân Mây và mặt đất dưới bóng (ngưỡng 1.5 m). Tỏa Sáng đo 3D tới tâm bóng. Bóng chỉ đi trên địa hình (không rơi khỏi đảo, không leo vách > 0.35 m); bị chặn thì thử lệch hướng ±30°/60°/90°.
6. **Lùi (recoil) 2 m trong 60 tick:** bộ đếm giảm trước khi di chuyển nên có 59 bước di chuyển, mỗi bước 2/59 m (tổng đúng 2 m). Đẩy lùi khi bị choáng: 15 bước × 4/15 m, dừng nếu gặp vật cản.
7. **Vùng an toàn lúc thắp:** bóng đang trong 6 m bị chuyển sang `recoil` 30 tick và di chuyển ra mép (quãng còn lại / số tick còn lại), nên đến mép đúng sau 30 tick và không gây sát thương. Bóng sinh trong tick thắp đèn không bị ảnh hưởng.
8. **Điểm sinh Bóng Mực hợp lệ** = cách người chơi ≥ 15 m (áp dụng cả 3 Đêm) và nằm ngoài vùng 6 m của đèn đã sáng; không có điểm hợp lệ thì bỏ lượt. Hai con sinh cùng tick 300 chọn độc lập.
9. **Điểm sinh đom đóm "trống"** = không có đom đóm đang nằm đúng tại điểm đó. 20 điểm ban đầu chọn ngẫu nhiên (theo seed) từ danh sách điểm của Đêm.
10. **Đom đóm rơi:** vành 1.5–2.5 m, thử tối đa 8 góc cho tới khi có mặt đất chênh cao ≤ 1.5 m; không được thì đặt tại chân Mây. Tồn tại 480 tick; đếm vào trần 30 đom đóm.
11. **Lướt:** bấm khi đang lướt bị bỏ qua; nhảy bị bỏ qua khi đang lướt. Có Bùa Gió thì sau lướt hồi chiêu = 0. Khi bị bục nhảy phóng, vận tốc phóng được giữ khi không lướt; lướt ghi đè tạm thời.
12. **Tăng tốc:** thay đổi vận tốc ngang tối đa `tốc độ / 6` m/s mỗi tick (đạt tốc độ tối đa trong 6 tick = 0.1 s), cả trên không.
13. **Gió Lạc:** bay (không bị địa hình chặn); idle lượn hướng ngẫu nhiên 2 m/s; chase ngang theo người chơi, cao hơn chân Mây 1 m. Điểm sương sinh ra: 6 điểm bán kính 20 m mỗi đảo (Đêm 2), 8 điểm bán kính 30 m (Đêm 3, và Đêm 1 nếu bật `random_drifters`). Bộ đếm flee 240 tick bắt đầu từ tick cướp, biến mất đúng tick +240. Tỏa Sáng đo 3D tới tâm Gió Lạc.
14. **Gió mạnh:** cơn k bắt đầu ở sim_tick 1800·k (k ≥ 1), dài 300 tick, hướng (độ, từ +X) lấy từ hàm băm của seed và k (không dùng `rng` chính nên không phụ thuộc pause). Báo trước 120 tick (chỉ có ở lớp web: lá bay và âm thanh). `wind.dir_deg` = 0 khi gió không hoạt động.
15. **Tương tác đèn chỉ đo XZ** (như quy ước v1.0); không kiểm tra độ cao.
16. **Sau khi rơi:** trong 60 tick chờ, Mây đứng yên, không thể nhặt/tương tác/tỏa sáng/lướt/nhảy và không bị chạm; Gió Lạc và Bóng Mực vẫn chạy.
17. **Snapshot:** `player.invuln` là boolean (kèm `invuln_s`); `drifters` không gồm con đã `removed`; `motes[].ttl_s` = `null` với đom đóm random; `night_start` ghi ở tick 0 ngay sau snapshot tick 0. Nếu kết thúc khi đang tạm dừng, dòng `end` ghi `state: "playing"`.
18. **Scenario:** đèn đặt `lit: true` mà không có `deposited` thì `deposited` = 10. Id đèn không tồn tại bị bỏ qua. `shades[].state` thiếu thì chọn `chase` nếu ≤ 12 m, ngược lại `wander`.
19. **Điểm cộng dồn nhiều Đêm** chỉ tồn tại ở lớp web (headless chạy một Đêm, điểm = điểm Đêm đó).

## Nhật ký dùng AI (ước tính)
- Công cụ: Claude Code (Sonnet 5.5). Toàn bộ code và tài liệu do agent viết, tôi duyệt hướng đi và quyết định phần sáng tạo.
- Quy trình: đọc ticket → liệt kê mơ hồ → viết lõi + test headless trước (40 test) → mới làm web. Làm lõi trước giúp lỗi lộ ra ở test nhanh thay vì phải chơi tay.
- Lỗi của AI (tìm ra nhờ test): (a) bộ đếm bay của Gió Lạc giảm sai bước làm biến mất sớm 1 tick; (b) lùi 2 m chỉ đi 1.97 m do đếm lệch 1 bước; (c) vài test tự viết sai (frame input trùng tick, kỳ vọng thời điểm sai) — sửa test có lý do ghi trong commit.
- Chưa xác minh: hiệu năng ≥ 30 FPS ở 1280×720 trên máy thật, âm thanh bằng tai, trải nghiệm một ván thật.
- Ước tính token cả phase: _điền số thực tế từ usage của session_.
