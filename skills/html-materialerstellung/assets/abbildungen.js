/* Exakte Abbildungen als SVG, berechnet statt gezeichnet (nie KI-Bilder für Lernobjekte).
   Im HTML als eigene Elemente verwenden, Beispiele:
     <x-uhr zeit="4:30" groesse="88"></x-uhr>            Uhr mit Zeigern
     <x-uhr loesung="4:30"></x-uhr>                       leere Uhr, Zeiger nur im Beispiel/Lösungsblatt
     <x-menge n="23" form="nuss" reihe="10" buendel="2"></x-menge>   Gegenstände in Reihen, 2 Zehner eingekreist
     <x-dienes z="3" e="5"></x-dienes>                    Zehnerstangen und Einerwürfel
     <x-strichpunkt z="3" e="5"></x-strichpunkt>          Strich = Zehner, Punkt = Einer (Fünferstruktur)
     <x-stellentafel stellen="Z E" loesung="3 5"></x-stellentafel>   Stellenwerttafel, Werte nur in Beispiel/Lösung
     <x-zwanzigerfeld n="13"></x-zwanzigerfeld>           Zwanzigerfeld mit 13 Plättchen
     <x-zahlenstrahl von="0" bis="20" zahlen="0 5 10 15 20" pfeile="7 13"></x-zahlenstrahl>
   "Beispiel" bedeutet: Element liegt in einem Container mit class="beispiel". */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const loesungSichtbar = (el) => document.body.classList.contains("loesung") || !!el.closest(".beispiel");
  const num = (el, a, d) => (el.hasAttribute(a) && el.getAttribute(a) !== "" ? parseFloat(el.getAttribute(a)) : d);
  const svg = (w, h, inner, px) =>
    `<svg xmlns="${NS}" viewBox="0 0 ${w} ${h}" width="${px ? px[0] : w}" height="${px ? px[1] : h}" ` +
    `fill="none" stroke="currentColor" style="color:var(--strich);overflow:visible">${inner}</svg>`;
  const r1 = (v) => Math.round(v * 100) / 100;

  function uhr(el) {
    const g = num(el, "groesse", 88);
    let zeit = el.getAttribute("zeit");
    if (!zeit && el.getAttribute("loesung") && loesungSichtbar(el)) zeit = el.getAttribute("loesung");
    let s = '<circle cx="50" cy="50" r="47" stroke-width="2.5"/>';
    for (let i = 0; i < 60; i++) {
      const a = (i * 6 * Math.PI) / 180, gross = i % 5 === 0;
      const r0 = gross ? 41.5 : 44;
      s += `<line x1="${r1(50 + r0 * Math.sin(a))}" y1="${r1(50 - r0 * Math.cos(a))}" x2="${r1(50 + 47 * Math.sin(a))}" y2="${r1(50 - 47 * Math.cos(a))}" stroke-width="${gross ? 2 : 0.8}"/>`;
    }
    if (el.getAttribute("ziffern") !== "nein") {
      for (let h = 1; h <= 12; h++) {
        const a = (h * 30 * Math.PI) / 180;
        s += `<text x="${r1(50 + 35 * Math.sin(a))}" y="${r1(50 - 35 * Math.cos(a))}" font-family="Andika,sans-serif" font-size="9.5" font-weight="700" fill="currentColor" stroke="none" text-anchor="middle" dominant-baseline="central">${h}</text>`;
      }
    }
    if (zeit) {
      const [hh, mm] = zeit.split(":").map(Number);
      const am = (mm * 6 * Math.PI) / 180, ah = (((hh % 12) + mm / 60) * 30 * Math.PI) / 180;
      s += `<line x1="50" y1="50" x2="${r1(50 + 18 * Math.sin(ah))}" y2="${r1(50 - 18 * Math.cos(ah))}" stroke-width="5" stroke-linecap="round"/>`;
      s += `<line x1="50" y1="50" x2="${r1(50 + 27 * Math.sin(am))}" y2="${r1(50 - 27 * Math.cos(am))}" stroke-width="3" stroke-linecap="round"/>`;
    }
    s += '<circle cx="50" cy="50" r="3" fill="currentColor" stroke="none"/>';
    el.innerHTML = svg(100, 100, s, [g, g]);
  }

  const FORMEN = {
    kreis: (x, y, d) => `<circle cx="${x + d / 2}" cy="${y + d / 2}" r="${d / 2 - 1}" stroke-width="1.6"/>`,
    plaettchen: (x, y, d) => `<circle cx="${x + d / 2}" cy="${y + d / 2}" r="${d / 2 - 1}" fill="currentColor" stroke="none"/>`,
    nuss: (x, y, d) => { // Haselnuss: runder Körper, Spitze, Kappenlinie
      const k = d / 20, p = (u, v) => `${r1(x + u * k)} ${r1(y + v * k)}`;
      return `<circle cx="${r1(x + 10 * k)}" cy="${r1(y + 11.5 * k)}" r="${r1(8 * k)}" stroke-width="1.5"/>` +
        `<path d="M${p(8.6, 3.8)} L${p(10, 0.6)} L${p(11.4, 3.8)}" stroke-width="1.3" stroke-linejoin="round"/>` +
        `<path d="M${p(2.8, 8.6)} C${p(6.5, 6.6)} ${p(13.5, 6.6)} ${p(17.2, 8.6)}" stroke-width="1.2"/>`;
    },
  };

  function menge(el) {
    const n = num(el, "n", 10), reihe = num(el, "reihe", 10), d = num(el, "groesse", 16);
    const form = FORMEN[el.getAttribute("form") || "kreis"] || FORMEN.kreis;
    const lx = d * 0.25, l5 = d * 0.7, ly = d * 0.4 + 5; // Zeilenabstand lässt Platz für Bündelrahmen // Abstand, Extra-Lücke nach 5, Zeilenabstand
    const breite = reihe * d + (reihe - 1) * lx + (reihe > 5 ? l5 : 0);
    const zeilen = Math.ceil(n / reihe);
    let buendel = num(el, "buendel", 0);
    if (!loesungSichtbar(el) && el.hasAttribute("buendel-loesung")) buendel = 0;
    if (loesungSichtbar(el) && el.hasAttribute("buendel-loesung")) buendel = num(el, "buendel-loesung", 0);
    let s = "";
    for (let i = 0; i < n; i++) {
      const c = i % reihe, r = Math.floor(i / reihe);
      const x = c * (d + lx) + (c >= 5 ? l5 : 0), y = r * (d + ly);
      s += form(x, y, d);
    }
    // Bündel: je 10 Gegenstände einer vollen Zeile (reihe = 10) eingekreist; Abstand zum Nachbarrahmen ≥ 4 px
    for (let b = 0; b < buendel && reihe === 10; b++) {
      const y = b * (d + ly) - 3;
      s += `<rect x="-3" y="${r1(y)}" width="${r1(breite + 6)}" height="${d + 6}" rx="${(d + 6) / 2}" stroke-width="2"/>`;
    }
    el.innerHTML = svg(r1(breite), r1(zeilen * d + (zeilen - 1) * ly), s);
  }

  function dienes(el) {
    const z = num(el, "z", 0), e = num(el, "e", 0), u = num(el, "groesse", 8);
    let s = "", x = 0;
    for (let i = 0; i < z; i++, x += u + u * 0.8) {
      s += `<rect x="${x}" y="0" width="${u}" height="${u * 10}" stroke-width="1.4"/>`;
      for (let k = 1; k < 10; k++) s += `<line x1="${x}" y1="${k * u}" x2="${x + u}" y2="${k * u}" stroke-width=".7"/>`;
    }
    if (z && e) x += u * 0.8;
    for (let i = 0; i < e; i++) {
      const c = Math.floor(i / 5), r = i % 5;
      s += `<rect x="${x + c * (u * 1.6)}" y="${u * 10 - (r + 1) * u * 1.6 + u * 0.6}" width="${u}" height="${u}" stroke-width="1.4"/>`;
    }
    const w = x + Math.ceil(e / 5) * u * 1.6;
    el.innerHTML = svg(r1(Math.max(w, u)), u * 10, s);
  }

  function strichpunkt(el) {
    const z = num(el, "z", 0), e = num(el, "e", 0), h = num(el, "groesse", 40), d = h / 5;
    let s = "", x = 0;
    for (let i = 0; i < z; i++, x += d * 1.1) s += `<line x1="${x + 2}" y1="0" x2="${x + 2}" y2="${h}" stroke-width="3" stroke-linecap="round"/>`;
    if (z && e) x += d * 0.9;
    for (let i = 0; i < e; i++) {
      const c = i % 5, r = Math.floor(i / 5);
      s += `<circle cx="${r1(x + c * d * 1.25 + d / 2)}" cy="${r1(h - d / 2 - r * d * 1.25)}" r="${r1(d * 0.42)}" fill="currentColor" stroke="none"/>`;
    }
    const w = x + Math.min(e, 5) * d * 1.25;
    el.innerHTML = svg(r1(Math.max(w, 4)), h, s);
  }

  function stellentafel(el) {
    const stellen = (el.getAttribute("stellen") || "Z E").split(/\s+/);
    const werte = (el.getAttribute("werte") || "").split(/\s+/);
    const loes = (el.getAttribute("loesung") || "").split(/\s+/);
    const zeilen = num(el, "zeilen", 1);
    let t = '<table class="stellentafel"><tr>' + stellen.map((s) => `<th>${s}</th>`).join("") + "</tr>";
    for (let r = 0; r < zeilen; r++) {
      t += "<tr>" + stellen.map((_, i) => {
        if (r === 0 && werte[i]) return `<td>${werte[i]}</td>`;
        if (r === 0 && loes[i]) return `<td class="l">${loes[i]}</td>`;
        return "<td></td>";
      }).join("") + "</tr>";
    }
    el.innerHTML = t + "</table>";
  }

  function zwanzigerfeld(el) {
    const n = num(el, "n", 0), d = num(el, "groesse", 22);
    let s = "";
    for (let i = 0; i < 20; i++) {
      const c = i % 10, r = Math.floor(i / 10), x = c * d + (c >= 5 ? d * 0.3 : 0), y = r * d;
      s += `<rect x="${r1(x)}" y="${y}" width="${d}" height="${d}" stroke-width="1.5"/>`;
      if (i < n) s += `<circle cx="${r1(x + d / 2)}" cy="${y + d / 2}" r="${d * 0.36}" fill="currentColor" stroke="none"/>`;
    }
    el.innerHTML = svg(r1(10 * d + d * 0.3), 2 * d, s);
  }

  function zahlenstrahl(el) {
    const von = num(el, "von", 0), bis = num(el, "bis", 20), schritt = num(el, "schritt", 1);
    const breite = num(el, "breite", 560), fs = num(el, "schrift", 16);
    const zahlen = (el.getAttribute("zahlen") || `${von} ${bis}`).split(/\s+/).map(Number);
    const pfeile = (el.getAttribute("pfeile") || "").split(/\s+/).filter(Boolean).map(Number);
    const x = (v) => r1(10 + ((v - von) / (bis - von)) * (breite - 20));
    const top = pfeile.length ? 26 : 4;
    let s = `<line x1="0" y1="${top + 12}" x2="${breite}" y2="${top + 12}" stroke-width="2"/>`;
    for (let v = von; v <= bis + 1e-9; v += schritt) {
      const lang = Math.abs(v % (schritt * 10)) < 1e-9 ? 12 : Math.abs(v % (schritt * 5)) < 1e-9 ? 9 : 6;
      s += `<line x1="${x(v)}" y1="${top + 12 - lang}" x2="${x(v)}" y2="${top + 12 + lang}" stroke-width="1.5"/>`;
    }
    zahlen.forEach((v) => {
      s += `<text x="${x(v)}" y="${top + 26 + fs * 0.8}" font-family="Andika,sans-serif" font-size="${fs}" fill="currentColor" stroke="none" text-anchor="middle">${v}</text>`;
    });
    pfeile.forEach((v) => {
      s += `<path d="M${x(v)} ${top - 2} L${x(v)} ${top + 6} M${x(v) - 4} ${top + 2} L${x(v)} ${top + 6} L${x(v) + 4} ${top + 2}" stroke-width="1.5"/>`;
      s += `<rect x="${x(v) - 15}" y="${top - 26}" width="30" height="22" rx="3" stroke-width="1.5"/>`;
      if (loesungSichtbar(el)) s += `<text x="${x(v)}" y="${top - 9}" font-family="Andika,sans-serif" font-size="${fs}" font-weight="700" fill="currentColor" stroke="none" text-anchor="middle">${v}</text>`;
    });
    el.innerHTML = svg(breite, top + 30 + fs, s);
  }

  const ARTEN = { "x-uhr": uhr, "x-menge": menge, "x-dienes": dienes, "x-strichpunkt": strichpunkt,
    "x-stellentafel": stellentafel, "x-zwanzigerfeld": zwanzigerfeld, "x-zahlenstrahl": zahlenstrahl };
  window.zeichneAbbildungen = function () {
    for (const [tag, f] of Object.entries(ARTEN)) document.querySelectorAll(tag).forEach(f);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", window.zeichneAbbildungen);
  else window.zeichneAbbildungen();
})();
