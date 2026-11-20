# Phase 1 — giả định và nhật ký AI

## Giả định (chỗ PRD-0 / contract chưa nói)
1. **Ngọn lửa (`flames`) = máu.** Mất 1 mỗi lần bị Bóng Mực chạm. Hết lửa → `lost` / `no_flames`.
2. **"Tốn ánh sáng" khi tỏa sáng = tốn `pulse_cost` (1) đom đóm đang mang.** Không đủ đom đóm hoặc đang hồi chiêu thì phím tỏa sáng bị bỏ qua (không có event).
3. **Thắp đèn:** cần `lantern_cost` (5) đom đóm nạp vào một đèn. Nạp từng phần được (ví dụ mang 3, nạp 3, đèn có `deposited` 3). `interact` nạp vào đèn chưa thắp **gần nhất** trong `interact_radius`; lượng nạp = min(đang mang, còn thiếu).
4. **Hết giờ (bình minh) mà chưa thắp hết đèn = thua** (`lost` / `dawn`). Hết giờ đúng tick `ceil(duration*60)`.
5. **Điểm:** `per_mote` cộng lúc nhặt. `per_second_left` (làm tròn xuống) và `per_flame_left` chỉ cộng một lần khi thắng. `per_stun` cộng cho mỗi Bóng Mực bị choáng **mới** (đang choáng thì không bị choáng/cộng lại, tránh farm điểm).
6. **Bị chạm:** −1 lửa, rơi `floor(carried * hit_drop_ratio)` đom đóm ra mặt đất cách người chơi 2 m (ngoài `pickup_radius`), bất tử `invuln_s` = 90 tick. Bóng Mực đang choáng không gây sát thương. Một bước chỉ tính tối đa một lần chạm.
7. **Nhặt đom đóm tự động** khi trong `pickup_radius` và còn chỗ (`carry_capacity`); chiều cao không ảnh hưởng (đo trên XZ).
8. **`safe_radius`:** chỉ các đèn **đã thắp** có vùng an toàn; Bóng Mực bị đẩy ra rìa vòng tròn.
9. **Đảo:** bán kính 40 m, người chơi và Bóng Mực bị giữ trong đảo (`fall_enabled: false`). 5 đèn nằm trên vòng bán kính 25 m, L1 ở (0,0,25).
10. **Ngẫu nhiên mặc định:** 20 đom đóm ban đầu, thêm 1 đom đóm mỗi 3 s nếu còn dưới 20. Bóng Mực đầu tiên xuất hiện lúc 5 s, sau đó mỗi 10 s, tối đa 5 con, ở rìa đảo. `random_*: false` tắt hoàn toàn việc tự sinh.
11. **Nhảy** (không có số trong tuning): vận tốc 6.5 m/s, trọng lực 18 m/s². Nhảy không giúp né (va chạm đo trên XZ).
12. Scenario có `lanterns[].id` không tồn tại thì bị bỏ qua; scenario/inputs sai định dạng hoặc không đọc được → exit 2. `dash` được chấp nhận trong inputs nhưng không có tác dụng (game không có dash).
13. Snapshot cuối: ngoài các snapshot theo `--snapshot-every`, luôn có snapshot ở tick cuối cùng trước dòng `end`.

## Nhật ký dùng AI (ước tính)
- Công cụ: Claude Code (Sonnet 5.5) làm gần như toàn bộ: đọc đề, thiết kế lõi, viết code và test.
- Ước tính token cả phase: _điền số thực tế từ usage của session_.
- Cách tiết kiệm: đọc đề 1 lần và rút trích thành text, thiết kế lõi tách khỏi hiển thị nên test không cần GPU, test viết trước khi làm web.
- AI sai/lưu ý: lần đầu `node --test tests/` không chạy trên Node 24 (phải dùng glob `tests/*.test.js`); ảnh chụp đầu tiên của game quá tối nên tăng ánh sáng môi trường.
