# ADR 0001 — Đèn cạn dầu: mô hình trạng thái đèn và luật thắng mới

- Trạng thái: chấp nhận (Phase 3, Ticket-03, Contract v1.2)
- Thay thế: luật "đèn sáng rồi không nhận thêm đom đóm", "Bóng Mực không bao giờ vào vùng an toàn", "thắng ngay khi tất cả đèn sáng", toàn bộ công thức điểm Phase 2.

## Bối cảnh
Người chơi giỏi thắp hết đèn trong 2 phút rồi game kết thúc. Nhà thiết kế muốn đổi mục tiêu từ "thắp hết" sang "giữ đảo sáng tới bình minh". Cần một mô hình đèn có thể tắt, một lý do để người chơi quay lại đèn, và một kẻ địch gây áp lực lên đèn chứ không chỉ lên người chơi.

## Quyết định

### 1. Mô hình trạng thái đèn
Mỗi đèn là `{ lit, fuelU, deposited, everLit, relit }`:

| Trạng thái | Điều kiện | Ý nghĩa |
|---|---|---|
| Tắt, chưa từng sáng | `!lit && !everLit` | cần 10 đom đóm để thắp |
| Tắt, từng sáng | `!lit && everLit` | cần 5 đom đóm để thắp lại |
| Sáng, mạnh | `lit && fuel >= 30` | có vùng an toàn 6 m |
| Sáng, yếu | `lit && fuel < 30` | mất vùng an toàn, nhấp nháy, thu hút Bóng Mực |
| Hết dầu | `fuel <= 0` | chuyển về "Tắt, từng sáng", `deposited = 0`, phát `lantern_out` |

`fuelU` là số nguyên theo đơn vị 1/60 (`fuel = fuelU / 60`). Hao 1.0/giây = trừ đúng 1 đơn vị mỗi tick, hút 5/giây = 5 đơn vị mỗi tick, mỗi đom đóm = 600 đơn vị. Không có số thực nên không có sai số tích lũy; chỉ làm tròn 1 chữ số khi xuất.

### 2. Bóng Mực và trạng thái `drain`
Thêm trạng thái `drain`. Bóng `wander` chọn mục tiêu mỗi tick (đèn sáng yếu gần nhất, hòa thì id nhỏ; không có thì đèn tắt gần nhất; không có nữa thì lang thang), đi tới ≤ 2 m rồi đứng yên hút. Thoát `drain` theo thứ tự: May vào ≤ 6 m → `chase`; trúng Tỏa Sáng → `stunned`; đèn tắt / fuel ≥ 30 / xa > 2 m → `wander`.

### 3. Luật thắng
Bỏ thắng sớm. Chỉ xét ở bước 11 sau mọi cập nhật: hết Ngọn Lửa → thua `no_flames`; hết giờ và số đèn sáng ≥ `ceil(0.6 × tổng)` → thắng `dawn_survived`; hết giờ mà thiếu → thua `dawn`. `all_lit` không còn được phát.

### 4. Sức chứa và điểm
Sức chứa = `min(20, 10 + 2 × successful_lights)`, đặt lại mỗi Đêm; thắp lại cũng tính, đèn đặt bằng scenario thì không. Điểm tính theo sự kiện (nạp +5/đom đóm, thắp mới +100, thắp lại +40, Tỏa Sáng +5 hoặc +15 nếu đang drain) và thưởng bình minh (50 + floor(fuel) mỗi đèn sáng, 50 mỗi Ngọn Lửa), không còn thưởng thời gian.

## Các phương án đã cân nhắc
- **Fuel là số thực:** đơn giản hơn nhưng cộng 1/60 sáu mươi lần không về đúng 1.0, và ngưỡng "đúng 30 còn vùng an toàn" sẽ dễ sai. Chọn số nguyên.
- **Giữ thêm điều kiện thắng sớm "thắp đủ đèn":** trái với mục đích ticket (không kết thúc sớm). Bỏ.
- **Mô hình hóa "đèn yếu" thành một trạng thái lưu riêng:** dễ lệch với `fuel`. Chọn suy ra từ `fuelU` (hàm `zoneActive`) để chỉ có một nguồn sự thật.
- **Bóng hút theo thời gian thực thay vì trạng thái `drain` riêng:** mất khả năng quan sát và kiểm thử (`fuel_drain`, thoát về `chase`). Chọn trạng thái riêng.

## Hệ quả
- Đèn "đầy" thực tế chỉ tồn tại trong đúng tick nó vừa được thắp hoặc châm đầy, vì dầu hao trước bước Tương tác của tick kế tiếp. Một đom đóm vẫn châm được đèn 99.98 → 100 (đúng theo công thức `ceil((100 − fuel)/10)`).
- Vùng an toàn của đèn vừa châm đúng 30 mất ngay tick sau (30 → 29.98).
- Bóng `wander` giờ có hướng đi rõ ràng (tới đèn), nên hành vi `wander` của Phase 2 (lang thang ngẫu nhiên) chỉ còn khi không có đèn nào cần tới.
- Một số test Phase 2 phải đổi; xem [CHANGELOG.md](../../CHANGELOG.md).
