/**
 * OZARO — приём заявок с сайта → Telegram на телефон + Google Таблица (CRM).
 *
 * Установка: docs/LAUNCH.md, шаг 2. Кратко:
 *   1. Google Таблица → Расширения → Apps Script → вставить этот файл.
 *   2. Настройки проекта → Свойства скрипта:
 *        BOT_TOKEN = токен от @BotFather
 *        CHAT_IDS  = ваш chat id (несколько — через запятую)
 *   3. Запустить функцию setup() один раз (выдать доступы).
 *   4. Развернуть → Новое развёртывание → Веб-приложение,
 *      «Выполнять как: я», «Доступ: все» → URL вставить в site/config.js.
 *
 * Что умеет:
 *   - каждая заявка: строка в листе «Заявки» + сообщение в Telegram
 *     с кнопками статуса (Принят / В производстве / Доставлен / Отказ);
 *   - нажатие кнопки меняет статус в таблице;
 *   - команды боту: /today, /week, /new — сводки;
 *   - каждый день в 20:00 — итог дня; каждое утро в 9:00 — напоминание
 *     о необработанных заявках.
 */

const SHEET = "Заявки";
const HEAD = ["№", "Дата", "Имя", "Телефон", "Товар", "Кол-во", "Район", "Комментарий",
  "Сумма (оценка)", "Статус", "Источник", "Кампания", "Страница"];
const STATUSES = { acc: "Принят", prod: "В производстве", done: "Доставлен", rej: "Отказ" };
const TZ = "Asia/Tashkent";

function props_() { return PropertiesService.getScriptProperties(); }
function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) {
    sh = ss.insertSheet(SHEET);
    sh.appendRow(HEAD);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEAD.length).setFontWeight("bold");
  }
  return sh;
}

/** Запустить один раз вручную: создаёт лист и расписания. */
function setup() {
  sheet_();
  if (!chats_().length) {
    // Перед запуском напишите боту любое сообщение — chat id возьмём оттуда
    const u = tg_("getUpdates", {});
    const last = u && u.ok && u.result.filter((x) => x.message).pop();
    if (!last) throw new Error("Сначала откройте своего бота в Telegram и нажмите Start, затем запустите setup() снова");
    props_().setProperty("CHAT_IDS", String(last.message.chat.id));
    props_().setProperty("TG_OFFSET", String(last.update_id + 1));
  }
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("pollTelegram").timeBased().everyMinutes(1).create();
  ScriptApp.newTrigger("dailyReport").timeBased().atHour(20).everyDays(1).inTimezone(TZ).create();
  ScriptApp.newTrigger("morningReminder").timeBased().atHour(9).everyDays(1).inTimezone(TZ).create();
  tg_("sendMessage", { chat_id: chats_()[0], text: "✅ OZARO: бот подключён, заявки будут приходить сюда." });
}

// ---------- приём заявки с сайта ----------
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const d = JSON.parse(e.postData.contents || "{}");
    if (d.website) return json_({ ok: true }); // honeypot
    const phone = String(d.phone || "").slice(0, 20);
    const name = String(d.name || "").slice(0, 60);
    if (phone.replace(/\D/g, "").length < 9 || !name) return json_({ ok: false, error: "invalid" });
    if (tooMany_(phone)) return json_({ ok: false, error: "rate" });

    lock.waitLock(10000);
    const sh = sheet_();
    const num = Math.max(1, sh.getLastRow()); // №1 — первая заявка под заголовком
    const now = Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd HH:mm");
    const row = [num, now, name, phone, cut_(d.productName, 80), Number(d.qty) || 1, cut_(d.district, 40),
      cut_(d.comment, 500), Number(d.estimate) || 0, "Новая", cut_(d.utm_source, 40), cut_(d.utm_campaign, 60), cut_(d.page, 200)];
    // апостроф — чтобы таблица не приняла текст за формулу
    sh.appendRow(row.map((v) => (typeof v === "string" && /^[=+\-@]/.test(v) ? "'" + v : v)));
    lock.releaseLock();

    const text = [
      `🆕 <b>Заявка №${num}</b>`,
      `👤 ${h_(name)}`,
      `📞 <a href="tel:${phone.replace(/[^\d+]/g, "")}">${h_(phone)}</a>`,
      `📦 ${h_(d.productName)} × ${Number(d.qty) || 1}`,
      `📍 ${h_(d.district)}`,
      d.comment ? `💬 ${h_(d.comment)}` : "",
      d.estimate ? `💰 ~${fmt_(d.estimate)} сум` : "",
      d.utm_source ? `📈 ${h_(d.utm_source)} / ${h_(d.utm_campaign || "")}` : "",
    ].filter(String).join("\n");
    chats_().forEach((id) => tg_("sendMessage", {
      chat_id: id, text, parse_mode: "HTML", reply_markup: JSON.stringify(buttons_(num)),
    }));
    return json_({ ok: true, id: num });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: "server" });
  }
}

function doGet() { return json_({ ok: true, service: "ozaro-leads" }); }

