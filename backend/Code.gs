/**
 * O'ZARO — приём заявок с сайта → Telegram на телефон + Google Таблица (CRM).
 *
 * Установка: docs/LAUNCH.md, шаг 2. Кратко:
 *   1. Google Таблица → Расширения → Apps Script → вставить этот файл.
 *   2. Настройки проекта → Свойства скрипта: BOT_TOKEN = токен от @BotFather.
 *   3. Написать своему боту «Start», затем запустить функцию setup() один раз.
 *   4. Развернуть → Новое развёртывание → Веб-приложение,
 *      «Выполнять как: я», «Доступ: все» → URL вставить в site/config.js.
 *
 * Что умеет:
 *   - каждая заявка — строка в листе «Заявки» и сообщение в Telegram
 *     с кнопкой звонка и кнопками статуса
 *     (Предоплата получена / Доставлено / Забрали / Отказ);
 *   - предупреждает, если на эту дату уже есть заказы (зеркал может не хватить);
 *   - 9:00 — план на сегодня и завтра (что везти, какая надпись), плюс заявки без ответа;
 *   - 20:00 — итог дня;
 *   - команды боту: /today, /week, /new, /plan.
 */

const SHEET = "Заявки";
const HEAD = ["№", "Создана", "Имя", "Телефон", "Дата события", "Пакет", "Цена $", "Зеркала",
  "Гравировка", "Событие", "Район", "Комментарий", "Статус", "Язык", "Источник", "Кампания"];
const COL = Object.fromEntries(HEAD.map((h, i) => [h, i]));
const STATUSES = { pre: "Предоплата получена", deliv: "Доставлено", back: "Забрали", rej: "Отказ" };
const ACTIVE = ["Новая", "Предоплата получена", "Доставлено"];
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
  ScriptApp.newTrigger("morningPlan").timeBased().atHour(9).everyDays(1).inTimezone(TZ).create();
  ScriptApp.newTrigger("dailyReport").timeBased().atHour(20).everyDays(1).inTimezone(TZ).create();
  tg_("sendMessage", { chat_id: chats_()[0], text: "✅ O'ZARO: бот подключён, заявки будут приходить сюда.\nКоманды: /today /week /new /plan" });
}

// ---------- приём заявки с сайта ----------
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const d = JSON.parse(e.postData.contents || "{}");
    if (d.website) return json_({ ok: true }); // ловушка для ботов
    const phone = cut_(d.phone, 20);
    const name = cut_(d.name, 60);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(d.eventDate) ? d.eventDate : "";
    if (phone.replace(/\D/g, "").length < 9 || !name || !date) return json_({ ok: false, error: "invalid" });
    if (tooMany_(phone)) return json_({ ok: false, error: "rate" });

    lock.waitLock(10000);
    const sh = sheet_();
    const sameDay = rows_().filter((r) => fmtDate_(r[COL["Дата события"]]) === date && ACTIVE.includes(r[COL["Статус"]])).length;
    const num = Math.max(1, sh.getLastRow());
    const now = Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd HH:mm");
    const row = [num, now, name, phone, date, cut_(d.packageName, 40), Number(d.price) || 0, cut_(d.mirrors, 60),
      cut_(d.engraving, 80), cut_(d.eventType, 40), cut_(d.district, 60), cut_(d.comment, 500), "Новая",
      cut_(d.lang, 4), cut_(d.utm_source, 40), cut_(d.utm_campaign, 60)];
    // апостроф — чтобы таблица не приняла текст клиента за формулу
    sh.appendRow(row.map((v) => (typeof v === "string" && /^[=+\-@]/.test(v) ? "'" + v : v)));
    sh.getRange(sh.getLastRow(), COL["Дата события"] + 1).setNumberFormat("@").setValue(date);
    lock.releaseLock();

    const text = [
      `🪞 <b>Заявка №${num}</b>`,
      `👤 ${h_(name)}`,
      `📞 <a href="tel:${phone.replace(/[^\d+]/g, "")}">${h_(phone)}</a>`,
      `📅 ${h_(prettyDate_(date))} — ${h_(d.eventType)}`,
      `📦 ${h_(d.packageName)} — $${Number(d.price) || 0}`,
      d.mirrors ? `🪞 ${h_(d.mirrors)}` : "",
      d.engraving ? `✍️ «${h_(d.engraving)}»` : "",
      `📍 ${h_(d.district)}`,
      d.comment ? `💬 ${h_(d.comment)}` : "",
      sameDay ? `⚠️ На эту дату уже заказов: ${sameDay} — проверьте, хватит ли зеркал` : "",
      daysTo_(date) < 7 ? `⏰ До события ${daysTo_(date)} дн.` : "",
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
        reply_markup: JSON.stringify(key === "back" || key === "rej" ? { inline_keyboard: [] } : buttons_(num)),
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
      else if (t.startsWith("/plan")) send_(chat, plan_(7));
      else send_(chat, "Команды: /today /week /new /plan");
    }
  });
}

