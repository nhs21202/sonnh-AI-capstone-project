# Announcement Bar App

> Shopify embedded app: merchant quản lý nhiều thanh thông báo (message, màu sắc, đếm ngược theo mốc thời gian),
> nhưng **chỉ một thanh active tại một thời điểm** — thanh active hiển thị trên đầu storefront và **tự ẩn khi hết hạn**.

**Trạng thái:** 8/8 feature `done` · `bash init.sh` → **HARNESS GREEN (9/9)** · Đồ án cuối khóa — Khóa học AI Coding.

README này trả lời 6 câu hỏi trình bày của đồ án: **Mục tiêu · Kiến thức áp dụng · AI/Harness hỗ trợ thế nào ·
Kết quả · Khó khăn & cách xử lý · Bài học.**

---

## 🎯 Mục tiêu

Cho merchant một cách **không cần code** để hiển thị một thanh thông báo có style + đếm ngược ở đầu cửa hàng: soạn
trong embedded admin, lên storefront ngay, và **tự biến mất khi khuyến mãi kết thúc**. Có thể lưu nhiều thanh, nhưng
**tối đa một thanh được bật (active)** — storefront luôn render đúng một thanh đang active (hoặc không có thanh nào).

## 🧩 Kiến thức áp dụng (từ khóa học)

- **Planning & delegation** — brainstorm chốt scope → bộ tài liệu thiết kế → chia nhỏ thành feature DAG.
- **Prompt / context engineering** — viết luật một lần trong repo thay vì lặp lại mỗi prompt.
- **Claude Code + `CLAUDE.md` / `AGENTS.md`** — `AGENTS.md` là nguồn sự thật (tech stack, lệnh verify, ràng buộc cứng).
- **Hooks / permissions (guardrails)** — chặn lệnh nguy hiểm + cảnh báo lộ secret ở tầng harness.
- **Verification + testing (TDD)** — viết test trước (RED → GREEN); `init.sh` là cổng kiểm thử duy nhất.
- **Harness workflow & subagents** — điều phối vòng lặp act → verify → feedback; giao việc tra cứu cho subagent.

## 🤖 AI / Harness hỗ trợ thế nào

Tư tưởng: **coi AI như một junior giỏi nhưng hiểu đúng nghĩa đen → bọc một "harness" quanh nó** (luật rõ ràng, scope
đã hoạch định, guardrail tự động, thói quen "có bằng chứng mới done") để tốc độ của AI không biến thành cẩu thả.

Harness gồm 5 phân hệ, mỗi cái neo vào file thật trong repo:

| Phân hệ | Trả lời câu hỏi | Nằm ở đâu |
|---|---|---|
| **Guidance** | Luật chơi / nguồn sự thật? | `AGENTS.md`, `CLAUDE.md` |
| **Tools** | AI được chạy gì? | permission rules trong `.claude/settings.json` |
| **Environment** | Tái lập thế nào? | `docker-compose.yml`, `.env.example`, `.nvmrc`, `Makefile`, `init.sh` |
| **State** | Scope, nhật ký, bàn giao? | `.claude/feature_list.json`, `progress.md`, `session-handoff.md` |
| **Feedback** | Làm sao biết chạy đúng? | bộ kiểm `init.sh` + hooks guardrail |

Quy trình thực tế: **brainstorm** (chốt cả danh sách "out of scope") → **docs** (`PRODUCT` → `ARCHITECTURE` → `plan`
→ `user-stories`) → phân loại NOW/COMPLEX/DISCUSS và **tự quyết** các ngã rẽ → **feature DAG** (`feature_list.json`,
chỉ một feature in-progress) → code **test-first** → **verify** bằng `init.sh`. AI liệt kê phương án + đánh đổi;
con người ra quyết định. Guardrail được viết như code và được test; một feature chỉ `done` khi dán **output verify
thật**, không phải lời hứa.

## ✅ Kết quả

