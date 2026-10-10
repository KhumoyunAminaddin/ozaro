# OZARO

Сайт заявок + автоматизация для бизнеса «производство на заказ и доставка» в Ташкенте.

- `site/` — сайт (статический, без сборки). Всё редактируется в `site/config.js`.
- `site/calc.html` — калькулятор рентабельности.
- `backend/Code.gs` — Google Apps Script: заявки → Telegram на телефон + Google Таблица (CRM), кнопки статусов, ежедневные отчёты.
- `docs/BUSINESS_PLAN.md` — бизнес-план и оценка рентабельности.
- `docs/LAUNCH.md` — запуск за 30 минут.

Локально: `cd site && python3 -m http.server` → http://localhost:8000