function morningPlan() {
  const msg = "☀️ " + plan_(2) + "\n\n" + pending_();
  chats_().forEach((id) => send_(id, msg));
}
function dailyReport() { chats_().forEach((id) => send_(id, report_(1))); }

// ---------- отчёты ----------
function rows_() {
  const sh = sheet_();
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, HEAD.length).getValues();
}
/** События на ближайшие N дней — что везти и какую надпись готовить. */
function plan_(days) {
  const from = today_();
  const to = Utilities.formatDate(new Date(Date.now() + (days - 1) * 864e5), TZ, "yyyy-MM-dd");
  const r = rows_()
    .filter((x) => { const d = fmtDate_(x[COL["Дата события"]]); return d >= from && d <= to && ACTIVE.includes(x[COL["Статус"]]); })
    .sort((a, b) => (fmtDate_(a[COL["Дата события"]]) < fmtDate_(b[COL["Дата события"]]) ? -1 : 1));
  if (!r.length) return `📅 На ${days === 2 ? "сегодня и завтра" : days + " дн."} событий нет`;
  return `📅 <b>План: ${days === 2 ? "сегодня и завтра" : days + " дн."}</b>\n` + r.map((x) => [
    `• ${h_(prettyDate_(fmtDate_(x[COL["Дата события"]])))} — №${x[0]} ${h_(x[COL["Пакет"]])}${x[COL["Статус"]] === "Новая" ? " ❗без предоплаты" : ""}`,
    `  ${h_(x[COL["Имя"]])} ${h_(x[COL["Телефон"]])}, ${h_(x[COL["Район"]])}`,
    x[COL["Зеркала"]] ? `  🪞 ${h_(x[COL["Зеркала"]])}` : "",
    x[COL["Гравировка"]] ? `  ✍️ «${h_(x[COL["Гравировка"]])}»` : "",
  ].filter(String).join("\n")).join("\n");
}
function report_(days) {
  const since = Utilities.formatDate(new Date(Date.now() - (days - 1) * 864e5), TZ, "yyyy-MM-dd");
  const r = rows_().filter((x) => String(x[1]).slice(0, 10) >= since);
  const by = (s) => r.filter((x) => x[COL["Статус"]] === s);
  const paid = r.filter((x) => ["Предоплата получена", "Доставлено", "Забрали"].includes(x[COL["Статус"]]));
  const sum = paid.reduce((s, x) => s + (Number(x[COL["Цена $"]]) || 0), 0);
  const src = {};
  r.forEach((x) => { const k = x[COL["Источник"]] || "прямые"; src[k] = (src[k] || 0) + 1; });
  return [
    `📊 <b>${days === 1 ? "Сегодня" : "За " + days + " дн."}</b>`,
    `Заявок: ${r.length}`,
    `С предоплатой: ${paid.length} на $${sum}`,
    `Новых без ответа: ${by("Новая").length}`,
    `Отказов: ${by("Отказ").length}`,
    `Источники: ${Object.keys(src).map((k) => `${h_(k)} ${src[k]}`).join(", ") || "—"}`,
  ].join("\n");
}
function pending_() {
  const r = rows_().filter((x) => x[COL["Статус"]] === "Новая");
  if (!r.length) return "Нет необработанных заявок 👍";
  return `⏳ Ждут ответа или предоплаты (${r.length}):\n` +
    r.slice(-15).map((x) => `№${x[0]} ${h_(x[COL["Имя"]])} ${h_(x[COL["Телефон"]])} — ${h_(prettyDate_(fmtDate_(x[COL["Дата события"]])))}`).join("\n");
}
function setStatus_(num, status) {
  if (!num || !status) return;
  const sh = sheet_();
  const ids = sh.getRange(2, 1, Math.max(1, sh.getLastRow() - 1), 1).getValues();
  const i = ids.findIndex((x) => Number(x[0]) === num);
  if (i >= 0) sh.getRange(i + 2, COL["Статус"] + 1).setValue(status);
}

// ---------- утилиты ----------
function buttons_(num) {
  return { inline_keyboard: [
    [{ text: "💳 Предоплата", callback_data: `${num}:pre` }, { text: "🚚 Доставлено", callback_data: `${num}:deliv` }],
    [{ text: "📦 Забрали", callback_data: `${num}:back` }, { text: "❌ Отказ", callback_data: `${num}:rej` }],
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
function today_() { return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd"); }
function fmtDate_(v) { return v instanceof Date ? Utilities.formatDate(v, TZ, "yyyy-MM-dd") : String(v || "").slice(0, 10); }
function daysTo_(d) { return Math.round((new Date(d + "T00:00:00Z") - new Date(today_() + "T00:00:00Z")) / 864e5); }
function prettyDate_(d) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  const wd = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"][new Date(d + "T12:00:00Z").getUTCDay()];
  return `${day}.${m}.${y} (${wd})`;
}
function cut_(s, n) { return String(s || "").slice(0, n); }
function h_(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
