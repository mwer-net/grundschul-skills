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
  const SATZSPIEGEL = 620; // nutzbare Breite einer A4-Hochkantseite in px

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
    "x-gluecksrad": "Glücksrad", "x-wuerfel": "Würfel", "x-strichliste": "Strichliste", "x-diagramm": "Diagramm",
    "x-urne": "Kugeln im Säckchen", "x-wahrscheinlichkeit": "Wahrscheinlichkeit", "x-kombinatorik": "Möglichkeiten",
    "x-gitter": "Gitter", "x-figur": "Figur", "x-tangram": "Tangram",
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

  /* == Daten und Zufall == */
  const FARB_DEUTSCH = { rot: "Rot", blau: "Blau", gruen: "Grün", gelb: "Gelb", orange: "Orange", lila: "Lila", grau: "Grau", leer: "Weiß" };

  const pruefeFarbe = (name) => {
    if (!FARBNAMEN.includes(name)) abbruch(`„${name}“ gibt es als Füllung nicht.`);
    return name;
  };

  /** Legende unter einer Abbildung: s/w nennt das Muster zur Farbe („Rot = schraffiert“). Liefert SVG und Höhe. */
  const legendeVon = (f, namen, y, breite) => {
    const reihen = [...new Set(namen)].filter((n) => n !== "leer");
    const beschriftung = (n) => (istSw() ? `${FARB_DEUTSCH[n]} = ${f.name(n)}` : FARB_DEUTSCH[n]);
    const spalte = Math.max(90, ...reihen.map((n) => textBreite(beschriftung(n), 14) + 38));
    const jeReihe = Math.max(1, Math.floor(breite / spalte));
    const s = reihen.map((n, i) => {
      const x = (i % jeReihe) * spalte, yy = y + Math.floor(i / jeReihe) * 26;
      return `<rect x="${r1(x)}" y="${r1(yy)}" width="20" height="20" rx="3" fill="${f.von(n)}" stroke-width="1.5"/>` +
        text(x + 26, yy + 10, beschriftung(n), { groesse: 14, anker: "start" });
    }).join("");
    return { s, h: Math.ceil(reihen.length / jeReihe) * 26 };
  };

  const GLUECKSRAD_DURCHMESSER_CM = 12;

  function gluecksrad(el) {
    const felder = paare(el, "felder");
    const anteile = liste(el, "anteile");
    const nachher = liste(el, "loesung");
    const bastel = attr(el, "bastel", "nein") === "ja";
    const mitZeiger = attr(el, "zeiger", "ja") === "ja";
    const mitLegende = attr(el, "legende", "ja") === "ja";
    const d = bastel ? cm(GLUECKSRAD_DURCHMESSER_CM) : num(el, "groesse", 200);
    if (felder.length < 2 || felder.length > 12) abbruch("Ein Glücksrad braucht 2 bis 12 Felder.");
    if (anteile.length > 0 && anteile.length !== felder.length) abbruch("Bei „Anteile“ braucht jedes Feld genau eine Zahl.");
    if (nachher.length > 0 && nachher.length !== felder.length) abbruch("Bei der Lösung braucht jedes Feld genau eine Füllung.");
    const teile = anteile.length > 0 ? anteile.map(Number) : felder.map(() => 1);
    if (teile.some((a) => !(a > 0))) abbruch("Anteile müssen Zahlen größer als 0 sein.");
    const summe = teile.reduce((a, b) => a + b, 0);
    const winkel = teile.map((a) => (a / summe) * 360);
    if (winkel.some((w) => w < 20 - 1e-9)) abbruch("Ein Feld ist zu schmal (unter 20°). Nimm weniger Felder oder andere Anteile.");
    let fuellen = felder.map((t) => pruefeFarbe(t.name));
    if (nachher.length > 0) fuellen = loesungSichtbar(el) ? nachher.map(pruefeFarbe) : felder.map(() => "leer");
    const f = fuellung();
    const r = d / 2, rand = 6, breite = Math.max(d + 2 * rand, mitLegende ? 300 : 0), cx = breite / 2, cy = r + rand;
    const punkt = (w, q = r) => {
      const a = ((w - 90) * Math.PI) / 180;
      return [r1(cx + q * Math.cos(a)), r1(cy + q * Math.sin(a))];
    };
    let s = "", start = 0, schrift = "";
    felder.forEach((t, i) => {
      const w = winkel[i], [x1, y1] = punkt(start), [x2, y2] = punkt(start + w);
      s += `<path data-winkel="${r1(w)}" d="M${r1(cx)} ${r1(cy)} L${x1} ${y1} A${r1(r)} ${r1(r)} 0 ${w > 180 ? 1 : 0} 1 ${x2} ${y2} Z" ` +
        `fill="${f.von(fuellen[i])}" stroke-width="1.6"/>`;
      const groesse = Math.max(14, Math.min(22, d / 10)), q = r * 0.66;
      const bogen = ((w * Math.PI) / 180) * q, b = textBreite(t.wert, groesse) + 8;
      if (t.wert && b <= bogen) {
        const [lx, ly] = punkt(start + w / 2, q), h = groesse + 6;
        schrift += `<rect x="${r1(lx - b / 2)}" y="${r1(ly - h / 2)}" width="${r1(b)}" height="${r1(h)}" rx="4" fill="#fff" stroke="none"/>` +
          text(lx, ly, t.wert, { groesse, fett: true });
      }
      start += w;
    });
    s += `<circle class="rad-rand" cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}" stroke-width="2"/>` + schrift;
    if (mitZeiger && !bastel) {
      const [px, py] = punkt(35, r * 0.46), [a1, a2] = punkt(35 - 90, r * 0.08), [b1, b2] = punkt(35 + 90, r * 0.08);
      s += `<path d="M${a1} ${a2} L${px} ${py} L${b1} ${b2} Z" fill="${SCHWARZ}" stroke="none"/>`;
    }
    s += `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${bastel ? 3 : r1(Math.max(4, r * 0.05))}" fill="${SCHWARZ}" stroke="none"/>`;
    let unten = d + 2 * rand;
    if (mitLegende && nachher.length === 0) {
      const leg = legendeVon(f, fuellen, unten + 4, breite);
      s += leg.s;
      unten += leg.h + 4;
    }
    if (bastel) {
      masstab(el);
      s += text(0, unten + 12, "Ausschneiden. Bleistift durch die Büroklammer in die Mitte stellen, Klammer drehen.", { groesse: 14, anker: "start" });
      unten += 24;
    } else el.removeAttribute("data-masstab");
    el.innerHTML = svg(breite, unten, f.defs() + s);
  }

  const AUGEN_STELLEN = {
    1: [[50, 50]], 2: [[27, 27], [73, 73]], 3: [[27, 27], [50, 50], [73, 73]], 4: [[27, 27], [73, 27], [27, 73], [73, 73]],
    5: [[27, 27], [73, 27], [50, 50], [27, 73], [73, 73]], 6: [[27, 25], [73, 25], [27, 50], [73, 50], [27, 75], [73, 75]],
  };
  const augenBild = (n, a) => (AUGEN_STELLEN[n] || []).map(([x, y]) =>
    `<circle class="auge" cx="${r1((x * a) / 100)}" cy="${r1((y * a) / 100)}" r="${r1(a * 0.09)}" fill="${SCHWARZ}" stroke="none"/>`).join("");

  const augenZahl = (roh, name) => {
    const n = Number(roh);
    if (!Number.isInteger(n) || n < 0 || n > 6) abbruch(`${name} muss eine Zahl von 0 bis 6 sein.`);
    return n;
  };

  function wuerfel(el) {
    const a = num(el, "groesse", 60);
    const art = attr(el, "art", "augen");
    const nachher = attr(el, "loesung", null);
    const f = fuellung();
    if (attr(el, "ansicht", "flach") === "raeumlich") {
      const seiten = [augenZahl(attr(el, "oben", "1"), "Oben"), augenZahl(attr(el, "vorne", "2"), "Vorne"), augenZahl(attr(el, "rechts", "3"), "Rechts")];
      for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) {
        if (seiten[i] === 0 || seiten[j] === 0) continue;
        if (seiten[i] + seiten[j] === 7) abbruch(`${seiten[i]} und ${seiten[j]} liegen auf dem Würfel gegenüber. Man sieht sie nie zusammen.`);
        if (seiten[i] === seiten[j]) abbruch(`Die ${seiten[i]} gibt es auf dem Würfel nur einmal.`);
      }
      const t = a * 0.42, k = r1(t / a);
      const flaeche = (matrix, n, klasse) => `<g class="${klasse}" transform="matrix(${matrix})"><rect width="${a}" height="${a}" fill="#fff" stroke-width="1.6"/>${augenBild(n, a)}</g>`;
      const inneres = flaeche(`1 0 0 1 0 ${r1(t)}`, seiten[1], "vorne") + flaeche(`1 0 ${-k} ${k} ${r1(t)} 0`, seiten[0], "oben") +
        flaeche(`${k} ${-k} 0 1 ${a} ${r1(t)}`, seiten[2], "rechts");
      el.innerHTML = svg(r1(a + t + 2), r1(a + t + 2), `<g transform="translate(1 1)">${inneres}</g>`);
      return;
    }
    const zeigeLoesung = nachher !== null && loesungSichtbar(el);
    const augen = attr(el, "augen", "0"), beschriftet = attr(el, "inhalt", "");
    const wert = zeigeLoesung ? nachher : (art === "augen" ? augen : beschriftet);
    const leer = nachher !== null && !zeigeLoesung;
    let innen = "", grund = "#fff";
    if (!leer) {
      if (art === "augen") innen = augenBild(augenZahl(wert, "Die Augenzahl"), a);
      else if (art === "muster") grund = wert ? f.von(pruefeFarbe(wert)) : "#fff";
      else innen = text(a / 2, a / 2, wert, { groesse: Math.min(a * 0.5, ((a * 0.86) / Math.max(1, String(wert).length)) / SCHRIFT_BREITE), fett: true });
    }
    el.innerHTML = svg(a + 2, a + 2, `${f.defs()}<g transform="translate(1 1)"><rect width="${a}" height="${a}" rx="${r1(a * 0.14)}" fill="${grund}" stroke-width="1.6"/>${innen}</g>`);
  }

  /** Vier senkrechte Striche, der fünfte quer darüber. */
  const strichBild = (n, x, y, h, dx, luecke) => {
    let s = "";
    const start = (i) => x + Math.floor(i / 5) * (4 * dx + luecke) + (i % 5) * dx;
    for (let i = 0; i < n; i++) {
      if (i % 5 === 4) s += `<line class="strich" x1="${r1(start(i - 4) - dx * 0.5)}" y1="${r1(y + h)}" x2="${r1(start(i - 1) + dx * 0.5)}" y2="${r1(y)}" stroke-width="2"/>`;
      else s += `<line class="strich" x1="${r1(start(i))}" y1="${r1(y)}" x2="${r1(start(i))}" y2="${r1(y + h)}" stroke-width="2"/>`;
    }
    return s;
  };

  function strichliste(el) {
    const werte = paare(el, "werte");
    const zeige = attr(el, "zeige", "striche");
    const h = num(el, "groesse", 34);
    if (werte.length < 1 || werte.length > 8) abbruch("Eine Strichliste hat 1 bis 8 Zeilen.");
    const zahlen = werte.map((t) => Number(t.wert));
    if (zahlen.some((n) => !Number.isInteger(n) || n < 0 || n > 30)) abbruch("Je Zeile geht eine ganze Zahl von 0 bis 30.");
    const schrift = Math.min(h * 0.55, 20), striche = h - 14, dx = striche * 0.32, luecke = dx * 1.5;
    const bedarf = (Math.ceil(Math.max(...zahlen, 15) / 5) * (4 * dx + luecke)) + 16;
    const sp1 = Math.max(90, ...werte.map((t) => textBreite(t.name, schrift) + 18));
    const sp2 = Math.max(90, bedarf), sp3 = Math.max(72, h * 1.8);
    const breite = sp1 + sp2 + sp3, hoehe = (werte.length + 1) * h;
    let s = `<rect x="1" y="1" width="${r1(breite)}" height="${r1(hoehe)}" stroke-width="1.6"/>`;
    for (const x of [sp1, sp1 + sp2]) s += `<line x1="${r1(x + 1)}" y1="1" x2="${r1(x + 1)}" y2="${r1(hoehe + 1)}" stroke-width="1.5"/>`;
    s += text(sp1 + sp2 / 2 + 1, h / 2 + 1, "Striche", { groesse: schrift, fett: true }) + text(sp1 + sp2 + sp3 / 2 + 1, h / 2 + 1, "Anzahl", { groesse: schrift, fett: true });
    werte.forEach((t, i) => {
      const y = (i + 1) * h + 1, n = zahlen[i];
      s += `<line x1="1" y1="${r1(y)}" x2="${r1(breite + 1)}" y2="${r1(y)}" stroke-width="1.5"/>`;
      s += text(10, y + h / 2, t.name, { groesse: schrift, anker: "start" });
      if (zeige === "striche" || loesungSichtbar(el)) s += strichBild(n, sp1 + 12 + dx * 0.5, y + 7, striche, dx, luecke);
      if (zeige === "zahl" || loesungSichtbar(el)) s += `<g class="anzahl">${text(sp1 + sp2 + sp3 / 2 + 1, y + h / 2, zahl(n), { groesse: schrift, fett: true })}</g>`;
    });
    el.innerHTML = svg(r1(breite + 2), r1(hoehe + 2), s);
  }

  const SKALEN_SCHRITTE = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
  const aufHalbemSchritt = (v, schritt) => Number.isInteger(v / (schritt / 2));

  /** Skala ab 0: kleinster runder Schritt mit höchstens zehn Linien, auf dessen halben Schritten alle Werte liegen. */
  const skalaVon = (zahlen, schritt, bis) => {
    const groesster = Math.max(...zahlen, 0);
    if (schritt !== null) {
      if (!(schritt > 0)) abbruch("Der Skalenschritt muss größer als 0 sein.");
      const ende = bis ?? Math.max(schritt, Math.ceil(groesster / schritt) * schritt);
      return { schritt, ende };
    }
    const passend = SKALEN_SCHRITTE.find((k) => (bis ?? Math.ceil(groesster / k) * k) / k <= 10 && zahlen.every((v) => aufHalbemSchritt(v, k)));
    if (!passend) abbruch("Diese Werte passen auf keine runde Skala. Nimm rundere Werte oder gib einen Skalenschritt an.");
    return { schritt: passend, ende: bis ?? Math.max(passend, Math.ceil(groesster / passend) * passend) };
  };

  const STERN_PUNKTE = Array.from({ length: 10 }, (_, i) => {
    const a = (i * Math.PI) / 5 - Math.PI / 2, q = i % 2 === 0 ? 1 : 0.45;
    return [q * Math.cos(a), q * Math.sin(a)];
  });
  const SYMBOLE = {
    kreis: (x, y, r, fuell) => `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}" fill="${fuell}" stroke-width="1.5"/>`,
    quadrat: (x, y, r, fuell) => `<rect x="${r1(x - r)}" y="${r1(y - r)}" width="${r1(2 * r)}" height="${r1(2 * r)}" fill="${fuell}" stroke-width="1.5"/>`,
    stern: (x, y, r, fuell) => `<path d="M${STERN_PUNKTE.map(([a, b]) => `${r1(x + a * r)} ${r1(y + b * r)}`).join(" L")} Z" fill="${fuell}" stroke-width="1.5"/>`,
    herz: (x, y, r, fuell) => `<path d="M${r1(x)} ${r1(y + r)} C${r1(x - 1.6 * r)} ${r1(y - 0.2 * r)} ${r1(x - 0.8 * r)} ${r1(y - 1.2 * r)} ${r1(x)} ${r1(y - 0.4 * r)} C${r1(x + 0.8 * r)} ${r1(y - 1.2 * r)} ${r1(x + 1.6 * r)} ${r1(y - 0.2 * r)} ${r1(x)} ${r1(y + r)} Z" fill="${fuell}" stroke-width="1.5"/>`,
  };

  function diagramm(el) {
    const art = attr(el, "art", "saeulen");
    const werte = paare(el, "werte");
    const offen = liste(el, "offen").map(Number);
    const einheit = attr(el, "einheit", "");
    const groesse = num(el, "groesse", 200);
    const bisRoh = attr(el, "bis", null), schrittRoh = attr(el, "skala", null);
    const symbol = attr(el, "symbol", "kreis");
    const je = num(el, "je", 1);
    if (werte.length < 1 || werte.length > 12) abbruch("Ein Diagramm hat 1 bis 12 Einträge.");
    const zahlen = werte.map((t) => Number(t.wert));
    if (zahlen.some((v) => !Number.isFinite(v) || v < 0)) abbruch("Die Werte müssen Zahlen ab 0 sein.");
    const istOffen = (i) => offen.includes(i + 1) && !loesungSichtbar(el);
    const f = fuellung(), grund = f.von(istSw() ? 1 : 0);

    if (art === "bild") {
      if (!SYMBOLE[symbol]) abbruch(`Das Symbol „${symbol}“ gibt es nicht.`);
      if (!(je >= 1)) abbruch("„Ein Symbol steht für“ muss mindestens 1 sein.");
      for (const v of zahlen) {
        const halb = je === 2 && v % 2 === 1;
        if (v % je !== 0 && !halb) abbruch(je === 2 ? "Die Werte müssen ganze Zahlen sein." : `Die Werte müssen durch ${je} teilbar sein, halbe Symbole gehen nur, wenn ein Symbol für 2 steht.`);
      }
      const zh = 34, r = 13, schrift = 15, links = Math.max(70, ...werte.map((t) => textBreite(t.name, schrift) + 14));
      const anzahl = Math.max(...zahlen.map((v) => Math.ceil(v / je)), 1), id = `abb-c${++fuellungsNr}`;
      let s = `<defs><clipPath id="${id}"><rect x="${-r - 2}" y="${-r - 2}" width="${r + 2}" height="${2 * r + 4}"/></clipPath></defs>`;
      werte.forEach((t, i) => {
        const y = i * zh;
        s += text(links - 10, y + zh / 2, t.name, { groesse: schrift, anker: "end" });
        s += `<line x1="${r1(links)}" y1="${r1(y)}" x2="${r1(links)}" y2="${r1(y + zh)}" stroke-width="1.5"/>`;
        if (istOffen(i)) return;
        const ganz = Math.floor(zahlen[i] / je), halb = zahlen[i] % je !== 0;
        for (let k = 0; k < ganz + (halb ? 1 : 0); k++) {
          const x = links + 18 + k * 32, zeichen = SYMBOLE[symbol](0, 0, r, grund);
          s += `<g class="symbol" transform="translate(${r1(x)} ${r1(y + zh / 2)})">${halb && k === ganz ? `<g clip-path="url(#${id})">${zeichen}</g>` : zeichen}</g>`;
        }
      });
      const unten = werte.length * zh + 8;
      s += `<g transform="translate(${r1(links + 18)} ${unten + 13})">${SYMBOLE[symbol](0, 0, r, grund)}</g>` +
        text(links + 40, unten + 13, `= ${zahl(je)}${einheit ? ` ${einheit}` : ""}`, { groesse: schrift, anker: "start" });
      el.innerHTML = svg(r1(links + 34 + anzahl * 32), unten + 30, f.defs() + s);
      return;
    }

    const { ende, schritt } = skalaVon(zahlen, schrittRoh === null ? null : Number(schrittRoh), bisRoh === null ? null : Number(bisRoh));
    if (zahlen.some((v) => v > ende)) abbruch(`Ein Wert ist größer als „Bis“ (${zahl(ende)}).`);
    if (zahlen.some((v) => !aufHalbemSchritt(v, schritt))) abbruch("Die Werte müssen auf einem Skalenstrich oder genau dazwischen liegen.");
    if (ende / schritt > 12) abbruch("Das wären mehr als 12 Linien. Nimm einen größeren Skalenschritt.");
    const schrift = 14, linien = [];
    for (let v = 0; v <= ende + 1e-9; v += schritt) linien.push(r1(v));
    const zahlBreite = Math.max(...linien.map((v) => textBreite(zahl(v), schrift))) + 12;

    if (art === "balken") {
      const links = Math.max(70, ...werte.map((t) => textBreite(t.name, schrift) + 14)), zeile = 34, plot = groesse * 2;
      const x = (v) => links + (v / ende) * plot, unten = werte.length * zeile + 4;
      let s = "";
      for (const v of linien) s += `<line x1="${r1(x(v))}" y1="0" x2="${r1(x(v))}" y2="${unten}" stroke="${GRAU}" stroke-width="1"/>` + text(x(v), unten + 12, zahl(v), { groesse: schrift });
      werte.forEach((t, i) => {
        const y = i * zeile + 4;
        s += text(links - 8, y + zeile / 2 - 2, t.name, { groesse: schrift, anker: "end" });
        if (!istOffen(i)) s += `<rect class="wert" data-wert="${zahlen[i]}" x="${r1(links)}" y="${y + 3}" width="${r1(x(zahlen[i]) - links)}" height="${zeile - 10}" fill="${grund}" stroke-width="1.5"/>`;
      });
      s += `<line x1="${r1(links)}" y1="0" x2="${r1(links)}" y2="${unten}" stroke-width="2"/><line x1="${r1(links)}" y1="${unten}" x2="${r1(x(ende) + 6)}" y2="${unten}" stroke-width="2"/>`;
      if (einheit) s += text(x(ende), unten + 32, einheit, { groesse: schrift, anker: "end" });
      el.innerHTML = svg(r1(x(ende) + 14), unten + (einheit ? 44 : 24), f.defs() + s);
      return;
    }

    const spalte = Math.max(48, ...werte.map((t) => textBreite(t.name, schrift) + 10)), links = zahlBreite, oben = einheit ? 26 : 10;
    const unten = oben + groesse, y = (v) => unten - (v / ende) * groesse, breite = links + spalte * werte.length + 10;
    let s = einheit ? text(4, 8, einheit, { groesse: schrift, anker: "start" }) : "";
    for (const v of linien) s += `<line class="gitter" data-v="${v}" x1="${r1(links)}" y1="${r1(y(v))}" x2="${r1(breite - 4)}" y2="${r1(y(v))}" stroke="${GRAU}" stroke-width="1"/>` + text(links - 6, y(v), zahl(v), { groesse: schrift, anker: "end" });
    werte.forEach((t, i) => {
      const x = links + i * spalte, b = Math.min(spalte - 14, 44), xb = x + (spalte - b) / 2;
      if (!istOffen(i)) s += `<rect class="wert" data-wert="${zahlen[i]}" x="${r1(xb)}" y="${r1(y(zahlen[i]))}" width="${r1(b)}" height="${r1(unten - y(zahlen[i]))}" fill="${grund}" stroke-width="1.5"/>`;
      s += text(x + spalte / 2, unten + 14, t.name, { groesse: schrift });
    });
    s += `<line x1="${r1(links)}" y1="${r1(oben - 6)}" x2="${r1(links)}" y2="${r1(unten)}" stroke-width="2"/><line x1="${r1(links)}" y1="${r1(unten)}" x2="${r1(breite - 2)}" y2="${r1(unten)}" stroke-width="2"/>`;
    el.setAttribute("data-skala", String(schritt));
    el.innerHTML = svg(r1(breite), r1(unten + 28), f.defs() + s);
  }

  function urne(el) {
    const kugeln = paare(el, "kugeln");
    const nachher = paare(el, "loesung");
    const form = attr(el, "form", "sack");
    const mitLegende = attr(el, "legende", "ja") === "ja";
    const g = num(el, "groesse", 160);
    const auspacken = (eintraege) => eintraege.flatMap((t) => {
      const n = Number(t.wert);
      if (!Number.isInteger(n) || n < 0) abbruch("Die Anzahl der Kugeln muss eine ganze Zahl sein.");
      return Array.from({ length: n }, () => pruefeFarbe(t.name));
    });
    const hatNachher = nachher.length > 0;
    const alle = hatNachher ? auspacken(nachher) : auspacken(kugeln);
    if (alle.length > 20) abbruch("Höchstens 20 Kugeln, sonst passen sie nicht hinein.");
    const zeichnen = !hatNachher || loesungSichtbar(el);
    const f = fuellung(), zz = zufall(samen(el, alle.join(",")));
    const h = g * 1.1, breite = Math.max(g, mitLegende ? 200 : 0), x0 = (breite - g) / 2;
    let s = form === "glas"
      ? `<path d="M${r1(x0 + g * 0.12)} 6 V${r1(h - 10)} Q${r1(x0 + g * 0.12)} ${r1(h - 2)} ${r1(x0 + g * 0.2)} ${r1(h - 2)} H${r1(x0 + g * 0.8)} Q${r1(x0 + g * 0.88)} ${r1(h - 2)} ${r1(x0 + g * 0.88)} ${r1(h - 10)} V6" stroke-width="2.2"/>`
      : `<path d="M${r1(x0 + g * 0.4)} ${r1(g * 0.16)} C${r1(x0 + g * 0.02)} ${r1(g * 0.34)} ${r1(x0 - g * 0.04)} ${r1(h - 2)} ${r1(x0 + g * 0.5)} ${r1(h - 2)} C${r1(x0 + g * 1.04)} ${r1(h - 2)} ${r1(x0 + g * 0.98)} ${r1(g * 0.34)} ${r1(x0 + g * 0.6)} ${r1(g * 0.16)}" stroke-width="2.2"/>` +
        `<path d="M${r1(x0 + g * 0.3)} 4 L${r1(x0 + g * 0.42)} ${r1(g * 0.16)} H${r1(x0 + g * 0.58)} L${r1(x0 + g * 0.7)} 4 Q${r1(x0 + g * 0.5)} ${r1(g * 0.1)} ${r1(x0 + g * 0.3)} 4 Z" stroke-width="2.2"/><line x1="${r1(x0 + g * 0.38)}" y1="${r1(g * 0.16)}" x2="${r1(x0 + g * 0.62)}" y2="${r1(g * 0.16)}" stroke-width="3"/>`;
    if (zeichnen && alle.length > 0) {
      const iw = g * 0.62, ih = g * 0.58, spalten = Math.ceil(Math.sqrt(alle.length * (iw / ih))), zeilen = Math.ceil(alle.length / spalten);
      const r = Math.min(iw / spalten, ih / zeilen) * 0.42, plaetze = [];
      for (let z = 0; z < zeilen; z++) for (let c = 0; c < spalten; c++) plaetze.push([x0 + (g - iw) / 2 + (c + 0.5) * (iw / spalten), h - 10 - ih + (z + 0.5) * (ih / zeilen)]);
      const orte = gemischt(plaetze, zz), reihe = gemischt(alle, zz);
      reihe.forEach((name, i) => {
        s += `<circle class="kugel" data-farbe="${name}" cx="${r1(orte[i][0])}" cy="${r1(orte[i][1])}" r="${r1(r)}" fill="${f.von(name)}" stroke-width="1.5"/>`;
      });
    }
    let unten = h + 2;
    if (mitLegende && zeichnen) {
      const leg = legendeVon(f, alle, unten + 8, breite);
      s += leg.s;
      unten += leg.h + 8;
    }
    el.innerHTML = svg(r1(breite), r1(unten), f.defs() + s);
  }

  const STUFEN_WOERTER = { 3: ["unmöglich", "möglich", "sicher"], 5: ["unmöglich", "wenig wahrscheinlich", "möglich", "sehr wahrscheinlich", "sicher"] };

  function wahrscheinlichkeit(el) {
    const stufen = num(el, "stufen", 3);
    const ereignisse = paare(el, "ereignisse");
    const woerter = STUFEN_WOERTER[stufen];
    if (!woerter) abbruch("Die Skala hat 3 oder 5 Stufen.");
    for (const t of ereignisse) if (!woerter.includes(t.wert)) abbruch(`„${t.wert}“ steht nicht auf dieser Skala.`);
    const breite = 620, spalte = breite / woerter.length, boxen = Math.max(1, ...woerter.map((w) => ereignisse.filter((t) => t.wert === w).length)), b = 34;
    let s = `<line x1="${r1(spalte / 2)}" y1="56" x2="${r1(breite - spalte / 2)}" y2="56" stroke-width="2"/>`;
    woerter.forEach((w, i) => {
      const x = spalte * i + spalte / 2;
      umbrechen(w, 12).forEach((z, n, alle) => {
        s += text(x, 34 - (alle.length - 1 - n) * 18, z, { groesse: 15, fett: true });
      });
      s += `<line x1="${r1(x)}" y1="48" x2="${r1(x)}" y2="64" stroke-width="2"/>`;
      const hier = ereignisse.filter((t) => t.wert === w);
      for (let k = 0; k < boxen; k++) s += antwortfeld(el, x - b / 2, 74 + k * (b + 6), b, b, hier[k]?.name);
    });
    el.innerHTML = svg(breite, 78 + boxen * (b + 6), s);
  }

  /** Alle Möglichkeiten: Kreuzprodukt der Stufen, gefiltert nach Wiederholung und Reihenfolge. */
  const moeglichkeiten = (stufen, wiederholung, reihenfolge) => {
    let pfade = [[]];
    for (const stufe of stufen) pfade = pfade.flatMap((p) => stufe.map((w) => [...p, w]));
    if (!wiederholung) pfade = pfade.filter((p) => new Set(p).size === p.length);
    if (reihenfolge) return pfade;
    const gesehen = new Set();
    return pfade.filter((p) => {
      const k = [...p].sort().join("\u0000");
      if (gesehen.has(k)) return false;
      gesehen.add(k);
      return true;
    });
  };

  function kombinatorik(el) {
    const art = attr(el, "art", "baum");
    const stufen = raster(el, "stufen");
    const wiederholung = attr(el, "wiederholung", "ja") === "ja";
    const reihenfolge = attr(el, "reihenfolge", "ja") === "ja";
    const vorgegeben = num(el, "vorgegeben", 1);
    if (stufen.length < 1 || stufen.length > 3) abbruch("Es gehen 1 bis 3 Stufen.");
    const pfade = moeglichkeiten(stufen, wiederholung, reihenfolge);
    if (pfade.length === 0) abbruch("So gibt es keine einzige Möglichkeit.");
    if (pfade.length > 24) abbruch(`Das wären ${pfade.length} Möglichkeiten; höchstens 24 passen aufs Blatt.`);
    el.setAttribute("data-anzahl", String(pfade.length));
    const schrift = 15, zeile = 28, kasten = (t) => textBreite(t, schrift) + 14;
    const sichtbar = (i) => i < vorgegeben;
    const feld = (x, y, b, h, t, zeigen) => (zeigen
      ? `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(b)}" height="${r1(h)}" rx="3" fill="#fff" stroke-width="1.5"/>${text(x + b / 2, y + h / 2, t, { groesse: schrift })}`
      : antwortfeld(el, x, y, b, h, t, { groesse: schrift }));
    let s = "", breite = 0, hoehe = 0;

    if (art === "baum") {
      const spaltenBreite = stufen.map((st) => Math.max(...st.map(kasten)));
      const xVon = (d) => 26 + spaltenBreite.slice(0, d).reduce((a, b) => a + b + 34, 0);
      const baue = (d, gruppe) => {
        const kinder = new Map();
        gruppe.forEach(({ i, p }) => {
          if (!kinder.has(p[d])) kinder.set(p[d], []);
          kinder.get(p[d]).push({ i, p });
        });
        return [...kinder.entries()].map(([name, teil]) => ({ name, teil, zeigen: teil.some((t) => sichtbar(t.i)), unter: d + 1 < stufen.length ? baue(d + 1, teil) : [] }));
      };
      const baum = baue(0, pfade.map((p, i) => ({ i, p })));
      let naechste = 0;
      const lege = (knoten) => {
        knoten.y = knoten.unter.length === 0 ? naechste++ * zeile + zeile / 2 : knoten.unter.map(lege).reduce((a, b) => a + b, 0) / knoten.unter.length;
        return knoten.y;
      };
      baum.forEach(lege);
      hoehe = naechste * zeile;
      const zeichne = (knoten, d, vonX, vonY) => {
        const x = xVon(d), b = spaltenBreite[d], h = zeile - 6;
        s += `<line x1="${r1(vonX)}" y1="${r1(vonY)}" x2="${r1(x)}" y2="${r1(knoten.y)}" stroke-width="1.5"/>`;
        s += `<g class="ast">${feld(x, knoten.y - h / 2, b, h, knoten.name, knoten.zeigen)}</g>`;
        knoten.unter.forEach((k) => zeichne(k, d + 1, x + b, knoten.y));
      };
      const mitte = baum.reduce((a, k) => a + k.y, 0) / baum.length;
      s += `<circle cx="6" cy="${r1(mitte)}" r="4" fill="${SCHWARZ}" stroke="none"/>`;
      baum.forEach((k) => zeichne(k, 0, 6, mitte));
      breite = xVon(stufen.length - 1) + spaltenBreite[stufen.length - 1] + 4;
    } else if (art === "tabelle") {
      if (stufen.length !== 2) abbruch("Eine Tabelle geht nur mit genau 2 Stufen.");
      const [a, b] = stufen, k = pfade.map((p) => p.join("\u0000"));
      const links = Math.max(...a.map(kasten), 40), sp = Math.max(...a.flatMap((x) => b.map((y) => kasten(`${x} ${y}`))), ...b.map(kasten));
      breite = links + sp * b.length + 2;
      hoehe = (a.length + 1) * zeile + 2;
      b.forEach((w, c) => {
        s += text(links + c * sp + sp / 2, zeile / 2, w, { groesse: schrift, fett: true });
      });
      a.forEach((w, r) => {
        const y = (r + 1) * zeile;
        s += text(links - 8, y + zeile / 2, w, { groesse: schrift, fett: true, anker: "end" });
        b.forEach((v, c) => {
          const x = links + c * sp, i = k.indexOf(`${w}\u0000${v}`);
          if (i < 0) s += `<rect x="${r1(x + 1)}" y="${r1(y + 2)}" width="${r1(sp - 2)}" height="${zeile - 4}" fill="#fff" stroke-width="1.5"/><line x1="${r1(x + 6)}" y1="${r1(y + zeile / 2)}" x2="${r1(x + sp - 6)}" y2="${r1(y + zeile / 2)}" stroke-width="1.5"/>`;
          else s += `<g class="ast">${feld(x + 1, y + 2, sp - 2, zeile - 4, `${w} ${v}`, sichtbar(i))}</g>`;
        });
      });
    } else {
      const b = Math.max(...pfade.map((p) => kasten(p.join(" + "))), 90), jeSpalte = 8, spalten = Math.ceil(pfade.length / jeSpalte);
      breite = spalten * (b + 12);
      hoehe = Math.min(pfade.length, jeSpalte) * zeile;
      pfade.forEach((p, i) => {
        s += `<g class="ast">${feld(Math.floor(i / jeSpalte) * (b + 12), (i % jeSpalte) * zeile + 2, b, zeile - 4, p.join(" + "), sichtbar(i))}</g>`;
      });
    }
    const y = hoehe + 8, wort = "Anzahl der Möglichkeiten:";
    s += text(0, y + 16, wort, { groesse: schrift, anker: "start" }) + antwortfeld(el, textBreite(wort, schrift) + 8, y, 54, 32, String(pfade.length), { groesse: schrift });
    el.innerHTML = svg(r1(Math.max(breite, textBreite(wort, schrift) + 66)), r1(y + 34), s);
  }

  /* == Ebene Geometrie == */
  const HELL_ODER_MUSTER = (f) => (istSw() ? f.von(1) : "color-mix(in srgb,var(--haupt) 45%,#fff)");

  /** Abbildung einer Form { zellen: [[x, y]], polys: [[[x, y]]] } unter T im Gitterpunkt-Maß. */
  const bildVon = (form, T) => ({
    zellen: form.zellen.map(([x, y]) => {
      const [a, b] = T(x, y), [c, d] = T(x + 1, y + 1);
      return [Math.min(a, c), Math.min(b, d)];
    }),
    polys: form.polys.map((p) => p.map(([x, y]) => T(x, y))),
  });
  const spiegelung = (achse, bei) => (achse === "senkrecht" ? (x, y) => [2 * bei - x, y] : (x, y) => [x, 2 * bei - y]);

  const seiteDerAchse = (form, achse, bei) => {
    const i = achse === "senkrecht" ? 0 : 1;
    const werte = [...form.zellen.flatMap((z) => [z[i], z[i] + 1]), ...form.polys.flat().map((p) => p[i])];
    if (werte.every((v) => v <= bei)) return -1;
    if (werte.every((v) => v >= bei)) return 1;
    return 0;
  };

  const passtInsGitter = (form, spalten, zeilen) =>
    form.zellen.every(([x, y]) => x >= 0 && y >= 0 && x < spalten && y < zeilen) &&
    form.polys.flat().every(([x, y]) => x >= 0 && y >= 0 && x <= spalten && y <= zeilen);

  /** Vergrößern um 2 oder Halbieren: Beim Halbieren muss jedes 2×2-Feld ganz voll oder ganz leer sein. */
  const skaliere = (form, faktor) => {
    const xs = [...form.zellen.map((z) => z[0]), ...form.polys.flat().map((p) => p[0])];
    const ys = [...form.zellen.map((z) => z[1]), ...form.polys.flat().map((p) => p[1])];
    const x0 = Math.min(...xs), y0 = Math.min(...ys);
    const polys = form.polys.map((p) => p.map(([x, y]) => [(x - x0) * faktor, (y - y0) * faktor]));
    if (polys.flat().flat().some((v) => !Number.isInteger(v * 2))) abbruch("Diese Figur liegt nach dem Verkleinern nicht mehr auf dem Gitter.");
    if (faktor >= 1) {
      const zellen = form.zellen.flatMap(([x, y]) => {
        const liste2 = [];
        for (let i = 0; i < faktor; i++) for (let j = 0; j < faktor; j++) liste2.push([(x - x0) * faktor + i, (y - y0) * faktor + j]);
        return liste2;
      });
      return { zellen, polys };
    }
    const voll = new Set(form.zellen.map(([x, y]) => `${x - x0},${y - y0}`)), kloetze = new Set();
    for (const k of voll) {
      const [x, y] = k.split(",").map(Number), a = x - (x % 2), b = y - (y % 2);
      if (![[a, b], [a + 1, b], [a, b + 1], [a + 1, b + 1]].every(([p, q]) => voll.has(`${p},${q}`))) abbruch("Diese Figur lässt sich nicht halbieren: Jedes 2×2-Feld muss ganz voll oder ganz leer sein.");
      kloetze.add(`${a / 2},${b / 2}`);
    }
    return { zellen: [...kloetze].map((k) => k.split(",").map(Number)), polys };
  };

  const RICHTUNGEN = { "→": [1, 0], "←": [-1, 0], "↑": [0, -1], "↓": [0, 1] };
  /** Zellen eines Wegs. Bricht ab, wenn er das Gitter verlässt. */
  const gehWeg = (start, schritte, spalten, zeilen) => {
    const orte = [start];
    for (const roh of schritte) {
      const t = /^(\d+)\s*([←→↑↓])$/.exec(roh);
      if (!t) abbruch(`„${roh}“ verstehe ich nicht als Schritt. Schreibe zum Beispiel 3→.`);
      const [dx, dy] = RICHTUNGEN[t[2]], [x, y] = orte[orte.length - 1], n = Number(t[1]);
      const neu = [x + dx * n, y + dy * n];
      if (neu[0] < 0 || neu[1] < 0 || neu[0] >= spalten || neu[1] >= zeilen) abbruch("Der Weg verlässt das Gitter. Ändere den Start oder die Schritte.");
      orte.push(neu);
    }
    return orte;
  };

  /** Fläche in Kästchen und Umfang in Kästchenlängen. Schräge Linien haben keinen Umfang in ganzen Längen. */
  const flaecheUmfang = (form) => {
    const voll = new Set(form.zellen.map(([x, y]) => `${x},${y}`));
    let flaeche = voll.size, umfang = 0, schraeg = false;
    for (const k of voll) {
      const [x, y] = k.split(",").map(Number);
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!voll.has(`${x + a},${y + b}`)) umfang += 1;
    }
    for (const p of form.polys) {
      let doppelt = 0;
      p.forEach(([x, y], i) => {
        const [c, d] = p[(i + 1) % p.length];
        doppelt += x * d - c * y;
        if (x !== c && y !== d) schraeg = true;
        umfang += Math.abs(c - x) + Math.abs(d - y);
      });
      flaeche += Math.abs(doppelt) / 2;
    }
    return { flaeche, umfang: schraeg ? null : umfang };
  };

  function gitter(el) {
    const art = attr(el, "art", "karo");
    const spalten = num(el, "spalten", 10), zeilen = num(el, "zeilen", 8);
    const k = cm(num(el, "kaestchen", klasse() <= 2 ? 1 : 0.5));
    const figur = raster(el, "figur");
    const linienRoh = attr(el, "linien", "");
    const aufgabe = attr(el, "aufgabe", "keine");
    const achse = attr(el, "achse", "");
    const faktor = attr(el, "faktor", "2") === "0.5" ? 0.5 : 2;
    const zaehlen = liste(el, "zaehlen");
    const wegart = attr(el, "wegart", "gehen");
    const schritte = liste(el, "weg");
    const startRoh = attr(el, "start", "0,0");
    const rapportart = attr(el, "rapportart", "schieben");
    const gegebenRapporte = num(el, "rapporte", 2);
    if (figur.flat().some((z) => z !== "0") && linienRoh) abbruch("Eine Figur besteht aus Kästchen oder aus Linien, nicht aus beidem.");
    const form = { zellen: [], polys: [] };
    figur.forEach((zeile, y) => zeile.forEach((z, x) => {
      if (z !== "0") form.zellen.push([x, y]);
    }));
    if (linienRoh) {
      form.polys = linienRoh.split(";").map((t) => t.trim()).filter(Boolean).map((t) => t.split(/\s+/).map((p) => p.split(",").map(Number)));
      if (form.polys.flat().flat().some((v) => !Number.isFinite(v))) abbruch("Linien schreibt man als Punkte, zum Beispiel 0,0 3,0 3,2.");
    }
    if (!passtInsGitter(form, spalten, zeilen)) abbruch("Die Figur passt nicht ins Gitter. Mach das Gitter größer.");
    const istLeer = form.zellen.length === 0 && form.polys.length === 0;
    if (["spiegeln", "fortsetzen", "vergroessern"].includes(aufgabe) && istLeer) abbruch("Die Figur ist noch leer.");
    const f = fuellung(), grund = HELL_ODER_MUSTER(f);

    let oben = 0, loesung = { zellen: [], polys: [] }, zielGitter = false, achseLinie = "", wegBild = "";
    if (achse && aufgabe !== "fortsetzen") {
      const grenze = achse === "senkrecht" ? spalten : zeilen, bei = num(el, "achse-bei", Math.floor(grenze / 2));
      if (!(bei > 0 && bei < grenze)) abbruch("Die Achse muss innerhalb des Gitters auf einer Linie liegen.");
      const a = bei * k;
      achseLinie = achse === "senkrecht"
        ? `<line class="achse" x1="${r1(a)}" y1="-6" x2="${r1(a)}" y2="${r1(zeilen * k + 6)}" stroke="${SCHWARZ}" stroke-width="2.5" stroke-dasharray="8 5"/>`
        : `<line class="achse" x1="-6" y1="${r1(a)}" x2="${r1(spalten * k + 6)}" y2="${r1(a)}" stroke="${SCHWARZ}" stroke-width="2.5" stroke-dasharray="8 5"/>`;
      if (aufgabe === "spiegeln") {
        if (seiteDerAchse(form, achse, bei) === 0) abbruch("Die Figur kreuzt die Achse. Sie muss ganz auf einer Seite liegen.");
        loesung = bildVon(form, spiegelung(achse, bei));
        if (!passtInsGitter(loesung, spalten, zeilen)) abbruch("Die gespiegelte Hälfte passt nicht ins Gitter. Rücke die Achse oder die Figur.");
      }
    } else if (aufgabe === "spiegeln") abbruch("Zum Spiegeln fehlt die Achse.");

    let gegeben = form;
    if (aufgabe === "fortsetzen") {
      const xs = [...form.zellen.map((z) => z[0] + 1), ...form.polys.flat().map((p) => p[0])];
      const w = num(el, "rapport", Math.max(...xs));
      if (!(w >= 1)) abbruch("Ein Rapport ist mindestens ein Kästchen breit.");
      if ((gegebenRapporte + 2) * w > spalten) abbruch(`Das Gitter ist zu schmal: Es braucht ${(gegebenRapporte + 2) * w} Spalten.`);
      const nach = (i) => (x, y) => {
        const wenden = i % 2 === 1 && rapportart !== "schieben";
        return [i * w + (wenden ? w - x : x), wenden && rapportart === "drehen" ? zeilen - y : y];
      };
      const vereint = (von, bis) => {
        const v = { zellen: [], polys: [] };
        for (let i = von; i < bis; i++) {
          const b = bildVon(form, nach(i));
          v.zellen.push(...b.zellen);
          v.polys.push(...b.polys);
        }
        return v;
      };
      gegeben = vereint(0, gegebenRapporte);
      loesung = vereint(gegebenRapporte, gegebenRapporte + 2);
    }
    if (aufgabe === "vergroessern") {
      zielGitter = true;
      loesung = skaliere(form, faktor);
      if (!passtInsGitter(loesung, spalten, zeilen)) abbruch("Die Figur passt in dieser Größe nicht ins Zielgitter. Mach das Gitter größer.");
    }

    const breiteGitter = spalten * k, hoeheGitter = zeilen * k, abstand = zielGitter ? 28 : 0;
    const gesamt = breiteGitter * (zielGitter ? 2 : 1) + abstand;
    if (gesamt > SATZSPIEGEL) abbruch("So viele Spalten passen nicht aufs Blatt. Nimm weniger Spalten oder kleinere Kästchen.");

    const zelle = (x, y, klassenName, dx = 0) => `<rect class="${klassenName}" data-x="${x}" data-y="${y}" x="${r1(dx + x * k)}" y="${r1(y * k)}" width="${r1(k)}" height="${r1(k)}" fill="${grund}" stroke="${SCHWARZ}" stroke-width="1.5"/>`;
    const poly = (p, klassenName, dx = 0) => `<path class="${klassenName}" d="M${p.map(([x, y]) => `${r1(dx + x * k)} ${r1(y * k)}`).join(" L")} Z" fill="${grund}" stroke="${SCHWARZ}" stroke-width="2"/>`;
    const gitterLinien = (dx) => {
      let s = "";
      if (art === "karo") {
        for (let x = 0; x <= spalten; x++) s += `<line x1="${r1(dx + x * k)}" y1="0" x2="${r1(dx + x * k)}" y2="${r1(hoeheGitter)}" stroke="${GRAU}" stroke-width="1"/>`;
        for (let y = 0; y <= zeilen; y++) s += `<line x1="${r1(dx)}" y1="${r1(y * k)}" x2="${r1(dx + breiteGitter)}" y2="${r1(y * k)}" stroke="${GRAU}" stroke-width="1"/>`;
        return s;
      }
      const rPunkt = art === "geobrett" ? 3 : 1.6;
      for (let x = 0; x <= spalten; x++) for (let y = 0; y <= zeilen; y++) s += `<circle cx="${r1(dx + x * k)}" cy="${r1(y * k)}" r="${rPunkt}" fill="${SCHWARZ}" stroke="none"/>`;
      return s;
    };
    const zeigeLoesung = loesungSichtbar(el);
    let s = gegeben.zellen.map(([x, y]) => zelle(x, y, "kaestchen")).join("") + gegeben.polys.map((p) => poly(p, "kaestchen")).join("");
    s += gitterLinien(0);
    if (zielGitter) s += gitterLinien(breiteGitter + abstand);
    if (zeigeLoesung) {
      const dx = zielGitter ? breiteGitter + abstand : 0;
      s += loesung.zellen.map(([x, y]) => zelle(x, y, "kaestchen-loesung", dx)).join("") + loesung.polys.map((p) => poly(p, "kaestchen-loesung", dx)).join("");
    }
    s += achseLinie;

    if (aufgabe === "weg") {
      const start = startRoh.split(",").map(Number);
      if (start.length !== 2 || start.some((v) => !Number.isInteger(v))) abbruch("Den Start schreibt man als Spalte,Zeile, zum Beispiel 2,3.");
      if (start[0] < 0 || start[1] < 0 || start[0] >= spalten || start[1] >= zeilen) abbruch("Der Start liegt außerhalb des Gitters.");
      const orte = gehWeg(start, schritte, spalten, zeilen);
      const mitte = ([x, y]) => [r1((x + 0.5) * k), r1((y + 0.5) * k)];
      const beschreiben = wegart === "beschreiben", [sx, sy] = mitte(orte[0]), [zx, zy] = mitte(orte[orte.length - 1]);
      if (beschreiben || zeigeLoesung) {
        wegBild += `<path class="weg" d="M${orte.map((o) => mitte(o).join(" ")).join(" L")}" stroke="${SCHWARZ}" stroke-width="2.5" stroke-linejoin="round"/>`;
        wegBild += `<circle class="ziel" cx="${zx}" cy="${zy}" r="${r1(k * 0.28)}" fill="#fff" stroke-width="2"/>` + text(zx, zy, "Z", { groesse: Math.min(14, k * 0.42), fett: true });
      }
      wegBild += `<circle class="start" cx="${sx}" cy="${sy}" r="${r1(k * 0.2)}" fill="${SCHWARZ}" stroke="none"/>`;
      s += wegBild;
      el.setAttribute("data-ziel", orte[orte.length - 1].join(","));
      const folge = schritte.join("  ");
      if (beschreiben) {
        oben = 0;
        const y = hoeheGitter + 10, b = Math.max(textBreite(folge, 16) + 24, 200);
        s += antwortfeld(el, 0, y, b, 32, folge, { groesse: 16 });
        el.innerHTML = svg(r1(Math.max(breiteGitter, b) + 2), r1(y + 34), f.defs() + `<g transform="translate(1 1)">${s}</g>`);
        return;
      }
      oben = 30;
      s = text(0, -18, folge, { groesse: 18, fett: true, anker: "start" }) + s;
    }

    let unten = hoeheGitter + (achse ? 8 : 2), breiteText = 0;
    if (zaehlen.length > 0) {
      const { flaeche, umfang } = flaecheUmfang(form);
      if (zaehlen.includes("umfang") && umfang === null) abbruch("Den Umfang gibt es nur bei Figuren ohne schräge Linien.");
      el.setAttribute("data-flaeche", String(flaeche));
      if (umfang !== null) el.setAttribute("data-umfang", String(umfang));
      const zeile = (wort, wert, einheit) => {
        const w1 = textBreite(wort, 15) + 8;
        s += text(0, unten + 22, wort, { groesse: 15, anker: "start" }) + antwortfeld(el, w1, unten + 6, 56, 32, zahl(wert), { groesse: 15 }) +
          text(w1 + 62, unten + 22, einheit, { groesse: 15, anker: "start" });
        breiteText = Math.max(breiteText, w1 + 62 + textBreite(einheit, 15));
        unten += 36;
      };
      if (zaehlen.includes("flaeche")) zeile("Fläche:", flaeche, "Kästchen");
      if (zaehlen.includes("umfang")) zeile("Umfang:", umfang, "Kästchenlängen");
      unten += 6;
    }
    masstab(el);
    el.innerHTML = svg(r1(Math.max(gesamt, breiteText) + 2), r1(unten + oben + 2), `${f.defs()}<g transform="translate(1 ${oben + 1})">${s}</g>`);
  }

  const ECKEN = {
    quadrat: (a) => [[0, 0], [a, 0], [a, a], [0, a]],
    rechteck: (a, b) => [[0, 0], [a, 0], [a, b], [0, b]],
    trapez: (a, b) => [[0, b], [a, b], [a * 0.75, 0], [a * 0.25, 0]],
    parallelogramm: (a, b) => [[0, b], [a, b], [a + b * 0.5, 0], [b * 0.5, 0]],
    raute: (a) => [[0, 0], [a, 0], [a * 1.5, a * 0.866], [a * 0.5, a * 0.866]],
  };
  const regelmaessig = (n, a) => {
    const r = a / (2 * Math.sin(Math.PI / n));
    return Array.from({ length: n }, (_, i) => {
      const w = (2 * Math.PI * i) / n - Math.PI / 2;
      return [r * Math.cos(w), r * Math.sin(w)];
    });
  };
  const dreieckEcken = (typ, a, b) => {
    if (typ === "gleichseitig") return [[0, a * 0.866], [a, a * 0.866], [a / 2, 0]];
    if (typ === "gleichschenklig") return [[0, b], [a, b], [a / 2, 0]];
    return [[0, b], [a, b], [0, 0]];
  };

  /** Zeichnet die Normsymbole an ein konvexes Vieleck; zählt die rechten Winkel. */
  const markiere = (ecken, was) => {
    const n = ecken.length, mitte = ecken.reduce((a, p) => [a[0] + p[0] / n, a[1] + p[1] / n], [0, 0]);
    const kanten = ecken.map((p, i) => [p, ecken[(i + 1) % n]]);
    const laenge = ([p, q]) => Math.hypot(q[0] - p[0], q[1] - p[1]);
    let s = "", rechte = 0;
    if (was.includes("rechter-winkel")) {
      ecken.forEach((p, i) => {
        const a = ecken[(i + n - 1) % n], b = ecken[(i + 1) % n];
        const u = [a[0] - p[0], a[1] - p[1]], v = [b[0] - p[0], b[1] - p[1]];
        const lu = Math.hypot(...u), lv = Math.hypot(...v);
        if (Math.abs(u[0] * v[0] + u[1] * v[1]) / (lu * lv) > 0.01) return;
        rechte += 1;
        const r = 16, a1 = [p[0] + (u[0] / lu) * r, p[1] + (u[1] / lu) * r], a2 = [p[0] + (v[0] / lv) * r, p[1] + (v[1] / lv) * r];
        const kreuz = u[0] * v[1] - u[1] * v[0];
        const hin = [u[0] / lu + v[0] / lv, u[1] / lu + v[1] / lv], lh = Math.hypot(...hin);
        s += `<path class="rechter-winkel" d="M${r1(a1[0])} ${r1(a1[1])} A${r} ${r} 0 0 ${kreuz > 0 ? 1 : 0} ${r1(a2[0])} ${r1(a2[1])}" stroke-width="1.5"/>`;
        s += `<circle cx="${r1(p[0] + (hin[0] / lh) * r * 0.52)}" cy="${r1(p[1] + (hin[1] / lh) * r * 0.52)}" r="1.8" fill="${SCHWARZ}" stroke="none"/>`;
      });
    }
    if (was.includes("parallel")) {
      const gruppen = [];
      kanten.forEach((k) => {
        const d = [(k[1][0] - k[0][0]) / laenge(k), (k[1][1] - k[0][1]) / laenge(k)];
        const g = gruppen.find((x) => Math.abs(x.d[0] * d[1] - x.d[1] * d[0]) < 0.01);
        if (g) g.kanten.push(k);
        else gruppen.push({ d, kanten: [k] });
      });
      gruppen.filter((g) => g.kanten.length > 1).forEach((g, nr) => g.kanten.forEach(([p, q]) => {
        const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
        for (let j = 0; j <= nr; j++) {
          const x = mx + g.d[0] * j * 7, y = my + g.d[1] * j * 7, nx = -g.d[1], ny = g.d[0];
          s += `<path class="parallel" d="M${r1(x - g.d[0] * 6 + nx * 5)} ${r1(y - g.d[1] * 6 + ny * 5)} L${r1(x)} ${r1(y)} L${r1(x - g.d[0] * 6 - nx * 5)} ${r1(y - g.d[1] * 6 - ny * 5)}" stroke-width="1.5"/>`;
        }
      }));
    }
    if (was.includes("gleich-lang")) {
      const gruppen = [];
      kanten.forEach((k) => {
        const g = gruppen.find((x) => Math.abs(x.l - laenge(k)) < 0.5);
        if (g) g.kanten.push(k);
        else gruppen.push({ l: laenge(k), kanten: [k] });
      });
      gruppen.filter((g) => g.kanten.length > 1).forEach((g, nr) => g.kanten.forEach((k) => {
        const [p, q] = k, d = [(q[0] - p[0]) / laenge(k), (q[1] - p[1]) / laenge(k)], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
        for (let j = 0; j <= nr; j++) {
          const o = (j - nr / 2) * 5, x = mx + d[0] * o, y = my + d[1] * o;
          s += `<line class="gleich-lang" x1="${r1(x - d[1] * 6)}" y1="${r1(y + d[0] * 6)}" x2="${r1(x + d[1] * 6)}" y2="${r1(y - d[0] * 6)}" stroke-width="1.5"/>`;
        }
      }));
    }
    return { s, rechte, mitte };
  };

  function figur(el) {
    const form = attr(el, "form", "quadrat");
    const typ = attr(el, "typ", "rechtwinklig");
    const masse = liste(el, "masse").map(Number);
    const drehung = num(el, "drehung", 0);
    const markierung = liste(el, "markierung");
    const nachher = liste(el, "loesung");
    const mitNamen = attr(el, "beschriftung", "nein") === "ja";
    const groesse = num(el, "groesse", 120);
    if (masse.some((m) => !(m > 0))) abbruch("Die Maße müssen Zahlen größer als 0 sein.");
    const a = masse[0] ?? 4, b = masse[1] ?? (form === "rechteck" ? 2.5 : 3);
    let ecken = null;
    if (ECKEN[form]) ecken = ECKEN[form](a, b);
    else if (form === "dreieck") ecken = dreieckEcken(typ, a, b);
    else if (form === "fuenfeck") ecken = regelmaessig(5, a);
    else if (form === "sechseck") ecken = regelmaessig(6, a);
    else if (form !== "kreis") abbruch(`Die Form „${form}“ gibt es nicht.`);
    const rand = 24;
    if (form === "kreis") {
      const d = masse.length > 0 ? cm(a) : groesse;
      if (masse.length > 0) masstab(el);
      else el.removeAttribute("data-masstab");
      el.innerHTML = svg(r1(d + 4), r1(d + 4), `<circle cx="${r1(d / 2 + 2)}" cy="${r1(d / 2 + 2)}" r="${r1(d / 2)}" stroke-width="2"/>`);
      return;
    }
    const roh = ecken.flat(), breit = Math.max(...roh.filter((_, i) => i % 2 === 0)) - Math.min(...roh.filter((_, i) => i % 2 === 0));
    const hoch = Math.max(...roh.filter((_, i) => i % 2 === 1)) - Math.min(...roh.filter((_, i) => i % 2 === 1));
    const mass = masse.length > 0 ? cm(1) : groesse / Math.max(breit, hoch);
    if (masse.length > 0) masstab(el);
    else el.removeAttribute("data-masstab");
    const w = (drehung * Math.PI) / 180, gedreht = ecken.map(([x, y]) => [mass * (x * Math.cos(w) - y * Math.sin(w)), mass * (x * Math.sin(w) + y * Math.cos(w))]);
    const x0 = Math.min(...gedreht.map((p) => p[0])), y0 = Math.min(...gedreht.map((p) => p[1]));
    const punkte = gedreht.map(([x, y]) => [r1(x - x0 + rand), r1(y - y0 + rand)]);
    const zeigen = loesungSichtbar(el) ? [...markierung, ...nachher] : markierung;
    const { mitte, rechte, s: marken } = markiere(punkte, zeigen);
    let s = `<path class="umriss" d="M${punkte.map((p) => p.join(" ")).join(" L")} Z" stroke-width="2"/>${marken}`;
    if (mitNamen) punkte.forEach((p, i) => {
      const d = [p[0] - mitte[0], p[1] - mitte[1]], l = Math.hypot(...d);
      s += text(p[0] + (d[0] / l) * 14, p[1] + (d[1] / l) * 14, String.fromCharCode(65 + i), { groesse: 15, fett: true });
    });
    el.setAttribute("data-rechte-winkel", String(rechte));
    el.innerHTML = svg(r1(Math.max(...punkte.map((p) => p[0])) + rand), r1(Math.max(...punkte.map((p) => p[1])) + rand), s);
  }

  /** Die sieben Teile aus dem Quadrat mit Seite 4 (Fläche 16). */
  const TANGRAM_TEILE = {
    gross1: [[0, 0], [4, 0], [2, 2]], gross2: [[0, 0], [2, 2], [0, 4]], mittel: [[4, 4], [4, 2], [2, 4]], klein1: [[2, 2], [3, 3], [1, 3]],
    klein2: [[4, 0], [4, 2], [3, 1]], quadrat: [[3, 1], [4, 2], [3, 3], [2, 2]], raute: [[1, 3], [3, 3], [2, 4], [0, 4]],
  };
  /** Jeder Umriss ist eine gültige Lage aller sieben Teile; der kern-Test rechnet Deckungsgleichheit und Überlappung nach. */
  const TANGRAM_UMRISSE = {
    haus: {
      gross1: [[0, 2], [4, 2], [2, 0]], gross2: [[0, 2], [4, 2], [2, 4]], mittel: [[0, 2], [2, 4], [0, 4]], klein1: [[4, 2], [4, 4], [3, 3]],
      klein2: [[4, 4], [2, 4], [3, 3]], quadrat: [[1, 1], [0, 0], [-1, 1], [0, 2]], raute: [[3, 1], [3, -1], [4, 0], [4, 2]],
    },
    katze: {
      quadrat: [[1, 0], [2, 1], [1, 2], [0, 1]], klein1: [[0, 1], [1, 0], [0, -1]], klein2: [[1, 0], [2, 1], [2, -1]], gross1: [[1, 2], [1, 6], [3, 4]],
      gross2: [[1, 6], [5, 6], [3, 4]], mittel: [[1, 2], [1, 4], [-1, 4]], raute: [[5, 6], [7, 6], [8, 5], [6, 5]],
    },
    schiff: {
      gross1: [[4, 0], [4, 4], [2, 2]], gross2: [[4, 4], [0, 4], [2, 2]], quadrat: [[3, 1], [2, 0], [1, 1], [2, 2]], mittel: [[0, 4], [2, 4], [2, 6]],
      klein1: [[2, 4], [4, 4], [3, 5]], klein2: [[2, 4], [3, 5], [2, 6]], raute: [[0, 4], [-2, 4], [-1, 5], [1, 5]],
    },
    fisch: {
      gross1: [[0, 2], [4, 2], [2, 0]], gross2: [[0, 2], [4, 2], [2, 4]], mittel: [[4, 2], [6, 2], [6, 0]], klein1: [[4, 2], [6, 2], [5, 3]],
      klein2: [[6, 2], [6, 4], [5, 3]], raute: [[1, 1], [2, 0], [2, -2], [1, -1]], quadrat: [[1, 3], [2, 4], [1, 5], [0, 4]],
    },
    kerze: {
      quadrat: [[1, 0], [2, 1], [1, 2], [0, 1]], gross1: [[0, 2], [0, 6], [2, 4]], mittel: [[0, 2], [2, 2], [2, 4]], klein1: [[0, 6], [2, 6], [1, 5]],
      klein2: [[2, 4], [2, 6], [1, 5]], gross2: [[-1, 6], [3, 6], [1, 8]], raute: [[3, 6], [5, 6], [4, 7], [2, 7]],
    },
  };

  function tangram(el) {
    const umriss = attr(el, "umriss", "haus");
    const vorgegeben = liste(el, "teile");
    const bogen = attr(el, "bogen", "nein") === "ja";
    const einheit = bogen ? cm(3) : num(el, "groesse", 30);
    const f = fuellung(), namen = Object.keys(TANGRAM_TEILE);
    const fuell = (n) => f.von(namen.indexOf(n) + 1);
    const pfad = (p, x0, y0) => `M${p.map(([x, y]) => `${r1((x - x0) * einheit + 3)} ${r1((y - y0) * einheit + 3)}`).join(" L")} Z`;
    if (bogen) {
      masstab(el);
      let s = "";
      for (const n of namen) s += `<path class="teil" data-teil="${n}" d="${pfad(TANGRAM_TEILE[n], 0, 0)}" fill="${fuell(n)}" stroke-width="2"/>`;
      el.innerHTML = svg(r1(4 * einheit + 6), r1(4 * einheit + 6), f.defs() + s);
      return;
    }
    el.removeAttribute("data-masstab");
    const lage = TANGRAM_UMRISSE[umriss];
    if (!lage) abbruch(`Den Umriss „${umriss}“ gibt es nicht. Es gibt: ${Object.keys(TANGRAM_UMRISSE).join(", ")}.`);
    for (const v of vorgegeben) if (!lage[v]) abbruch(`Das Teil „${v}“ gibt es nicht.`);
    const alle = Object.values(lage).flat(), x0 = Math.min(...alle.map((p) => p[0])), y0 = Math.min(...alle.map((p) => p[1]));
    let s = namen.map((n) => `<path d="${pfad(lage[n], x0, y0)}" fill="#fff" stroke-width="5" stroke-linejoin="round"/>`).join("");
    s += namen.map((n) => `<path d="${pfad(lage[n], x0, y0)}" fill="#fff" stroke="none"/>`).join("");
    for (const n of namen) {
      if (loesungSichtbar(el) || vorgegeben.includes(n)) s += `<path class="teil" data-teil="${n}" d="${pfad(lage[n], x0, y0)}" fill="${fuell(n)}" stroke-width="1.6"/>`;
    }
    const breite = Math.max(...alle.map((p) => p[0])) - x0, hoehe = Math.max(...alle.map((p) => p[1])) - y0;
    el.innerHTML = svg(r1(breite * einheit + 6), r1(hoehe * einheit + 6), f.defs() + s);
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
    "x-probe": probe, "x-gluecksrad": gluecksrad, "x-wuerfel": wuerfel, "x-strichliste": strichliste, "x-diagramm": diagramm,
    "x-urne": urne, "x-wahrscheinlichkeit": wahrscheinlichkeit, "x-kombinatorik": kombinatorik,
    "x-gitter": gitter, "x-figur": figur, "x-tangram": tangram };

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
  window.schoolboxAbbildungen = {
    ARTEN, zahl, cm, zufall, gemischt, trenneListe, trenneRaster, bildVon, spiegelung, skaliere, gehWeg, flaecheUmfang, TANGRAM_TEILE, TANGRAM_UMRISSE,
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => window.zeichneAbbildungen());
  else window.zeichneAbbildungen();
})();
