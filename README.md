# O'ZARO

Аренда зеркал с индивидуальной матовой гравировкой для мероприятий в Ташкенте.
Сайт: https://khumoyunaminaddin.github.io/ozaro/

- `site/` — сайт на русском и узбекском (статический, без сборки). Данные — `site/config.js`, тексты — `site/i18n.js`, фото — `site/img/`.
- `site/calc.html` — калькулятор рентабельности по пакетам.
- `backend/Code.gs` — Google Apps Script: заявки → Telegram на телефон + Google Таблица (CRM), статусы, утренний план доставок.
- `docs/BUSINESS_PLAN.md` — бизнес-план и оценка рентабельности.
- `docs/LAUNCH.md` — подключение приёма заявок.

Локально: `cd site && python3 -m http.server` → http://localhost:8000
