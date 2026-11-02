/* Exakte Abbildungen als SVG, berechnet statt gezeichnet (nie KI-Bilder für Lernobjekte).
   Welche Elemente es gibt und wie sie geschrieben werden, steht im Katalog: references/abbildungen.md.
   Die Datei ist in Abschnitte gegliedert (Marker wie unten). "Beispiel" bedeutet: Das Element liegt in einem Container
   mit class="beispiel". Neues Element: Checkliste in SKILL.md, Abschnitt „Neues Element“. */
(function () {
  /* == Kern == */
  const NS = "http://www.w3.org/2000/svg";
  const SCHWARZ = "#1D1D1B", GRAU = "#808080";
  const loesungSichtbar = (el) => document.body.classList.contains("loesung") || !!el.closest(".beispiel");
  const istSw = () => !document.body.classList.contains("farbe");
  const klasse = () => +((document.body.className.match(/kl(\d)/) || [0, 2])[1]);
  const num = (el, a, d) => (el.hasAttribute(a) && el.getAttribute(a) !== "" ? parseFloat(el.getAttribute(a)) : d);
  const attr = (el, a, d) => (el.hasAttribute(a) && el.getAttribute(a) !== "" ? el.getAttribute(a) : d);
  const svg = (w, h, inner, px) =>
    `<svg xmlns="${NS}" viewBox="0 0 ${w} ${h}" width="${px ? px[0] : w}" height="${px ? px[1] : h}" ` +
    `fill="none" stroke="currentColor" style="color:var(--strich);overflow:visible">${inner}</svg>`;
  const r1 = (v) => Math.round(v * 100) / 100;

  const maskiere = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  /** SVG-Text in Andika, immer schwarz; Inhalt maskiert. */
  const text = (x, y, inhalt, { groesse = 16, fett = false, anker = "middle", grundlinie = "central", farbe = SCHWARZ } = {}) =>
    `<text x="${r1(x)}" y="${r1(y)}" font-family="Andika,sans-serif" font-size="${r1(groesse)}"${fett ? ' font-weight="700"' : ""} ` +
    `fill="${farbe}" stroke="none" text-anchor="${anker}" dominant-baseline="${grundlinie}">${maskiere(inhalt)}</text>`;

  const SCHRIFT_BREITE = 0.56; // mittlere Zeichenbreite von Andika je Schriftgröße, für Platzrechnungen
  const textBreite = (t, groesse) => String(t).length * groesse * SCHRIFT_BREITE;

  /** Kästchen wie .antwort; die Lösung steht nur im Beispiel und auf dem Lösungsblatt darin. */
  const antwortfeld = (el, x, y, b, h, loesung, { groesse = Math.min(h * 0.62, 20), immer = false } = {}) =>
    `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(b)}" height="${r1(h)}" rx="3" stroke-width="1.6" fill="#fff"/>` +
    (loesung !== undefined && loesung !== null && (immer || loesungSichtbar(el))
      ? text(x + b / 2, y + h / 2, loesung, { groesse, fett: true })
      : "");

  /** Deutsche Schreibweise: Komma, schmale Zifferngruppen ab fünf Stellen (DIN 5008). Die einzige Stelle dafür. */
  const zahl = (n) => {
    const v = n < 0 ? "−" : "";
    const [ganz, rest] = String(Math.abs(n)).split(".");
    const gruppen = ganz.length >= 5 ? ganz.replace(/\B(?=(\d{3})+$)/g, "\u202f") : ganz;
    return v + gruppen + (rest ? `,${rest}` : "");
  };

  const cm = (x) => (x * 96) / 2.54;

  /** Das Element hat echte Maße: pruefung.js meldet „In Originalgröße drucken“. */
  const masstab = (el) => el.setAttribute("data-masstab", "");

  const streuwert = (t) => {
    let h = 2166136261;
    for (const z of String(t)) h = Math.imul(h ^ z.codePointAt(0), 16777619);
    return h >>> 0;
  };

  /** Deterministischer Zufall (mulberry32): gleicher seed, gleiche Folge, im Editor wie im PDF. */
  const zufall = (seed) => {
    let a = streuwert(seed);
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const gemischt = (feld, zz) => {
    const a = [...feld];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(zz() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  /** seed aus dem Attribut, sonst aus dem Inhalt: gleiche Angaben ergeben dasselbe Bild. */
  const samen = (el, inhalt) => attr(el, "seed", null) ?? inhalt;

  const NAMEN = {
    "x-uhr": "Uhr", "x-menge": "Menge", "x-dienes": "Zehnerstangen und Einerwürfel", "x-strichpunkt": "Strich-Punkt-Bild",
    "x-stellentafel": "Stellentafel", "x-zwanzigerfeld": "Zwanzigerfeld", "x-zahlenstrahl": "Zahlenstrahl", "x-timer": "Timer",
    "x-probe": "Probe",
  };

  class Abbildungsfehler extends Error {}
  /** Bricht das Zeichnen ab; das Element erscheint als gestrichelter Kasten mit dem Text (meldeFehler). */
  const abbruch = (meldung) => {
    throw new Abbildungsfehler(meldung);
  };

  const umbrechen = (meldung, zeichen) => {
    const zeilen = [];
    let z = "";
    for (const wort of meldung.split(/\s+/)) {
      if (z && (z + " " + wort).length > zeichen) {
        zeilen.push(z);
        z = wort;
      } else z = z ? `${z} ${wort}` : wort;
    }
    return z ? [...zeilen, z] : zeilen;
  };

  /** Statt der Abbildung ein gestrichelter Kasten mit dem Text. Nie still etwas Falsches zeichnen. */
  const meldeFehler = (el, meldung) => {
    el.setAttribute("data-fehler", meldung);
    const zeilen = umbrechen(meldung, 40);
    const h = 24 + zeilen.length * 20;
    el.innerHTML = svg(320, h, `<rect x="1" y="1" width="318" height="${h - 2}" rx="6" stroke-width="2" stroke-dasharray="6 4"/>` +
      zeilen.map((z, i) => text(160, 22 + i * 20, z, { groesse: 15 })).join(""));
  };

  /** Liste mit Leerzeichen, oder mit ;, wenn Einträge Leerzeichen enthalten. */
  const trenneListe = (w) => (w.includes(";") ? w.split(";") : w.split(/\s+/)).map((t) => t.trim()).filter(Boolean);
  const liste = (el, a) => trenneListe(el.getAttribute(a) || "");
  /** Paare `Beschriftung: Wert; Beschriftung: Wert`; ohne Doppelpunkt fehlt der Wert. */
  const paare = (el, a) => (el.getAttribute(a) || "").split(";").map((t) => t.trim()).filter(Boolean).map((t) => {
    const i = t.indexOf(":");
    return i < 0 ? { name: t, wert: "" } : { name: t.slice(0, i).trim(), wert: t.slice(i + 1).trim() };
  });
  /** Raster zeilenweise mit /, Zellen mit Leerzeichen: `0 1 1 / 0 1 0`. */
  const trenneRaster = (w) => w.split("/").map((z) => z.trim()).filter(Boolean).map((z) => z.split(/\s+/));
  const raster = (el, a) => trenneRaster(el.getAttribute(a) || "");

  /** Der ursprüngliche Text eines Elements, dessen Inhalt die Angabe ist; das Zeichnen ersetzt den Inhalt. */
  const inhalt = (el) => {
    if (el._abbInhalt === undefined) el._abbInhalt = el.textContent.trim();
    return el._abbInhalt;
  };
  window.setzeAbbildungsInhalt = (el, wert) => {
    el._abbInhalt = wert;
  };

  /** Für das Panel: Felder eines Rasters in der Gestalt des Elements, Hinweise zur Kontrolle. Nur zur Laufzeit. */
  const meldeZellen = (el, feld, zellen) => {
    el._abbZellen = { ...(el._abbZellen || {}), [feld]: zellen };
  };
  const meldeInfo = (el, info) => {
    el._abbInfo = info;
  };

  const FARBNAMEN = ["rot", "blau", "gruen", "gelb", "orange", "lila", "grau", "leer"];
  const FARBWERTE = { rot: "#D8392B", blau: "#2F6FD6", gruen: "#2E9E4F", gelb: "#FFD23F", orange: "#F28C28", lila: "#7B4FA3", grau: "#9A9A9A", leer: "#FFFFFF" };
  const PALETTE = ["var(--haupt)", "var(--akzent)", "var(--dunkel)", "color-mix(in srgb,var(--haupt) 45%,#fff)", "color-mix(in srgb,var(--akzent) 45%,#fff)", "color-mix(in srgb,var(--dunkel) 45%,#fff)"];
  const MUSTERNAMEN = ["weiß", "schraffiert", "gepunktet", "kariert", "quer gestreift", "grau", "gekreuzt schräg", "dicht schraffiert"];
  const MUSTER = [
    "",
    '<path d="M0 8 L8 0" stroke-width="1.5"/>',
    '<circle cx="4" cy="4" r="1.5" fill="#1D1D1B" stroke="none"/>',
    '<path d="M0 4 H8 M4 0 V8" stroke-width="1"/>',
    '<path d="M0 4 H8" stroke-width="2"/>',
    "",
    '<path d="M0 8 L8 0 M0 0 L8 8" stroke-width="1"/>',
    '<path d="M0 4 L4 0 M4 8 L8 4" stroke-width="1.5"/>',
  ];

  let fuellungsNr = 0;
  /**
   * Füllungen für ein Element: s/w über Muster (mit eindeutiger ID), Farbe über die Palette aus blatt.css bzw. benannte
   * Farben. `f.von(i)` nimmt die Nummer in der Palette oder den Namen einer Farbe; `f.defs()` gehört ins SVG.
   */
  const fuellung = () => {
    const id = `abb-f${++fuellungsNr}`, benutzt = new Set();
    const musterFuer = (i) => {
      const n = i % MUSTER.length;
      if (n === 0) return "#fff";
      if (n === 5) return GRAU;
      benutzt.add(n);
      return `url(#${id}-${n})`;
    };
    return {
      von(wert) {
        const i = typeof wert === "number" ? wert : FARBNAMEN.indexOf(wert);
        if (istSw()) return wert === "leer" ? "#fff" : musterFuer(typeof wert === "number" ? i : [1, 2, 3, 4, 7, 6, 5, 0][i < 0 ? 0 : i]);
        if (typeof wert === "number") return PALETTE[i % PALETTE.length];
        return FARBWERTE[wert] ?? FARBWERTE.grau;
      },
      name(wert) {
        const i = typeof wert === "number" ? wert : FARBNAMEN.indexOf(wert);
        return MUSTERNAMEN[(typeof wert === "number" ? i : [1, 2, 3, 4, 7, 6, 5, 0][i < 0 ? 0 : i]) % MUSTER.length];
      },
      defs: () => (benutzt.size === 0 ? "" : `<defs>${[...benutzt].map((n) =>
        `<pattern id="${id}-${n}" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#fff" stroke="none"/><g stroke="${SCHWARZ}" fill="none">${MUSTER[n]}</g></pattern>`).join("")}</defs>`),
    };
  };

  /* == Grundelemente == */
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
      if (!/^\d{1,2}:\d{2}$/.test(zeit)) abbruch(`„${zeit}“ ist keine Uhrzeit wie 4:30.`);
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
    if (!(von < bis)) abbruch("„Bis“ muss größer sein als „Von“.");
    if (!(schritt > 0) || (bis - von) / schritt > 1000) abbruch("Der Abstand der Striche passt nicht.");
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

  // Zifferblatt bis 60 (über 60 Minuten: 120, nur alle 30 beschriftet, dreistellige Zahlen stießen an den Rand),
  // Zahlen gegen den Uhrzeigersinn ab 0 oben; die Scheibe zeigt die eingestellte Zeit oder, beim Präsentieren
  // (praesentation.js), die Restzeit aus dem Attribut rest (Minuten, mit Nachkommastellen).
  function timer(el) {
    const minuten = num(el, "minuten", 10), g = num(el, "groesse", 360);
    const skala = num(el, "skala", minuten > 60 ? 120 : 60);
    const rest = num(el, "rest", minuten);
    const schritt = [1, 2, 5, 10, 15, 30].find((s) => skala / s <= (skala > 60 ? 4 : 12)) || skala / 12;
    const punkt = (m, r) => {
      const a = (2 * Math.PI * m) / skala;
      return `${r1(50 - r * Math.sin(a))} ${r1(50 - r * Math.cos(a))}`;
    };
    let s = '<circle cx="50" cy="50" r="48" stroke-width="2.5" fill="#fff"/>';
    const zeit = Math.min(Math.max(rest, 0), skala), farbe = 'class="timer-scheibe" stroke="none" style="fill:var(--haupt)"';
    if (zeit >= skala) s += `<circle cx="50" cy="50" r="35" ${farbe}/>`;
    else if (zeit > 0) s += `<path d="M50 50 L50 15 A35 35 0 ${zeit / skala > 0.5 ? 1 : 0} 0 ${punkt(zeit, 35)} Z" ${farbe}/>`;
    const fein = skala <= 60 ? 1 : skala / 60;
    for (let m = 0; m < skala; m += fein) {
      const gross = Math.abs(m / schritt - Math.round(m / schritt)) < 1e-9;
      s += `<path d="M${punkt(m, gross ? 35 : 36.3)} L${punkt(m, 38)}" stroke-width="${gross ? 1.6 : 0.6}"/>`;
    }
    for (let m = 0; m < skala; m += schritt) {
      const [x, y] = punkt(m, 42.3).split(" ");
      s += `<text x="${x}" y="${y}" font-family="Andika,sans-serif" font-size="6" font-weight="700" fill="currentColor" stroke="none" text-anchor="middle" dominant-baseline="central">${m}</text>`;
    }
    s += '<circle cx="50" cy="50" r="4" fill="currentColor" stroke="none"/>';
    const text = `${String(minuten).replace(".", ",")} ${minuten === 1 ? "Minute" : "Minuten"}`;
    el.innerHTML = svg(100, 100, s, [g, g]) + `<span class="timer-text">${text}</span>`;
  }

  /* == Test == */
  // x-probe gibt es nur für die Tests der Feldtypen im Panel (023); in Material kommt es nicht vor.
  function probe(el) {
    const titel = attr(el, "titel", "");
    const eintraege = paare(el, "eintraege");
    const arten = liste(el, "arten");
    const feld = raster(el, "feld");
    const hoehen = raster(el, "hoehen");
    const form = liste(el, "form");
    const farbe = attr(el, "farbe", "rot");
    const seed = attr(el, "seed", "");
    const wort = inhalt(el);
    if (titel === "falsch") abbruch("Dieser Titel geht nicht.");
    meldeZellen(el, "form", [0, 1, 2, 3].map((i) => ({ id: String(i), x: i, y: i % 2, text: String(i + 1) })));
    meldeInfo(el, `${eintraege.length} Einträge`);
    const zz = zufall(samen(el, `${titel}|${wort}`));
    const f = fuellung();
    let s = `<rect x="0" y="0" width="40" height="40" fill="${f.von(farbe)}" stroke-width="1.5"/>`;
    s += text(50, 10, titel || "–", { anker: "start" }) + text(50, 30, wort || "–", { anker: "start" });
    s += text(50, 50, eintraege.map((e) => `${e.name}=${e.wert}`).join(",") || "–", { anker: "start" });
    s += text(50, 70, arten.join(",") || "–", { anker: "start" });
    s += text(50, 90, form.join(",") || "–", { anker: "start" });
    s += text(150, 90, hoehen.map((z) => z.join(" ")).join("/") || "–", { anker: "start" });
    feld.forEach((z, r) => z.forEach((c, i) => {
      if (c !== "0") s += `<rect x="${i * 10}" y="${50 + r * 10}" width="10" height="10" fill="${SCHWARZ}" stroke="none"/>`;
    }));
    s += `<circle class="probe-punkt" cx="${r1(zz() * 40)}" cy="110" r="4" fill="${SCHWARZ}" stroke="none"/>`;
    el.setAttribute("data-seed-probe", seed);
    el.innerHTML = svg(320, 120, f.defs() + s);
  }

  /* == Ende der Abschnitte == */
  const ARTEN = { "x-uhr": uhr, "x-menge": menge, "x-dienes": dienes, "x-strichpunkt": strichpunkt,
    "x-stellentafel": stellentafel, "x-zwanzigerfeld": zwanzigerfeld, "x-zahlenstrahl": zahlenstrahl, "x-timer": timer,
    "x-probe": probe };

  const zeichne = (f, el) => {
    el.removeAttribute("data-fehler");
    try {
      f(el);
    } catch (e) {
      meldeFehler(el, e instanceof Abbildungsfehler ? e.message : `Die Abbildung ließ sich nicht zeichnen (${e.message}).`);
    }
  };

  // Ohne Argument alle Abbildungen, sonst nur das Element selbst und was darin liegt (z. B. ein ablaufender Timer).
  window.zeichneAbbildungen = function (wurzel) {
    const ort = wurzel instanceof Element ? wurzel : document;
    for (const [tag, f] of Object.entries(ARTEN)) {
      if (ort !== document && ort.matches(tag)) zeichne(f, ort);
      ort.querySelectorAll(tag).forEach((el) => zeichne(f, el));
    }
  };
  window.abbildungsName = (tag) => NAMEN[tag] || tag;
  /* == Rechenkerne für Tests == */
  window.schoolboxAbbildungen = { ARTEN, zahl, cm, zufall, gemischt, trenneListe, trenneRaster };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => window.zeichneAbbildungen());
  else window.zeichneAbbildungen();
})();
