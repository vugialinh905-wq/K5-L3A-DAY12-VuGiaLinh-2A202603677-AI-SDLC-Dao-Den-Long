# Credits

## Thư viện
- **Three.js r160** (MIT, © 2010–2023 Three.js Authors) — https://threejs.org. Nằm trong `vendor/three.module.js` (lấy bằng `npm pack three@0.160.0`, không sửa đổi); giấy phép tại `vendor/three.LICENSE`.
- **Node.js** — môi trường chạy lõi game, headless, server, soak, benchmark. Không có gói npm phụ thuộc nào khác.

## Asset, âm thanh, hình ảnh
- **Không dùng asset bên ngoài.** Mọi mô hình 3D (Mây, đèn lồng, Bóng Mực, Gió Lạc, cây dừa, cây cau, bụi, hoa, đảo, cầu, tháp) là hình khối cơ bản tạo bằng code trong `src/main.js` và `src/world.js`.
- **Âm thanh** (nhạc nền và hiệu ứng) được tổng hợp bằng WebAudio trong `src/audio.js`; không có file âm thanh nào.
- **Ảnh chụp màn hình** trong `docs/img/` chụp từ chính game này.
- **Phông chữ:** dùng phông hệ thống (Segoe UI / system-ui), không nhúng phông.

## Công cụ AI tạo nội dung
- **Claude Code (Claude Sonnet 5.5, Anthropic)** viết phần lớn mã nguồn, test và tài liệu theo yêu cầu và duyệt của tác giả. Chi tiết quy trình, lỗi của AI và cách phát hiện: [docs/retro.md](docs/retro.md) và các `docs/notes/phase-N.md`.
- Không dùng công cụ AI sinh ảnh hoặc âm thanh.

## Giấy phép
Mã nguồn của dự án: MIT, xem [LICENSE](LICENSE).
