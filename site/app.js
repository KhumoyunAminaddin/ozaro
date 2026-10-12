(function () {
  const C = window.OZARO;
  const I = window.OZARO_I18N;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const phoneDigits = C.phone.replace(/[^\d+]/g, "");
  const igUrl = "https://instagram.com/" + C.instagram;
  const igDirect = "https://ig.me/m/" + C.instagram;

  let lang = (navigator.language || "").startsWith("uz") ? "uz" : "ru";
  try { lang = localStorage.getItem("ozaro_lang") || lang; } catch (_) {}
  if (!I[lang]) lang = "ru";
  const t = (k) => I[lang][k];

  // --- метки рекламы (utm) запоминаем, чтобы видеть источник заявки ---
  const qs = new URLSearchParams(location.search);
  const utm = {};
  ["utm_source", "utm_medium", "utm_campaign", "utm_content"].forEach((k) => qs.get(k) && (utm[k] = qs.get(k)));
  try {
    if (Object.keys(utm).length) localStorage.setItem("ozaro_utm", JSON.stringify(utm));
    else Object.assign(utm, JSON.parse(localStorage.getItem("ozaro_utm") || "{}"));
  } catch (_) {}
  if (qs.get("lang") && I[qs.get("lang")]) lang = qs.get("lang");

  // --- статичные привязки ---
  const binds = {
    phoneLink: (el) => { el.textContent = C.phone; el.href = "tel:" + phoneDigits; },
    igLink: (el) => (el.href = igUrl),
    established: (el) => (el.textContent = C.established),
    city: (el) => (el.textContent = C.city[lang]),
  };

  // --- форма: выбор зеркал и итог ---
  const form = $("#form");
  const status = $("#status");
  const picked = new Set();
  const dateInput = form.eventDate;
  const today = new Date();
  dateInput.min = today.toISOString().slice(0, 10);

  function render() {
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const v = t(el.dataset.i18n);
      if (typeof v === "string") el.innerHTML = v; // строки словаря — наши, без пользовательского ввода
    });
    document.querySelectorAll("[data-i18n-ph]").forEach((el) => (el.placeholder = t(el.dataset.i18nPh)));
    document.querySelectorAll("[data-bind]").forEach((el) => binds[el.dataset.bind] && binds[el.dataset.bind](el));
    document.querySelectorAll("[data-lang]").forEach((b) => b.classList.toggle("on", b.dataset.lang === lang));

    $("#mirrorList").innerHTML = C.mirrors.map((m) => `
      <article class="mirror">
        <div class="mirror-img"><img src="${esc(m.img)}" alt="${esc(m.name)}" loading="lazy" width="217" height="279"></div>
        <div>
          <h3>${esc(m.name)}</h3>
          <dl>
            <dt>${t("lShape")}</dt><dd>${esc(m[lang].shape)}</dd>
            <dt>${t("lFrame")}</dt><dd>${esc(m[lang].frame)}</dd>
            <dt>${t("lSize")}</dt><dd>${esc(m[lang].size)}</dd>
          </dl>
        </div>
      </article>`).join("");

    $("#packageList").innerHTML = C.packages.map((p) => `
      <article class="pkg${p.featured ? " featured" : ""}">
        ${p.featured ? `<span class="badge">${t("popular")}</span>` : ""}
        <h3>${esc(p[lang].name)}</h3>
        <div class="price">${C.currency}${p.price}</div>
        <ul>
          <li>${t("mirrorsWord")(p.mirrors)}</li>
          <li>${t("incEngraving")}</li>
          ${p.flowers ? `<li>${t("incFlowers")}</li>` : ""}
          ${p.light ? `<li>${t("incLight")}</li>` : ""}
          <li>${t("incDelivery")}</li>
        </ul>
        <a class="btn ${p.featured ? "" : "ghost"}" href="#order" data-pick="${esc(p.id)}">${t("choose")}</a>
      </article>`).join("");

    $("#steps").innerHTML = t("steps").map((s) => `<li>${esc(s)}</li>`).join("");
    $("#orderFacts").innerHTML = t("facts").map((s) => `<li>${esc(s)}</li>`).join("");
    $("#faqList").innerHTML = t("faq").map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("");
    $("#team").innerHTML = C.team.map((m) => `
      <div class="member"><span class="avatar">${esc(m[lang].name[0])}</span><b>${esc(m[lang].name)}</b><span>${esc(m[lang].role)}</span></div>`).join("");

    const sel = $("#packageSel");
    const cur = sel.value || "classic";
    sel.innerHTML = C.packages.map((p) => `<option value="${esc(p.id)}">${esc(p[lang].name)} — ${C.currency}${p.price}</option>`).join("");
    sel.value = cur;

    const ev = $("#eventSel");
    const curEv = ev.selectedIndex;
    ev.innerHTML = t("events").map((e, i) => `<option value="${i}">${esc(e)}</option>`).join("");
    ev.selectedIndex = Math.max(0, curEv);

    $("#districtSel").innerHTML = C.districts.map((d) => `<option>${esc(d)}</option>`).join("");

    $("#mirrorChips").innerHTML = C.mirrors.map((m) =>
      `<button type="button" class="chip${picked.has(m.id) ? " on" : ""}" data-mirror="${esc(m.id)}">${esc(m.name)}</button>`).join("");
    updateTotal();
  }

  function updateTotal() {
    const p = C.packages.find((x) => x.id === form.package.value);
    $("#total").innerHTML = p ? `${t("total")}: <b>${C.currency}${p.price}</b>` : "";
  }

  document.addEventListener("click", (e) => {
    const lb = e.target.closest("[data-lang]");
    if (lb) {
      lang = lb.dataset.lang;
      try { localStorage.setItem("ozaro_lang", lang); } catch (_) {}
      render();
      return;
    }
    const pick = e.target.closest("[data-pick]");
    if (pick) { form.package.value = pick.dataset.pick; updateTotal(); }
    const chip = e.target.closest("[data-mirror]");
    if (chip) {
      const id = chip.dataset.mirror;
      picked.has(id) ? picked.delete(id) : picked.add(id);
      chip.classList.toggle("on");
    }
  });
  form.package.addEventListener("change", updateTotal);

  // --- отправка заявки ---
  const setStatus = (msg, cls) => { status.textContent = msg; status.className = "status full " + (cls || ""); };

  function leadText(d) {
    return [
      `Заявка O'ZARO`,
      `Имя: ${d.name}`,
      `Телефон: ${d.phone}`,
      `Дата: ${d.eventDate}`,
      `Пакет: ${d.packageName} ($${d.price})`,
      d.mirrors ? `Зеркала: ${d.mirrors}` : "",
      d.engraving ? `Гравировка: ${d.engraving}` : "",
      `Событие: ${d.eventType}`,
      `Район: ${d.district}`,
      d.comment ? `Комментарий: ${d.comment}` : "",
    ].filter(Boolean).join("\n");
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    if (f.website) return; // бот
    const digits = (f.phone || "").replace(/\D/g, "");
    const bad = { name: !f.name.trim(), phone: digits.length < 9, eventDate: !f.eventDate };
    Object.keys(bad).forEach((k) => form[k].classList.toggle("bad", bad[k]));
    if (bad.name || bad.phone || bad.eventDate) return setStatus(t("errRequired"), "err");

    const p = C.packages.find((x) => x.id === f.package);
    const data = {
      name: f.name.trim(),
      phone: f.phone.trim(),
      eventDate: f.eventDate,
      package: f.package,
      packageName: p ? p.ru.name : f.package,
      price: p ? p.price : 0,
      mirrors: C.mirrors.filter((m) => picked.has(m.id)).map((m) => m.name).join(", "),
      engraving: (f.engraving || "").trim(),
      eventType: I.ru.events[Number(f.eventType)] || "",
      district: f.district,
      comment: (f.comment || "").trim(),
      lang,
      page: location.href,
      ...utm,
    };

    const days = (new Date(f.eventDate) - new Date(today.toISOString().slice(0, 10))) / 864e5;
    const soon = days < 7;
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    setStatus(t("sending"));

    if (C.leadEndpoint) {
      try {
        // text/plain — без CORS-preflight, Apps Script это принимает
        const r = await fetch(C.leadEndpoint, { method: "POST", body: JSON.stringify(data) });
        const j = await r.json();
        if (!j.ok) throw new Error(j.error || "fail");
        form.reset();
        picked.clear();
        render();
        setStatus(t("ok") + (soon ? " " + t("errSoon") : ""), "ok");
        if (window.fbq) window.fbq("track", "Lead");
        btn.disabled = false;
        return;
      } catch (err) {
        console.warn("lead endpoint failed", err);
      }
    }
    // Запасной путь: копируем текст заявки и открываем Instagram Direct
    try { await navigator.clipboard.writeText(leadText(data)); } catch (_) {}
    setStatus(t("fallback"), "ok");
    window.open(C.telegram ? "https://t.me/" + C.telegram + "?text=" + encodeURIComponent(leadText(data)) : igDirect, "_blank");
    btn.disabled = false;
  });

  render();
})();
