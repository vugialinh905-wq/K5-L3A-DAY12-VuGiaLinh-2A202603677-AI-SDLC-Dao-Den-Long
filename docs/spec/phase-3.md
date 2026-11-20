# Spec Phase 3 — Ticket-03 "Đèn cạn dầu" (Contract v1.2)

Quyết định thiết kế: [ADR 0001](../adr/0001-den-can-dau-va-luat-thang.md). Thay đổi phá vỡ tương thích: [CHANGELOG](../../CHANGELOG.md). Test nằm trong `tests/headless.test.js` (tìm theo tên).

| Mục | Tiêu chí nghiệm thu | Kiểm bằng |
|---|---|---|
| **1. Nhiên liệu** | A1. Đèn vừa thắp có fuel 100; hao 1.0/giây (600 tick → 90.0) | "hao dầu 1.0/giây", "nạp ánh sáng" |
| | A2. Châm dầu: `used = min(mang, ceil((100 − fuel)/10))`, `fuel = min(100, fuel + 10·used)`, trừ `used` đom đóm, +5 điểm/đom đóm, sự kiện `refuel {lantern_id, amount, fuel}` | "chau dau: used = ..." |
| | A3. Mang 0 đom đóm thì không sự kiện, không điểm | cùng test |
| | A4. Chọn đèn: chỉ đèn nhận được (chưa sáng, hoặc sáng chưa đầy dầu); gần nhất, hòa thì id nhỏ | "tuong tac: ..." |
| | A5. Hết dầu: tắt đúng tick, `deposited = 0`, `lantern_out`, giữ `ever_lit` | "het dau: den tat dung tick" |
| | A6. Thắp lại chỉ cần 5 (chưa từng sáng vẫn 10); `lantern_lit.relight`; +40 điểm; `relit_count` | "thap lai: +5/dom dom +40 diem" |
| | A7. Độ chính xác: tính theo đơn vị nguyên 1/60 | `fuelU` trong `src/core.js`; test dùng `fuel + 1/60` để bù hao trước tương tác |
| | A8. Hiển thị: thanh dầu; `fuel < 30` thì đèn và thanh dầu nhấp nháy 1 Hz | bản web (xem proof) |
| **2. Bóng hút dầu** | B1. `fuel < 30` mất vùng an toàn; đúng 30 còn | "vung an toan chi con khi fuel >= 30" |
| | B2. Chỉ bóng `wander` chọn đèn yếu gần nhất (hòa → id nhỏ); không có thì đèn tắt gần nhất; bóng `chase` không đổi mục tiêu | "wander: nham den sang..." |
| | B3. ≤ 2 m (XZ) vào `drain`, đứng yên, hút 5/giây, nhiều con cộng dồn, đèn vẫn hao 1/giây; `fuel_drain` mỗi 60 tick | "drain: bong toi den yeu...", "drain cong don" |
| | B4. Thoát `drain`: May ≤ 6 m → `chase`; Tỏa Sáng → `stunned` (+15); đèn tắt / xa > 2 m → `wander` | "drain -> chase ..." |
| | B5. Hết choáng thì về `wander` | "het choang -> wander" |
| | B6. Châm dầu từ < 30 lên ≥ 30 lúc có bóng trong 6 m: bóng bị đẩy ra ≤ 30 tick, không gây sát thương | "chau dau len >= 30 khi bong dang hut" |
| **3. Luật thắng** | C1. Thời gian 240/270/300 | "ban do chuan" |
| | C2. Không thắng sớm; thắng ở tick bình minh khi đèn sáng ≥ `ceil(0.6 × tổng)` (3/5, 4/6, 5/7), lý do `dawn_survived` | "khong con thang som", "binh minh: thang...", "nguong thang theo dem" |
| | C3. Thua: hết Ngọn Lửa (ưu tiên, kể cả tick cuối) `no_flames`, hoặc hết giờ thiếu đèn `dawn` | "binh minh: het Ngon Lua luon thua" |
| | C4. Thứ tự tick: trừ dầu ở bước 2, đèn `fuel ≤ 0` tắt ngay sau đó, thắng/thua xét sau mọi cập nhật | cấu trúc `step()` (chú thích bước 2 và 11) |
| **4. Sức chứa** | D1. `10 + 2·successful_lights`, tối đa 20; thắp lại tính; đèn đặt bằng scenario không tính; HUD hiện mang/sức chứa | "Suc chua tang dan", "snapshot v1.2", web |
| **5. Điểm** | E1. +5 mỗi đom đóm nạp/châm; +100 thắp đầu; +40 thắp lại; +5 mỗi bóng trúng Tỏa Sáng, +15 nếu đang drain; bình minh thắng +(50 + floor(fuel)) mỗi đèn và +50 mỗi Ngọn Lửa; không thưởng thời gian | các test điểm ở trên |
| **6. Mù màu** | F1. Cài đặt "Bảng màu dễ phân biệt" được lưu | web: `localStorage.ddl_settings.cb` |
| | F2. Viền và mắt Bóng Mực `#00B3FF`; cảnh báo `#FFFFFF` kèm ⚠ | web (ảnh trong proof) |
| | F3. Đèn tắt xẹp 20% và có vết rách; đèn sắp hết dầu nhấp nháy | web |
| **7. Contract v1.2** | G1. `contract_version` "1.2", tuning có đủ khóa mới và thời lượng mới | "contract v1.2" |
| | G2. Snapshot: `lanterns[].{fuel, ever_lit, relit_count}`, `player.capacity`, trạng thái `drain` | "snapshot v1.2", test drain |
| | G3. Scenario: `fuel`, `ever_lit`, `successful_lights`, `target_lantern_id`; `lit:true` không `fuel` → 100; sai định dạng → exit 2 | "snapshot v1.2", "v1.2: scenario sai" |
| | G4. Sự kiện mới `refuel`, `lantern_out`, `fuel_drain`; `lantern_lit.relight` | các test tương ứng |