- **8/8 feature `done`**; `bash init.sh` → **HARNESS GREEN (9/9)**: backend `go test`, frontend **67 Vitest**,
  storefront **5 Vitest**, cả ba tầng build sạch.
- **Cài đặt live qua OAuth** trên dev store `sonnh-dev-store-3`; admin CRUD, public endpoint và thanh storefront đều
  chạy thật.
- Kiến trúc **3 tầng**: Go API (Fiber + GORM + MySQL) · admin React + Polaris + App Bridge · storefront Webpack
  (Theme App Extension).
- Tính năng: OAuth **stateless**, admin CRUD + **one-active invariant** + **anti-IDOR**, public endpoint có
  **server-side expiry gate**, admin UI (search / filter / sort / pagination 10/trang + live preview + toggle),
  storefront **sticky bar** + đếm ngược tự ẩn khi hết hạn.
- Tech stack: **Go 1.23 · React 18 · MySQL 8 · TypeScript / Vite / Webpack**.

## 🧱 Khó khăn & cách xử lý

**Về quy trình & kiến thức**
- Lần đầu **dựng harness** (5 file lõi và cách nối chúng lại) — vẫn còn loay hoay.
- **Ghép tất cả kiến thức** (planning, prompt/context engineering, guardrails, TDD, subagents) thành một quy trình
  thống nhất thì khá rối.
- **Lần đầu làm Shopify app từ con số 0** — OAuth, App Bridge, embedded admin, theme app extension đều mới.

**Bug kỹ thuật (đã fix)** — chủ yếu xử lý bằng *systematic debugging* và để `init.sh` làm "người kiểm":
- Windows Defender khóa `*.test.exe` khi `go test` → `init.sh` chỉ bỏ qua đúng artifact đó.
- npm `UNABLE_TO_VERIFY_LEAF_SIGNATURE` (TLS bị chặn) → chạy `npm_config_strict_ssl=false` theo từng lần.
- OAuth `redirect_uri` không khớp do `APP_URL` dư dấu `/`.
- CORS preflight **405** ở public endpoint → gắn CORS làm path middleware để trả `OPTIONS`.
- App Bridge chưa load → admin API **401** → thêm `<meta shopify-api-key>` + `app-bridge.js`.
- "Cannot GET /" → backend phục vụ SPA admin (`app.Static` + fallback).

## 📚 Bài học

- **Bằng chứng hơn lời hứa** — chỉ `done` khi có output verify thật.
- **Repo là spec** — luật/scope sống trong repo; có prototype thì UI mới đẹp & nhất quán.
- **Con người giữ quyền quyết định** — AI đề xuất, con người chọn; không để AI đoán thầm ở ngã rẽ.
- **Guardrail là code** — đừng tin AI cẩn thận, hãy làm cho sự cẩu thả không thể xảy ra (và test nó).
- **Handoff trung thực** + kiên nhẫn khi làm tech stack lần đầu.

## 📦 Sản phẩm bàn giao

- **Repo / source:** https://github.com/nhs21202/sonnh-AI-capstone-project
- **Slide trình bày:** [`presentation/index.html`](presentation/index.html) (mở bằng trình duyệt)
- **Ghi chú workflow AI/Harness:** [`present.md`](present.md)
- **Kịch bản demo E2E:** [`docs/demo-script.md`](docs/demo-script.md)

⏰ **Hạn nộp:** 14:00 Thứ Ba 30/06/2026.

## ▶️ Chạy nhanh

```bash
nvm use                                   # Node 22
npm_config_strict_ssl=false bash init.sh  # MySQL + cài đặt + test + build cả 3 tầng → HARNESS GREEN
```

Chi tiết chạy live (backend `go run .`, ngrok tunnel, `APP_URL`, `shopify app deploy`) và kịch bản demo:
xem [`docs/demo-script.md`](docs/demo-script.md). Tài liệu thiết kế đầy đủ ở [`docs/`](docs/) và `AGENTS.md`.
