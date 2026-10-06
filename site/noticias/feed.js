// Feed de notícias do LoveDopa (lovedopa.org/noticias/).
// Lê public.news_items e public.news_runs do Supabase do LoveDopa (chave anon, leitura pública por RLS).
(function () {
  var SB = "https://lehionghdrddxycyeoib.supabase.co/rest/v1/";
  var KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlaGlvbmdoZHJkZHh5Y3llb2liIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMDE5MDIsImV4cCI6MjA5MTU3NzkwMn0.r03NyP32WHf1beOszTZGyvLffpsiME2kbCcYk351YMo";
  var H = { apikey: KEY, Authorization: "Bearer " + KEY };
  var CATS = { "pesquisa": "Pesquisa", "tratamento": "Tratamento", "qualidade-de-vida": "Qualidade de vida", "cuidado": "Cuidado", "politica-e-acesso": "Política e acesso", "comunidade": "Comunidade" };
  var EV = { "estudo-em-humanos": "Estudo em humanos", "estudo-pre-clinico": "Pré-clínico", "revisao": "Revisão", "aprovacao-regulatoria": "Aprovação regulatória", "noticia": "Notícia", "opiniao": "Opinião" };
  var items = [], filter = "todas", lastRunAt = null;
  var $ = function (id) { return document.getElementById(id); };

  // Cria elementos sem HTML em string: todo texto entra como textContent.
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "class") n.className = attrs[k];
      else if (k === "text") n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function safeUrl(u) { try { var x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : "#"; } catch (e) { return "#"; } }
  function icon(paths, filled) {
    var NS = "http://www.w3.org/2000/svg", s = document.createElementNS(NS, "svg");
    s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true");
    s.setAttribute("fill", filled ? "currentColor" : "none"); if (!filled) { s.setAttribute("stroke", "currentColor"); s.setAttribute("stroke-width", "2"); }
    paths.forEach(function (p) { var e = document.createElementNS(NS, p[0]); Object.keys(p[1]).forEach(function (k) { e.setAttribute(k, p[1][k]); }); s.appendChild(e); });
    return s;
  }
  var IG = function () { return icon([["rect", { x: 3, y: 3, width: 18, height: 18, rx: 5 }], ["circle", { cx: 12, cy: 12, r: 4 }], ["circle", { cx: 17.5, cy: 6.5, r: 1, fill: "currentColor" }]]); };
  var WA = function () { return icon([["path", { d: "M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.3.3c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.2z" }]], true); };
  var LK = function () { return icon([["path", { d: "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" }], ["path", { d: "M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" }]]); };

  function rel(iso) {
    if (!iso) return "";
    var s = (Date.now() - Date.parse(iso)) / 1000;
    var r = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
    if (s < 3600) return r.format(-Math.max(1, Math.round(s / 60)), "minute");
    if (s < 86400) return r.format(-Math.round(s / 3600), "hour");
    return r.format(-Math.round(s / 86400), "day");
  }
  function hhmm(iso) { return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }); }
  function get(path) { return fetch(SB + path, { headers: H }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  function toast(msg) { var t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("show"); }, 4500); }

  function renderFilters() {
    var used = {}; items.forEach(function (i) { used[i.category] = 1; });
    var box = $("filters"); clear(box);
    [["todas", "Todas"]].concat(Object.keys(CATS).filter(function (k) { return used[k]; }).map(function (k) { return [k, CATS[k]]; }))
      .forEach(function (f) { box.appendChild(el("button", { class: "chip", type: "button", "data-f": f[0], "aria-pressed": String(filter === f[0]), text: f[1] })); });
  }

  function card(i) {
    var isNew = Date.now() - Date.parse(i.created_at) < 3 * 3600 * 1000;
    var ig = el("button", { class: "btn btn-ig", type: "button" }, [IG(), "Postar no Instagram"]);
    ig.addEventListener("click", function () { shareInstagram(i, ig); });
    var wa = el("button", { class: "btn btn-ghost", type: "button", "aria-label": "Enviar pelo WhatsApp" }, [WA(), el("span", { class: "hide-sm", text: "WhatsApp" })]);
    wa.addEventListener("click", function () { logShare(i, "whatsapp"); window.open("https://wa.me/?text=" + encodeURIComponent(i.title_pt + "\n\n" + (i.takeaway_pt || "") + "\n\n" + permalink(i)), "_blank", "noopener"); });
    var lk = el("button", { class: "btn btn-ghost", type: "button", "aria-label": "Copiar link da notícia" }, [LK()]);
    lk.addEventListener("click", function () { navigator.clipboard.writeText(permalink(i)).then(function () { logShare(i, "link"); toast("Link copiado."); }); });
    return el("article", { class: "item", id: i.slug }, [
      el("div", { class: "meta" }, [
        isNew ? el("span", { class: "badge b-new", text: "Nova" }) : null,
        el("span", { class: "badge b-cat", text: CATS[i.category] || i.category }),
        el("span", { class: "badge b-ev", text: EV[i.evidence_level] || i.evidence_level }),
        el("span", { text: "· publicada " + rel(i.created_at) }),
      ]),
      el("h3", { text: i.title_pt }),
      i.takeaway_pt ? el("p", { class: "takeaway", text: i.takeaway_pt }) : null,
      el("div", { class: "locked" }, [
        el("div", { class: "locked__txt" }, [
          el("strong", { text: "Resumo e comentário do LoveDopa" }),
          el("span", { text: "Para quem está na plataforma · fonte: " + i.source_name }),
        ]),
        el("a", { class: "btn btn-lock", href: "https://app.lovedopa.org/lista-de-espera?origem=noticia&n=" + encodeURIComponent(i.slug), text: "Ler na íntegra" }),
      ]),
      el("div", { class: "row" }, [
        el("span", { class: "source", text: "Compartilhe:" }),
        el("div", { class: "actions" }, [ig, wa, lk]),
      ]),
    ]);
  }

  function render() {
    var feed = $("feed"); clear(feed);
    var list = items.filter(function (i) { return filter === "todas" || i.category === filter; });
    if (!list.length) { feed.appendChild(el("div", { class: "empty", text: "Ainda não há notícias neste tema. O agente procura novidades a cada hora." })); return; }
    list.forEach(function (i) { feed.appendChild(card(i)); });
  }

  function permalink(i) { return "https://lovedopa.org/noticias/#" + i.slug; }
  function logShare(i, channel) {
    fetch(SB + "news_shares", { method: "POST", headers: Object.assign({ "Content-Type": "application/json", Prefer: "return=minimal" }, H), body: JSON.stringify({ news_id: i.id, channel: channel, surface: "site" }) }).catch(function () {});
    try { gtag("event", "share", { method: channel, content_type: "news", item_id: i.slug }); } catch (e) {}
  }
  function caption(i) {
    return i.title_pt + "\n\n" + (i.takeaway_pt || "") + "\n\nResumo e comentário completos em lovedopa.org/noticias\nFonte: " + i.source_name + "\n\n#Parkinson #DoençaDeParkinson #LoveDopa #Cuidadores #SaúdeNeurológica";
  }

  // ---------- imagem com a marca LoveDopa para o Instagram (1080x1350) ----------
  var logo = new Image(); logo.src = "../logo-symbol.png";
  function wrapText(ctx, text, x, y, maxW, lh, maxLines) {
    var words = String(text).split(/\s+/), line = "", lines = [];
    for (var n = 0; n < words.length; n++) {
      var test = line ? line + " " + words[n] : words[n];
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = words[n]; } else { line = test; }
    }
    if (line) lines.push(line);
    if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, "") + "…"; }
    lines.forEach(function (l, k) { ctx.fillText(l, x, y + k * lh); });
    return y + lines.length * lh;
  }
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function makeImage(i) {
    var waits = [logo.complete ? null : new Promise(function (r) { logo.onload = logo.onerror = r; })];
    if (document.fonts) waits.push(document.fonts.load('800 64px "DM Sans"'), document.fonts.load('500 36px "DM Sans"'), document.fonts.load('600 26px "IBM Plex Mono"'));
    return Promise.all(waits).then(function () {
      var W = 1080, Hh = 1350, c = document.createElement("canvas"); c.width = W; c.height = Hh;
      var x = c.getContext("2d");
      x.fillStyle = "#1A1F3D"; x.fillRect(0, 0, W, Hh);
      var g1 = x.createRadialGradient(W * .9, 0, 0, W * .9, 0, 700); g1.addColorStop(0, "rgba(42,157,143,.55)"); g1.addColorStop(1, "rgba(42,157,143,0)"); x.fillStyle = g1; x.fillRect(0, 0, W, Hh);
      var g2 = x.createRadialGradient(0, Hh, 0, 0, Hh, 800); g2.addColorStop(0, "rgba(232,99,74,.5)"); g2.addColorStop(1, "rgba(232,99,74,0)"); x.fillStyle = g2; x.fillRect(0, 0, W, Hh);
      if (logo.naturalWidth) x.drawImage(logo, 80, 80, 78, 78);
      x.font = '800 46px "DM Sans", sans-serif'; x.textBaseline = "middle";
      x.fillStyle = "#E8634A"; x.fillText("Love", 176, 120); var lw = x.measureText("Love").width;
      x.fillStyle = "#2A9D8F"; x.fillText("Dopa", 176 + lw, 120);
      x.textBaseline = "alphabetic";
      x.font = '600 26px "IBM Plex Mono", monospace';
      var tagTxt = ("Notícia · " + (CATS[i.category] || "")).toUpperCase(), tw = x.measureText(tagTxt).width;
      x.fillStyle = "rgba(255,255,255,.12)"; roundRect(x, 80, 230, tw + 48, 58, 29); x.fill();
      x.fillStyle = "#FFFFFF"; x.fillText(tagTxt, 104, 269);
      x.fillStyle = "#FFFFFF"; x.font = '800 68px "DM Sans", sans-serif';
      var y = wrapText(x, i.title_pt, 80, 400, W - 160, 80, 5);
      if (i.takeaway_pt) { x.fillStyle = "rgba(255,255,255,.85)"; x.font = '500 38px "DM Sans", sans-serif'; y = wrapText(x, i.takeaway_pt, 80, y + 50, W - 160, 52, 4); }
      var boxY = Math.min(Math.max(y + 50, 980), Hh - 330);
      x.fillStyle = "rgba(255,255,255,.08)"; roundRect(x, 80, boxY, W - 160, 150, 24); x.fill();
      x.fillStyle = "#E8634A"; x.fillRect(80, boxY, 10, 150);
      x.fillStyle = "#FFFFFF"; x.font = '600 26px "IBM Plex Mono", monospace'; x.fillText("COMENTÁRIO DO LOVEDOPA", 120, boxY + 58);
      x.fillStyle = "rgba(255,255,255,.85)"; x.font = '500 32px "DM Sans", sans-serif'; x.fillText("O que isso muda na prática, em lovedopa.org", 120, boxY + 108);
      x.fillStyle = "rgba(255,255,255,.7)"; x.font = '500 28px "DM Sans", sans-serif'; wrapText(x, "Fonte: " + i.source_name, 80, Hh - 90, 560, 34, 1);
      x.fillStyle = "#FFFFFF"; x.font = '600 28px "IBM Plex Mono", monospace'; var u = "lovedopa.org/noticias"; x.fillText(u, W - 80 - x.measureText(u).width, Hh - 90);
      return new Promise(function (res) { c.toBlob(function (b) { res(b); }, "image/png"); });
    });
  }

  function shareInstagram(i, btn) {
    btn.disabled = true;
    var cap = caption(i);
    makeImage(i).then(function (blob) {
      var file = new File([blob], "lovedopa-" + i.slug.slice(0, 40) + ".png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { if (navigator.clipboard) navigator.clipboard.writeText(cap); } catch (e) {}
        return navigator.share({ files: [file], text: cap }).then(function () { logShare(i, "instagram"); toast("Escolha o Instagram. A legenda já está copiada — é só colar."); });
      }
      var a = el("a", { href: URL.createObjectURL(blob), download: file.name });
      document.body.appendChild(a); a.click(); a.remove();
      var copied = navigator.clipboard ? navigator.clipboard.writeText(cap) : Promise.resolve();
      return copied.then(function () { logShare(i, "download"); toast("Imagem com a marca LoveDopa baixada e legenda copiada. Agora é só postar no Instagram."); });
    }).catch(function (e) { if (!e || e.name !== "AbortError") toast("Não foi possível gerar a imagem. Tente de novo."); })
      .then(function () { btn.disabled = false; });
  }

  $("filters").addEventListener("click", function (e) { var b = e.target.closest("[data-f]"); if (!b) return; filter = b.getAttribute("data-f"); renderFilters(); render(); });
  $("newbarBtn").addEventListener("click", function () { $("newbar").classList.remove("show"); load(); window.scrollTo({ top: 0 }); });

  function load() {
    return Promise.all([
      get("news_public?select=id,slug,title_pt,takeaway_pt,category,evidence_level,relevance,source_name,published_at,created_at&order=created_at.desc&limit=60"),
      get("news_runs?select=digest_title,digest_pt,finished_at,new_items&status=eq.ok&order=finished_at.desc&limit=1"),
    ]).then(function (r) {
      items = r[0];
      var run = r[1][0];
      if (run) {
        lastRunAt = run.finished_at;
        $("digestTitle").textContent = run.digest_title || "Comentário da hora";
        $("digestText").textContent = run.digest_pt || "";
        $("digestTime").textContent = "· " + hhmm(run.finished_at);
        $("liveText").textContent = "Atualizado às " + hhmm(run.finished_at) + " · de hora em hora";
      }
      renderFilters(); render();
      if (location.hash) { var t = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (t) { t.scrollIntoView(); t.classList.add("flash"); } }
    }).catch(function () {
      var feed = $("feed"); clear(feed);
      feed.appendChild(el("div", { class: "empty", text: "Não foi possível carregar as notícias agora. Tente de novo em instantes." }));
    });
  }
  function poll() {
    get("news_runs?select=finished_at&status=eq.ok&order=finished_at.desc&limit=1").then(function (r) {
      if (r[0] && lastRunAt && r[0].finished_at !== lastRunAt) $("newbar").classList.add("show");
    }).catch(function () {});
  }
  load();
  setInterval(poll, 5 * 60 * 1000);
})();