// ---------- Telegram: кнопки и команды (опрос раз в минуту) ----------
function pollTelegram() {
  const p = props_();
  const offset = Number(p.getProperty("TG_OFFSET") || 0);
  const res = tg_("getUpdates", { offset, timeout: 0, allowed_updates: JSON.stringify(["message", "callback_query"]) });
  if (!res || !res.ok) return;
  const allowed = chats_().map(String);
  res.result.forEach((u) => {
    p.setProperty("TG_OFFSET", String(u.update_id + 1));
    if (u.callback_query) {
      const q = u.callback_query;
      if (!allowed.includes(String(q.message.chat.id))) return;
      const [num, key] = String(q.data).split(":");
      setStatus_(Number(num), STATUSES[key]);
      tg_("answerCallbackQuery", { callback_query_id: q.id, text: `№${num}: ${STATUSES[key]}` });
      tg_("editMessageText", {
        chat_id: q.message.chat.id, message_id: q.message.message_id, parse_mode: "HTML",
        text: h_(q.message.text) + `\n\n➡️ <b>${STATUSES[key]}</b>`,
        reply_markup: JSON.stringify(key === "done" || key === "rej" ? { inline_keyboard: [] } : buttons_(num)),
      });
    } else if (u.message && u.message.text) {
      const chat = String(u.message.chat.id);
      const t = u.message.text.trim();
      if (t.startsWith("/start") || t.startsWith("/id")) {
        tg_("sendMessage", { chat_id: chat, text: `Ваш chat id: ${chat}\nДобавьте его в CHAT_IDS в свойствах скрипта.` });
        return;
      }
      if (!allowed.includes(chat)) return;
      if (t.startsWith("/today")) send_(chat, report_(1));
      else if (t.startsWith("/week")) send_(chat, report_(7));
      else if (t.startsWith("/new")) send_(chat, pending_());
      else send_(chat, "Команды: /today /week /new");
    }
  });
}

function dailyReport() { chats_().forEach((id) => send_(id, report_(1))); }
function morningReminder() {
  const msg = pending_();
  if (!/Нет/.test(msg)) chats_().forEach((id) => send_(id, "☀️ " + msg));
}

// ---------- отчёты ----------
function rows_() {
  const sh = sheet_();
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, HEAD.length).getValues();
}
function report_(days) {
  const since = Utilities.formatDate(new Date(Date.now() - (days - 1) * 864e5), TZ, "yyyy-MM-dd");
  const r = rows_().filter((x) => String(x[1]).slice(0, 10) >= since);
  const by = (s) => r.filter((x) => x[9] === s);
  const sum = (a) => a.reduce((s, x) => s + (Number(x[8]) || 0), 0);
  const src = {};
  r.forEach((x) => (src[x[10] || "прямые"] = (src[x[10] || "прямые"] || 0) + 1));
  return [
    `📊 <b>${days === 1 ? "Сегодня" : "За " + days + " дн."}</b>`,
    `Заявок: ${r.length}`,
    `Доставлено: ${by("Доставлен").length} на ~${fmt_(sum(by("Доставлен")))} сум`,
    `В работе: ${by("Принят").length + by("В производстве").length}`,
    `Новых без ответа: ${by("Новая").length}`,
    `Отказов: ${by("Отказ").length}`,
    `Источники: ${Object.keys(src).map((k) => `${h_(k)} ${src[k]}`).join(", ") || "—"}`,
  ].join("\n");
}
function pending_() {
  const r = rows_().filter((x) => x[9] === "Новая");
  if (!r.length) return "Нет необработанных заявок 👍";
  return `⏳ Необработанные заявки (${r.length}):\n` +
    r.slice(-15).map((x) => `№${x[0]} ${h_(x[2])} ${h_(x[3])} — ${h_(x[4])}`).join("\n");
}
function setStatus_(num, status) {
  if (!num || !status) return;
  const sh = sheet_();
  const ids = sh.getRange(2, 1, Math.max(1, sh.getLastRow() - 1), 1).getValues();
  const i = ids.findIndex((x) => Number(x[0]) === num);
  if (i >= 0) sh.getRange(i + 2, HEAD.indexOf("Статус") + 1).setValue(status);
}

// ---------- утилиты ----------
function buttons_(num) {
  return { inline_keyboard: [
    [{ text: "✅ Принят", callback_data: `${num}:acc` }, { text: "🛠 В производстве", callback_data: `${num}:prod` }],
    [{ text: "🚚 Доставлен", callback_data: `${num}:done` }, { text: "❌ Отказ", callback_data: `${num}:rej` }],
  ] };
}
function chats_() { return String(props_().getProperty("CHAT_IDS") || "").split(",").map((s) => s.trim()).filter(String); }
function tg_(method, payload) {
  const token = props_().getProperty("BOT_TOKEN");
  if (!token) throw new Error("BOT_TOKEN не задан в свойствах скрипта");
  const r = UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "post", payload, muteHttpExceptions: true });
  try { return JSON.parse(r.getContentText()); } catch (_) { return null; }
}
function send_(chat, text) { tg_("sendMessage", { chat_id: chat, text, parse_mode: "HTML" }); }
function tooMany_(phone) {
  const c = CacheService.getScriptCache();
  const k = "rl_" + phone.replace(/\D/g, "");
  const n = Number(c.get(k) || 0);
  c.put(k, String(n + 1), 600);
  return n >= 3; // не больше 3 заявок с одного номера за 10 минут
}
function cut_(s, n) { return String(s || "").slice(0, n); }
function h_(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function fmt_(n) { return Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " "); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
