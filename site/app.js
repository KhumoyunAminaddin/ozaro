(function () {
  const C = window.OZARO;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => Number(n).toLocaleString("ru-RU").replace(/,/g, " ") + " " + C.currency;
  const phoneDigits = C.phone.replace(/[^\d+]/g, "");
  const tgUrl = "https://t.me/" + C.telegram;

  // --- простые привязки из config.js ---
  const binds = {
    brand: (el) => (el.textContent = C.brand),
    tagline: (el) => (el.textContent = C.tagline),
    subtitle: (el) => (el.textContent = C.subtitle),
    city: (el) => (el.textContent = C.city),
    workHours: (el) => (el.textContent = C.workHours),
    phoneLink: (el) => { el.textContent = C.phone; el.href = "tel:" + phoneDigits; },
    tgLink: (el) => (el.href = tgUrl),
    igLink: (el) => (el.href = "https://instagram.com/" + C.instagram),
  };
  document.querySelectorAll("[data-bind]").forEach((el) => binds[el.dataset.bind] && binds[el.dataset.bind](el));
  document.title = C.brand + " — " + C.tagline;
  $("#year").textContent = new Date().getFullYear();

  $("#benefits").innerHTML = C.benefits.map((b) => `<div class="benefit"><b>${esc(b.t)}</b><span>${esc(b.d)}</span></div>`).join("");
  $("#steps").innerHTML = C.steps.map((s) => `<li>${esc(s)}</li>`).join("");
  $("#faqList").innerHTML = C.faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("");

  $("#products").innerHTML = C.products.map((p) => `
    <article class="card">
      ${p.img ? `<img src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy">` : `<div class="ph">${esc(C.brand)}</div>`}
      <div class="body">
        <h3>${esc(p.name)}</h3>
        <p>${esc(p.desc)}</p>
        <div class="price">от ${money(p.price)}</div>
        <a class="btn" href="#order" data-pick="${esc(p.id)}">Заказать</a>
      </div>
    </article>`).join("");

  const productSel = $("#productSel");
  productSel.innerHTML = C.products.map((p) => `<option value="${esc(p.id)}">${esc(p.name)} — от ${money(p.price)}</option>`).join("") + `<option value="custom">Индивидуальный заказ</option>`;
  $("#districtSel").innerHTML = C.districts.map((d) => `<option>${esc(d)}</option>`).join("");
  document.addEventListener("click", (e) => {
    const id = e.target.closest("[data-pick]")?.dataset.pick;
    if (id) productSel.value = id;
  });

  // --- метки рекламы (utm) сохраняем, чтобы видеть, откуда заявка ---
  const qs = new URLSearchParams(location.search);
  const utm = {};
  ["utm_source", "utm_medium", "utm_campaign", "utm_content"].forEach((k) => qs.get(k) && (utm[k] = qs.get(k)));
  try {
    if (Object.keys(utm).length) localStorage.setItem("ozaro_utm", JSON.stringify(utm));
    else Object.assign(utm, JSON.parse(localStorage.getItem("ozaro_utm") || "{}"));
  } catch (_) {}

  // --- отправка заявки ---
  const form = $("#form");
  const status = $("#status");
  const setStatus = (t, cls) => { status.textContent = t; status.className = "status full " + (cls || ""); };

  function leadText(d) {
    return [
      `Заявка с сайта ${C.brand}`,
      `Имя: ${d.name}`,
      `Телефон: ${d.phone}`,
      `Товар: ${d.productName} × ${d.qty}`,
      `Район: ${d.district}`,
      d.comment ? `Комментарий: ${d.comment}` : "",
    ].filter(Boolean).join("\n");
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    if (f.website) return; // бот
    const digits = (f.phone || "").replace(/\D/g, "");
    form.phone.classList.toggle("bad", digits.length < 9);
    form.name.classList.toggle("bad", !f.name.trim());
    if (digits.length < 9 || !f.name.trim()) return setStatus("Укажите имя и телефон", "err");

    const prod = C.products.find((p) => p.id === f.product);
    const data = {
      name: f.name.trim(),
      phone: f.phone.trim(),
      product: f.product,
      productName: prod ? prod.name : "Индивидуальный заказ",
      qty: Math.max(1, parseInt(f.qty, 10) || 1),
      district: f.district,
      comment: (f.comment || "").trim(),
      estimate: prod ? prod.price * Math.max(1, parseInt(f.qty, 10) || 1) : 0,
      page: location.href,
      ...utm,
    };

    const btn = form.querySelector("button");
    btn.disabled = true;
    setStatus("Отправляем…");

    if (C.leadEndpoint) {
      try {
        // text/plain — без CORS-preflight, Apps Script это принимает
        const r = await fetch(C.leadEndpoint, { method: "POST", body: JSON.stringify(data) });
        const j = await r.json();
        if (!j.ok) throw new Error(j.error || "fail");
        form.reset();
        setStatus("Спасибо! Заявка принята, перезвоним в течение 15 минут.", "ok");
        if (window.ym && window.YM_ID) window.ym(window.YM_ID, "reachGoal", "lead");
        if (window.fbq) window.fbq("track", "Lead");
        btn.disabled = false;
        return;
      } catch (err) {
        console.warn("lead endpoint failed", err);
      }
    }
    // Запасной путь: открыть Telegram с готовым текстом заявки
    setStatus("Откроется Telegram — нажмите «Отправить», и заявка придёт нам.", "ok");
    window.open(tgUrl + "?text=" + encodeURIComponent(leadText(data)), "_blank");
    btn.disabled = false;
  });
})();
