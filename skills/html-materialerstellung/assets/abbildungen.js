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
    "x-uhr": "Uhr", "x-menge": "Menge", "x-dienes": "Mehrsystemblöcke", "x-strichpunkt": "Strich-Punkt-Bild",
    "x-stellentafel": "Stellentafel", "x-zwanzigerfeld": "Zwanzigerfeld", "x-zahlenstrahl": "Zahlenstrahl", "x-timer": "Timer",
    "x-probe": "Probe",
    "x-gluecksrad": "Glücksrad", "x-wuerfel": "Würfel", "x-strichliste": "Strichliste", "x-diagramm": "Diagramm",
    "x-urne": "Kugeln im Säckchen", "x-wahrscheinlichkeit": "Wahrscheinlichkeit", "x-kombinatorik": "Möglichkeiten",
    "x-gitter": "Gitter", "x-figur": "Figur", "x-tangram": "Tangram",
    "x-hunderterfeld": "Hunderterfeld", "x-hundertertafel": "Hundertertafel", "x-rechenrahmen": "Rechenrahmen", "x-rechenstrich": "Rechenstrich",
    "x-lineatur": "Schreiblinien", "x-silben": "Silben", "x-wortarten": "Wortarten", "x-satzglieder": "Satzglieder", "x-wortbausteine": "Wortbausteine", "x-zeitleiste": "Zeitleiste", "x-jahreskreis": "Jahreskreis", "x-windrose": "Windrose", "x-plan": "Plan", "x-schaltplan": "Stromkreis", "x-kreislauf": "Kreislauf", "x-verkehrszeichen": "Verkehrszeichen", "x-wetter": "Wettersymbol",
    "x-geld": "Geld", "x-skala": "Messgerät", "x-strecke": "Strecke", "x-kalender": "Kalender", "x-zeitspanne": "Zeitspanne",
    "x-punktfeld": "Punktfeld", "x-malkreuz": "Malkreuz", "x-schriftlich": "Schriftliche Rechnung",
    "x-zahlenmauer": "Zahlenmauer", "x-rechendreieck": "Rechendreieck", "x-zahlenhaus": "Zahlenhaus", "x-zahlenkette": "Rechenkette", "x-zauberdreieck": "Zauberdreieck", "x-rechenrad": "Rechenrad",
    "x-wuerfelbau": "Würfelgebäude", "x-wuerfelnetz": "Würfelnetz", "x-koerper": "Körper",
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
  const uhrText = (zeit, format) => {
    const [hh, mm] = zeit.split(":").map(Number);
    const stunde = format === "12" ? String(hh % 12 || 12) : String(hh).padStart(2, "0");
    return `${stunde}:${String(mm).padStart(2, "0")}`;
  };
  const uhrSektor = (roh) => {
    const m = roh.match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
    if (!m) abbruch(`„${roh}“ ist keine Zeitspanne wie 4:30-4:50.`);
    const von = Number(m[1]) * 60 + Number(m[2]);
    let bis = Number(m[3]) * 60 + Number(m[4]);
    if (bis <= von) bis += 720;
    if (bis - von > 60) abbruch("Der Sektor zeigt höchstens 60 Minuten.");
    const punkt = (minute) => {
      const a = ((minute % 60) * 6 * Math.PI) / 180;
      return `${r1(50 + 47 * Math.sin(a))} ${r1(50 - 47 * Math.cos(a))}`;
    };
    const flaeche = istSw() ? "#d0d0d0" : "color-mix(in srgb,var(--haupt) 45%,#fff)";
    if (bis - von === 60) return `<circle class="uhr-sektor" cx="50" cy="50" r="47" fill="${flaeche}" stroke="none"/>`;
    return `<path class="uhr-sektor" d="M50 50L${punkt(von)}A47 47 0 ${bis - von > 30 ? 1 : 0} 1 ${punkt(bis)}Z" fill="${flaeche}" stroke="none"/>`;
  };
  function uhr(el) {
    const g = num(el, "groesse", 88);
    const digital = attr(el, "digital", "nein"), format = attr(el, "format", "24"), mitMinuten = attr(el, "minuten", "nein") === "ja", mit24 = attr(el, "ziffern24", "nein") === "ja";
    if (!["nein", "ja", "nur"].includes(digital)) abbruch(`„${digital}“ gibt es bei der Digitalanzeige nicht.`);
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
    if (mit24) {
      for (let h = 13; h <= 24; h++) {
        const a = (h * 30 * Math.PI) / 180;
        s += text(50 + 24.5 * Math.sin(a), 50 - 24.5 * Math.cos(a), String(h), { groesse: 6, farbe: "currentColor" });
      }
    }
    const sektorRoh = el.getAttribute("sektor") || (loesungSichtbar(el) ? el.getAttribute("sektor-loesung") : null);
    if (sektorRoh) s = uhrSektor(sektorRoh) + s;
    if (zeit) {
      if (!/^\d{1,2}:\d{2}$/.test(zeit)) abbruch(`„${zeit}“ ist keine Uhrzeit wie 4:30.`);
      const [hh, mm] = zeit.split(":").map(Number);
      const am = (mm * 6 * Math.PI) / 180, ah = (((hh % 12) + mm / 60) * 30 * Math.PI) / 180;
      s += `<line x1="50" y1="50" x2="${r1(50 + 18 * Math.sin(ah))}" y2="${r1(50 - 18 * Math.cos(ah))}" stroke-width="5" stroke-linecap="round"/>`;
      s += `<line x1="50" y1="50" x2="${r1(50 + 27 * Math.sin(am))}" y2="${r1(50 - 27 * Math.cos(am))}" stroke-width="3" stroke-linecap="round"/>`;
    }
    s += '<circle cx="50" cy="50" r="3" fill="currentColor" stroke="none"/>';
    const anzeige = (y) => `<rect x="20" y="${y}" width="60" height="24" rx="4" stroke-width="1.6" fill="#fff"/>` +
      `<g class="uhr-digital">${zeit ? text(50, y + 12, uhrText(zeit, format), { groesse: 16, fett: true }) : ""}</g>`;
    if (digital === "nur") {
      el.innerHTML = svg(100, 26, anzeige(1), [g, g * 0.26]);
      return;
    }
    if (!mitMinuten && digital === "nein") {
      el.innerHTML = svg(100, 100, s, [g, g]);
      return;
    }
    const rand = mitMinuten ? 11 : 0;
    let ring = "";
    if (mitMinuten) {
      for (let i = 1; i <= 12; i++) {
        const a = (i * 30 * Math.PI) / 180;
        ring += text(50 + 53 * Math.sin(a), 50 - 53 * Math.cos(a), String(i * 5), { groesse: 6.5, farbe: "currentColor" });
      }
    }
    const breit = 100 + rand * 2, hoch = breit + (digital === "ja" ? 28 : 0), faktor = g / 100;
    const unten = digital === "ja" ? anzeige(breit + 2 - rand) : "";
    el.innerHTML = svg(breit, hoch, `<g transform="translate(${rand} ${rand})">${s}${ring}${unten}</g>`, [breit * faktor, hoch * faktor]);
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
    const loes = liste(el, "loesung").map(Number), zeige = loes.length > 0 && loesungSichtbar(el);
    if (loes.length && loes.length !== 4) abbruch("Die Lösung hat vier Zahlen: Tausender, Hunderter, Zehner, Einer.");
    const t = zeige ? loes[0] : num(el, "t", 0), h = zeige ? loes[1] : num(el, "h", 0);
    const z = zeige ? loes[2] : num(el, "z", 0), e = zeige ? loes[3] : num(el, "e", 0), u = num(el, "groesse", 8);
    const tiefe = t ? r1(u * 3.5) : 0;
    let s = "", x = 0;
    for (let i = 0; i < t; i++, x += u * 10 + tiefe + u * 1.6) {
      const k = u * 10;
      let g = `<rect class="tausender" x="${x}" y="${tiefe}" width="${k}" height="${k}" stroke-width="1.4"/>`;
      g += `<path d="M${x} ${tiefe}L${x + tiefe} 0H${x + k + tiefe}L${x + k} ${tiefe}M${x + k + tiefe} 0V${k}L${x + k} ${k + tiefe}" stroke-width="1.4"/>`;
      for (let m = 1; m < 10; m++) {
        g += `<line x1="${x + m * u}" y1="${tiefe}" x2="${x + m * u}" y2="${tiefe + k}" stroke-width=".5"/><line x1="${x}" y1="${tiefe + m * u}" x2="${x + k}" y2="${tiefe + m * u}" stroke-width=".5"/>`;
      }
      s += g;
    }
    for (let i = 0; i < h; i++, x += u * 10 + u * 1.6) {
      s += `<rect class="hunderter" x="${x}" y="${tiefe}" width="${u * 10}" height="${u * 10}" stroke-width="1.4"/>`;
      for (let m = 1; m < 10; m++) {
        s += `<line x1="${x + m * u}" y1="${tiefe}" x2="${x + m * u}" y2="${tiefe + u * 10}" stroke-width=".5"/><line x1="${x}" y1="${tiefe + m * u}" x2="${x + u * 10}" y2="${tiefe + m * u}" stroke-width=".5"/>`;
      }
    }
    for (let i = 0; i < z; i++, x += u + u * 0.8) {
      s += `<rect class="zehner" x="${x}" y="${tiefe}" width="${u}" height="${u * 10}" stroke-width="1.4"/>`;
      for (let k = 1; k < 10; k++) s += `<line x1="${x}" y1="${tiefe + k * u}" x2="${x + u}" y2="${tiefe + k * u}" stroke-width=".7"/>`;
    }
    if (z && e) x += u * 0.8;
    for (let i = 0; i < e; i++) {
      const c = Math.floor(i / 5), r = i % 5;
      s += `<rect class="einer" x="${x + c * (u * 1.6)}" y="${tiefe + u * 10 - (r + 1) * u * 1.6 + u * 0.6}" width="${u}" height="${u}" stroke-width="1.4"/>`;
    }
    const w = x + Math.ceil(e / 5) * u * 1.6;
    if (w > SATZSPIEGEL) abbruch("So viele Blöcke passen nicht in eine Zeile. Nimm eine kleinere Größe.");
    el.setAttribute("data-wert", t * 1000 + h * 100 + z * 10 + e);
    el.innerHTML = svg(r1(Math.max(w, u)), u * 10 + tiefe, s);
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

  /** `data-stellenfarben="E:blau Z:rot H:gruen"` am body, nur im Farbprofil; s/w bleibt bei den Buchstaben. */
  const stellenfarben = () => {
    const roh = document.body?.getAttribute("data-stellenfarben");
    if (!roh || istSw()) return {};
    return Object.fromEntries(roh.trim().split(/\s+/).map((t) => t.split(":")).filter(([, f]) => FARBWERTE[f]).map(([s, f]) => [s, FARBWERTE[f]]));
  };

  function stellentafel(el) {
    const stellen = (el.getAttribute("stellen") || "Z E").split(/\s+/);
    const werte = (el.getAttribute("werte") || "").split(/\s+/);
    const loes = (el.getAttribute("loesung") || "").split(/\s+/);
    const zeilen = num(el, "zeilen", 1);
    if (stellen.length > 7) abbruch("Die Stellentafel hat höchstens 7 Stellen.");
    const farben = stellenfarben();
    const kopf = (s) => (farben[s] ? `<th style="border-top:6px solid ${farben[s]}">${s}</th>` : `<th>${s}</th>`);
    let t = '<table class="stellentafel"><tr>' + stellen.map(kopf).join("") + "</tr>";
    if (attr(el, "art", "ziffern") === "plaettchen") {
      const gegeben = liste(el, "plaettchen").map(Number), loesung = loes.filter(Boolean).map(Number);
      const anzahl = loesung.length && loesungSichtbar(el) ? loesung : gegeben;
      for (const a of [...gegeben, ...loesung]) if (!Number.isInteger(a) || a < 0 || a > 15) abbruch("In einer Stelle liegen 0 bis 15 Plättchen.");
      if (gegeben.length > stellen.length || loesung.length > stellen.length) abbruch("Es sind mehr Plättchen-Zahlen als Stellen.");
      t += "<tr>" + stellen.map((st, i) => {
        let s = "";
        for (let k = 0; k < (anzahl[i] ?? 0); k++) {
          s += `<circle class="plaettchen" cx="${7 + Math.floor(k / 5) * 13}" cy="${7 + (k % 5) * 13}" r="5" stroke="none" fill="${farben[st] ?? "currentColor"}"/>`;
        }
        return `<td class="plaettchen-zelle" data-stelle="${st}" data-anzahl="${anzahl[i] ?? 0}">${svg(40, 66, s)}</td>`;
      }).join("") + "</tr>";
      el.innerHTML = t + "</table>";
      return;
    }
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
    const art = attr(el, "art", "zwanziger"), felder = { fuenfer: 5, zehner: 10, zwanziger: 20 }[art];
    if (!felder) abbruch(`Das Feld „${art}“ gibt es nicht.`);
    const loes = liste(el, "loesung").map(Number), zeige = loes.length > 0 && loesungSichtbar(el);
    const n = zeige ? loes[0] : num(el, "n", 0), n2 = zeige ? (loes[1] ?? 0) : num(el, "n2", 0), d = num(el, "groesse", 22);
    if ((felder < 20 || n2 > 0) && n + n2 > felder) abbruch(`${n + n2} Plättchen passen nicht in ${felder} Felder.`);
    let s = "";
    for (let i = 0; i < felder; i++) {
      const c = i % 10, r = Math.floor(i / 10), x = c * d + (c >= 5 ? d * 0.3 : 0), y = r * d;
      s += `<rect x="${r1(x)}" y="${y}" width="${d}" height="${d}" stroke-width="1.5"/>`;
      if (i < n) s += `<circle cx="${r1(x + d / 2)}" cy="${y + d / 2}" r="${d * 0.36}" fill="currentColor" stroke="none"/>`;
      else if (i < n + n2) s += plaettchenKreis(x + d / 2, y + d / 2, d * 0.36, true);
    }
    el.innerHTML = svg(r1(felder === 5 ? 5 * d : 10 * d + d * 0.3), felder === 20 ? 2 * d : d, s);
  }

  function zahlenstrahl(el) {
    const von = num(el, "von", 0), bis = num(el, "bis", 20), schritt = num(el, "schritt", 1);
    const breite = num(el, "breite", 560), fs = num(el, "schrift", 16), mittel = num(el, "marken", 5);
    if (!(mittel >= 1)) abbruch("Die mittleren Striche brauchen einen Abstand ab 1.");
    if (!(von < bis)) abbruch("„Bis“ muss größer sein als „Von“.");
    if (!(schritt > 0) || (bis - von) / schritt > 1000) abbruch("Der Abstand der Striche passt nicht.");
    const zahlen = (el.getAttribute("zahlen") || `${von} ${bis}`).split(/\s+/).map(Number);
    const pfeile = (el.getAttribute("pfeile") || "").split(/\s+/).filter(Boolean).map(Number);
    const x = (v) => r1(10 + ((v - von) / (bis - von)) * (breite - 20));
    const top = pfeile.length ? 26 : 4;
    let s = `<line x1="0" y1="${top + 12}" x2="${breite}" y2="${top + 12}" stroke-width="2"/>`;
    for (let v = von; v <= bis + 1e-9; v += schritt) {
      const lang = Math.abs(v % (schritt * mittel * 2)) < 1e-9 ? 12 : Math.abs(v % (schritt * mittel)) < 1e-9 ? 9 : 6;
      s += `<line x1="${x(v)}" y1="${top + 12 - lang}" x2="${x(v)}" y2="${top + 12 + lang}" stroke-width="1.5"/>`;
    }
    zahlen.forEach((v) => {
      s += `<text x="${x(v)}" y="${top + 26 + fs * 0.8}" font-family="Andika,sans-serif" font-size="${fs}" fill="currentColor" stroke="none" text-anchor="middle">${zahl(v)}</text>`;
    });
    pfeile.forEach((v) => {
      s += `<path d="M${x(v)} ${top - 2} L${x(v)} ${top + 6} M${x(v) - 4} ${top + 2} L${x(v)} ${top + 6} L${x(v) + 4} ${top + 2}" stroke-width="1.5"/>`;
      const halb = String(v).length <= 3 ? 15 : r1(textBreite(zahl(v), fs) / 2 + 5);
      s += `<rect x="${r1(x(v) - halb)}" y="${top - 26}" width="${r1(2 * halb)}" height="22" rx="3" stroke-width="1.5"/>`;
      if (loesungSichtbar(el)) s += `<text x="${x(v)}" y="${top - 9}" font-family="Andika,sans-serif" font-size="${fs}" font-weight="700" fill="currentColor" stroke="none" text-anchor="middle">${zahl(v)}</text>`;
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
    if (zahlen.some((v) => !Number.isFinite(v))) abbruch("Die Werte müssen Zahlen sein.");
    if (art !== "linie" && zahlen.some((v) => v < 0)) abbruch("Die Werte müssen Zahlen ab 0 sein.");
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

    if (art === "linie") {
      const von = attr(el, "von", null) === null ? null : Number(attr(el, "von", null));
      const leer = (i) => werte[i].wert === "" || istOffen(i), belegt = zahlen.filter((_, i) => werte[i].wert !== "");
      const { schritt } = skalaVon(belegt.map(Math.abs), schrittRoh === null ? null : Number(schrittRoh), null);
      const ende = bisRoh === null ? Math.max(schritt, Math.ceil(Math.max(0, ...belegt) / schritt) * schritt) : Number(bisRoh);
      const start = von ?? Math.min(0, Math.floor(Math.min(0, ...belegt) / schritt) * schritt);
      if (!(start < ende)) abbruch("„Von“ muss kleiner als „Bis“ sein.");
      if (belegt.some((v) => v > ende || v < start)) abbruch(`Ein Wert liegt nicht zwischen ${zahl(start)} und ${zahl(ende)}.`);
      if ((ende - start) / schritt > 12) abbruch("Das wären mehr als 12 Linien. Nimm einen größeren Skalenschritt.");
      const schrift = 14, linien = [];
      for (let v = start; v <= ende + 1e-9; v += schritt) linien.push(r1(v));
      const links = Math.max(...linien.map((v) => textBreite(zahl(v), schrift))) + 12, oben = einheit ? 26 : 10;
      const spalte = Math.max(48, ...werte.map((t) => textBreite(t.name, schrift) + 10)), unten = oben + groesse, breite = links + spalte * werte.length + 10;
      const y = (v) => unten - ((v - start) / (ende - start)) * groesse, x = (i) => links + (i + 0.5) * spalte;
      let s = einheit ? text(4, 8, einheit, { groesse: schrift, anker: "start" }) : "";
      for (const v of linien) s += `<line class="${v === 0 && start < 0 ? "nulllinie" : "gitter"}" data-v="${v}" x1="${r1(links)}" y1="${r1(y(v))}" x2="${r1(breite - 4)}" y2="${r1(y(v))}" stroke="${v === 0 && start < 0 ? SCHWARZ : GRAU}" stroke-width="${v === 0 && start < 0 ? 3 : 1}"/>` + text(links - 7, y(v), zahl(v), { groesse: schrift, anker: "end", fett: v === 0 && start < 0 });
      let strecke = [];
      const zieheLinie = () => {
        if (strecke.length > 1) s += `<polyline class="verlauf" points="${strecke.join(" ")}" fill="none" stroke="${SCHWARZ}" stroke-width="2.4"/>`;
        strecke = [];
      };
      werte.forEach((t, i) => {
        if (leer(i)) zieheLinie();
        else strecke.push(`${r1(x(i))},${r1(y(zahlen[i]))}`);
      });
      zieheLinie();
      werte.forEach((t, i) => {
        if (!leer(i)) s += `<circle class="wert" data-wert="${zahlen[i]}" cx="${r1(x(i))}" cy="${r1(y(zahlen[i]))}" r="5" fill="${SCHWARZ}" stroke="#fff" stroke-width="1.5"/>`;
        s += text(x(i), unten + 14, t.name, { groesse: schrift });
      });
      s += `<line x1="${r1(links)}" y1="${r1(oben - 6)}" x2="${r1(links)}" y2="${r1(unten)}" stroke-width="2"/><line x1="${r1(links)}" y1="${r1(unten)}" x2="${r1(breite - 2)}" y2="${r1(unten)}" stroke-width="2"/>`;
      el.setAttribute("data-skala", String(schritt));
      el.innerHTML = svg(r1(breite), r1(unten + 28), s);
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

  /* == Räumliche Geometrie == */
  const SEITENHOEHE = 900; // nutzbare Höhe einer A4-Hochkantseite in px
  const TIEFE = Math.SQRT1_2 / 2;
  const PROJEKTION = {
    schraeg: (x, y, z) => [x + y * TIEFE, -z - y * TIEFE],
    iso: (x, y, z) => [(x + y) * 0.866, (x - y) * 0.5 - z],
  };
  const imVieleck = (x, y, p) => {
    let drin = false;
    p.forEach(([a, b], i) => {
      const [c, d] = p[(i + 1) % p.length];
      if ((b > y) !== (d > y) && x < a + ((y - b) * (c - a)) / (d - b)) drin = !drin;
    });
    return drin;
  };

  const ansichtenVon = (plan) => {
    const hoechster = (zeile) => Math.max(...zeile);
    return {
      vorne: plan[0].map((_, s) => hoechster(plan.map((z) => z[s]))),
      rechts: [...plan].reverse().map(hoechster),
      links: plan.map(hoechster),
      oben: plan.map((z) => z.map((h) => (h > 0 ? 1 : 0))),
    };
  };
  /** Von hinten nach vorn und von unten nach oben: So verdecken spätere Würfel die früheren. */
  const wuerfelVon = (plan) => {
    const alle = [];
    plan.forEach((zeile, r) => zeile.forEach((hoehe, x) => {
      for (let z = 0; z < hoehe; z++) alle.push({ x, y: plan.length - 1 - r, z });
    }));
    return alle.sort((a, b) => b.y - a.y || a.x - b.x || a.z - b.z);
  };
  const wuerfelSeiten = ({ x, y, z }) => ({
    oben: [[x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]],
    vorne: [[x, y, z], [x + 1, y, z], [x + 1, y, z + 1], [x, y, z + 1]],
    seite: [[x + 1, y, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x + 1, y, z + 1]],
  });
  const verdeckteWuerfel = (plan, art = "schraeg") => {
    const zeige = PROJEKTION[art];
    const alle = wuerfelVon(plan);
    const seitenAuf = alle.map((w) => Object.values(wuerfelSeiten(w)).map((s) => s.map((p) => zeige(...p))));
    const stellen = [0.1, 0.3, 0.5, 0.7, 0.9];
    return alle.filter((_, i) => seitenAuf[i].every(([a, b, , d]) => stellen.every((s) => stellen.every((t) => {
      const px = a[0] + (b[0] - a[0]) * s + (d[0] - a[0]) * t, py = a[1] + (b[1] - a[1]) * s + (d[1] - a[1]) * t;
      return seitenAuf.slice(i + 1).some((spaeter) => spaeter.some((p) => imVieleck(px, py, p)));
    }))));
  };
  const TOENE = {
    sw: { oben: "#ffffff", vorne: "#d9d9d9", seite: "#a6a6a6" },
    farbe: {
      oben: "color-mix(in srgb,var(--haupt) 20%,#fff)", vorne: "color-mix(in srgb,var(--haupt) 50%,#fff)", seite: "color-mix(in srgb,var(--haupt) 85%,#fff)",
    },
  };
  const ANSICHT_NAMEN = { vorne: "von vorne", rechts: "von rechts", links: "von links", oben: "von oben" };
  /** Bausteine nebeneinander, bei zu wenig Breite in die nächste Reihe. */
  const reihen = (bausteine, abstand = 22) => {
    let x = 0, y = 0, zeilenhoehe = 0, breite = 0, s = "";
    for (const b of bausteine) {
      if (x > 0 && x + b.b > SATZSPIEGEL) {
        x = 0;
        y += zeilenhoehe + abstand;
        zeilenhoehe = 0;
      }
      s += `<g transform="translate(${r1(x)} ${r1(y)})">${b.s}</g>`;
      breite = Math.max(breite, x + b.b);
      zeilenhoehe = Math.max(zeilenhoehe, b.h);
      x += b.b + abstand;
    }
    return { b: breite, h: y + zeilenhoehe, s };
  };

  function wuerfelbau(el) {
    const zeilen = raster(el, "bauplan");
    if (zeilen.length === 0) abbruch("Der Bauplan fehlt, zum Beispiel 2 1 / 1 0.");
    if (zeilen.some((z) => z.length !== zeilen[0].length)) abbruch("Alle Zeilen des Bauplans müssen gleich lang sein.");
    if (zeilen.length > 4 || zeilen[0].length > 4) abbruch("Der Bauplan darf höchstens 4 × 4 groß sein.");
    const plan = zeilen.map((z) => z.map(Number));
    if (plan.flat().some((h) => !Number.isInteger(h) || h < 0 || h > 5)) abbruch("Die Türme dürfen 0 bis 5 Würfel hoch sein.");
    const anzahl = plan.flat().reduce((a, h) => a + h, 0);
    if (anzahl === 0) abbruch("Der Bau braucht mindestens einen Würfel.");
    const zeige = liste(el, "zeige"), fragen = liste(el, "fragen");
    const gezeigt = zeige.length ? zeige : ["schraegbild"];
    const beides = fragen.find((f) => gezeigt.includes(f));
    if (beides) abbruch(`„${beides}“ steht als Vorgabe und als Frage da. Die Frage verrät dann ihre Antwort.`);
    if (fragen.length && !gezeigt.includes("schraegbild") && !gezeigt.includes("bauplan")) abbruch("Zu den Fragen braucht es ein Schrägbild oder einen Bauplan als Vorgabe.");
    const art = attr(el, "projektion", "schraeg");
    if (!PROJEKTION[art]) abbruch(`Die Projektion „${art}“ gibt es nicht.`);
    const verdeckt = verdeckteWuerfel(plan, art);
    if (gezeigt.includes("schraegbild") && !gezeigt.includes("bauplan") && verdeckt.length && fragen.some((f) => f === "bauplan" || f === "anzahl")) {
      abbruch("Ein Würfel ist von hier nicht zu sehen; die Aufgabe ist nicht eindeutig.");
    }
    const e = num(el, "einheit", 26), zelle = 22;
    const toene = istSw() ? TOENE.sw : TOENE.farbe;
    const ansichten = ansichtenVon(plan);
    const beschrifte = (b, wort) => {
      const breite = Math.max(b.b, textBreite(wort, 13));
      return { b: breite, h: b.h + 20, s: `<g transform="translate(${r1((breite - b.b) / 2)} 0)">${b.s}</g>${text(breite / 2, b.h + 11, wort, { groesse: 13 })}` };
    };

    const schraegbild = () => {
      const zeigeAuf = PROJEKTION[art], alle = wuerfelVon(plan);
      const punkte = alle.flatMap((w) => Object.values(wuerfelSeiten(w)).flat().map((p) => zeigeAuf(...p)));
      const x0 = Math.min(...punkte.map((p) => p[0])), y0 = Math.min(...punkte.map((p) => p[1]));
      const pfad = (seite) => seite.map((p) => {
        const [x, y] = zeigeAuf(...p);
        return `${r1((x - x0) * e + 1)},${r1((y - y0) * e + 1)}`;
      }).join(" ");
      let s = alle.map((w) => `<g class="baustein" data-w="${w.x},${w.y},${w.z}">${Object.entries(wuerfelSeiten(w)).map(([n, seite]) =>
        `<polygon class="seite-${n}" points="${pfad(seite)}" style="fill:${toene[n]}" stroke-width="1.4" stroke-linejoin="round"/>`).join("")}</g>`).join("");
      if (attr(el, "verdeckt", "nicht") === "zeigen") {
        s += verdeckt.map((w) => Object.values(wuerfelSeiten(w)).map((seite) =>
          `<polygon class="verdeckt" points="${pfad(seite)}" stroke-width="1" stroke-dasharray="4 3"/>`).join("")).join("");
      }
      return {
        b: r1((Math.max(...punkte.map((p) => p[0])) - x0) * e + 2),
        h: r1((Math.max(...punkte.map((p) => p[1])) - y0) * e + 2),
        s: `<g class="schraegbild">${s}</g>`,
      };
    };
    const bauplanBlatt = (leer) => {
      const breite = plan[0].length * zelle, hoehe = plan.length * zelle;
      let s = "";
      plan.forEach((z, r) => z.forEach((h, c) => {
        const zeigen = !leer || loesungSichtbar(el);
        s += `<rect class="plan-zelle" data-hoehe="${h}" x="${c * zelle + 1}" y="${r * zelle + 1}" width="${zelle}" height="${zelle}" stroke-width="1.2"/>`;
        if (zeigen && h > 0) s += text(c * zelle + zelle / 2 + 1, r * zelle + zelle / 2 + 1, zahl(h), { groesse: 14, fett: true });
      }));
      s += `<line x1="1" y1="${hoehe + 1}" x2="${breite + 1}" y2="${hoehe + 1}" stroke-width="3"/>`;
      return beschrifte({ b: breite + 2, h: hoehe + 2, s: `<g class="bauplan">${s}</g>` }, "Bauplan, unten vorne");
    };
    const ansichtBlatt = (welche, leer) => {
      const oben = welche === "oben", werte = ansichten[welche];
      const spalten = oben ? plan[0].length : werte.length;
      const hoehe = oben ? plan.length : Math.max(3, Math.max(...plan.flat()) + (leer ? 1 : 0));
      const voll = (c, r) => (oben ? werte[r][c] === 1 : hoehe - r <= werte[c]);
      let s = "";
      for (let r = 0; r < hoehe; r++) {
        for (let c = 0; c < spalten; c++) {
          const gefuellt = voll(c, r) && (!leer || loesungSichtbar(el));
          if (gefuellt) s += `<rect class="ansicht-voll" data-x="${c}" data-y="${r}" x="${c * zelle + 1}" y="${r * zelle + 1}" width="${zelle}" height="${zelle}" style="fill:${toene.vorne}" stroke-width="1.4"/>`;
          else if (leer) s += `<rect x="${c * zelle + 1}" y="${r * zelle + 1}" width="${zelle}" height="${zelle}" stroke-width=".7"/>`;
        }
      }
      const wert = oben ? werte.map((z) => z.join(" ")).join(" / ") : werte.join(" ");
      return beschrifte({
        b: spalten * zelle + 2, h: hoehe * zelle + 2,
        s: `<g class="ansicht" data-ansicht="${welche}" data-hoehen="${wert}">${s}${oben || leer ? "" : `<line x1="1" y1="${hoehe * zelle + 1}" x2="${spalten * zelle + 1}" y2="${hoehe * zelle + 1}" stroke-width="2"/>`}</g>`,
      }, ANSICHT_NAMEN[welche]);
    };
    const bausteine = [];
    for (const was of gezeigt) {
      if (was === "schraegbild") bausteine.push(schraegbild());
      else if (was === "bauplan") bausteine.push(bauplanBlatt(false));
      else if (ansichten[was]) bausteine.push(ansichtBlatt(was, false));
      else abbruch(`„${was}“ lässt sich nicht zeigen.`);
    }
    for (const was of fragen) {
      if (was === "bauplan") bausteine.push(bauplanBlatt(true));
      else if (ansichten[was]) bausteine.push(ansichtBlatt(was, true));
      else if (was !== "anzahl") abbruch(`„${was}“ lässt sich nicht fragen.`);
    }
    const r = reihen(bausteine);
    let s = r.s, h = r.h;
    if (fragen.includes("anzahl")) {
      const w = textBreite("Das sind", 15) + 8;
      s += text(0, h + 26, "Das sind", { groesse: 15, anker: "start" }) + antwortfeld(el, w, h + 10, 44, 32, zahl(anzahl), { groesse: 15 }) +
        text(w + 50, h + 26, "Würfel.", { groesse: 15, anker: "start" });
      h += 44;
    }
    el.setAttribute("data-anzahl", anzahl);
    el.setAttribute("data-verdeckt", verdeckt.length);
    el.innerHTML = svg(r1(Math.max(r.b, 230)), r1(h + 2), s);
  }

  const WUERFELNETZE = {
    1: "1000/1111/1000", 2: "1000/1111/0100", 3: "1000/1111/0010", 4: "1000/1111/0001", 5: "0100/1111/0100", 6: "0100/1111/0010",
    7: "1100/0111/0100", 8: "1100/0111/0010", 9: "1100/0111/0001", 10: "1100/0110/0011", 11: "11100/00111",
  };
  const NICHT_NETZE = {
    n1: "111111", n2: "111/111", n3: "1111/1100", n4: "1111/1001", n5: "11111/10000", n6: "01000/11111", n7: "00100/11111", n8: "1110/0011/0001",
  };
  const netzZellen = (code) => {
    const zeilen = (WUERFELNETZE[code] ?? NICHT_NETZE[code]).split("/"), zellen = [];
    zeilen.forEach((z, r) => [...z].forEach((v, c) => {
      if (v === "1") zellen.push({ nr: zellen.length + 1, c, r });
    }));
    return zellen;
  };
  const gegen = (v) => v.map((a) => -a);
  const NACHBARN = [
    { dc: 1, dr: 0, name: "rechts", rahmen: ({ n, r, u }) => ({ n: r, r: gegen(n), u }) },
    { dc: -1, dr: 0, name: "links", rahmen: ({ n, r, u }) => ({ n: gegen(r), r: n, u }) },
    { dc: 0, dr: -1, name: "oben", rahmen: ({ n, r, u }) => ({ n: u, r, u: gegen(n) }) },
    { dc: 0, dr: 1, name: "unten", rahmen: ({ n, r, u }) => ({ n: gegen(u), r, u: n }) },
  ];
  /** Rollt das Papier um seine Kanten: `n` zeigt nach außen, `r` und `u` sind im Netz rechts und oben. */
  const falteNetz = (zellen) => {
    const stelle = new Map(zellen.map((z) => [`${z.c},${z.r}`, z]));
    const fertig = [{ ...zellen[0], rahmen: { n: [0, 0, 1], r: [1, 0, 0], u: [0, 1, 0] } }];
    const gesehen = new Set([zellen[0].nr]);
    for (let i = 0; i < fertig.length; i++) {
      const z = fertig[i];
      for (const d of NACHBARN) {
        const q = stelle.get(`${z.c + d.dc},${z.r + d.dr}`);
        if (q && !gesehen.has(q.nr)) {
          gesehen.add(q.nr);
          fertig.push({ ...q, rahmen: d.rahmen(z.rahmen), von: z.nr, weg: d.name });
        }
      }
    }
    return fertig;
  };
  const istWuerfelnetz = (zellen) => new Set(falteNetz(zellen).map((z) => z.rahmen.n.join())).size === 6;
  /** An jeder Klebekante genau eine Lasche, möglichst dort, wo sie das Netz nicht breiter macht. */
  const netzLaschen = (zellen) => {
    const faltung = falteNetz(zellen), belegt = new Set(zellen.map((z) => `${z.c},${z.r}`));
    const cs = zellen.map((z) => z.c), rs = zellen.map((z) => z.r);
    const innen = (c, r) => c >= Math.min(...cs) && c <= Math.max(...cs) && r >= Math.min(...rs) && r <= Math.max(...rs);
    const paare = new Map();
    for (const z of faltung) {
      for (const d of NACHBARN) {
        if (belegt.has(`${z.c + d.dc},${z.r + d.dr}`)) continue;
        const { n, r, u } = z.rahmen;
        const richtung = { rechts: r, links: gegen(r), oben: u, unten: gegen(u) }[d.name];
        const ort = n.map((a, i) => a + richtung[i]).join();
        paare.set(ort, [...(paare.get(ort) ?? []), { nr: z.nr, c: z.c, r: z.r, seite: d.name, innen: innen(z.c + d.dc, z.r + d.dr) }]);
      }
    }
    return [...paare.values()].map((p) => p.find((k) => k.innen) ?? p[0]);
  };
  const AUGEN_DER_SEITE = { "0,0,1": 1, "0,0,-1": 6, "1,0,0": 2, "-1,0,0": 5, "0,1,0": 3, "0,-1,0": 4 };
  /** Wie weit das Augenbild im Netz gedreht ist, damit es gefaltet wie auf einem echten Würfel liegt. */
  const augenDrehung = ({ n, r, u }) => {
    const hoch = n[2] !== 0 ? [0, 1, 0] : [0, 0, 1];
    const gleich = (a, b) => a.join() === b.join();
    if (gleich(hoch, u)) return 0;
    if (gleich(hoch, r)) return 90;
    return gleich(hoch, gegen(u)) ? 180 : 270;
  };
  const ACHSE = (v) => v.findIndex((a) => a !== 0);
  /** Rechtecke im Netz: Jedes Feld liegt an seinem Vorgänger, die Breite kommt aus der Richtung im Körper. */
  const netzLage = (faltung, masse) => {
    const lage = new Map();
    for (const z of faltung) {
      const b = masse[ACHSE(z.rahmen.r)], h = masse[ACHSE(z.rahmen.u)];
      const v = lage.get(z.von);
      let x = 0, y = 0;
      if (v) {
        x = z.weg === "rechts" ? v.x + v.b : z.weg === "links" ? v.x - b : v.x;
        y = z.weg === "unten" ? v.y + v.h : z.weg === "oben" ? v.y - h : v.y;
      }
      lage.set(z.nr, { x, y, b, h });
    }
    return lage;
  };
  const drehZellen = (zellen, grad) => {
    let z = zellen;
    for (let i = 0; i < ((grad % 360) + 360) % 360; i += 90) z = z.map((q) => ({ ...q, c: -q.r, r: q.c }));
    return z;
  };
  const flaecheVonNetz = (x, y, b, h, wert, a, f, drehung) => {
    const mx = x + b / 2, my = y + h / 2;
    if (wert === "" || wert === "0") return "";
    if (/^[1-6]$/.test(wert)) {
      return `<g class="augen" transform="translate(${r1(mx - a / 2)} ${r1(my - a / 2)}) rotate(${drehung} ${r1(a / 2)} ${r1(a / 2)})">${augenBild(Number(wert), a)}</g>`;
    }
    if (FARBNAMEN.includes(wert)) return `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(b)}" height="${r1(h)}" fill="${f.von(wert)}" stroke="none"/>`;
    const wort = wert.replace(/^#/, "");
    return text(mx, my, wort, { groesse: Math.min(a * 0.5, ((a * 0.86) / Math.max(1, wort.length)) / SCHRIFT_BREITE), fett: true });
  };

  function wuerfelnetz(el) {
    const code = attr(el, "netz", "1");
    if (!WUERFELNETZE[code] && !NICHT_NETZE[code]) abbruch(`Das Netz „${code}“ gibt es nicht. Es gibt 1 bis 11 und n1 bis n8.`);
    const istQuader = attr(el, "art", "wuerfel") === "quader";
    const bastel = attr(el, "bastel", "nein") === "ja";
    const aufgabe = attr(el, "aufgabe", "keine");
    const echt = Boolean(WUERFELNETZE[code]);
    const laschen = attr(el, "laschen", bastel ? "ja" : "nein") === "ja";
    if (!echt && (laschen || bastel || aufgabe === "gegenueber" || aufgabe === "augen-ergaenzen")) abbruch(`Aus Netz ${code} lässt sich kein Würfel falten. Hier passt nur die Aufgabe „Netz oder nicht“.`);
    if (istQuader && !["1", "2", "3", "4", "5", "6"].includes(code)) abbruch("Für Quader gibt es die Netze 1 bis 6.");
    const kante = num(el, "kante", 4), angegeben = liste(el, "masse").map(Number);
    if (istQuader && (angegeben.length !== 3 || angegeben.some((m) => !(m > 0)))) abbruch("Der Quader braucht drei Maße, zum Beispiel 4 2 1.");
    const masse = istQuader ? angegeben : (bastel ? [kante, kante, kante] : [1, 1, 1]);
    const px = bastel ? cm(1) : num(el, "groesse", 30);
    const standard = attr(el, "augen", "nein") === "ja" || aufgabe === "augen-ergaenzen";
    const flaechen = liste(el, "flaechen");
    if (standard && flaechen.length) abbruch("Beim Standardwürfel stehen die Augen schon fest. Dann bleiben die Flächen leer.");
    if (flaechen.length && flaechen.length !== 6) abbruch(`Ein Würfel hat 6 Flächen, hier stehen ${flaechen.length}.`);
    for (const inhaltFlaeche of flaechen) if (/^\d+$/.test(inhaltFlaeche) && Number(inhaltFlaeche) > 6) abbruch(`„${inhaltFlaeche}“ hat zu viele Augen. Zahlen schreibst du mit #, zum Beispiel #${inhaltFlaeche}.`);

    const lasche = bastel ? 0.6 : 0.25;
    const entwurf = (grad) => {
      const zellen = drehZellen(netzZellen(code), grad);
      const faltung = echt ? falteNetz(zellen) : zellen.map((z) => ({ ...z, rahmen: { n: [0, 0, 1], r: [1, 0, 0], u: [0, 1, 0] } }));
      const lage = echt ? netzLage(faltung, masse) : new Map(zellen.map((z) => [z.nr, { x: z.c, y: z.r, b: 1, h: 1 }]));
      const klappen = echt && laschen ? netzLaschen(zellen).map((k) => {
        const l = lage.get(k.nr), t = Math.min(lasche, Math.min(l.b, l.h) * 0.25);
        const ecken = {
          oben: [[l.x, l.y], [l.x + t, l.y - t], [l.x + l.b - t, l.y - t], [l.x + l.b, l.y]],
          unten: [[l.x, l.y + l.h], [l.x + t, l.y + l.h + t], [l.x + l.b - t, l.y + l.h + t], [l.x + l.b, l.y + l.h]],
          links: [[l.x, l.y], [l.x - t, l.y + t], [l.x - t, l.y + l.h - t], [l.x, l.y + l.h]],
          rechts: [[l.x + l.b, l.y], [l.x + l.b + t, l.y + t], [l.x + l.b + t, l.y + l.h - t], [l.x + l.b, l.y + l.h]],
        }[k.seite];
        return { ...k, ecken };
      }) : [];
      const xs = [...lage.values()].flatMap((l) => [l.x, l.x + l.b]).concat(klappen.flatMap((k) => k.ecken.map((p) => p[0])));
      const ys = [...lage.values()].flatMap((l) => [l.y, l.y + l.h]).concat(klappen.flatMap((k) => k.ecken.map((p) => p[1])));
      const x0 = Math.min(...xs), y0 = Math.min(...ys);
      return { faltung, lage, klappen, x0, y0, breite: Math.max(...xs) - x0, hoehe: Math.max(...ys) - y0 };
    };
    const passt = (e, k) => e.breite * k <= SATZSPIEGEL - 4 && e.hoehe * k <= SEITENHOEHE;
    const start = num(el, "drehung", 0);
    let e = entwurf(start);
    if (!passt(e, px)) {
      const quer = entwurf(start + 90);
      if (passt(quer, px)) e = quer;
      else {
        const moeglich = Math.max(...[e, quer].map((v) => Math.min((SATZSPIEGEL - 4) / v.breite, SEITENHOEHE / v.hoehe)));
        abbruch(bastel ? `Bei ${zahl(kante)} cm Kante passt das Netz nicht aufs Blatt. Größte Kante: ${zahl(Math.floor((moeglich * masse[0]) / cm(1) * 10) / 10)} cm.` : "Das Netz passt so groß nicht aufs Blatt.");
      }
    }
    if (bastel) masstab(el);
    const f = fuellung(), musterId = `abb-lasche-${++fuellungsNr}`;
    const X = (v) => r1((v - e.x0) * px + 2), Y = (v) => r1((v - e.y0) * px + 2);
    const nachNormale = new Map(e.faltung.map((z) => [z.rahmen.n.join(), z]));
    const markiert = num(el, "markiere", 1);
    const ziel = e.faltung.find((z) => z.nr === markiert);
    if (aufgabe === "gegenueber" && !ziel) abbruch("Die markierte Fläche muss 1 bis 6 sein.");
    const gegenueber = aufgabe === "gegenueber" ? nachNormale.get(gegen(ziel.rahmen.n).join()) : null;
    const versteckt = new Set();
    if (aufgabe === "augen-ergaenzen") {
      const zz = zufall(samen(el, `${code}|${attr(el, "drehung", "0")}`));
      for (const achse of [[0, 0, 1], [1, 0, 0], [0, 1, 0]]) {
        const seite = zz() < 0.5 ? achse : gegen(achse);
        versteckt.add(nachNormale.get(seite.join()).nr);
      }
    }
    let s = `<defs><pattern id="${musterId}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="${GRAU}" stroke-width="1.2"/></pattern></defs>`;
    for (const k of e.klappen) {
      s += `<polygon class="lasche" data-feld="${k.nr}" data-seite="${k.seite}" points="${k.ecken.map(([x, y]) => `${X(x)},${Y(y)}`).join(" ")}" fill="url(#${musterId})" stroke-width="1.4"/>`;
    }
    const kanten = new Map();
    const reinKante = (a, b) => {
      const name = [a, b].map((p) => p.join()).sort().join("|");
      kanten.set(name, { a, b, zahl: (kanten.get(name)?.zahl ?? 0) + 1 });
    };
    for (const z of e.faltung) {
      const l = e.lage.get(z.nr), nv = z.rahmen.n.join();
      const lo = [X(l.x), Y(l.y)], ro = [X(l.x + l.b), Y(l.y)], lu = [X(l.x), Y(l.y + l.h)], ru = [X(l.x + l.b), Y(l.y + l.h)];
      for (const [a, b] of [[lo, ro], [ro, ru], [ru, lu], [lu, lo]]) reinKante(a, b);
      const a = Math.min(l.b, l.h) * px;
      const augen = standard ? String(AUGEN_DER_SEITE[nv]) : (flaechen[z.nr - 1] ?? "");
      const wert = versteckt.has(z.nr) && !loesungSichtbar(el) ? "" : augen;
      const istMarke = aufgabe === "gegenueber" && (z.nr === markiert || (gegenueber?.nr === z.nr && loesungSichtbar(el)));
      s += `<g class="feld" data-feld="${z.nr}" data-normale="${nv}" data-augen="${wert}">`;
      if (istMarke) s += `<rect class="marke" x="${X(l.x)}" y="${Y(l.y)}" width="${r1(l.b * px)}" height="${r1(l.h * px)}" fill="${f.von("rot")}" stroke="none"/>`;
      s += flaecheVonNetz(X(l.x), Y(l.y), r1(l.b * px), r1(l.h * px), wert, a, f, augenDrehung(z.rahmen)) + "</g>";
    }
    for (const { a, b, zahl: anzahl } of kanten.values()) {
      const falz = anzahl > 1;
      s += `<line class="${falz ? "falz" : "kontur"}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke-width="${falz ? 1 : 1.8}"${falz ? ' stroke-dasharray="5 4"' : ""}/>`;
    }
    let breite = e.breite * px + 4, hoehe = e.hoehe * px + 4;
    if (aufgabe === "netz-oder-nicht") {
      const w = textBreite("Würfelnetz?", 13) + 8, y = hoehe + 6;
      s += text(0, y + 13, "Würfelnetz?", { groesse: 13, anker: "start" }) + `<rect class="netz-frage" x="${r1(w)}" y="${r1(y)}" width="26" height="26" rx="3" stroke-width="1.6" fill="#fff"/>`;
      if (loesungSichtbar(el)) {
        s += echt ? `<path class="haken" d="M${r1(w + 6)} ${r1(y + 13)}l5 6 9-12" stroke-width="3"/>` : `<path class="kreuz" d="M${r1(w + 6)} ${r1(y + 6)}l14 14m0-14l-14 14" stroke-width="3"/>`;
      }
      el.setAttribute("data-netz", echt ? "ja" : "nein");
      breite = Math.max(breite, w + 28);
      hoehe += 36;
    }
    if (gegenueber) el.setAttribute("data-gegenueber", gegenueber.nr);
    el.setAttribute("data-laschen", e.klappen.length);
    el.innerHTML = svg(r1(breite), r1(hoehe), f.defs() + s);
  }

  const KOERPER_ZAHLEN = {
    wuerfel: { ecken: 8, kanten: 12, flaechen: 6 }, quader: { ecken: 8, kanten: 12, flaechen: 6 }, pyramide: { ecken: 5, kanten: 8, flaechen: 5 },
    prisma: { ecken: 6, kanten: 9, flaechen: 5 }, kugel: { ecken: 0, kanten: 0, flaechen: 1 }, zylinder: { ecken: 0, kanten: 2, flaechen: 3 }, kegel: { ecken: 1, kanten: 1, flaechen: 2 },
  };
  const VIELFLACHE = {
    quader: (l, b, h) => ({
      ecken: [[0, 0, 0], [l, 0, 0], [l, b, 0], [0, b, 0], [0, 0, h], [l, 0, h], [l, b, h], [0, b, h]],
      seiten: [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]],
    }),
    pyramide: (l, b, h) => ({
      ecken: [[0, 0, 0], [l, 0, 0], [l, b, 0], [0, b, 0], [l / 2, b / 2, h]],
      seiten: [[0, 1, 2, 3], [0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]],
    }),
    prisma: (l, b, h) => ({
      ecken: [[0, 0, 0], [l, 0, 0], [l / 2, 0, h], [0, b, 0], [l, b, 0], [l / 2, b, h]],
      seiten: [[0, 1, 2], [3, 4, 5], [0, 1, 4, 3], [1, 2, 5, 4], [2, 0, 3, 5]],
    }),
  };
  VIELFLACHE.wuerfel = VIELFLACHE.quader;
  /** Ecken, Kanten und Flächen; `sichtbar` nach der Blickrichtung der Kavalierperspektive. */
  const vielflach = (form, [l, b, h], drehung = 0) => {
    const { ecken, seiten } = VIELFLACHE[form](l, b, h);
    const w = (drehung * Math.PI) / 180, mx = l / 2, my = b / 2;
    const punkte = ecken.map(([x, y, z]) => [mx + (x - mx) * Math.cos(w) - (y - my) * Math.sin(w), my + (x - mx) * Math.sin(w) + (y - my) * Math.cos(w), z]);
    const mitte = [0, 1, 2].map((i) => punkte.reduce((a, p) => a + p[i], 0) / punkte.length);
    const blick = [TIEFE, -1, TIEFE];
    const flaechen = seiten.map((s) => {
      const [a, c, d] = s.map((i) => punkte[i]);
      const u = [0, 1, 2].map((i) => c[i] - a[i]), v = [0, 1, 2].map((i) => d[i] - a[i]);
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const m = [0, 1, 2].map((i) => s.reduce((sum, e) => sum + punkte[e][i], 0) / s.length);
      const aussen = n.reduce((sum, wert, i) => sum + wert * (m[i] - mitte[i]), 0) >= 0 ? 1 : -1;
      return { ecken: s, sichtbar: n.reduce((sum, wert, i) => sum + aussen * wert * blick[i], 0) > 1e-9 };
    });
    const kanten = new Map();
    for (const f of flaechen) {
      f.ecken.forEach((a, i) => {
        const c = f.ecken[(i + 1) % f.ecken.length], name = [a, c].sort((p, q) => p - q).join();
        kanten.set(name, { a, c, sichtbar: (kanten.get(name)?.sichtbar ?? false) || f.sichtbar });
      });
    }
    return { punkte, flaechen, kanten: [...kanten.values()] };
  };

  function koerper(el) {
    const form = attr(el, "form", "wuerfel");
    if (!KOERPER_ZAHLEN[form]) abbruch(`Den Körper „${form}“ gibt es nicht.`);
    const ansicht = attr(el, "ansicht", "schraegbild");
    const istVielflach = Boolean(VIELFLACHE[form]);
    if (ansicht === "kantenmodell" && !istVielflach) abbruch("Ein Kantenmodell gibt es nur für Körper mit geraden Kanten.");
    const px = num(el, "groesse", 30), gestrichelt = attr(el, "verdeckt", "gestrichelt") === "gestrichelt";
    const marken = liste(el, "markiere"), zeige = loesungSichtbar(el);
    const f = fuellung(), masse = liste(el, "masse").map(Number);
    if (masse.some((m) => !(m > 0))) abbruch("Die Maße müssen größer als 0 sein.");
    const zahlen = KOERPER_ZAHLEN[form];
    const strich = gestrichelt ? ' stroke-dasharray="5 4"' : "";
    let s = "", breite, hoehe;
    if (istVielflach) {
      const roh = { wuerfel: [3, 3, 3], quader: [4, 2, 2], pyramide: [3, 3, 3], prisma: [4, 2, 3] }[form];
      const m = form === "wuerfel" ? Array(3).fill(masse[0] ?? roh[0]) : roh.map((w, i) => masse[i] ?? w);
      const { flaechen, kanten, punkte } = vielflach(form, m, num(el, "drehung", 0));
      const auf = punkte.map((p) => PROJEKTION.schraeg(...p));
      const x0 = Math.min(...auf.map((p) => p[0])), y0 = Math.min(...auf.map((p) => p[1]));
      const P = auf.map(([x, y]) => [r1((x - x0) * px + 8), r1((y - y0) * px + 8)]);
      if (zeige && marken.includes("flaechen")) {
        for (const q of flaechen.filter((v) => v.sichtbar)) s += `<polygon class="flaeche-marke" points="${q.ecken.map((i) => P[i].join()).join(" ")}" fill="${f.von("gruen")}" stroke="none"/>`;
      }
      for (const k of kanten) {
        const dick = zeige && marken.includes("kanten") ? 3.2 : ansicht === "kantenmodell" ? 2.4 : 1.8;
        if (k.sichtbar || ansicht === "kantenmodell") s += `<line class="kante" x1="${P[k.a][0]}" y1="${P[k.a][1]}" x2="${P[k.c][0]}" y2="${P[k.c][1]}" stroke-width="${dick}"/>`;
        else if (gestrichelt) s += `<line class="kante-verdeckt" x1="${P[k.a][0]}" y1="${P[k.a][1]}" x2="${P[k.c][0]}" y2="${P[k.c][1]}" stroke-width="${dick === 1.8 ? 1.2 : dick}"${strich}/>`;
      }
      if (ansicht === "kantenmodell") for (const p of P) s += `<circle class="kugel-ecke" cx="${p[0]}" cy="${p[1]}" r="5" fill="${SCHWARZ}" stroke="none"/>`;
      else if (zeige && marken.includes("ecken")) for (const p of P) s += `<circle class="ecke" cx="${p[0]}" cy="${p[1]}" r="4.5" fill="${SCHWARZ}" stroke="none"/>`;
      breite = Math.max(...P.map((p) => p[0])) + 8;
      hoehe = Math.max(...P.map((p) => p[1])) + 8;
    } else {
      const d = (masse[0] ?? 3) * px, h = form === "kugel" ? d : (masse[1] ?? 3) * px, rx = d / 2, ry = d * 0.15;
      const bogen = (cy, vorne, extra) => `<path d="M8 ${r1(cy)}a${r1(rx)} ${r1(ry)} 0 0 ${vorne ? 0 : 1} ${r1(d)} 0" ${extra}/>`;
      const fett = zeige && marken.includes("kanten") ? 3.2 : 1.8;
      const flaecheMarke = zeige && marken.includes("flaechen") ? `fill="${f.von("gruen")}"` : "";
      if (form === "kugel") {
        const cy = 8 + rx;
        s += `<circle class="koerper-rand" cx="${r1(8 + rx)}" cy="${r1(cy)}" r="${r1(rx)}" stroke-width="1.8" ${flaecheMarke}/>`;
        s += bogen(cy, true, 'stroke-width="1.2"') + (gestrichelt ? bogen(cy, false, `stroke-width="1"${strich}`) : "");
        hoehe = d + 16;
      } else if (form === "zylinder") {
        const oben = 8 + ry, unten = oben + h;
        if (flaecheMarke) s += `<path d="M8 ${r1(oben)}V${r1(unten)}a${r1(rx)} ${r1(ry)} 0 0 0 ${r1(d)} 0V${r1(oben)}a${r1(rx)} ${r1(ry)} 0 0 0 ${r1(-d)} 0" ${flaecheMarke} stroke="none"/>`;
        s += `<ellipse class="koerper-kreis" cx="${r1(8 + rx)}" cy="${r1(oben)}" rx="${r1(rx)}" ry="${r1(ry)}" stroke-width="${fett}" ${flaecheMarke}/>`;
        s += `<line x1="8" y1="${r1(oben)}" x2="8" y2="${r1(unten)}" stroke-width="1.8"/><line x1="${r1(8 + d)}" y1="${r1(oben)}" x2="${r1(8 + d)}" y2="${r1(unten)}" stroke-width="1.8"/>`;
        s += bogen(unten, true, `class="koerper-kreis" stroke-width="${fett}"`) + (gestrichelt ? bogen(unten, false, `class="koerper-kreis" stroke-width="${fett === 1.8 ? 1.2 : fett}"${strich}`) : "");
        hoehe = unten + ry + 8;
      } else {
        const unten = 8 + h;
        if (flaecheMarke) s += `<path d="M8 ${r1(unten)}L${r1(8 + rx)} 8L${r1(8 + d)} ${r1(unten)}a${r1(rx)} ${r1(ry)} 0 0 1 ${r1(-d)} 0" ${flaecheMarke} stroke="none"/>`;
        s += `<path class="koerper-rand" d="M8 ${r1(unten)}L${r1(8 + rx)} 8L${r1(8 + d)} ${r1(unten)}" stroke-width="1.8" stroke-linejoin="round"/>`;
        s += bogen(unten, true, `class="koerper-kreis" stroke-width="${fett}"`) + (gestrichelt ? bogen(unten, false, `class="koerper-kreis" stroke-width="${fett === 1.8 ? 1.2 : fett}"${strich}`) : "");
        if (zeige && marken.includes("ecken")) s += `<circle class="ecke" cx="${r1(8 + rx)}" cy="8" r="4.5" fill="${SCHWARZ}" stroke="none"/>`;
        hoehe = unten + ry + 8;
      }
      breite = d + 16;
    }
    const worte = { ecken: form === "kegel" ? "Spitzen" : "Ecken", kanten: "Kanten", flaechen: "Flächen" };
    for (const was of marken) {
      if (zahlen[was] === undefined) abbruch(`„${was}“ lässt sich nicht markieren.`);
      el.setAttribute(`data-${was}`, zahlen[was]);
      const w = textBreite(`${worte[was]}:`, 14) + 6;
      s += text(0, hoehe + 18, `${worte[was]}:`, { groesse: 14, anker: "start" }) + antwortfeld(el, w, hoehe + 3, 40, 30, zahl(zahlen[was]), { groesse: 15 });
      breite = Math.max(breite, w + 42);
      hoehe += 34;
    }
    el.innerHTML = svg(r1(breite), r1(hoehe), f.defs() + s);
  }

  /* == Zahldarstellungen == */
  const plaettchenKreis = (cx, cy, r, ring, fuell = "currentColor") => ring
    ? `<circle class="plaettchen-ring" cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r * 0.88)}" fill="#fff" stroke-width="${r1(Math.max(2, r * 0.26))}"/>`
    : `<circle class="plaettchen-voll" cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}" stroke="none" fill="${fuell}"/>`;

  function hunderterfeld(el) {
    const zeilen = num(el, "zeilen", 10), spalten = num(el, "spalten", 10), d = num(el, "groesse", 22);
    if (zeilen < 1 || zeilen > 10 || spalten < 1 || spalten > 10) abbruch("Das Feld hat höchstens 10 Zeilen und 10 Spalten.");
    const loesung = attr(el, "loesung", null), zeige = loesung !== null && loesungSichtbar(el);
    const ausLoesung = zeige && !loesung.includes("x") ? loesung.trim().split(/\s+/).map(Number) : [];
    const n = zeige && ausLoesung.length ? ausLoesung[0] : num(el, "n", 0);
    const n2 = zeige && ausLoesung.length ? (ausLoesung[1] ?? 0) : num(el, "n2", 0);
    if (!Number.isInteger(n) || !Number.isInteger(n2) || n < 0 || n2 < 0) abbruch("Die Anzahl der Plättchen muss eine ganze Zahl sein.");
    if (n + n2 > zeilen * spalten) abbruch(`${n + n2} Plättchen passen nicht in ${zeilen * spalten} Felder.`);
    const winkelText = zeige && loesung.includes("x") ? loesung : attr(el, "malwinkel", null);
    const luecke = d * 0.3;
    const X = (c) => r1(c * d + (c >= 5 ? luecke : 0) + 2), Y = (r) => r1(r * d + (r >= 5 ? luecke : 0) + 2);
    const farbe1 = istSw() ? SCHWARZ : "var(--haupt)";
    let s = "";
    for (let i = 0; i < zeilen * spalten; i++) {
      const c = i % spalten, r = Math.floor(i / spalten);
      s += `<rect class="hunderter-feld" x="${X(c)}" y="${Y(r)}" width="${d}" height="${d}" stroke-width="1"/>`;
      if (i < n) s += plaettchenKreis(X(c) + d / 2, Y(r) + d / 2, d * 0.36, false, farbe1);
      else if (i < n + n2) s += plaettchenKreis(X(c) + d / 2, Y(r) + d / 2, d * 0.36, true);
    }
    const breite = spalten * d + (spalten > 5 ? luecke : 0), hoehe = zeilen * d + (zeilen > 5 ? luecke : 0);
    if (winkelText) {
      const t = /^(\d+)x(\d+)$/.exec(winkelText.trim());
      if (!t) abbruch("Der Malwinkel sieht so aus: 3x7 (Zeilen x Spalten).");
      const a = Number(t[1]), b = Number(t[2]);
      if (a < 1 || b < 1 || a > zeilen || b > spalten) abbruch(`Der Malwinkel ${a}x${b} passt nicht ins Feld.`);
      const x2 = Number(X(b - 1)) + d, y2 = Number(Y(a - 1)) + d;
      s += `<path class="malwinkel" data-malwinkel="${a}x${b}" d="M${r1(x2)} 0V${r1(y2)}H0" stroke-width="3.5" stroke-linejoin="round"/>`;
    }
    el.innerHTML = svg(r1(breite + 4), r1(hoehe + 4), s);
  }

  const TAFEL_AUSSCHNITTE = ["ganz", "zeile", "spalte", "kreuz", "block", "treppe"];
  const tafelOrt = (von, z) => [(z - von) % 10, Math.floor((z - von) / 10)];
  /** Die Zahlen des Ausschnitts. Ein Kreuz am Rand gäbe es auf der echten Tafel nicht und wird abgelehnt. */
  const ausschnittZahlen = (von, bis, art, mitte) => {
    const alle = Array.from({ length: bis - von + 1 }, (_, i) => von + i);
    if (art === "ganz") return alle;
    if (mitte === null || mitte === undefined || Number.isNaN(mitte)) abbruch("Für diesen Ausschnitt fehlt die Mittelzahl.");
    if (mitte < von || mitte > bis) abbruch(`${zahl(mitte)} steht nicht auf dieser Tafel (${zahl(von)} bis ${zahl(bis)}).`);
    const [spalte, zeile] = tafelOrt(von, mitte);
    if (art === "zeile") return alle.filter((z) => tafelOrt(von, z)[1] === zeile);
    if (art === "spalte") return alle.filter((z) => tafelOrt(von, z)[0] === spalte);
    const versatz = { kreuz: [-10, -1, 0, 1, 10], block: [-11, -10, -9, -1, 0, 1, 9, 10, 11], treppe: [0, 1, 11, 12, 22, 23] }[art];
    if (!versatz) abbruch(`Den Ausschnitt „${art}“ gibt es nicht.`);
    const links = art === "treppe" ? 0 : 1;
    if (spalte < links || spalte + 1 > 9) abbruch(`Um ${zahl(mitte)} passt der Ausschnitt nicht: Die Zahl steht am Rand der Tafel.`);
    const zahlen = versatz.map((v) => mitte + v);
    const draussen = zahlen.find((z) => z < von || z > bis);
    if (draussen !== undefined) abbruch(`${zahl(draussen)} steht nicht auf dieser Tafel (${zahl(von)} bis ${zahl(bis)}).`);
    return zahlen;
  };

  function hundertertafel(el) {
    const von = num(el, "von", 1), bis = num(el, "bis", von + 99), d = num(el, "groesse", 32);
    if (!(von <= bis) || bis - von >= 400) abbruch("Die Tafel geht von „Von“ bis „Bis“, höchstens 400 Zahlen.");
    const art = attr(el, "ausschnitt", "ganz");
    const roh = attr(el, "mitte", null);
    const zahlen = ausschnittZahlen(von, bis, art, roh === null ? null : Number(roh));
    const luecken = new Set(liste(el, "luecken").map(Number)), markiert = new Set(liste(el, "markiert").map(Number));
    const zufaellig = num(el, "zufall", 0);
    if (zufaellig > 0) {
      const zz = zufall(samen(el, `${von}|${bis}|${art}|${roh ?? ""}`));
      for (const z of gemischt(zahlen, zz).slice(0, zufaellig)) luecken.add(z);
    }
    for (const z of [...luecken, ...markiert]) if (!zahlen.includes(z)) abbruch(`${zahl(z)} steht nicht in diesem Ausschnitt.`);
    if (zahlen.every((z) => luecken.has(z))) abbruch("Mindestens eine Zahl muss stehen bleiben; aus ihr ergeben sich die anderen.");
    const orte = zahlen.map((z) => tafelOrt(von, z));
    const c0 = Math.min(...orte.map((o) => o[0])), r0 = Math.min(...orte.map((o) => o[1]));
    const zellen = zahlen.map((z, i) => ({ id: String(z), x: orte[i][0] - c0, y: orte[i][1] - r0, text: String(z) }));
    meldeZellen(el, "luecken", zellen);
    meldeZellen(el, "markiert", zellen);
    const f = fuellung(), muster = istSw() ? f.von(2) : "color-mix(in srgb,var(--haupt) 30%,#fff)";
    const groesste = String(bis).length, schrift = Math.min(d * 0.46, (d * 0.86) / (groesste * SCHRIFT_BREITE));
    let s = "";
    for (const { id, x, y } of zellen) {
      const z = Number(id), leer = luecken.has(z), px = x * d + 1, py = y * d + 1;
      s += `<g class="tafel-zelle${leer ? " luecke" : ""}" data-zahl="${z}" data-x="${x}" data-y="${y}">`;
      s += `<rect x="${px}" y="${py}" width="${d}" height="${d}" stroke-width="1.2" fill="${markiert.has(z) ? muster : "#fff"}"${markiert.has(z) ? ' class="markiert"' : ""}/>`;
      if (markiert.has(z) && istSw() && (!leer || loesungSichtbar(el))) s += `<rect x="${r1(px + d * 0.12)}" y="${r1(py + d * 0.22)}" width="${r1(d * 0.76)}" height="${r1(d * 0.56)}" fill="#fff" stroke="none"/>`;
      if (!leer) s += text(px + d / 2, py + d / 2, z, { groesse: schrift });
      else if (loesungSichtbar(el)) s += text(px + d / 2, py + d / 2, z, { groesse: schrift, fett: true });
      s += "</g>";
    }
    const breite = (Math.max(...zellen.map((c) => c.x)) + 1) * d, hoehe = (Math.max(...zellen.map((c) => c.y)) + 1) * d;
    if (breite > SATZSPIEGEL) abbruch("Die Tafel ist zu breit. Nimm eine kleinere Größe.");
    el.innerHTML = svg(r1(breite + 2), r1(hoehe + 2), f.defs() + s);
  }

  function rechenrahmen(el) {
    const art = attr(el, "art", "20");
    if (art !== "20" && art !== "100") abbruch("Den Rechenrahmen gibt es als 20 und als 100.");
    const reihen = art === "100" ? 10 : 2, d = num(el, "groesse", 18);
    const loesung = liste(el, "loesung").map(Number), stellung = liste(el, "stellung").map(Number);
    const werte = loesung.length && loesungSichtbar(el) ? loesung : stellung;
    for (const w of [...stellung, ...loesung]) if (!Number.isInteger(w) || w < 0 || w > 10) abbruch("In jeder Reihe sind 0 bis 10 Kugeln links.");
    if (stellung.length > reihen || loesung.length > reihen) abbruch(`Dieser Rahmen hat ${reihen} Reihen.`);
    const stange = d * 13.5, rand = 8, hell = "#fff", dunkel = istSw() ? SCHWARZ : "var(--haupt)";
    let s = `<rect x="1" y="1" width="${r1(stange + 2 * rand)}" height="${r1(reihen * (d + 3) + 2 * rand - 3)}" rx="4" stroke-width="2.4"/>`;
    for (let r = 0; r < reihen; r++) {
      const y = rand + 1 + r * (d + 3) + d / 2, links = werte[r] ?? 0;
      s += `<line x1="1" y1="${r1(y)}" x2="${r1(stange + 2 * rand + 1)}" y2="${r1(y)}" stroke-width="1.2"/>`;
      for (let i = 0; i < 10; i++) {
        const x = i < links ? rand + 1 + i * d : rand + 1 + stange - (10 - i) * d;
        s += `<circle class="kugel" data-reihe="${r}" data-nr="${i}" data-seite="${i < links ? "links" : "rechts"}" cx="${r1(x + d / 2)}" cy="${r1(y)}" r="${r1(d * 0.46)}" stroke-width="1.3" style="fill:${i < 5 ? dunkel : hell}"/>`;
      }
    }
    el.setAttribute("data-summe", werte.reduce((a, w) => a + w, 0));
    el.innerHTML = svg(r1(stange + 2 * rand + 2), r1(reihen * (d + 3) + 2 * rand - 1), s);
  }

  const leseSprung = (t) => {
    const m = /^([+\-−])\s*(\d+)$/.exec(String(t).trim());
    if (!m) abbruch(`„${t}“ ist kein Sprung. So sieht einer aus: +30 oder −4.`);
    return m[1] === "+" ? Number(m[2]) : -Number(m[2]);
  };
  const rechenstrichWerte = (start, spruenge) => spruenge.reduce((w, s) => [...w, w[w.length - 1] + s], [start]);
  const sprungText = (s) => `${s < 0 ? "−" : "+"}${zahl(Math.abs(s))}`;

  function rechenstrich(el) {
    const start = num(el, "start", 0), breite = num(el, "breite", 560);
    const spruenge = liste(el, "spruenge").map(leseSprung);
    if (spruenge.length === 0) abbruch("Der Rechenstrich braucht mindestens einen Sprung, zum Beispiel +30.");
    if (breite > SATZSPIEGEL) abbruch(`Der Rechenstrich ist breiter als die Seite (höchstens ${SATZSPIEGEL} px).`);
    const hoch = spruenge.some((s) => s > 0), runter = spruenge.some((s) => s < 0);
    if (spruenge.includes(0)) abbruch("Ein Sprung um 0 ist kein Sprung.");
    if (hoch && runter && attr(el, "gemischt", "nein") !== "ja") abbruch("Vor- und Rückwärtssprünge in einer Aufgabe: Das braucht „Gemischte Sprünge“.");
    const zeige = attr(el, "zeige", null) === null ? ["start", "spruenge"] : liste(el, "zeige");
    const werte = rechenstrichWerte(start, spruenge);
    const massstab = attr(el, "massstab", "nein") === "ja" || (hoch && runter);
    const klein = Math.min(...werte), gross = Math.max(...werte), rand = 30, innen = breite - 2 * rand;
    const xVon = (w, i) => {
      if (massstab) return rand + ((w - klein) / (gross - klein || 1)) * innen;
      const schritt = i * (innen / spruenge.length);
      return runter ? rand + innen - schritt : rand + schritt;
    };
    const orte = werte.map(xVon);
    if (massstab) {
      orte.slice(1).forEach((x, i) => {
        const b = Math.abs(x - orte[i]);
        if (b < 28) abbruch(`Der Bogen für ${sprungText(spruenge[i])} wäre nur ${Math.round(b)} px breit. Nimm den Rechenstrich breiter oder ohne Maßstab.`);
      });
    }
    const bogenHoehe = 34, oben = 30 + bogenHoehe, linie = oben + 2;
    let s = `<line x1="0" y1="${linie}" x2="${breite}" y2="${linie}" stroke-width="2"/>`;
    const feld = (x, y, wert, wort, klasse, ist) => {
      const b = Math.max(38, textBreite(wort, 15) + 12), sichtbar = zeige.includes(ist);
      return `<g class="${klasse}" data-wert="${wert}" data-sichtbar="${sichtbar ? "ja" : "nein"}">` +
        (sichtbar ? text(x, y + 13, wort, { groesse: 15, fett: true }) : antwortfeld(el, x - b / 2, y, b, 26, wort, { groesse: 15 })) + "</g>";
    };
    spruenge.forEach((sprung, i) => {
      const a = orte[i], z = orte[i + 1], mitte = (a + z) / 2, h = Math.min(bogenHoehe, Math.abs(z - a) * 0.45 + 8);
      const richtung = z > a ? -1 : 1, spitzeY = linie - 2;
      s += `<path class="bogen" d="M${r1(a)} ${spitzeY}Q${r1(mitte)} ${r1(linie - 2 * h)} ${r1(z)} ${spitzeY}" stroke-width="2"/>`;
      s += `<path d="M${r1(z + richtung * 7)} ${spitzeY - 6}L${r1(z)} ${spitzeY}L${r1(z + richtung * 1)} ${spitzeY - 9}" stroke-width="2" stroke-linejoin="round"/>`;
      s += feld(mitte, linie - h - 28, sprung, sprungText(sprung), "strich-sprung", "spruenge");
    });
    let letzte = -1, reihe = 0, gestaffelt = false;
    orte.forEach((x, i) => {
      s += `<line x1="${r1(x)}" y1="${linie - 6}" x2="${r1(x)}" y2="${linie + 6}" stroke-width="2"/>`;
      reihe = letzte >= 0 && Math.abs(x - letzte) < 46 && reihe === 0 ? 1 : 0;
      gestaffelt = gestaffelt || reihe === 1;
      letzte = x;
      const ist = i === 0 ? "start" : i === werte.length - 1 ? "ziel" : "zwischen";
      s += feld(x, linie + 10 + reihe * 30, werte[i], zahl(werte[i]), "strich-wert", ist);
    });
    el.setAttribute("data-ziel", werte[werte.length - 1]);
    el.innerHTML = svg(breite, linie + 10 + 26 + (gestaffelt ? 30 : 0) + 2, s);
  }

  /* == Rechenformate == */
  const ZAHLENRAUM = { 1: 20, 2: 100, 3: 1000, 4: 1000000 };
  const pruefeRaum = (werte) => {
    const k = klasse(), grenze = ZAHLENRAUM[k] ?? 1000000;
    for (const w of werte) {
      if (!Number.isInteger(w)) abbruch(`${String(w).replace(".", ",")} ist keine ganze Zahl.`);
      if (w < 0) abbruch(`Ein Feld wäre ${zahl(w)} und damit unter 0.`);
      if (w > grenze) abbruch(`Ein Feld wäre ${zahl(w)} und damit über ${zahl(grenze)}, die Grenze in Klasse ${k}.`);
    }
  };
  /** Rang über die Gaußsche Elimination; die Gleichungen sind klein, die Koeffizienten ganz. */
  const rang = (zeilen) => {
    const m = zeilen.map((z) => [...z]);
    let r = 0;
    const spalten = m[0]?.length ?? 0;
    for (let c = 0; c < spalten && r < m.length; c++) {
      let p = r;
      for (let i = r; i < m.length; i++) if (Math.abs(m[i][c]) > Math.abs(m[p][c])) p = i;
      if (Math.abs(m[p][c]) < 1e-9) continue;
      [m[r], m[p]] = [m[p], m[r]];
      for (let i = 0; i < m.length; i++) {
        if (i === r) continue;
        const f = m[i][c] / m[r][c];
        for (let j = c; j < spalten; j++) m[i][j] -= f * m[r][j];
      }
      r++;
    }
    return r;
  };
  /** Ergibt sich jedes offene Feld aus den gegebenen? `gleichungen`: je `{ id: Faktor }`. */
  const istEindeutig = (gleichungen, offen) => {
    const ids = [...offen];
    if (ids.length === 0) return true;
    return rang(gleichungen.map((g) => ids.map((id) => g[id] ?? 0))) === ids.length;
  };
  const MEHRERE = "Mit diesen Vorgaben gibt es mehrere Lösungen.";
  const leseOffen = (roh, standard) => new Set(roh === null ? standard : trenneListe(roh));
  const feldMass = (werte, wunsch) => {
    const mindest = { 1: 28, 2: 24, 3: 22, 4: 22 }[klasse()] ?? 24;
    const schrift = Math.max(14, Math.min(20, Math.max(wunsch, mindest) * 0.5));
    const breit = Math.max(...werte.map((w) => textBreite(zahl(w), schrift))) + 14;
    return { b: Math.max(wunsch, mindest, breit), schrift };
  };
  const rechenfeld = (el, id, x, y, b, h, wert, offen, schrift, { rund = false, rand = "", inhaltText } = {}) => {
    const zeige = !offen || loesungSichtbar(el);
    const wort = inhaltText ?? zahl(wert);
    return `<g class="rechenfeld" data-id="${id}" data-wert="${wert}" data-offen="${offen ? "ja" : "nein"}">` +
      `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(b)}" height="${r1(h)}" rx="${rund ? r1(h / 2) : 3}" fill="#fff" stroke-width="1.6"${rand}/>` +
      (zeige ? text(x + b / 2, y + h / 2, wort, { groesse: schrift, fett: offen }) : "") + "</g>";
  };

  const mauerWerte = (basis, art = "plus") => {
    const reihen = [basis];
    while (reihen[reihen.length - 1].length > 1) {
      const unten = reihen[reihen.length - 1];
      reihen.push(unten.slice(1).map((w, i) => (art === "minus" ? unten[i] - w : unten[i] + w)));
    }
    return reihen;
  };
  const mauerEindeutig = (stufen, offen, art = "plus") => {
    const gleichungen = [];
    for (let r = 1; r < stufen; r++) {
      for (let c = 0; c < stufen - r; c++) gleichungen.push({ [`${r}-${c}`]: 1, [`${r - 1}-${c}`]: -1, [`${r - 1}-${c + 1}`]: art === "minus" ? 1 : -1 });
    }
    return istEindeutig(gleichungen, offen);
  };

  function zahlenmauer(el) {
    const basis = liste(el, "basis").map(Number), art = attr(el, "art", "plus");
    if (basis.length < 2 || basis.length > 5) abbruch("Eine Zahlenmauer hat unten 2 bis 5 Steine.");
    if (art !== "plus" && art !== "minus") abbruch(`Die Art „${art}“ gibt es nicht.`);
    const reihen = mauerWerte(basis, art);
    pruefeRaum(reihen.flat());
    const stufen = basis.length;
    const zellen = reihen.flatMap((reihe, r) => reihe.map((w, c) => ({ id: `${r}-${c}`, x: r / 2 + c, y: stufen - 1 - r, text: String(w), an: r > 0 })));
    meldeZellen(el, "offen", zellen);
    const offen = leseOffen(attr(el, "offen", null), zellen.filter((z) => z.an).map((z) => z.id));
    for (const id of offen) if (!zellen.some((z) => z.id === id)) abbruch(`Den Stein „${id}“ gibt es nicht.`);
    if (!mauerEindeutig(stufen, offen, art)) abbruch(MEHRERE);
    const { b, schrift } = feldMass(reihen.flat(), num(el, "groesse", 44));
    const h = Math.max(30, schrift * 1.8);
    let s = "";
    reihen.forEach((reihe, r) => reihe.forEach((w, c) => {
      const deck = r === stufen - 1;
      s += rechenfeld(el, `${r}-${c}`, 1 + (r / 2 + c) * b, 1 + (stufen - 1 - r) * h, b, h, w, offen.has(`${r}-${c}`), schrift, { rand: deck && !istSw() ? ' style="stroke:var(--akzent)"' : "" });
    }));
    el.innerHTML = svg(r1(stufen * b + 2), r1(stufen * h + 2), s);
  }

  const RECHENDREIECK_GLEICHUNGEN = [{ a0: 1, i0: -1, i1: -1 }, { a1: 1, i1: -1, i2: -1 }, { a2: 1, i2: -1, i0: -1 }];
  const plaettchenMitte = (cx, cy, n, r = 3.6, abstand = 9) => {
    let s = "";
    const breite = Math.min(n, 5), zeilen = Math.ceil(n / 5);
    for (let i = 0; i < n; i++) {
      const c = i % 5, z = Math.floor(i / 5);
      s += `<circle class="plaettchen" cx="${r1(cx + (c - (Math.min(n - z * 5, 5) - 1) / 2) * abstand)}" cy="${r1(cy + (z - (zeilen - 1) / 2) * abstand)}" r="${r}" fill="currentColor" stroke="none" data-b="${breite}"/>`;
    }
    return s;
  };

  function rechendreieck(el) {
    const innen = liste(el, "innen").map(Number);
    if (innen.length !== 3) abbruch("Das Rechendreieck braucht drei Innenzahlen.");
    const aussen = [innen[0] + innen[1], innen[1] + innen[2], innen[2] + innen[0]];
    const alle = [...innen, ...aussen];
    pruefeRaum(alle);
    const plaettchen = attr(el, "darstellung", "zahlen") === "plaettchen";
    if (plaettchen && innen.some((w) => w > 20)) abbruch("Plättchen gehen bis 20.");
    const namen = ["i0", "i1", "i2", "a0", "a1", "a2"];
    const offenStandard = ["a0", "a1", "a2"];
    const lage = [[1, 0], [0, 2], [2, 2], [0, 1], [1, 3], [2, 1]];
    meldeZellen(el, "offen", namen.map((id, i) => ({ id, x: lage[i][0], y: lage[i][1], text: String(alle[i]), an: offenStandard.includes(id) })));
    const offen = leseOffen(attr(el, "offen", null), offenStandard);
    for (const id of offen) if (!namen.includes(id)) abbruch(`Das Feld „${id}“ gibt es nicht.`);
    if (!istEindeutig(RECHENDREIECK_GLEICHUNGEN, offen)) abbruch(MEHRERE);
    const g = num(el, "groesse", 220), { b, schrift } = feldMass(alle, 44), h = Math.max(30, schrift * 1.8);
    const h3 = g * 0.866, ox = b + 8, oy = 4;
    const T = [ox + g / 2, oy], L = [ox, oy + h3], R = [ox + g, oy + h3], M = [ox + g / 2, oy + h3 * 0.62];
    let s = `<path d="M${r1(T[0])} ${r1(T[1])}L${r1(L[0])} ${r1(L[1])}L${r1(R[0])} ${r1(R[1])}Z" stroke-width="2.2" stroke-linejoin="round" fill="#fff"/>`;
    const seitenMitte = [[(T[0] + L[0]) / 2, (T[1] + L[1]) / 2], [(L[0] + R[0]) / 2, L[1]], [(R[0] + T[0]) / 2, (R[1] + T[1]) / 2]];
    for (const p of seitenMitte) s += `<line x1="${r1(M[0])}" y1="${r1(M[1])}" x2="${r1(p[0])}" y2="${r1(p[1])}" stroke-width="1.6"/>`;
    const orteInnen = [[T[0], oy + h3 * 0.36], [ox + g * 0.25, oy + h3 * 0.8], [ox + g * 0.75, oy + h3 * 0.8]];
    orteInnen.forEach(([x, y], i) => {
      const id = namen[i], ist = offen.has(id);
      if (plaettchen) {
        const inhaltPunkte = !ist || loesungSichtbar(el) ? plaettchenMitte(x, y, innen[i]) : "";
        s += `<g class="rechenfeld" data-id="${id}" data-wert="${innen[i]}" data-offen="${ist ? "ja" : "nein"}">${inhaltPunkte}</g>`;
      } else s += rechenfeld(el, id, x - b / 2, y - h / 2, b, h, innen[i], ist, schrift);
    });
    const orteAussen = [[seitenMitte[0][0] - b / 2 - 8, seitenMitte[0][1]], [seitenMitte[1][0], L[1] + h / 2 + 8], [seitenMitte[2][0] + b / 2 + 8, seitenMitte[2][1]]];
    orteAussen.forEach(([x, y], i) => {
      s += rechenfeld(el, `a${i}`, x - b / 2, y - h / 2, b, h, aussen[i], offen.has(`a${i}`), schrift);
    });
    el.innerHTML = svg(r1(g + 2 * ox), r1(h3 + oy + h + 12), s);
  }

  function zahlenhaus(el) {
    const dachRoh = num(el, "dach", NaN), alleZerlegungen = attr(el, "alle", "nein") === "ja";
    if (!Number.isInteger(dachRoh) || dachRoh < 0) abbruch("Das Dach braucht eine Zahl.");
    const dach = dachRoh;
    const zeilen = alleZerlegungen
      ? Array.from({ length: dach + 1 }, (_, i) => [i, dach - i])
      : (el.getAttribute("zerlegungen") || "").split(";").map((t) => t.trim()).filter(Boolean).map((t) => t.split(/\s+/).map(Number));
    if (zeilen.length === 0) abbruch("Das Zahlenhaus braucht mindestens ein Stockwerk.");
    if (zeilen.length > 21) abbruch("Das Zahlenhaus hat höchstens 21 Stockwerke.");
    for (const z of zeilen) {
      if (z.length !== 2) abbruch("Jedes Stockwerk hat zwei Zahlen.");
      if (z[0] + z[1] !== dach) abbruch(`${zahl(z[0])} und ${zahl(z[1])} ergeben nicht ${zahl(dach)}.`);
    }
    pruefeRaum([dach, ...zeilen.flat()]);
    const standard = zeilen.map((_, r) => `${r}-r`);
    const zellen = [{ id: "dach", x: 0.5, y: 0, text: String(dach), an: false }];
    zeilen.forEach((z, r) => {
      zellen.push({ id: `${r}-l`, x: 0, y: r + 1, text: String(z[0]), an: false }, { id: `${r}-r`, x: 1, y: r + 1, text: String(z[1]), an: true });
    });
    meldeZellen(el, "offen", zellen);
    const offen = leseOffen(attr(el, "offen", null), standard);
    for (const id of offen) if (!zellen.some((z) => z.id === id)) abbruch(`Das Feld „${id}“ gibt es nicht.`);
    if (!istEindeutig(zeilen.map((_, r) => ({ dach: 1, [`${r}-l`]: -1, [`${r}-r`]: -1 })), offen)) abbruch(MEHRERE);
    const { b, schrift } = feldMass([dach, ...zeilen.flat()], num(el, "groesse", 40)), h = Math.max(28, schrift * 1.7);
    const breite = 2 * b, dachH = b * 0.95;
    let s = `<path d="M1 ${r1(dachH + 1)}L${r1(b + 1)} 1L${r1(breite + 1)} ${r1(dachH + 1)}Z" fill="#fff" stroke-width="2" stroke-linejoin="round"/>`;
    const ist = offen.has("dach");
    s += `<g class="rechenfeld" data-id="dach" data-wert="${dach}" data-offen="${ist ? "ja" : "nein"}">${!ist || loesungSichtbar(el) ? text(b + 1, dachH * 0.64, zahl(dach), { groesse: schrift, fett: true }) : ""}</g>`;
    zeilen.forEach((z, r) => {
      const y = dachH + 1 + r * h;
      s += rechenfeld(el, `${r}-l`, 1, y, b, h, z[0], offen.has(`${r}-l`), schrift) + rechenfeld(el, `${r}-r`, 1 + b, y, b, h, z[1], offen.has(`${r}-r`), schrift);
    });
    el.innerHTML = svg(r1(breite + 2), r1(dachH + zeilen.length * h + 2), s);
  }

  const leseOperator = (t) => {
    const m = /^([+\-−·×*:])\s*(\d+)$/.exec(String(t).trim());
    if (!m) abbruch(`„${t}“ ist kein Rechenschritt. So sieht einer aus: +5, −3, ·2 oder :4.`);
    return { art: { "+": "+", "-": "−", "−": "−", "·": "·", "×": "·", "*": "·", ":": ":" }[m[1]], wert: Number(m[2]) };
  };
  const rechne = (a, { art, wert }) => {
    if (art === "+") return a + wert;
    if (art === "−") return a - wert;
    if (art === "·") return a * wert;
    if (wert === 0) abbruch("Durch 0 kann man nicht teilen.");
    if (a % wert !== 0) abbruch(`${zahl(a)} : ${zahl(wert)} geht nicht ohne Rest auf.`);
    return a / wert;
  };
  const operatorText = ({ art, wert }) => `${art}${art === "·" || art === ":" ? " " : ""}${zahl(wert)}`;
  const ketteWerte = (start, ops) => ops.reduce((w, o) => [...w, rechne(w[w.length - 1], o)], [start]);

  function zahlenkette(el) {
    const start = num(el, "start", 0), ops = liste(el, "operatoren").map(leseOperator);
    if (ops.length === 0) abbruch("Die Kette braucht mindestens einen Rechenschritt, zum Beispiel +5.");
    const rueckwaerts = attr(el, "rueckwaerts", "nein") === "ja";
    const standard = rueckwaerts ? ["ziel", "operatoren"] : ["start", "operatoren"];
    const zeige = attr(el, "zeige", null) === null ? standard : liste(el, "zeige");
    if (!["start", "ziel", "zwischen"].some((z) => zeige.includes(z))) abbruch("Mindestens eine Zahl muss vorgegeben sein, sonst lässt sich nichts rechnen.");
    if (!zeige.includes("operatoren") && ops.length > 1 && !zeige.includes("zwischen")) abbruch(MEHRERE);
    const werte = ketteWerte(start, ops);
    pruefeRaum(werte);
    const pfeilbild = attr(el, "art", "kette") === "pfeilbild";
    const { b, schrift } = feldMass(werte, 44), h = Math.max(30, schrift * 1.8), luecke = pfeilbild ? 62 : 56, oben = pfeilbild ? 40 : 24;
    const breite = werte.length * b + ops.length * luecke;
    if (breite > SATZSPIEGEL) abbruch("Die Kette ist zu lang für eine Zeile. Nimm weniger Schritte.");
    let s = "";
    const wortHoehe = 14;
    werte.forEach((w, i) => {
      const x = i * (b + luecke) + 1, ist = i === 0 ? "start" : i === werte.length - 1 ? "ziel" : "zwischen";
      s += rechenfeld(el, `w${i}`, x, oben, b, h, w, !zeige.includes(ist), schrift, { rund: pfeilbild });
      if (i === ops.length) return;
      const x1 = x + b + 3, x2 = x + b + luecke - 3, my = oben + h / 2, wort = operatorText(ops[i]), mitte = (x1 + x2) / 2;
      if (pfeilbild) s += `<path d="M${r1(x + b / 2)} ${oben - 1}Q${r1(mitte)} ${r1(oben - 36)} ${r1(x + b + luecke + b / 2)} ${oben - 1}" stroke-width="1.8"/><path d="M${r1(x + b + luecke + b / 2 - 7)} ${oben - 6}L${r1(x + b + luecke + b / 2)} ${oben - 1}L${r1(x + b + luecke + b / 2 - 1)} ${oben - 10}" stroke-width="1.8"/>`;
      else s += `<path d="M${r1(x1)} ${r1(my)}L${r1(x2)} ${r1(my)}M${r1(x2 - 6)} ${r1(my - 4)}L${r1(x2)} ${r1(my)}L${r1(x2 - 6)} ${r1(my + 4)}" stroke-width="1.8"/>`;
      const wy = pfeilbild ? oben - 26 : my - 10;
      const offenOp = !zeige.includes("operatoren");
      s += `<g class="kette-op" data-wert="${wort}" data-offen="${offenOp ? "ja" : "nein"}">`;
      if (offenOp) s += antwortfeld(el, mitte - 20, wy - wortHoehe + 2, 40, 22, wort, { groesse: 13 });
      else s += text(mitte, wy, wort, { groesse: 14, fett: true });
      s += "</g>";
    });
    el.innerHTML = svg(r1(breite + 2), r1(oben + h + 2), s);
  }

  const ZAUBER = {
    dreieck: {
      felder: ["e0", "s0", "e1", "s1", "e2", "s2"],
      linien: [["e0", "s0", "e1"], ["e1", "s1", "e2"], ["e2", "s2", "e0"]],
      zahlen: [1, 2, 3, 4, 5, 6],
    },
    quadrat: {
      felder: ["z0", "z1", "z2", "z3", "z4", "z5", "z6", "z7", "z8"],
      linien: [["z0", "z1", "z2"], ["z3", "z4", "z5"], ["z6", "z7", "z8"], ["z0", "z3", "z6"], ["z1", "z4", "z7"], ["z2", "z5", "z8"], ["z0", "z4", "z8"], ["z2", "z4", "z6"]],
      zahlen: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    },
  };
  /** Alle Belegungen, in denen jede Linie dieselbe Summe hat; Wiederholungen in `zahlen` zählen einmal. */
  const zauberLoesungen = (art, zahlen, summe) => {
    const { felder, linien } = ZAUBER[art], vorrat = new Map();
    for (const z of zahlen) vorrat.set(z, (vorrat.get(z) ?? 0) + 1);
    const belegt = {}, gefunden = [];
    const geht = () => {
      let ziel = summe ?? null;
      for (const l of linien) {
        if (!l.every((f) => belegt[f] !== undefined)) continue;
        const s = l.reduce((a, f) => a + belegt[f], 0);
        if (ziel === null) ziel = s;
        else if (s !== ziel) return false;
      }
      return true;
    };
    const setze = (i) => {
      if (i === felder.length) {
        gefunden.push({ ...belegt });
        return;
      }
      for (const [z, n] of vorrat) {
        if (n === 0) continue;
        vorrat.set(z, n - 1);
        belegt[felder[i]] = z;
        if (geht()) setze(i + 1);
        delete belegt[felder[i]];
        vorrat.set(z, n);
      }
    };
    setze(0);
    return gefunden;
  };

  function zauberdreieck(el) {
    const art = attr(el, "art", "dreieck");
    if (!ZAUBER[art]) abbruch(`Die Art „${art}“ gibt es nicht.`);
    const zahlen = attr(el, "zahlen", null) === null ? ZAUBER[art].zahlen : liste(el, "zahlen").map(Number);
    if (zahlen.length !== ZAUBER[art].felder.length) abbruch(`Hier braucht es genau ${ZAUBER[art].felder.length} Zahlen.`);
    pruefeRaum(zahlen);
    const summe = num(el, "summe", 0) || null, loesungen = zauberLoesungen(art, zahlen, summe);
    if (loesungen.length === 0) abbruch(summe === null ? "Mit diesen Zahlen geht es nicht auf." : `Mit diesen Zahlen gibt es keine Lösung für die Summe ${zahl(summe)}.`);
    const zz = zufall(samen(el, `${art}|${zahlen.join()}|${summe ?? ""}`));
    const wahl = loesungen[Math.floor(zz() * loesungen.length)];
    const dreieck = art === "dreieck";
    const orte = dreieck
      ? { e0: [1, 0], s0: [0.5, 1], e1: [0, 2], s1: [1, 2], e2: [2, 2], s2: [1.5, 1] }
      : Object.fromEntries(ZAUBER.quadrat.felder.map((f, i) => [f, [i % 3, Math.floor(i / 3)]]));
    meldeZellen(el, "vorgegeben", ZAUBER[art].felder.map((id) => ({ id, x: orte[id][0], y: orte[id][1], text: String(wahl[id]) })));
    const gegeben = liste(el, "vorgegeben");
    for (const id of gegeben) if (!ZAUBER[art].felder.includes(id)) abbruch(`Das Feld „${id}“ gibt es nicht.`);
    const passende = loesungen.filter((l) => gegeben.every((f) => l[f] === wahl[f]));
    if (passende.length > 1 && summe !== null) abbruch(MEHRERE);
    const { b, schrift } = feldMass(zahlen, num(el, "groesse", 44)), h = b;
    const X = (x) => 1 + x * (dreieck ? b * 1.15 : b), Y = (y) => 1 + y * (dreieck ? b * 1.25 : b);
    let s = "";
    if (dreieck) {
      const mitte = (id) => [X(orte[id][0]) + b / 2, Y(orte[id][1]) + h / 2];
      const [a, c, d] = ["e0", "e1", "e2"].map(mitte);
      s += `<path d="M${r1(a[0])} ${r1(a[1])}L${r1(c[0])} ${r1(c[1])}L${r1(d[0])} ${r1(d[1])}Z" stroke-width="1.6"/>`;
    }
    for (const id of ZAUBER[art].felder) s += rechenfeld(el, id, X(orte[id][0]), Y(orte[id][1]), b, h, wahl[id], !gegeben.includes(id), schrift, { rund: dreieck });
    const unten = Y(2) + h + 2;
    let hoehe = unten;
    if (summe === null && loesungSichtbar(el) && passende.length > 1) {
      const wort = `eine von ${zahl(passende.length)} Lösungen`;
      s += text(0, unten + 12, wort, { groesse: 13, anker: "start" });
      hoehe += 20;
    }
    el.setAttribute("data-loesungen", passende.length);
    el.innerHTML = svg(r1(Math.max(X(2) + b + 2, 140)), r1(hoehe), s);
  }

  function rechenrad(el) {
    const op = leseOperator(attr(el, "mitte", "·2")), innen = liste(el, "zahlen").map(Number);
    if (innen.length < 6 || innen.length > 10) abbruch("Das Rechenrad hat 6 bis 10 Zahlen.");
    const aussen = innen.map((z) => rechne(z, op));
    pruefeRaum([...innen, ...aussen]);
    const offen = attr(el, "offen", "aussen");
    if (offen !== "aussen" && offen !== "innen") abbruch("Offen ist der äußere oder der innere Ring.");
    if (offen === "innen" && op.art === "·" && op.wert === 0) abbruch(MEHRERE);
    const g = num(el, "groesse", 240), n = innen.length, R = g / 2, m = R + 1;
    const r3 = R * 0.3, r2 = R * 0.65;
    let s = `<circle cx="${m}" cy="${m}" r="${R}" stroke-width="2" fill="#fff"/><circle cx="${m}" cy="${m}" r="${r2}" stroke-width="1.6"/>`;
    const auf = (r, w) => [m + r * Math.sin(w), m - r * Math.cos(w)];
    for (let i = 0; i < n; i++) {
      const w = ((i + 0.5) * 2 * Math.PI) / n;
      const [a, c] = auf(r3, w), [d, e] = auf(R, w);
      s += `<line x1="${r1(a)}" y1="${r1(c)}" x2="${r1(d)}" y2="${r1(e)}" stroke-width="1.4"/>`;
      const wm = (i * 2 * Math.PI) / n;
      const [ix, iy] = auf((r3 + r2) / 2, wm), [ax, ay] = auf((r2 + R) / 2, wm);
      const schrift = Math.min(16, R * 0.14);
      s += `<g class="rechenfeld" data-id="i${i}" data-wert="${innen[i]}" data-offen="${offen === "innen" ? "ja" : "nein"}">${offen !== "innen" || loesungSichtbar(el) ? text(ix, iy, zahl(innen[i]), { groesse: schrift, fett: offen === "innen" }) : ""}</g>`;
      s += `<g class="rechenfeld" data-id="a${i}" data-wert="${aussen[i]}" data-offen="${offen === "aussen" ? "ja" : "nein"}">${offen !== "aussen" || loesungSichtbar(el) ? text(ax, ay, zahl(aussen[i]), { groesse: schrift, fett: offen === "aussen" }) : ""}</g>`;
    }
    s += `<circle cx="${m}" cy="${m}" r="${r1(r3)}" fill="#fff" stroke-width="2"${istSw() ? "" : ' style="stroke:var(--akzent);fill:color-mix(in srgb,var(--haupt) 25%,#fff)"'}/>`;
    s += text(m, m, operatorText(op), { groesse: Math.min(20, R * 0.17), fett: true });
    el.innerHTML = svg(g + 2, g + 2, s);
  }

  /* == Einmaleins und schriftliches Rechnen == */
  function punktfeld(el) {
    const zeilen = num(el, "zeilen", 5), spalten = num(el, "spalten", 5), d = num(el, "groesse", 20);
    const richtung = attr(el, "richtung", "zeilen"), trenner = attr(el, "trenner", null);
    const abdecken = attr(el, "abdecken", null), nurLoesung = attr(el, "loesung", null) === "ja";
    if (zeilen < 1 || zeilen > 10 || spalten < 1 || spalten > 10) abbruch("Ein Punktfeld hat höchstens 10 Zeilen und 10 Spalten.");
    if (richtung !== "zeilen" && richtung !== "spalten") abbruch(`Die Richtung „${richtung}“ gibt es nicht.`);
    const nachZeilen = richtung === "zeilen", anzahl = nachZeilen ? zeilen : spalten;
    const k = trenner === null ? null : Number(trenner);
    if (k !== null && (!Number.isInteger(k) || k < 1 || k >= anzahl)) abbruch(`Die Zerlegungslinie muss innerhalb des Feldes liegen (1 bis ${anzahl - 1}).`);
    pruefeRaum([zeilen * spalten]);
    const ort = (i) => d / 2 + i * d + (i >= 5 ? d * 0.5 : 0) + 2;
    const breite = ort(spalten - 1) + d / 2 + 2, hoehe = ort(zeilen - 1) + d / 2 + 2, r = Math.max(3, d * 0.3);
    let s = "";
    for (let z = 0; z < zeilen; z++) {
      for (let c = 0; c < spalten; c++) s += `<circle class="punkt" cx="${r1(ort(c))}" cy="${r1(ort(z))}" r="${r1(r)}" fill="${SCHWARZ}" stroke="none"/>`;
    }
    if (abdecken !== null) {
      const [dz, ds] = abdecken.trim().split(/\s+/).map(Number);
      if (!(dz >= 1 && dz <= zeilen && ds >= 1 && ds <= spalten)) abbruch("Der freie Teil muss im Feld liegen (Zeilen, dann Spalten).");
      const x = dz === zeilen ? ort(ds - 1) + d / 2 : null, y = ds === spalten ? ort(dz - 1) + d / 2 : null;
      const ecke = [ort(ds - 1) + d / 2, ort(dz - 1) + d / 2];
      const pfad = x !== null ? `M${r1(x)} 0H${r1(breite)}V${r1(hoehe)}H${r1(x)}Z`
        : y !== null ? `M0 ${r1(y)}H${r1(breite)}V${r1(hoehe)}H0Z`
        : `M${r1(ecke[0])} 0H${r1(breite)}V${r1(hoehe)}H0V${r1(ecke[1])}H${r1(ecke[0])}Z`;
      s += `<path class="abdeckung" d="${pfad}" fill="#d0d0d0" stroke="none"/>`;
    }
    const zeigeLinie = k !== null && (!nurLoesung || loesungSichtbar(el));
    let unten = hoehe;
    if (zeigeLinie) {
      const lage = (ort(k - 1) + ort(k)) / 2, stil = `class="trennlinie" stroke-width="3" stroke-linecap="round"${istSw() ? "" : ' style="stroke:var(--haupt)"'}`;
      s += nachZeilen ? `<path ${stil} d="M1 ${r1(lage)}H${r1(breite - 1)}"/>` : `<path ${stil} d="M${r1(lage)} 1V${r1(hoehe - 1)}"/>`;
    }
    const teil = k === null ? "" : nachZeilen ? `${k} · ${spalten} + ${zeilen - k} · ${spalten}` : `${zeilen} · ${k} + ${zeilen} · ${spalten - k}`;
    if (teil) el.setAttribute("data-teilaufgaben", teil);
    else el.removeAttribute("data-teilaufgaben");
    const breiteText = teil ? textBreite(teil, 14) + 4 : 0;
    if (teil && loesungSichtbar(el)) {
      s += text(Math.max(breite, breiteText) / 2, hoehe + 12, teil, { groesse: 14, fett: true });
    }
    if (k !== null) unten = hoehe + 22;
    meldeInfo(el, `${zeilen} · ${spalten} = ${zahl(zeilen * spalten)}`);
    el.innerHTML = svg(r1(Math.max(breite, breiteText)), r1(unten), s);
  }

  const stellenteile = (n) => {
    const ziffern = String(n), teile = [];
    [...ziffern].forEach((z, i) => {
      if (z !== "0") teile.push(Number(z) * 10 ** (ziffern.length - 1 - i));
    });
    return teile.length > 0 ? teile : [0];
  };
  const malkreuzRechnung = (a, b) => {
    const spalten = stellenteile(a), zeilen = stellenteile(b);
    const produkte = zeilen.map((z) => spalten.map((s) => z * s));
    return { spalten, zeilen, produkte, summen: produkte.map((p) => p.reduce((x, y) => x + y, 0)), ergebnis: a * b };
  };

  function malkreuz(el) {
    const a = num(el, "a", 34), b = num(el, "b", 6), zeige = leseOffen(attr(el, "zeige", null), ["zerlegung"]);
    for (const n of [a, b]) {
      if (!Number.isInteger(n) || n < 1 || n > 99) abbruch("Beim Malkreuz sind beide Zahlen 1 bis 99.");
    }
    const r = malkreuzRechnung(a, b);
    pruefeRaum([r.ergebnis]);
    const schrift = 16, h = 34;
    const alle = [...r.spalten, ...r.zeilen, ...r.produkte.flat(), ...r.summen, r.ergebnis];
    const b0 = Math.max(52, ...alle.map((w) => textBreite(zahl(w), schrift) + 14));
    const sp = r.spalten.length, ze = r.zeilen.length, mitSumme = ze > 1;
    const zeile0 = 30, l = 2;
    let s = text(l, 12, `${a} · ${b} =`, { groesse: 16, fett: true, anker: "start" });
    const xErgebnis = l + textBreite(`${a} · ${b} =`, 16) + 8;
    s += rechenfeld(el, "ergebnis", xErgebnis, 0, b0, 24, r.ergebnis, !zeige.has("summe"), schrift);
    const x = (c) => l + c * b0, y = (z) => zeile0 + z * h;
    s += `<g class="malkreuz-kopf">${text(x(0) + b0 / 2, y(0) + h / 2, "·", { groesse: 20, fett: true })}</g>`;
    r.spalten.forEach((w, c) => {
      s += rechenfeld(el, `s${c}`, x(c + 1), y(0), b0, h, w, !zeige.has("zerlegung"), schrift);
    });
    r.zeilen.forEach((w, z) => {
      s += rechenfeld(el, `z${z}`, x(0), y(z + 1), b0, h, w, !zeige.has("zerlegung"), schrift);
      r.spalten.forEach((_, c) => {
        s += rechenfeld(el, `p${z}-${c}`, x(c + 1), y(z + 1), b0, h, r.produkte[z][c], !zeige.has("teilprodukte"), schrift);
      });
      s += text(x(sp + 1) + 10, y(z + 1) + h / 2, "→", { groesse: 16 });
      s += rechenfeld(el, `t${z}`, x(sp + 1) + 22, y(z + 1), b0, h, r.summen[z], !zeige.has("summe"), schrift);
    });
    if (mitSumme) {
      const xs = x(sp + 1) + 22, ys = y(ze + 1) + 6;
      s += `<path d="M${r1(xs)} ${r1(ys - 3)}H${r1(xs + b0)}" stroke-width="2"/>`;
      s += rechenfeld(el, "summe", xs, ys, b0, h, r.ergebnis, !zeige.has("summe"), schrift);
    }
    const breite = x(sp + 1) + 22 + b0 + 2, hoehe = y(ze + 1) + (mitSumme ? h + 8 : 2);
    meldeInfo(el, `Ergebnis: ${zahl(r.ergebnis)}`);
    el.innerHTML = svg(r1(breite), r1(hoehe), s);
  }

  /* Die Rechenkerne rechnen Stelle für Stelle; die Reihung ist immer von den Einern (Index 0) nach links. */
  const stellenVon = (n) => [...String(n)].reverse().map(Number);
  const zahlAus = (stellen) => Number([...stellen].reverse().join("")) || 0;

  /** `vergessen`: Spalte, deren Übertrag nach links nicht ankommt (Fehleraufgabe). */
  const addiere = (zahlen, { vergessen = null } = {}) => {
    const reihen = zahlen.map(stellenVon), breite = Math.max(...reihen.map((r) => r.length));
    const ziffern = [], uebertraege = [];
    let behalten = 0;
    for (let i = 0; i < breite || behalten > 0; i++) {
      uebertraege[i] = behalten;
      const summe = reihen.reduce((t, r) => t + (r[i] ?? 0), behalten);
      ziffern[i] = summe % 10;
      behalten = i === vergessen ? 0 : Math.floor(summe / 10);
    }
    return { ziffern, uebertraege, ergebnis: zahlAus(ziffern) };
  };

  /** Erweitern: Übertrag unter dem Subtrahenden. `falschHerum`: In dieser Spalte oben von unten abgezogen. */
  const subtrahiereErweitern = (a, b, verfahren, { vergessen = null, falschHerum = null } = {}) => {
    const oben = stellenVon(a), unten = stellenVon(b), ziffern = [], uebertraege = [], sprechweise = [];
    let behalten = 0;
    for (let i = 0; i < oben.length; i++) {
      uebertraege[i] = behalten;
      const s = (unten[i] ?? 0) + behalten, ziel = oben[i];
      if (i === falschHerum) {
        ziffern[i] = Math.abs(ziel - s);
        behalten = 0;
        continue;
      }
      const leihe = s > ziel;
      ziffern[i] = (leihe ? ziel + 10 : ziel) - s;
      const voll = leihe ? ziel + 10 : ziel;
      sprechweise[i] = verfahren === "ergaenzen" ? `${s} + ${ziffern[i]} = ${voll}` : `${voll} − ${s} = ${ziffern[i]}`;
      if (leihe) sprechweise[i] += ", 1 gemerkt";
      behalten = leihe && i !== vergessen ? 1 : 0;
    }
    while (ziffern.length > 1 && ziffern[ziffern.length - 1] === 0) ziffern.pop();
    return { ziffern, uebertraege, sprechweise, ergebnis: zahlAus(ziffern) };
  };

  /** Entbündeln: `neu[i]` ist die Ziffer, die über der durchgestrichenen steht (`null`: unverändert). */
  const subtrahiereEntbuendeln = (a, b, verfahren, { vergessen = null, falschHerum = null } = {}) => {
    const oben = stellenVon(a), unten = stellenVon(b), neu = oben.map(() => null), jetzt = [...oben], ziffern = [], sprechweise = [];
    const geliehen = [];
    for (let i = 0; i < oben.length; i++) {
      const s = unten[i] ?? 0;
      if (i === falschHerum) {
        ziffern[i] = Math.abs(jetzt[i] - s);
        continue;
      }
      if (jetzt[i] < s) {
        geliehen.push(i);
        let j = i + 1;
        while (jetzt[j] === 0) j++;
        if (i !== vergessen) {
          jetzt[j]--;
          neu[j] = jetzt[j];
          for (let m = j - 1; m > i; m--) {
            jetzt[m] = 9;
            neu[m] = 9;
          }
        }
        jetzt[i] += 10;
        neu[i] = jetzt[i];
      }
      ziffern[i] = jetzt[i] - s;
      sprechweise[i] = verfahren === "ergaenzen" ? `${s} + ${ziffern[i]} = ${jetzt[i]}` : `${jetzt[i]} − ${s} = ${ziffern[i]}`;
    }
    while (ziffern.length > 1 && ziffern[ziffern.length - 1] === 0) ziffern.pop();
    return { ziffern, neu, sprechweise, geliehen, ergebnis: zahlAus(ziffern) };
  };

  /** Ein Teilprodukt: `verschoben` Nullen rechts, `uebertraege[i]` kommt in Stelle i dazu. */
  const teilprodukt = (a, faktor, verschoben, { vergessen = null } = {}) => {
    const oben = stellenVon(a), ziffern = [], uebertraege = [];
    let behalten = 0;
    for (let i = 0; i < oben.length || behalten > 0; i++) {
      uebertraege[i] = behalten;
      const produkt = (oben[i] ?? 0) * faktor + behalten;
      ziffern[i] = produkt % 10;
      behalten = i === vergessen ? 0 : Math.floor(produkt / 10);
    }
    while (ziffern.length > 1 && ziffern[ziffern.length - 1] === 0) ziffern.pop();
    return { faktor, verschoben, ziffern, uebertraege, wert: zahlAus(ziffern) * 10 ** verschoben };
  };
  /** Vom höchsten Stellenwert des zweiten Faktors an, wie in den Schulbüchern. */
  const multipliziere = (a, b, { teilVergessen = null, vergessen = null, verrutscht = null } = {}) => {
    const stellen = stellenVon(b), teile = [];
    for (let i = stellen.length - 1; i >= 0; i--) {
      const nr = stellen.length - 1 - i;
      teile.push(teilprodukt(a, stellen[i], nr === verrutscht ? 0 : i, nr === teilVergessen ? { vergessen } : {}));
    }
    const summe = teile.length > 1 ? addiere(teile.map((t) => t.wert)) : null;
    return { teile, summe, ergebnis: summe ? summe.ergebnis : teile[0].wert };
  };

  /** `restVergessen`: Nummer des Schritts, dessen Rest nicht heruntergenommen wird. `nullWeg`: Null im Ergebnis fehlt. */
  const dividiere = (a, b, { restVergessen = null, nullWeg = false } = {}) => {
    const ziffern = [...String(a)].map(Number), schritte = [];
    let teil = 0, ende = 0;
    for (; ende < ziffern.length; ende++) {
      teil = teil * 10 + ziffern[ende];
      if (teil >= b) break;
    }
    if (ende === ziffern.length) ende = ziffern.length - 1;
    for (; ende < ziffern.length; ende++) {
      if (schritte.length > 0) teil = teil * 10 + ziffern[ende];
      const q = Math.floor(teil / b), produkt = q * b, rest = teil - produkt;
      schritte.push({ ende, teil, q, produkt, rest });
      teil = schritte.length - 1 === restVergessen ? 0 : rest;
    }
    const alleQ = schritte.map((x) => x.q), letzter = schritte[schritte.length - 1];
    const qZiffern = nullWeg ? alleQ.filter((q) => q !== 0) : alleQ;
    return { schritte, quotient: qZiffern.length > 0 ? Number(qZiffern.join("")) : 0, qZiffern, rest: letzter.rest };
  };

  const FEHLER_NAMEN = { uebertrag: "Übertrag vergessen", stelle: "Stelle verrutscht", herum: "Falsch herum gerechnet", rest: "Rest vergessen", null: "Null im Ergebnis vergessen" };
  /** Alle Fehler, die in dieser Aufgabe etwas ändern; die Rechnung rechnet immer mit genau diesem einen Fehler. */
  const moeglicheFehler = (art, zahlen, verfahren) => {
    const [a, b] = zahlen, liste = [];
    if (art === "plus") {
      addiere(zahlen).uebertraege.forEach((u, i) => {
        if (u > 0) liste.push({ art: "uebertrag", vergessen: i - 1 });
      });
      const letzte = zahlen[zahlen.length - 1];
      if (letzte > 0 && String(letzte).length < String(Math.max(...zahlen)).length) liste.push({ art: "stelle" });
    } else if (art === "minus") {
      const oben = stellenVon(a), unten = stellenVon(b);
      let spalten = subtrahiereEntbuendeln(a, b, "abziehen").geliehen;
      if (verfahren?.endsWith("erweitern")) {
        const r = subtrahiereErweitern(a, b, "abziehen");
        spalten = oben.flatMap((o, i) => ((unten[i] ?? 0) + r.uebertraege[i] > o ? [i] : []));
      }
      for (const i of spalten) liste.push({ art: "uebertrag", vergessen: i }, { art: "herum", falschHerum: i });
      if (b * 10 <= a && b > 0) liste.push({ art: "stelle" });
    } else if (art === "mal") {
      multipliziere(a, b).teile.forEach((t, nr) => {
        t.uebertraege.forEach((u, i) => {
          if (u > 0) liste.push({ art: "uebertrag", teilVergessen: nr, vergessen: i - 1 });
        });
      });
      if (a > 0 && b >= 10) liste.push({ art: "stelle", verrutscht: 0 });
    } else {
      const d = dividiere(a, b);
      d.schritte.slice(0, -1).forEach((x, nr) => {
        if (x.rest > 0) liste.push({ art: "rest", restVergessen: nr });
      });
      if (d.schritte.some((x, nr) => x.q === 0 && nr > 0)) liste.push({ art: "null", nullWeg: true });
    }
    return liste;
  };

  const VERFAHREN = ["abziehen-entbuendeln", "abziehen-erweitern", "ergaenzen-entbuendeln", "ergaenzen-erweitern"];
  /** Der Plan der Rechnung im Karoraster: Zeilen mit Zellen; `rolle` entscheidet, was das Arbeitsblatt zeigt. */
  const rechnungsplan = (art, zahlen, verfahren, fehler, mitUebertrag, mindestBreite = 0) => {
    const zeilen = [];
    const reihe = (zellen, strich = null) => {
      zeilen.push({ zellen, strich });
      return zeilen[zeilen.length - 1];
    };
    const ziffernzellen = (stellen, rechts, rolle) => stellen.map((t, i) => ({ c: rechts - i, t: String(t), rolle }));
    const uebertragszellen = (werte, rechts) => werte.flatMap((u, i) => (u > 0 ? [{ c: rechts - i, t: String(u), rolle: "uebertrag" }] : []));
    const f = fehler ?? {};
    if (art === "plus" || art === "minus") {
      const anzeige = f.art === "stelle" ? [...zahlen.slice(0, -1), zahlen[zahlen.length - 1] * 10] : zahlen;
      const [abzug, bund] = (verfahren ?? "abziehen-erweitern").split("-");
      let r = null;
      if (art === "plus") r = addiere(anzeige, f);
      else if (bund === "entbuendeln") r = subtrahiereEntbuendeln(anzeige[0], anzeige[1], abzug, f);
      else r = subtrahiereErweitern(anzeige[0], anzeige[1], abzug, f);
      const w = Math.max(mindestBreite, r.ziffern.length, ...anzeige.map((z) => String(z).length));
      const zeichen = { c: 0, t: art === "plus" ? "+" : "−", rolle: "aufgabe" };
      const oben = stellenVon(anzeige[0]);
      if (r.neu && mitUebertrag) reihe(r.neu.flatMap((n, i) => (n === null ? [] : [{ c: w - i, t: String(n), rolle: "uebertrag" }])));
      anzeige.forEach((z, i) => {
        const zellen = ziffernzellen(stellenVon(z), w, "aufgabe");
        if (r.neu && mitUebertrag && i === 0) zellen.forEach((x, j) => { if (r.neu[j] !== null && oben[j] !== undefined) x.durch = true; });
        if (i === anzeige.length - 1) zellen.push(zeichen);
        reihe(zellen);
      });
      if (r.uebertraege && mitUebertrag) reihe(uebertragszellen(r.uebertraege, w));
      zeilen[zeilen.length - 1].strich = "voll";
      reihe(ziffernzellen(r.ziffern, w, "ergebnis")).ergebnis = true;
      return { zeilen, spalten: w + 1, ergebnis: r.ergebnis, sprechweise: r.sprechweise ?? [], text: r.ergebnis };
    }
    if (art === "mal") {
      const [a, b] = zahlen, r = multipliziere(a, b, f);
      const la = String(a).length, lb = String(b).length, rechts = Math.max(la + lb + 1, mindestBreite);
      const start = rechts - la - lb;
      reihe([...[...String(a)].map((t, i) => ({ c: start + i, t, rolle: "aufgabe" })), { c: start + la, t: "·", rolle: "aufgabe" },
        ...[...String(b)].map((t, i) => ({ c: start + la + 1 + i, t, rolle: "aufgabe" }))], "voll");
      r.teile.forEach((t, nr) => {
        const ende = rechts - t.verschoben;
        const zellen = [...ziffernzellen(t.ziffern, ende, "ergebnis")];
        for (let i = 0; i < t.verschoben; i++) zellen.push({ c: rechts - i, t: "0", rolle: "ergebnis" });
        if (mitUebertrag) reihe(uebertragszellen(t.uebertraege, ende));
        if (r.summe && nr === r.teile.length - 1) zellen.push({ c: 0, t: "+", rolle: "ergebnis" });
        const z = reihe(zellen);
        if (!r.summe) z.ergebnis = true;
      });
      if (r.summe) {
        if (mitUebertrag) reihe(uebertragszellen(r.summe.uebertraege, rechts));
        zeilen[zeilen.length - 1].strich = "voll";
        reihe(ziffernzellen(r.summe.ziffern, rechts, "ergebnis")).ergebnis = true;
      }
      return { zeilen, spalten: rechts + 1, ergebnis: r.ergebnis, sprechweise: [], text: r.ergebnis };
    }
    const [a, b] = zahlen, r = dividiere(a, b, f), richtig = dividiere(a, b);
    const la = String(a).length, ende = (stelle) => 1 + stelle;
    const qStart = la + 4, qBreite = richtig.qZiffern.length, kopf = [];
    [...String(a)].forEach((t, i) => kopf.push({ c: 1 + i, t, rolle: "aufgabe" }));
    kopf.push({ c: la + 1, t: ":", rolle: "aufgabe" }, { c: la + 2, t: String(b), rolle: "aufgabe" }, { c: la + 3, t: "=", rolle: "aufgabe" });
    r.qZiffern.forEach((q, i) => kopf.push({ c: qStart + i, t: String(q), rolle: "ergebnis" }));
    if (r.rest > 0) kopf.push({ c: qStart + qBreite, t: "R", rolle: "ergebnis" }, { c: qStart + qBreite + 1, t: String(r.rest), rolle: "ergebnis" });
    reihe(kopf).ergebnis = true;
    r.schritte.forEach((x, nr) => {
      const rechts = ende(x.ende), ziffern = [...String(x.produkt)], links = rechts - ziffern.length + 1;
      const zellen = ziffern.map((t, i) => ({ c: links + i, t, rolle: "ergebnis" }));
      zellen.push({ c: links - 1, t: "−", rolle: "ergebnis" });
      reihe(zellen, { von: links - 1, bis: rechts });
      const danach = r.schritte[nr + 1];
      const wert = danach ? danach.teil : x.rest, rechtsWert = danach ? ende(danach.ende) : rechts;
      const wort = String(wert).padStart(danach && x.rest === 0 && f.restVergessen !== nr ? 2 : 1, "0");
      reihe([...wort].map((t, i) => ({ c: rechtsWert - wort.length + 1 + i, t, rolle: "ergebnis" })));
    });
    const spalten = Math.max(mindestBreite, qStart + qBreite + 2);
    return { zeilen, spalten, ergebnis: richtig.quotient, sprechweise: [], text: r.rest > 0 ? `${r.quotient} R ${r.rest}` : String(r.quotient) };
  };

  const pruefeSchriftlich = (art, zahlen, verfahren) => {
    if (!["plus", "minus", "mal", "geteilt"].includes(art)) abbruch(`Die Art „${art}“ gibt es nicht.`);
    if (zahlen.some((z) => !Number.isInteger(z) || z < 0)) abbruch("Schriftlich gerechnet wird nur mit ganzen Zahlen ab 0.");
    if (zahlen.some((z) => String(z).length > 7)) abbruch("Eine Zahl hat höchstens 7 Stellen.");
    if (art === "plus" && (zahlen.length < 2 || zahlen.length > 4)) abbruch("Bei Plus stehen 2 bis 4 Zahlen untereinander.");
    if (art !== "plus" && zahlen.length !== 2) abbruch("Hier gehören genau 2 Zahlen hinein.");
    if (art === "minus" && zahlen[0] < zahlen[1]) abbruch("Die erste Zahl muss mindestens so groß sein wie die zweite.");
    if (art === "minus" && !VERFAHREN.includes(verfahren)) abbruch("Bitte das Verfahren wählen, das die Klasse gelernt hat.");
    if (art === "mal" && String(zahlen[1]).length > 3) abbruch("Der zweite Faktor hat höchstens 3 Stellen.");
    if (art === "geteilt" && (zahlen[1] < 2 || zahlen[1] > 9)) abbruch("Geteilt wird durch 2 bis 9.");
  };
  const schriftlichWert = (art, zahlen) => {
    if (art === "plus") return zahlen.reduce((x, y) => x + y, 0);
    if (art === "minus") return zahlen[0] - zahlen[1];
    return art === "mal" ? zahlen[0] * zahlen[1] : Math.floor(zahlen[0] / zahlen[1]);
  };
  const RECHENZEICHEN = { plus: " + ", minus: " − ", mal: " · ", geteilt: " : " };

  function schriftlich(el) {
    const art = attr(el, "art", "plus"), zahlen = liste(el, "zahlen").map(Number), verfahren = attr(el, "verfahren", null);
    const mitUebertrag = attr(el, "uebertrag", "zeile") !== "keine", zeige = leseOffen(attr(el, "zeige", null), ["aufgabe"]);
    const kaestchen = num(el, "kaestchen", 0.5), fehlerhaft = attr(el, "fehlerhaft", null) === "ja";
    if (kaestchen < 0.4 || kaestchen > 1) abbruch("Ein Kästchen misst 0,4 bis 1 cm.");
    pruefeSchriftlich(art, zahlen, verfahren);
    const wert = schriftlichWert(art, zahlen);
    pruefeRaum([...zahlen, wert]);
    masstab(el);
    const richtig = rechnungsplan(art, zahlen, verfahren, null, mitUebertrag);
    let plan = richtig, wahl = null;
    if (fehlerhaft) {
      const moeglich = moeglicheFehler(art, zahlen, verfahren);
      if (moeglich.length === 0) abbruch("In diese Aufgabe lässt sich kein typischer Fehler einbauen.");
      const zz = zufall(samen(el, `${art}|${zahlen.join(" ")}`));
      wahl = moeglich[Math.floor(zz() * moeglich.length)];
      plan = rechnungsplan(art, zahlen, verfahren, wahl, mitUebertrag);
    }
    const k = cm(kaestchen), schrift = Math.max(12, k * 0.72), klein = Math.max(9, k * 0.5);
    const sichtbar = (rolle) => fehlerhaft || loesungSichtbar(el) || zeige.has(rolle === "uebertrag" ? "uebertraege" : rolle);
    const unterschiede = new Set();
    let korrektur = [];
    if (fehlerhaft) {
      const versatz = plan.spalten - richtig.spalten;
      plan.zeilen.forEach((z, r) => {
        const soll = richtig.zeilen[r]?.zellen ?? [];
        for (const zelle of z.zellen) {
          if (zelle.rolle === "uebertrag") continue;
          const gegen = soll.find((x) => x.c + versatz === zelle.c && x.rolle !== "uebertrag");
          if (gegen?.t !== zelle.t) unterschiede.add(`${r}-${zelle.c}`);
        }
        if (z.ergebnis && art !== "geteilt") korrektur = soll.flatMap((x) => (x.rolle === "uebertrag" || z.zellen.some((y) => y.c === x.c + versatz && y.t === x.t && y.rolle !== "uebertrag") ? [] : [{ c: x.c + versatz, t: x.t }]));
      });
    }
    const hatKorrektur = fehlerhaft && art !== "geteilt";
    const zeilenzahl = plan.zeilen.length + (hatKorrektur ? 1 : 0), breite = plan.spalten * k, hoehe = zeilenzahl * k;
    let gitter = "";
    for (let i = 0; i <= plan.spalten; i++) gitter += `M${r1(i * k)} 0V${r1(hoehe)}`;
    for (let i = 0; i <= zeilenzahl; i++) gitter += `M0 ${r1(i * k)}H${r1(breite)}`;
    let s = `<path class="karo" d="${gitter}" stroke="#808080" stroke-width="0.5"/>`;
    const uebertragFarbe = istSw() ? SCHWARZ : "var(--dunkel)";
    plan.zeilen.forEach((z, r) => {
      for (const zelle of z.zellen) {
        const zeigen = sichtbar(zelle.rolle), x = zelle.c * k, y = r * k;
        s += `<g class="stelle" data-r="${r}" data-c="${zelle.c}" data-rolle="${zelle.rolle}" data-wert="${zelle.t}">`;
        if (zeigen && zelle.rolle === "uebertrag") {
          s += text(x + k / 2, y + k * 0.62, zelle.t, { groesse: klein, farbe: uebertragFarbe });
        } else if (zeigen) {
          s += text(x + k / 2, y + k / 2, zelle.t, { groesse: schrift });
        }
        if (sichtbar("uebertrag") && zelle.durch) s += `<path class="durch" d="M${r1(x + k * 0.2)} ${r1(y + k * 0.8)}L${r1(x + k * 0.8)} ${r1(y + k * 0.2)}" stroke-width="1.2"/>`;
        if (loesungSichtbar(el) && unterschiede.has(`${r}-${zelle.c}`)) s += `<circle class="fehlerkreis" cx="${r1(x + k / 2)}" cy="${r1(y + k / 2)}" r="${r1(k * 0.46)}" fill="none" stroke-width="1.6"/>`;
        s += "</g>";
      }
      if (z.strich) {
        const von = z.strich === "voll" ? 0 : z.strich.von * k, bis = z.strich === "voll" ? breite : (z.strich.bis + 1) * k;
        s += `<path class="ergebnisstrich" d="M${r1(von)} ${r1((r + 1) * k)}H${r1(bis)}" stroke-width="1.8"/>`;
      }
    });
    if (hatKorrektur && loesungSichtbar(el)) {
      for (const zelle of korrektur) {
        s += `<g class="korrektur" data-c="${zelle.c}">${text((zelle.c + 0.5) * k, (plan.zeilen.length + 0.5) * k, zelle.t, { groesse: schrift, fett: true })}</g>`;
      }
    }
    let unten = hoehe, weit = breite;
    const zeichen = RECHENZEICHEN[art], aufgabe = zahlen.map((z) => zahl(z)).join(zeichen);
    const rest = art === "geteilt" ? zahlen[0] % zahlen[1] : 0;
    const richtigText = `${aufgabe} = ${zahl(wert)}${rest > 0 ? ` R ${rest}` : ""}`;
    if (fehlerhaft) {
      const zeile = `${FEHLER_NAMEN[wahl.art]}. Richtig: ${richtigText}`;
      weit = Math.max(breite, textBreite(zeile, 13) + 2);
      unten = hoehe + 20;
      if (loesungSichtbar(el)) s += text(0, hoehe + 12, zeile, { groesse: 13, anker: "start", fett: true });
      el.setAttribute("data-fehlerart", wahl.art);
      el.setAttribute("data-falsch", plan.text);
    } else {
      el.removeAttribute("data-fehlerart");
      el.removeAttribute("data-falsch");
    }
    el.setAttribute("data-ergebnis", String(wert));
    const gesprochen = [...richtig.sprechweise].filter(Boolean).join("; ");
    meldeInfo(el, `Ergebnis: ${zahl(wert)}${rest > 0 ? ` R ${rest}` : ""}${fehlerhaft ? ` · Eingebaut: ${FEHLER_NAMEN[wahl.art]}` : ""}${gesprochen ? ` · Gesprochen: ${gesprochen}` : ""}`);
    el.innerHTML = svg(r1(weit), r1(unten), s);
  }

  /* == Größen == */
  // Münzen: Durchmesser in mm (EU-Verordnung 729/2014), Scheine: Europa-Serie in mm.
  const MUENZEN = {
    "1ct": { mm: 16.25, wert: 1, metall: "kupfer" }, "2ct": { mm: 18.75, wert: 2, metall: "kupfer" }, "5ct": { mm: 21.25, wert: 5, metall: "kupfer" },
    "10ct": { mm: 19.75, wert: 10, metall: "gold" }, "20ct": { mm: 22.25, wert: 20, metall: "gold" }, "50ct": { mm: 24.25, wert: 50, metall: "gold" },
    "1€": { mm: 23.25, wert: 100, metall: "euro1" }, "2€": { mm: 25.75, wert: 200, metall: "euro2" },
  };
  const SCHEINE = {
    "5€": { b: 120, h: 62, wert: 500, farbe: "#c9c9c9" }, "10€": { b: 127, h: 67, wert: 1000, farbe: "#e8a3a3" }, "20€": { b: 133, h: 72, wert: 2000, farbe: "#a9c3e8" },
    "50€": { b: 140, h: 77, wert: 5000, farbe: "#f0c08a" }, "100€": { b: 147, h: 77, wert: 10000, farbe: "#a8d8a8" }, "200€": { b: 153, h: 77, wert: 20000, farbe: "#efe08f" },
  };
  const SCHEIN_HOECHSTENS = 0.75; // EZB/2013/10: deutlich verkleinert, hier höchstens 75 % je Seite
  const METALL_SW = { kupfer: "#bdbdbd", gold: "#e4e4e4", euro1: "#e4e4e4", euro2: "#bdbdbd" };
  const METALL_FARBE = { kupfer: "#c6794a", gold: "#dcb84c", euro1: "#dcb84c", euro2: "#c9c9c9" };
  const KERN_SW = { euro1: "#bdbdbd", euro2: "#e4e4e4" };
  const KERN_FARBE = { euro1: "#c9c9c9", euro2: "#dcb84c" };
  const stueckWert = (name) => (MUENZEN[name] ?? SCHEINE[name])?.wert;

  const betragText = (cent, kl) => {
    const euro = Math.floor(cent / 100), ct = cent % 100;
    if (kl >= 3) return `${zahl(euro)},${String(ct).padStart(2, "0")} €`;
    if (euro === 0) return `${ct} ct`;
    return ct === 0 ? `${zahl(euro)} €` : `${zahl(euro)} € ${ct} ct`;
  };
  /** Wenigste Stücke für den Betrag. Ohne `vorrat` reicht Gierig, das Euro-System ist kanonisch; mit `vorrat` jedes Stück einmal. */
  const mindestStueckelung = (cent, vorrat = []) => {
    if (vorrat.length === 0) {
      const stuecke = [];
      let rest = cent;
      for (const name of Object.keys({ ...SCHEINE, ...MUENZEN }).sort((a, b) => stueckWert(b) - stueckWert(a))) {
        while (rest >= stueckWert(name)) {
          stuecke.push(name);
          rest -= stueckWert(name);
        }
      }
      return stuecke;
    }
    const besser = new Map([[0, []]]);
    for (const name of vorrat) {
      const w = stueckWert(name);
      for (const [summe, stuecke] of [...besser].sort((a, b) => b[0] - a[0])) {
        const neu = summe + w, bisher = besser.get(neu);
        if (neu <= cent && (!bisher || bisher.length > stuecke.length + 1)) besser.set(neu, [...stuecke, name]);
      }
    }
    const treffer = besser.get(cent);
    return treffer ? [...treffer].sort((a, b) => stueckWert(b) - stueckWert(a)) : null;
  };

  const stueckBild = (name, x, y, mass, rueck) => {
    const schein = SCHEINE[name];
    if (schein) {
      const b = schein.b * mass.schein, h = schein.h * mass.schein, wort = name.replace("€", " €");
      return `<g class="stueck" data-stueck="${name}" data-b="${r1(b)}" data-h="${r1(h)}">` +
        `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(b)}" height="${r1(h)}" rx="4" stroke-width="1.6" fill="${istSw() ? "#fff" : schein.farbe}"/>` +
        text(x + b / 2, y + h * 0.42, wort, { groesse: h * 0.36, fett: true }) +
        text(x + b / 2, y + h * 0.82, "Spielgeld", { groesse: Math.max(10, h * 0.15) }) + "</g>";
    }
    const m = MUENZEN[name], d = m.mm * mass.muenze, r = d / 2, cx = x + r, cy = y + r;
    const sw = istSw(), kern = sw ? KERN_SW[m.metall] : KERN_FARBE[m.metall];
    let s = `<g class="stueck" data-stueck="${name}" data-d="${r1(d)}"><circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}" stroke-width="1.4" fill="${sw ? METALL_SW[m.metall] : METALL_FARBE[m.metall]}"/>`;
    if (kern) s += `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r * 0.7)}" stroke-width="0.8" fill="${kern}"/>`;
    if (rueck) {
      for (let i = 0; i < 12; i++) {
        const a = (i * 30 * Math.PI) / 180;
        s += `<circle cx="${r1(cx + r * 0.62 * Math.sin(a))}" cy="${r1(cy - r * 0.62 * Math.cos(a))}" r="${r1(r * 0.07)}" fill="${SCHWARZ}" stroke="none"/>`;
      }
    } else {
      const zahlWort = name.replace(/ct|€/, ""), einheit = name.endsWith("€") ? "€" : "ct";
      s += text(cx, cy - r * 0.14, zahlWort, { groesse: r * 0.92, fett: true }) + text(cx, cy + r * 0.5, einheit, { groesse: Math.max(8, r * 0.46) });
    }
    return s + "</g>";
  };
  const stueckMass = (name, mass) => {
    const schein = SCHEINE[name];
    return schein ? { b: schein.b * mass.schein, h: schein.h * mass.schein } : { b: MUENZEN[name].mm * mass.muenze, h: MUENZEN[name].mm * mass.muenze };
  };
  const legeAus = (namen, mass, rueck, gruppiert, oben = 0) => {
    let x = 0, y = oben, zeile = 0, s = "", vorher = null, weit = 0;
    for (const name of namen) {
      const { b, h } = stueckMass(name, mass), luecke = gruppiert && vorher !== null && vorher !== name ? 16 : 0;
      x += x > 0 ? luecke : 0;
      if (x > 0 && x + b > SATZSPIEGEL - 4) {
        x = 0;
        y += zeile + 8;
        zeile = 0;
      }
      s += stueckBild(name, x + 1, y + 1, mass, rueck);
      x += b + 8;
      weit = Math.max(weit, x);
      zeile = Math.max(zeile, h + 2);
      vorher = name;
    }
    return { s, weit, unten: y + zeile };
  };
  const leseBetrag = (roh) => {
    const m = String(roh).trim().replace("€", "").trim().match(/^(\d+)(?:[.,](\d{1,2}))?$/);
    if (!m) abbruch(`„${roh}“ ist kein Betrag wie 3,45.`);
    return Number(m[1]) * 100 + Number((m[2] ?? "0").padEnd(2, "0"));
  };

  function geld(el) {
    const namen = liste(el, "stuecke"), aufgabe = attr(el, "aufgabe", "keine"), anordnung = attr(el, "anordnung", "reihe");
    const seite = attr(el, "seite", "wert"), massstab = attr(el, "massstab", "0.5"), betragRoh = attr(el, "betrag", null);
    for (const n of namen) if (stueckWert(n) === undefined) abbruch(`Das Stück „${n}“ gibt es nicht.`);
    if (!["keine", "betrag", "legen"].includes(aufgabe)) abbruch(`Die Aufgabe „${aufgabe}“ gibt es nicht.`);
    const original = massstab === "original", faktor = original ? 1 : Number(massstab);
    if (!(faktor >= 0.3 && faktor <= 1)) abbruch("Der Maßstab ist „original“ oder eine Zahl von 0,3 bis 1.");
    if (original) masstab(el);
    else el.removeAttribute("data-masstab");
    const mm = cm(0.1), mass = { muenze: mm * faktor, schein: mm * Math.min(faktor, SCHEIN_HOECHSTENS) };
    const gruppiert = anordnung === "gruppiert", kl = klasse();
    const folge = gruppiert ? [...namen].sort((a, b) => stueckWert(b) - stueckWert(a)) : namen;
    const summe = namen.reduce((t, n) => t + stueckWert(n), 0);
    if (namen.length === 0 && aufgabe !== "legen") abbruch("Es fehlen die Stücke.");
    const flaeche = legeAus(folge, mass, seite === "rueck", gruppiert);
    let s = flaeche.s, weit = flaeche.weit, unten = flaeche.unten;
    if (aufgabe === "betrag") {
      pruefeRaum([Math.ceil(summe / 100)]);
      s += text(0, unten + 22, "Das sind", { groesse: 16, anker: "start" });
      s += antwortfeld(el, 72, unten + 8, 120, 28, betragText(summe, kl), { groesse: 16 });
      unten += 40;
      weit = Math.max(weit, 194);
    }
    if (aufgabe === "legen") {
      if (betragRoh === null) abbruch("Es fehlt der Betrag zum Legen.");
      const cent = leseBetrag(betragRoh);
      pruefeRaum([Math.ceil(cent / 100)]);
      const loesung = mindestStueckelung(cent, namen);
      if (!loesung) abbruch(`Mit diesen Stücken lässt sich ${betragText(cent, kl)} nicht legen.`);
      const anfang = unten + (namen.length > 0 ? 12 : 0);
      s += text(0, anfang + 10, `Lege ${betragText(cent, kl)}.`, { groesse: 16, fett: true, anker: "start" });
      const bild = legeAus(loesung, mass, false, false, anfang + 30);
      const hoehe = bild.unten - anfang - 30 + 12;
      s += `<rect class="legefeld" x="0.5" y="${r1(anfang + 24)}" width="${SATZSPIEGEL - 1}" height="${r1(hoehe)}" rx="6" stroke-width="1.2" stroke-dasharray="6 4"/>`;
      if (loesungSichtbar(el)) s += `<g transform="translate(8 0)">${bild.s}</g>`;
      el.setAttribute("data-stueckelung", loesung.join(" "));
      unten = anfang + 24 + hoehe;
      weit = SATZSPIEGEL;
    } else {
      el.removeAttribute("data-stueckelung");
    }
    if (summe > 0) meldeInfo(el, `Zusammen: ${betragText(summe, kl)}`);
    else meldeInfo(el, null);
    el.innerHTML = svg(r1(weit), r1(unten + 1), s);
  }

  const SKALA_EINHEITEN = { lineal: ["cm", "mm"], massband: ["cm", "m"], messbecher: ["ml", "l"], thermometer: ["°C"], waage: ["g", "kg"] };
  const SKALA_STANDARD = {
    "lineal|cm": [0, 15, "1 0.1"], "lineal|mm": [0, 150, "10 1"], "massband|cm": [0, 100, "10 1"], "massband|m": [0, 5, "1 0.1"],
    "messbecher|ml": [0, 500, "100 20"], "messbecher|l": [0, 2, "1 0.1"], "thermometer|°C": [-20, 40, "10 2"], "waage|g": [0, 1000, "100 20"], "waage|kg": [0, 5, "1 0.1"],
  };
  /** Striche mit exakt gleichen Abständen, aus ganzzahligen Vielfachen statt aufaddiert. */
  const skalaStriche = (von, bis, haupt, klein) => {
    const anzahl = Math.round((bis - von) / klein);
    if (Math.abs(anzahl * klein - (bis - von)) > 1e-6) abbruch("Die Striche passen nicht in die Skala.");
    if (anzahl > 300) abbruch("Diese Teilung hat zu viele Striche.");
    return Array.from({ length: anzahl + 1 }, (_, i) => {
      const wert = Math.round((von + i * klein) * 1e6) / 1e6, q = wert / haupt;
      return { wert, gross: Math.abs(q - Math.round(q)) < 1e-6, anteil: i / anzahl };
    });
  };

  function skala(el) {
    const art = attr(el, "art", "lineal"), einheiten = SKALA_EINHEITEN[art];
    if (!einheiten) abbruch(`Das Messgerät „${art}“ gibt es nicht.`);
    const einheit = attr(el, "einheit", einheiten[0]);
    if (!einheiten.includes(einheit)) abbruch(`${einheit} passt nicht zu diesem Messgerät.`);
    const [v0, b0, t0] = SKALA_STANDARD[`${art}|${einheit}`];
    const von = num(el, "von", v0), bis = num(el, "bis", b0), [haupt, klein] = attr(el, "teilung", t0).trim().split(/\s+/).map(Number);
    if (!(von < bis)) abbruch("„Von“ muss kleiner sein als „bis“.");
    if (!(haupt > 0 && klein > 0)) abbruch("Die Teilung besteht aus Hauptstrich und Zwischenstrich, z. B. 1 0,1.");
    const aufgabe = attr(el, "aufgabe", null), wertRoh = attr(el, "wert", null), loesungRoh = attr(el, "loesung", null);
    const massstab = attr(el, "massstab", art === "lineal" ? "original" : "nein"), groesse = attr(el, "groesse", null);
    if (aufgabe !== null && aufgabe !== "ablesen" && aufgabe !== "einzeichnen") abbruch(`Die Aufgabe „${aufgabe}“ gibt es nicht.`);
    const roh = wertRoh ?? loesungRoh, wert = roh === null ? null : Number(String(roh).replace(",", "."));
    if (wert !== null && !(wert >= von && wert <= bis)) abbruch(`Der Wert muss zwischen ${zahl(von)} und ${zahl(bis)} liegen.`);
    const striche = skalaStriche(von, bis, haupt, klein), anteil = wert === null ? 0 : (wert - von) / (bis - von);
    const zeigeWert = wert !== null && (loesungSichtbar(el) || (wertRoh !== null && aufgabe !== "einzeichnen"));
    const wort = wert === null ? "" : `${zahl(wert)} ${einheit}`, fluessig = istSw() ? "#b5b5b5" : "var(--haupt)", zeiger = istSw() ? SCHWARZ : "var(--haupt)";
    const original = art === "lineal" && massstab === "original";
    if (original) masstab(el);
    else el.removeAttribute("data-masstab");
    let s = "", breite = 0, hoehe = 0;
    if (art === "lineal" || art === "massband") {
      const proEinheit = original ? cm(einheit === "mm" ? 0.1 : 1) : (Number(groesse) || 480) / (bis - von), L = (bis - von) * proEinheit;
      if (L + 24 > SATZSPIEGEL) abbruch("Das passt nicht auf die Seite: Bitte „bis“ kleiner wählen.");
      const x0 = 12, koerper = art === "lineal" ? 46 : 34;
      s += `<rect x="0.8" y="0.8" width="${r1(L + 24)}" height="${koerper}" rx="${art === "lineal" ? 3 : 1}" stroke-width="1.6" fill="${art === "lineal" ? "#fff" : "#f4f4f4"}"/>`;
      for (const st of striche) {
        const x = x0 + st.anteil * L, mitte = !st.gross && Math.abs(((st.wert * 2) / haupt) - Math.round((st.wert * 2) / haupt)) < 1e-6;
        const lang = st.gross ? 18 : mitte ? 12 : 7;
        s += `<line class="strich" data-wert="${st.wert}" x1="${r1(x)}" y1="1" x2="${r1(x)}" y2="${lang + 1}" stroke-width="${st.gross ? 1.5 : 0.7}"/>`;
        if (st.gross) s += text(x, lang + 10, zahl(st.wert), { groesse: 12 });
      }
      breite = L + 26;
      hoehe = koerper + 2;
      if (zeigeWert) {
        const x = x0 + anteil * L;
        s += `<path class="marke" d="M${r1(x)} ${hoehe + 1}l-7 11h14Z" fill="${zeiger}" stroke="none"/>`;
      }
      hoehe += 14;
      if (!original) {
        s += text(breite - 2, hoehe + 8, "nicht zum Messen", { groesse: 11, anker: "end" });
        hoehe += 16;
      }
    } else if (art === "messbecher" || art === "thermometer") {
      const L = Number(groesse) || 190, oben = 14;
      if (art === "messbecher") {
        const b = 86;
        s += `<path d="M1 ${oben - 10}H${b + 1}V${r1(oben + L + 6)}Q${b + 1} ${r1(oben + L + 12)} ${b - 5} ${r1(oben + L + 12)}H7Q1 ${r1(oben + L + 12)} 1 ${r1(oben + L + 6)}Z" stroke-width="2" fill="#fff"/>`;
        if (zeigeWert) s += `<rect class="pegel" x="2" y="${r1(oben + L * (1 - anteil))}" width="${b - 2}" height="${r1(L * anteil + 11)}" fill="${fluessig}" stroke="none" opacity="0.7"/>`;
        for (const st of striche) {
          const y = oben + L * (1 - st.anteil), lang = st.gross ? 26 : 12;
          s += `<line class="strich" data-wert="${st.wert}" x1="${b + 1}" y1="${r1(y)}" x2="${b + 1 - lang}" y2="${r1(y)}" stroke-width="${st.gross ? 1.6 : 0.8}"/>`;
          if (st.gross) s += text(b + 8, y, `${zahl(st.wert)} ${einheit}`, { groesse: 12, anker: "start" });
        }
        breite = b + 70;
      } else {
        const m = 24, roehre = 14, kugel = 15;
        s += `<path d="M${m - roehre / 2} ${r1(oben + L + 6)}V${oben - 4}a${roehre / 2} ${roehre / 2} 0 0 1 ${roehre} 0V${r1(oben + L + 6)}" stroke-width="1.8" fill="#fff"/>`;
        s += `<circle cx="${m}" cy="${r1(oben + L + 6 + kugel - 3)}" r="${kugel}" stroke-width="1.8" fill="${zeigeWert ? fluessig : "#fff"}"/>`;
        if (zeigeWert) s += `<rect class="pegel" x="${m - 4}" y="${r1(oben + L * (1 - anteil))}" width="8" height="${r1(L * anteil + 14)}" fill="${fluessig}" stroke="none"/>`;
        for (const st of striche) {
          const y = oben + L * (1 - st.anteil), lang = st.gross ? 14 : 7;
          s += `<line class="strich" data-wert="${st.wert}" x1="${m + roehre / 2}" y1="${r1(y)}" x2="${m + roehre / 2 + lang}" y2="${r1(y)}" stroke-width="${st.gross ? 1.6 : 0.8}"/>`;
          if (st.gross) s += text(m + roehre / 2 + lang + 4, y, `${zahl(st.wert)} °C`, { groesse: 12, anker: "start" });
        }
        breite = m + 80;
      }
      hoehe = oben + L + (art === "messbecher" ? 14 : 36);
    } else {
      const R = (Number(groesse) || 240) / 2, mx = R + 8, my = R + 14, winkel = (t) => Math.PI * 0.84 * (t - 0.5);
      const grosse = striche.filter((st) => st.gross).length, jeder = Math.max(1, Math.ceil((grosse * 34) / (Math.PI * 0.84 * (R - 26))));
      let nr = 0;
      s += `<path d="M${r1(mx - R)} ${r1(my)}A${r1(R)} ${r1(R)} 0 0 1 ${r1(mx + R)} ${r1(my)}Z" stroke-width="2" fill="#fff"/>`;
      for (const st of striche) {
        const a = winkel(st.anteil), lang = st.gross ? 16 : 8, sin = Math.sin(a), cos = Math.cos(a);
        s += `<line class="strich" data-wert="${st.wert}" x1="${r1(mx + R * sin)}" y1="${r1(my - R * cos)}" x2="${r1(mx + (R - lang) * sin)}" y2="${r1(my - (R - lang) * cos)}" stroke-width="${st.gross ? 1.6 : 0.8}"/>`;
        if (st.gross && nr++ % jeder === 0) s += text(mx + (R - lang - 13) * sin, my - (R - lang - 13) * cos, zahl(st.wert), { groesse: 11 });
      }
      s += text(mx + R * 0.42, my - 12, einheit, { groesse: 14, fett: true });
      if (zeigeWert) {
        const a = winkel(anteil);
        s += `<line class="marke" x1="${r1(mx)}" y1="${r1(my)}" x2="${r1(mx + (R - 6) * Math.sin(a))}" y2="${r1(my - (R - 6) * Math.cos(a))}" stroke-width="3" stroke-linecap="round" style="stroke:${zeiger}"/>`;
      }
      s += `<circle cx="${r1(mx)}" cy="${r1(my)}" r="5" fill="${SCHWARZ}" stroke="none"/>`;
      breite = R * 2 + 16;
      hoehe = my + 8;
    }
    if (aufgabe === "ablesen") {
      s += antwortfeld(el, 0, hoehe + 6, 110, 28, wort, { groesse: 15 });
      hoehe += 36;
      breite = Math.max(breite, 112);
    } else if (aufgabe === "einzeichnen" && wert !== null) {
      s += text(0, hoehe + 16, `Zeichne ein: ${wort}`, { groesse: 15, fett: true, anker: "start" });
      hoehe += 26;
      breite = Math.max(breite, textBreite(`Zeichne ein: ${wort}`, 15) + 4);
    }
    el.setAttribute("data-wert", wert === null ? "" : String(wert));
    el.innerHTML = svg(r1(breite), r1(hoehe), s);
  }

  const leseLaenge = (roh) => {
    const m = String(roh).trim().match(/^(\d+(?:[.,]\d+)?)\s*(cm|mm)?$/);
    if (!m) abbruch(`„${roh}“ ist keine Länge wie 7 cm oder 45 mm.`);
    const zahlwert = Number(m[1].replace(",", ".")), einheit = m[2] ?? "cm";
    return { cm: einheit === "mm" ? zahlwert / 10 : zahlwert, wort: `${zahl(zahlwert)} ${einheit}` };
  };
  function strecke(el) {
    const { cm: laenge, wort } = leseLaenge(attr(el, "laenge", "7")), [a, b] = trenneListe(attr(el, "beschriftung", "")), richtung = attr(el, "richtung", "waagerecht");
    if (richtung !== "waagerecht" && richtung !== "schraeg") abbruch(`Die Richtung „${richtung}“ gibt es nicht.`);
    if (!(laenge > 0)) abbruch("Die Strecke braucht eine Länge.");
    const L = cm(laenge), winkel = richtung === "schraeg" ? Math.PI / 6 : 0, dx = L * Math.cos(winkel), dy = L * Math.sin(winkel), rand = 14;
    if (dx + rand * 2 > SATZSPIEGEL) abbruch("Diese Strecke passt in Originalgröße nicht auf die Seite.");
    masstab(el);
    const x1 = rand, y1 = dy + 18, x2 = x1 + dx, y2 = y1 - dy, nx = Math.sin(winkel) * 7, ny = Math.cos(winkel) * 7;
    let s = `<line class="strecke" data-laenge="${laenge}" x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}" stroke-width="1.6"/>`;
    for (const [x, y] of [[x1, y1], [x2, y2]]) s += `<line x1="${r1(x - nx)}" y1="${r1(y - ny)}" x2="${r1(x + nx)}" y2="${r1(y + ny)}" stroke-width="1.6"/>`;
    if (a) s += text(x1, y1 + 16, a, { groesse: 14, fett: true });
    if (b) s += text(x2, y2 + 16, b, { groesse: 14, fett: true });
    const unten = y1 + 28;
    s += antwortfeld(el, 0, unten, 90, 28, wort, { groesse: 15 });
    el.innerHTML = svg(r1(Math.max(dx + rand * 2, 92)), r1(unten + 30), s);
  }

  const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  /** `start`: Spalte des 1. Tags, Montag ist 0. Eigene Rechnung, damit keine Zeitzone hineinspielt. */
  const kalenderMonat = (jahr, monat) => {
    const schalt = (jahr % 4 === 0 && jahr % 100 !== 0) || jahr % 400 === 0;
    const tage = [31, schalt ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][monat - 1];
    const v = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4][monat - 1], j = monat < 3 ? jahr - 1 : jahr;
    const sonntag0 = (j + Math.floor(j / 4) - Math.floor(j / 100) + Math.floor(j / 400) + v + 1) % 7;
    return { tage, start: (sonntag0 + 6) % 7 };
  };
  const isoWoche = (jahr, monat, tag) => {
    const d = new Date(Date.UTC(jahr, monat - 1, tag)), wt = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - wt + 3);
    const erster = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    return 1 + Math.round(((d - erster) / 86400000 - 3 + ((erster.getUTCDay() + 6) % 7)) / 7);
  };
  const monatsbild = (el, jahr, monat, ox, oy, z, h, { markiert, luecken, mitKw, praefix, schrift }) => {
    const { tage, start } = kalenderMonat(jahr, monat), links = mitKw ? z : 0;
    let s = text(ox + links + (7 * z) / 2, oy + h / 2, `${MONATE[monat - 1]} ${jahr}`, { groesse: schrift + 2, fett: true });
    ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].forEach((w, i) => {
      s += text(ox + links + (i + 0.5) * z, oy + h * 1.5, w, { groesse: schrift, fett: true });
    });
    if (mitKw) s += text(ox + z / 2, oy + h * 1.5, "KW", { groesse: schrift - 1 });
    const zellen = [];
    for (let t = 1; t <= tage; t++) {
      const pos = start + t - 1, wt = pos % 7, woche = Math.floor(pos / 7), x = ox + links + wt * z, y = oy + (woche + 2) * h, id = `${praefix}${t}`;
      const offen = luecken.has(id), zeige = !offen || loesungSichtbar(el);
      zellen.push({ id, x: wt, y: woche, text: String(t) });
      s += `<g class="kal-tag" data-tag="${t}" data-wt="${wt}" data-woche="${woche}" data-offen="${offen ? "ja" : "nein"}">`;
      s += `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(z)}" height="${r1(h)}" stroke-width="0.8" fill="${wt >= 5 ? "#E0E0E0" : "#fff"}"/>`;
      if (zeige) s += text(x + z / 2, y + h / 2, String(t), { groesse: schrift });
      if (markiert.has(id)) s += `<circle class="kal-ring" cx="${r1(x + z / 2)}" cy="${r1(y + h / 2)}" r="${r1(Math.min(z, h) * 0.42)}" fill="none" stroke-width="1.8"${istSw() ? "" : ' style="stroke:var(--haupt)"'}/>`;
      s += "</g>";
      if (mitKw && (wt === 0 || t === 1)) s += text(ox + z / 2, y + h / 2, String(isoWoche(jahr, monat, t)), { groesse: schrift - 1, farbe: GRAU });
    }
    const wochen = Math.ceil((start + tage) / 7);
    return { s, zellen, breite: links + 7 * z, hoehe: (wochen + 2) * h };
  };
  function kalender(el) {
    const art = attr(el, "art", "monat"), monat = num(el, "monat", 1), jahr = num(el, "jahr", 2026), mitKw = attr(el, "kw", "nein") === "ja";
    const markiert = new Set(liste(el, "markiert")), luecken = new Set(liste(el, "luecken"));
    if (art !== "monat" && art !== "jahr") abbruch(`Die Art „${art}“ gibt es nicht.`);
    if (!Number.isInteger(jahr) || jahr < 1900 || jahr > 2100) abbruch("Das Jahr liegt zwischen 1900 und 2100.");
    if (art === "monat") {
      if (!Number.isInteger(monat) || monat < 1 || monat > 12) abbruch("Der Monat ist 1 bis 12.");
      const bild = monatsbild(el, jahr, monat, 0.5, 0.5, 44, 34, { markiert, luecken, mitKw, praefix: "", schrift: 15 });
      meldeZellen(el, "markiert", bild.zellen);
      meldeZellen(el, "luecken", bild.zellen);
      el.innerHTML = svg(r1(bild.breite + 1), r1(bild.hoehe + 1), bild.s);
      return;
    }
    meldeZellen(el, "markiert", []);
    meldeZellen(el, "luecken", []);
    const z = mitKw ? 22 : 25, h = 20, abstand = 14, proZeile = 3;
    let s = "", breite = 0, hoehe = 0;
    for (let m = 1; m <= 12; m++) {
      const spalte = (m - 1) % proZeile, zeile = Math.floor((m - 1) / proZeile), weit = (mitKw ? 8 : 7) * z;
      const bild = monatsbild(el, jahr, m, 0.5 + spalte * (weit + abstand), 0.5 + zeile * (8 * h + abstand), z, h, { markiert, luecken, mitKw, praefix: `${m}-`, schrift: 11 });
      s += `<g class="kal-monat" data-monat="${m}">${bild.s}</g>`;
      breite = Math.max(breite, (spalte + 1) * (weit + abstand));
      hoehe = Math.max(hoehe, (zeile + 1) * (8 * h + abstand));
    }
    el.innerHTML = svg(r1(breite), r1(hoehe), s);
  }

  const leseZeit = (roh) => {
    const m = String(roh).trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m || Number(m[1]) > 24 || Number(m[2]) > 59) abbruch(`„${roh}“ ist keine Uhrzeit wie 8:20.`);
    return Number(m[1]) * 60 + Number(m[2]);
  };
  const zeitText = (min) => `${Math.floor(min / 60) % 24}:${String(min % 60).padStart(2, "0")}`;
  const dauerText = (min) => {
    const h = Math.floor(min / 60), m = min % 60;
    return [h > 0 ? `${h} h` : "", m > 0 || h === 0 ? `${m} min` : ""].filter(Boolean).join(" ");
  };
  /** Stationen der Zeitspanne: automatisch zur vollen Stunde, dann die ganzen Stunden, dann der Rest. */
  const zeitStationen = (von, bis, spruenge) => {
    const orte = [von];
    if (spruenge) {
      for (const teil of spruenge.split(",").map((t) => t.trim()).filter(Boolean)) {
        const letzter = orte[orte.length - 1], bisZeit = teil.match(/^bis\s+(\d{1,2}:\d{2})$/), plus = teil.match(/^\+\s*(\d+)\s*(min|h)$/);
        if (bisZeit) {
          let ziel = leseZeit(bisZeit[1]);
          while (ziel < letzter) ziel += 1440;
          orte.push(ziel);
        } else if (plus) orte.push(letzter + Number(plus[1]) * (plus[2] === "h" ? 60 : 1));
        else abbruch(`„${teil}“ ist kein Sprung wie „bis 9:00“ oder „+40 min“.`);
      }
      if (orte[orte.length - 1] !== bis) abbruch(`Die Sprünge enden bei ${zeitText(orte[orte.length - 1])}, nicht bei ${zeitText(bis)}.`);
      return orte;
    }
    const naechste = Math.ceil(von / 60) * 60;
    if (naechste > von && naechste < bis) orte.push(naechste);
    const letzteVolle = Math.floor(bis / 60) * 60;
    if (letzteVolle > orte[orte.length - 1] && letzteVolle < bis) orte.push(letzteVolle);
    if (orte[orte.length - 1] !== bis) orte.push(bis);
    return orte;
  };
  function zeitspanne(el) {
    const vonRoh = attr(el, "von", "8:20"), bisRoh = attr(el, "bis", "9:45"), spruenge = attr(el, "spruenge", null), zeige = leseOffen(attr(el, "zeige", null), ["von", "bis"]);
    const von = leseZeit(vonRoh);
    let bis = leseZeit(bisRoh);
    if (bis <= von) {
      if (klasse() <= 2) abbruch("In Klasse 1 und 2 geht die Zeitspanne nicht über Mitternacht.");
      bis += 1440;
    }
    if (bis - von > 1440) abbruch("Die Zeitspanne ist höchstens 24 Stunden lang.");
    const orte = zeitStationen(von, bis, spruenge), schritt = Math.min(130, (SATZSPIEGEL - 80) / (orte.length - 1)), b = 62, h = 28, oben = 44;
    let s = `<line x1="${b / 2}" y1="${oben + 6}" x2="${r1(b / 2 + schritt * (orte.length - 1))}" y2="${oben + 6}" stroke-width="2"/>`;
    orte.forEach((ort, i) => {
      const x = b / 2 + i * schritt, rolle = i === 0 ? "von" : i === orte.length - 1 ? "bis" : "spruenge";
      s += `<line x1="${r1(x)}" y1="${oben}" x2="${r1(x)}" y2="${oben + 12}" stroke-width="2"/>`;
      s += rechenfeld(el, `o${i}`, x - b / 2, oben + 16, b, h, ort, !zeige.has(rolle), 15, { inhaltText: zeitText(ort) });
      if (i === 0) return;
      const x0 = x - schritt, mitte = x0 + schritt / 2, wortS = `+${dauerText(ort - orte[i - 1])}`;
      s += `<path d="M${r1(x0)} ${oben}Q${r1(mitte)} ${oben - 26} ${r1(x)} ${oben}" stroke-width="1.6"/>`;
      s += `<g class="sprung" data-wert="${wortS}" data-offen="${zeige.has("spruenge") ? "nein" : "ja"}">`;
      if (zeige.has("spruenge") || loesungSichtbar(el)) s += text(mitte, oben - 22, wortS, { groesse: 13, fett: !zeige.has("spruenge") });
      s += "</g>";
    });
    const unten = oben + 16 + h + 8;
    s += text(0, unten + 14, "Dauer:", { groesse: 16, anker: "start" });
    s += rechenfeld(el, "dauer", 56, unten, 110, 28, bis - von, !zeige.has("dauer"), 15, { inhaltText: dauerText(bis - von) });
    meldeInfo(el, `Dauer: ${dauerText(bis - von)}`);
    el.innerHTML = svg(r1(Math.max(b + schritt * (orte.length - 1), 170)), r1(unten + 30), s);
  }

  /* == Deutsch == */
  const ANDIKA_X_HOEHE = 0.5; // gemessen an Andika-Regular.woff2: „x“ bei 1000 px Schrift 500 px hoch
  /** Maße in mm. `oben`/`unten`: Abstand der Hilfslinien über und unter dem Mittelband; `abstand`: bis zur nächsten Zeile. */
  const LINEATUREN = {
    1: { band: 5, oben: 5, unten: 5, abstand: 7 }, 2: { band: 4, oben: 4, unten: 4, abstand: 6 },
    3: { band: 3.5, oben: 0, unten: 0, abstand: 5.5 }, 4: { band: 0, oben: 0, unten: 0, abstand: 9, schrift: 3.5 },
  };
  const KARO = { karo: 10, "karo-klein": 5 };
  const lineaturMass = (art, band) => {
    const l = LINEATUREN[art];
    const faktor = band !== null && l.band > 0 ? band / l.band : 1;
    const mittel = band !== null && l.band > 0 ? band : l.band, oben = l.oben * faktor, unten = l.unten * faktor;
    return { band: mittel, oben, unten, abstand: l.abstand, hoehe: oben + mittel + unten, schrift: (mittel || band || l.schrift) / ANDIKA_X_HOEHE };
  };
  const satzZeilen = (wort, breite, groesse) => {
    const zeilen = [];
    let zeile = "";
    for (const w of wort.trim().split(/\s+/)) {
      const neu = zeile ? `${zeile} ${w}` : w;
      if (zeile && textBreite(neu, groesse) > breite) {
        zeilen.push(zeile);
        zeile = w;
      } else zeile = neu;
    }
    if (zeile) zeilen.push(zeile);
    return zeilen;
  };

  function lineatur(el) {
    const art = attr(el, "art", "1"), zeilen = num(el, "zeilen", 3), vorlage = attr(el, "vorlage", null), anfang = attr(el, "anfang", null);
    const vorlageZeilen = num(el, "vorlage-zeilen", 1), mittelband = attr(el, "mittelband", "linie"), band = attr(el, "band", null), loesung = attr(el, "loesung", null);
    if (!LINEATUREN[art] && !KARO[art]) abbruch(`Die Lineatur „${art}“ gibt es nicht.`);
    if (!Number.isInteger(zeilen) || zeilen < 1 || zeilen > 30) abbruch("Es sind 1 bis 30 Zeilen.");
    if (mittelband !== "linie" && mittelband !== "getoent") abbruch(`Das Mittelband „${mittelband}“ gibt es nicht.`);
    const bandMm = band === null ? null : Number(String(band).replace(",", "."));
    if (bandMm !== null && !(bandMm >= 2 && bandMm <= 10)) abbruch("Das Mittelband misst 2 bis 10 mm.");
    const spalte = el.parentElement?.clientWidth || SATZSPIEGEL, breite = Math.min(num(el, "breite", spalte), SATZSPIEGEL);
    masstab(el);
    const mm = cm(0.1);
    let s = "", hoehe = 0;
    const satz = (x, y, wort, groesse, farbe, klasse2) => `<g class="${klasse2}">${text(x, y, wort, { groesse, anker: "start", grundlinie: "alphabetic", farbe })}</g>`;
    if (KARO[art]) {
      const k = (bandMm ?? KARO[art]) * mm, spalten = Math.floor((breite - 1) / k);
      hoehe = zeilen * k;
      let gitter = "";
      for (let i = 0; i <= spalten; i++) gitter += `M${r1(i * k + 0.5)} 0.5V${r1(hoehe + 0.5)}`;
      for (let i = 0; i <= zeilen; i++) gitter += `M0.5 ${r1(i * k + 0.5)}H${r1(spalten * k + 0.5)}`;
      s += `<path class="karo" d="${gitter}" stroke="#808080" stroke-width="0.6"/>`;
      const zeichen = (wort, zeile, farbe, klasse2) => {
        const teile = [...wort];
        if (teile.length > spalten) abbruch("Der Text ist zu lang für eine Zeile.");
        return teile.map((t, i) => (t === " " ? "" : `<g class="${klasse2}">${text((i + 0.5) * k + 0.5, (zeile + 0.5) * k + 0.5, t, { groesse: k * 0.72, farbe })}</g>`)).join("");
      };
      let frei = 0;
      if (vorlage !== null) for (; frei < Math.min(vorlageZeilen, zeilen); frei++) s += zeichen(vorlage, frei, "#808080", "vorlage");
      if (anfang !== null) for (let z = frei; z < zeilen; z++) s += zeichen(anfang, z, SCHWARZ, "anfang");
      if (loesung !== null && loesungSichtbar(el)) s += zeichen(loesung, frei, SCHWARZ, "loesungstext");
    } else {
      const m = lineaturMass(art, bandMm), teilung = (m.hoehe + m.abstand) * mm, groesse = m.schrift * mm, randOben = m.oben > 0 ? 0.75 : Math.max(groesse * 0.8 - m.band * mm, 0) + 1;
      hoehe = zeilen * teilung - m.abstand * mm + randOben + (m.unten > 0 ? 0.75 : groesse * 0.25);
      const grund = (z) => randOben + z * teilung + (m.oben + m.band) * mm, x0 = 0, x1 = breite - 1;
      const rest = breite - 8;
      if (vorlage !== null && textBreite(vorlage, groesse) + (anfang ? textBreite(anfang, groesse) + 16 : 0) > rest) abbruch("Der Text ist zu lang für eine Zeile.");
      for (let z = 0; z < zeilen; z++) {
        const y = grund(z), linie = (lage, stark, name) => `<line class="linie" data-art="${name}" data-z="${z}" data-y="${r1(lage)}" x1="${x0}" y1="${r1(lage)}" x2="${r1(x1)}" y2="${r1(lage)}" stroke-width="${stark ? 1.5 : 1}" style="stroke:${stark ? SCHWARZ : "#808080"}"/>`;
        if (m.band > 0 && mittelband === "getoent" && !istSw()) s += `<rect class="getoent" x="${x0}" y="${r1(y - m.band * mm)}" width="${r1(x1)}" height="${r1(m.band * mm)}" fill="color-mix(in srgb,var(--haupt) 18%,#fff)" stroke="none"/>`;
        if (m.oben > 0) s += linie(y - (m.band + m.oben) * mm, false, "oben");
        if (m.band > 0) s += linie(y - m.band * mm, false, "mitte");
        s += linie(y, true, "grund");
        if (m.unten > 0) s += linie(y + m.unten * mm, false, "unten");
        let x = 2;
        if (anfang !== null) {
          s += satz(x, y, anfang, groesse, SCHWARZ, "anfang");
          x += textBreite(anfang, groesse) + 16;
        }
        if (vorlage !== null && z < vorlageZeilen) s += satz(x, y, vorlage, groesse, "#808080", "vorlage");
      }
      if (loesung !== null && loesungSichtbar(el)) {
        const erste = vorlage !== null ? Math.min(vorlageZeilen, zeilen) : 0;
        const teile = satzZeilen(loesung, rest, groesse);
        if (teile.length > zeilen - erste) abbruch("Die Lösung passt nicht in die Zeilen.");
        teile.forEach((t, i) => {
          s += satz(2, grund(erste + i), t, groesse, SCHWARZ, "loesungstext");
        });
      } else if (loesung !== null) {
        const erste = vorlage !== null ? Math.min(vorlageZeilen, zeilen) : 0;
        if (satzZeilen(loesung, rest, groesse).length > zeilen - erste) abbruch("Die Lösung passt nicht in die Zeilen.");
      }
    }
    el.innerHTML = svg(r1(breite), r1(hoehe + 1), s);
  }

  const SILBEN_FARBEN = { blau: "#1f4fb8", rot: "#b3261e", gruen: "#1b6e34", lila: "#6a2c91", braun: "#7a4a12", schwarz: "#1D1D1B" };
  const pruefeSilben = (wort) => {
    if (/\|\|/.test(wort)) abbruch("Zwei Silbenstriche stehen direkt nebeneinander.");
    if (/(^|[\s„"'(])\||\|($|[\s.,;:!?“"')])/.test(wort)) abbruch("Ein Silbenstrich steht am Anfang oder Ende eines Worts.");
    if (!/^[\p{L}\s|.,;:!?„“"'()\-–…]*$/u.test(wort)) abbruch("Erlaubt sind Buchstaben, Satzzeichen, Leerzeichen und der Silbenstrich.");
  };
  /** Zerlegt in Teile: Wörter mit ihren Silben, dazwischen Satzzeichen und Leerraum. */
  const silbenTeile = (wort) => (wort.match(/[\p{L}|\-]+|[^\p{L}|\-]+/gu) ?? []).map((t) => (/\p{L}/u.test(t) ? { silben: t.split("|") } : { text: t }));

  function silben(el) {
    const wort = inhalt(el), darstellung = attr(el, "darstellung", "boegen"), farben = trenneListe(attr(el, "farben", "blau rot")), aufgabe = attr(el, "aufgabe", "keine");
    if (!["boegen", "farbe", "beides"].includes(darstellung)) abbruch(`Die Darstellung „${darstellung}“ gibt es nicht.`);
    if (!["keine", "boegen", "trennen"].includes(aufgabe)) abbruch(`Die Aufgabe „${aufgabe}“ gibt es nicht.`);
    if (farben.length !== 2 || farben.some((f) => !SILBEN_FARBEN[f])) abbruch(`Zwei Farben aus: ${Object.keys(SILBEN_FARBEN).join(", ")}.`);
    pruefeSilben(wort);
    const sw = istSw(), loesung = loesungSichtbar(el);
    const mitBogen = aufgabe === "boegen" ? loesung : aufgabe === "keine" && (sw || darstellung !== "farbe");
    const mitFarbe = aufgabe === "keine" && !sw && darstellung !== "boegen";
    const mitStrich = aufgabe === "trennen" && loesung;
    const bogen = '<svg class="bogen" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true"><path d="M3 2Q50 34 97 2" fill="none" stroke="currentColor" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>';
    const html = silbenTeile(wort).map((t) => {
      if (t.text !== undefined) return maskiere(t.text);
      const stuecke = t.silben.map((silbe, i) => {
        const farbe = mitFarbe ? ` style="color:${SILBEN_FARBEN[farben[i % 2]]}"` : "";
        return `<span class="silbe${mitBogen ? " mit-bogen" : ""}" data-farbe="${mitFarbe ? farben[i % 2] : ""}"${farbe}>${maskiere(silbe)}${mitBogen ? bogen : ""}</span>`;
      });
      return `<span class="wort">${stuecke.join(mitStrich ? '<span class="silbenstrich">|</span>' : "")}</span>`;
    }).join("");
    el.innerHTML = html;
  }

  /* Sprache untersuchen (032) */
  const WORTARTEN = {
    N: { name: "Nomen", farbe: "#1D1D1B", symbol: '<path d="M2 19L12 1L22 19Z"/>', voll: true, linie: "solid 2px" },
    Art: { name: "Artikel", farbe: "#4FA3E0", symbol: '<path d="M8 19L12 11L16 19Z"/>', voll: true, linie: "dotted 2px" },
    V: { name: "Verb", farbe: "#D0281E", symbol: '<circle cx="12" cy="10" r="9"/>', voll: true, linie: "wavy 1.5px" },
    A: { name: "Adjektiv", farbe: "#1F3F9E", symbol: '<path d="M5 19L12 7L19 19Z"/>', voll: false, linie: "dashed 2px" },
    P: { name: "Pronomen", farbe: "#7A3E9D", symbol: '<path d="M9 19L12 1L15 19Z"/>', voll: false, linie: "double 3px" },
    Pr: { name: "Präposition", farbe: "#2E8B3E", symbol: '<path d="M3 17Q12 -3 21 17" fill="none"/>', voll: false, linie: "dashed 3.5px" },
    K: { name: "Konjunktion", farbe: "#D9608F", symbol: '<rect x="2" y="13" width="20" height="5"/>', voll: false, linie: "solid 4px" },
    Adv: { name: "Adverb", farbe: "#E8871E", symbol: '<circle cx="12" cy="14" r="5"/>', voll: false, linie: "dotted 3.5px" },
  };
  const WORT_FARBEN = { ...SILBEN_FARBEN, hellblau: "#4FA3E0", rosa: "#D9608F", orange: "#E8871E" };
  const wortartenTeile = (satz) => [...satz.matchAll(/([\p{L}\p{N}-]+)(?:\/(\p{L}*))?|[^\p{L}\p{N}-]+/gu)].map((m) => (m[1] ? { wort: m[1], marke: m[2] ?? null } : { text: m[0] }));
  const pruefeWortarten = (satz) => {
    for (const t of wortartenTeile(satz)) {
      if (t.marke !== undefined && t.marke !== null && !WORTARTEN[t.marke]) abbruch(`Das Kürzel „${t.marke}“ gibt es nicht. Erlaubt: ${Object.keys(WORTARTEN).join(", ")}.`);
    }
  };
  const wortartSymbol = (w, farbe) => {
    const f = w.voll ? farbe : "none";
    return `<svg class="wa-symbol" viewBox="0 0 24 20" aria-hidden="true" fill="${f}" stroke="${farbe}" stroke-width="2" stroke-linejoin="round">${w.symbol}</svg>`;
  };

  function wortarten(el) {
    const satz = inhalt(el), darstellung = attr(el, "darstellung", "symbole"), aufgabe = attr(el, "aufgabe", "keine"), nur = liste(el, "nur"), eigene = paare(el, "farben");
    if (!["symbole", "unterstreichen"].includes(darstellung)) abbruch(`Die Darstellung „${darstellung}“ gibt es nicht.`);
    if (!["keine", "bestimmen"].includes(aufgabe)) abbruch(`Die Aufgabe „${aufgabe}“ gibt es nicht.`);
    pruefeWortarten(satz);
    for (const k of nur) if (!WORTARTEN[k]) abbruch(`Das Kürzel „${k}“ gibt es nicht.`);
    const farben = {};
    for (const { name: k, wert: f } of eigene) {
      if (!WORTARTEN[k]) abbruch(`Das Kürzel „${k}“ gibt es nicht.`);
      if (!WORT_FARBEN[f]) abbruch(`Die Farbe „${f}“ gibt es nicht. Erlaubt: ${Object.keys(WORT_FARBEN).join(", ")}.`);
      farben[k] = WORT_FARBEN[f];
    }
    const sw = istSw(), sichtbar = aufgabe === "keine" || loesungSichtbar(el);
    const html = wortartenTeile(satz).map((t) => {
      if (t.text !== undefined) return maskiere(t.text);
      const w = t.marke && (nur.length === 0 || nur.includes(t.marke)) ? WORTARTEN[t.marke] : null;
      const wort = maskiere(t.wort);
      if (!w) return `<span class="wortart"><span class="wa-text">${wort}</span></span>`;
      const farbe = sw ? SCHWARZ : farben[t.marke] ?? w.farbe;
      if (darstellung === "unterstreichen") {
        const [stil, dicke] = w.linie.split(" ");
        const strich = sichtbar ? ` style="text-decoration:underline ${stil} ${farbe};text-decoration-thickness:${dicke}"` : "";
        return `<span class="wortart" data-wortart="${t.marke}"><span class="wa-text wa-linie"${strich}>${wort}</span></span>`;
      }
      const platz = sichtbar ? wortartSymbol(w, farbe) : '<svg class="wa-symbol wa-leer" viewBox="0 0 24 20" aria-hidden="true"><rect x="1" y="1" width="22" height="18" fill="none" stroke="#808080" stroke-width="1.5" stroke-dasharray="3 3"/></svg>';
      return `<span class="wortart" data-wortart="${t.marke}"><span class="wa-text">${wort}</span>${platz}</span>`;
    }).join("");
    el.innerHTML = html;
  }

  const ROLLEN = {
    S: { name: "Subjekt", frage: "Wer oder was?" },
    P: { name: "Prädikat", frage: "Was tut jemand?" },
    AkO: { name: "Akkusativobjekt", frage: "Wen oder was?" },
    DaO: { name: "Dativobjekt", frage: "Wem?" },
    Ort: { name: "Ortsangabe", frage: "Wo?" },
    Zeit: { name: "Zeitangabe", frage: "Wann?" },
  };
  const satzLesen = (satz) => {
    const glieder = [];
    let zeichen = "";
    const rest = satz.replace(/\[([^\[\]]*)\](\p{L}*)|([^\[\]]+)/gu, (_, klammer, rolle, frei) => {
      if (klammer !== undefined) {
        if (rolle && !ROLLEN[rolle]) abbruch(`Das Satzglied „${rolle}“ gibt es nicht. Erlaubt: ${Object.keys(ROLLEN).join(", ")}.`);
        glieder.push({ text: klammer.trim(), rolle: rolle || null });
      } else if (/[\p{L}\p{N}]/u.test(frei)) {
        const ende = frei.trim().match(/[.!?]+$/)?.[0] ?? "";
        glieder.push({ text: frei.trim().slice(0, frei.trim().length - ende.length), rolle: null });
        zeichen = ende;
      } else if (frei.trim()) {
        zeichen = frei.trim();
      }
      return "";
    });
    if (rest.trim()) abbruch("Eine eckige Klammer ist nicht geschlossen.");
    if (!glieder.some((g) => g.rolle === "P")) abbruch("Jeder Satz braucht ein Prädikat.");
    if (glieder.filter((g) => g.rolle === "P").length > 2) abbruch("Das Prädikat hat höchstens zwei Teile.");
    return { glieder, zeichen };
  };
  // Mitten im Satz klein: alles außer Nomen und Namen. Die Liste ist geschlossen genug für Grundschulsätze.
  const KLEIN_AM_ANFANG = new Set("der die das den dem des ein eine einen einem einer eines kein keine keinen keinem keiner mein meine meinen meinem meiner dein deine deinen deinem deiner sein seine seinen seinem seiner ihr ihre ihren ihrem ihrer unser unsere unseren unserem unserer euer eure euren eurem eurer ich du er sie es wir mir dir ihm ihnen uns euch mich dich ihn wer jeder jede jedes alle viele einige manche dieser diese dieses diesen diesem heute gestern morgen vorgestern übermorgen jetzt nun dann bald später früher oft immer manchmal nie abends morgens mittags nachts dort hier da draußen drinnen oben unten vorn hinten im am in an auf unter über vor hinter neben zwischen bei beim mit nach zu zum zur vom von aus durch für um ohne gegen seit zwei drei vier fünf sechs sieben acht neun zehn".split(" "));
  const ANREDE = new Set(["Herr", "Frau", "Tante", "Onkel", "Oma", "Opa", "Mama", "Papa"]);
  const kleinImSatz = (t) => {
    const [erstes, ...rest] = t.split(/\s+/);
    if (KLEIN_AM_ANFANG.has(erstes.toLowerCase())) return erstes.charAt(0).toLowerCase() + t.slice(1);
    const beifuegung = rest.length > 0 && !["und", "oder"].includes(rest[0]) && !ANREDE.has(erstes) && /(e|en|er|es|em)$/.test(erstes) && /^\p{Lu}/u.test(rest.at(-1));
    return beifuegung ? erstes.charAt(0).toLowerCase() + t.slice(1) : t;
  };
  const grossAmAnfang = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const satzUmstellen = (satz, vorn = null) => {
    const { glieder, zeichen } = satzLesen(satz);
    if (zeichen.includes("?")) abbruch("Fragen lassen sich hier nicht umstellen.");
    if (glieder.some((g) => !g.rolle)) abbruch("Zum Umstellen braucht jedes Wort ein Satzglied.");
    if (glieder[1]?.rolle !== "P") abbruch("Zum Umstellen steht das Prädikat an zweiter Stelle.");
    const [gebeugt, ...klammer] = glieder.filter((g) => g.rolle === "P");
    const andere = glieder.filter((g) => g.rolle !== "P"), erstes = glieder[0];
    const wahl = andere.find((g) => g !== erstes && (vorn === null || g.rolle === vorn));
    if (!wahl) abbruch(vorn === null ? "Zum Umstellen braucht der Satz noch ein Satzglied." : `Das Satzglied „${vorn}“ lässt sich nicht nach vorn stellen.`);
    const neu = [wahl, gebeugt, ...andere.filter((g) => g !== wahl), ...klammer];
    return { glieder: neu.map((g, i) => ({ rolle: g.rolle, text: i === 0 ? grossAmAnfang(g.text) : g === erstes ? kleinImSatz(g.text) : g.text })), zeichen };
  };

  function satzglieder(el) {
    const satz = inhalt(el), aufgabe = attr(el, "aufgabe", "keine"), ausschneiden = attr(el, "ausschneiden", "nein") === "ja", vorn = attr(el, "vorn", null);
    if (!["keine", "bestimmen", "umstellen", "fragen"].includes(aufgabe)) abbruch(`Die Aufgabe „${aufgabe}“ gibt es nicht.`);
    const { glieder, zeichen } = satzLesen(satz);
    const loesung = loesungSichtbar(el);
    const kasten = (g, oben, leer) => {
      const art = [g.rolle === "P" ? "praedikat" : "", g.rolle ? "" : "ohne-rolle", leer ? "leer" : "", ausschneiden ? "schnitt" : ""].filter(Boolean).join(" ");
      const kopf = oben === null ? "" : `<span class="sg-rolle${oben === "" ? " frei" : ""}">${maskiere(oben)}</span>`;
      const platz = leer ? ` style="min-width:${r1([...g.text].length * 0.55 + 1.5)}em"` : "";
      return `<span class="sg-glied">${kopf}<span class="sg-kasten ${art}" data-rolle="${g.rolle ?? ""}"${platz}>${leer ? "" : maskiere(g.text)}</span></span>`;
    };
    const oben = (g) => {
      if (!g.rolle) return aufgabe === "keine" && ausschneiden ? null : "";
      if (aufgabe === "bestimmen") return loesung ? ROLLEN[g.rolle].name : "";
      if (aufgabe === "fragen") return loesung ? ROLLEN[g.rolle].frage : "";
      return aufgabe === "keine" && !ausschneiden ? ROLLEN[g.rolle].name : null;
    };
    const satzEnde = ausschneiden || !zeichen ? "" : `<span class="sg-zeichen">${maskiere(zeichen)}</span>`;
    let html = `<span class="sg-reihe">${glieder.map((g) => kasten(g, oben(g), false)).join("")}${satzEnde}</span>`;
    if (aufgabe === "umstellen") {
      const neu = satzUmstellen(satz, vorn);
      html += `<span class="sg-reihe sg-umstellung"${loesung ? " data-loesung" : ""}>${neu.glieder.map((g) => kasten(g, null, !loesung)).join("")}${loesung && neu.zeichen ? `<span class="sg-zeichen">${maskiere(neu.zeichen)}</span>` : ""}</span>`;
    }
    el.innerHTML = html;
  }

  const bausteineVon = (wort) => wort.split("|").map((t) => t.trim());
  const pruefeBausteine = (wort, stamm) => {
    if (/\s/.test(wort.trim())) abbruch("Ein Wort, keine Leerzeichen.");
    const teile = bausteineVon(wort);
    if (teile.some((t) => !t)) abbruch("Zwischen zwei Strichen fehlt ein Baustein.");
    if (teile.some((t) => !/^[\p{L}-]+$/u.test(t))) abbruch("Bausteine bestehen aus Buchstaben.");
    if (stamm !== null && !teile.some((t) => t.toLowerCase() === stamm.toLowerCase())) abbruch(`Der Stamm „${stamm}“ ist keiner der Bausteine.`);
    return teile;
  };

  function wortbausteine(el) {
    const art = attr(el, "art", "wort"), wort = inhalt(el), stamm = attr(el, "stamm", null), woerter = liste(el, "woerter"), aufgabe = attr(el, "aufgabe", "keine");
    if (!["wort", "familie"].includes(art)) abbruch(`Die Art „${art}“ gibt es nicht.`);
    const teile = pruefeBausteine(wort, stamm), loesung = loesungSichtbar(el);
    const reihe = () => `<span class="wb-reihe">${teile.map((t) => `<span class="wb-kasten${stamm !== null && t.toLowerCase() === stamm.toLowerCase() ? " stamm" : ""}">${maskiere(t)}</span>`).join("")}</span>`;
    if (art === "familie") {
      if (!["keine", "familie"].includes(aufgabe)) abbruch(`Die Aufgabe „${aufgabe}“ gibt es bei einer Wortfamilie nicht.`);
      if (teile.length !== 1) abbruch("Bei einer Wortfamilie steht in der Mitte nur der Stamm.");
      if (woerter.length < 1 || woerter.length > 8) abbruch("Eine Wortfamilie hat 1 bis 8 Wörter.");
      const plaetze = [[1, 2], [3, 2], [2, 1], [2, 3], [1, 1], [1, 3], [3, 1], [3, 3]];
      const zeigen = aufgabe === "keine" || loesung;
      const felder = woerter.map((w, i) => `<span class="wb-wort${zeigen ? "" : " leer"}" style="grid-row:${plaetze[i][0]};grid-column:${plaetze[i][1]}">${zeigen ? maskiere(w) : ""}</span>`).join("");
      el.innerHTML = `<span class="wb-familie"><span class="wb-kasten stamm" style="grid-row:2;grid-column:2">${maskiere(teile[0])}</span>${felder}</span>`;
      return;
    }
    if (!["keine", "zerlegen", "zusammensetzen"].includes(aufgabe)) abbruch(`Die Aufgabe „${aufgabe}“ gibt es bei einem Wort nicht.`);
    const ganz = teile.join("");
    if (aufgabe === "zerlegen" && !loesung) el.innerHTML = `<span class="wb-ganz">${maskiere(ganz)}</span>`;
    else if (aufgabe === "zusammensetzen") el.innerHTML = `${reihe()}<span class="wb-wort wb-ergebnis${loesung ? "" : " leer"}">${loesung ? maskiere(ganz) : ""}</span>`;
    else el.innerHTML = reihe();
  }

  /* == Sachunterricht == */
  /** Ein Jahr auf der Leiste. Vor Christus negativ; ein Jahr 0 gibt es nicht, auf -1 folgt 1. */
  const zeitPos = (jahr) => (jahr < 0 ? jahr : jahr - 1);
  const jahrText = (j) => (j < 0 ? `${-j} v. Chr.` : String(j));
  const zeitEreignisse = (roh) => roh.map((p) => {
    const m = p.name.match(/^(-?\d+)(?:-(-?\d+))?$/);
    if (!m) abbruch(`„${p.name}“ ist kein Jahr und kein Zeitraum.`);
    const offen = /:\s*offen$/.test(p.wert);
    return { von: Number(m[1]), bis: m[2] === undefined ? null : Number(m[2]), text: p.wert.replace(/:\s*offen$/, "").trim(), offen };
  });

  function zeitleiste(el) {
    const art = attr(el, "art", "jahre"), leben = art === "leben", von = num(el, "von", 1900), bis = num(el, "bis", 2020), liste2 = attr(el, "ereignisliste", "ja") === "ja";
    if (!["jahre", "leben"].includes(art)) abbruch(`Die Art „${art}“ gibt es nicht.`);
    if (!(von < bis)) abbruch("Der Anfang liegt vor dem Ende.");
    if (!leben && (von === 0 || bis === 0)) abbruch("Ein Jahr 0 gibt es nicht.");
    const spanne = zeitPos(bis) - zeitPos(von);
    const vorschlag = spanne <= 20 ? 1 : spanne <= 100 ? 10 : spanne <= 1000 ? 100 : 1000;
    const schritt = num(el, "schritt", vorschlag);
    if (!(schritt > 0)) abbruch("Der Schritt ist größer als 0.");
    const breite = num(el, "breite", Math.min(el.parentElement?.clientWidth || SATZSPIEGEL, SATZSPIEGEL));
    const pos = leben ? (j) => j : zeitPos, rand = 34, x0 = rand, x1 = breite - rand - 10, proJahr = (x1 - x0) / (pos(bis) - pos(von));
    const xVon = (j) => x0 + (pos(j) - pos(von)) * proJahr;
    const liste3 = zeitEreignisse(paare(el, "ereignisse")), f = fuellung(), loesung = loesungSichtbar(el), groesse = 15, zeile = 19;
    for (const e of liste3) {
      if (!leben && (e.von === 0 || e.bis === 0)) abbruch("Ein Jahr 0 gibt es nicht.");
      for (const j of e.bis === null ? [e.von] : [e.von, e.bis]) if (j < von || j > bis) abbruch(`${jahrText(j)} liegt außerhalb der Leiste.`);
      if (e.bis !== null && e.bis <= e.von) abbruch("Ein Zeitraum geht vom früheren zum späteren Jahr.");
    }
    const balken = [], reihen = [];
    liste3.filter((e) => e.bis !== null).forEach((e) => {
      let r = reihen.findIndex((ende) => ende < e.von);
      if (r < 0) r = reihen.length;
      reihen[r] = e.bis;
      balken.push({ e, r });
    });
    const balkenHoehe = reihen.length * 12;
    const kopfText = (e) => (leben ? `${e.von}${e.bis === null ? "" : `–${e.bis}`} ${e.von === 1 && e.bis === null ? "Jahr" : "Jahre"}` : e.bis === null ? jahrText(e.von) : `${jahrText(e.von)}–${jahrText(e.bis)}`);
    const karten = liste3.map((e) => {
      const zeilen = satzZeilen(e.text, 150, groesse), kopf = kopfText(e);
      const w = Math.min(Math.max(textBreite(kopf, groesse) * 1.05, ...zeilen.map((z) => textBreite(z, groesse))), 170) + 14;
      return { e, zeilen, kopf, w, h: (zeilen.length + 1) * zeile + 8, x: xVon(e.bis === null ? e.von : (e.von + e.bis) / 2) };
    }).sort((a, b) => a.x - b.x);
    const stufe = Math.max(0, ...karten.map((k) => k.h)) + 10, tiefe = 26;
    const belegt = [];
    const frei = (k, seite, n, kx) => belegt.every((b) => {
      if (b.seite !== seite) return true;
      const neben = Math.abs(b.kx - kx) >= (b.k.w + k.w) / 2 + 6;
      if (b.n === n) return neben;
      const fuehrungKreuzt = (n > b.n && Math.abs(k.x - b.kx) < b.k.w / 2 + 3) || (b.n > n && Math.abs(b.k.x - kx) < k.w / 2 + 3);
      return !fuehrungKreuzt;
    });
    let seite = "unten";
    for (const k of karten) {
      const kx = Math.min(Math.max(k.x, k.w / 2 + 1), breite - k.w / 2 - 1);
      const zuerst = seite === "unten" ? ["oben", "unten"] : ["unten", "oben"];
      const wahl = [0, 1, 2].flatMap((n) => zuerst.map((s) => ({ s, n }))).find(({ s, n }) => frei(k, s, n, kx));
      if (!wahl) abbruch("Ereignisse liegen zu dicht; Leiste länger machen oder Zeitraum kürzen.");
      belegt.push({ k, seite: wahl.s, n: wahl.n, kx });
      seite = wahl.s;
    }
    const obenStufen = Math.max(0, ...belegt.filter((b) => b.seite === "oben").map((b) => b.n + 1));
    const untenStufen = Math.max(0, ...belegt.filter((b) => b.seite === "unten").map((b) => b.n + 1));
    const y = obenStufen * stufe + balkenHoehe + 12;
    let s = "";
    balken.forEach(({ e, r }) => {
      const a = xVon(e.von), z = xVon(e.bis);
      s += `<rect class="zeitraum" data-von="${e.von}" data-bis="${e.bis}" data-x="${r1(a)}" data-x2="${r1(z)}" x="${r1(a)}" y="${y - 12 * (r + 1)}" width="${r1(z - a)}" height="11" fill="${f.von(r + 1)}" stroke="${SCHWARZ}" stroke-width="1"/>`;
    });
    s += `<line class="strahl" x1="${x0 - 12}" y1="${y}" x2="${x1 + 16}" y2="${y}" stroke="${SCHWARZ}" stroke-width="2.5"/><path d="M${x1 + 16} ${y - 6}L${x1 + 26} ${y}L${x1 + 16} ${y + 6}Z" fill="${SCHWARZ}" stroke="none"/>`;
    const marken = [];
    const erster = Math.ceil(von / schritt) * schritt;
    for (let t = erster; t <= bis; t += schritt) if (leben || t !== 0) marken.push(t);
    const breiteste = Math.max(...marken.map((t) => textBreite(jahrText(t), 14))) + 8;
    const jede = Math.max(1, Math.ceil(breiteste / (schritt * proJahr)));
    for (const { k, seite: sei, n, kx } of belegt) {
      const oben = sei === "oben";
      const ky = oben ? y - balkenHoehe - (n + 1) * stufe + 2 : y + tiefe + n * stufe;
      const fuss = oben ? ky + k.h : ky;
      const zeigen = !k.e.offen || loesung;
      s += `<g class="ereignis" data-jahr="${k.e.von}" data-x="${r1(k.x)}" data-box="${r1(kx - k.w / 2)} ${r1(ky)} ${r1(k.w)} ${r1(k.h)}"${k.e.offen ? " data-offen" : ""}>`;
      s += `<line class="fuehrung" x1="${r1(k.x)}" y1="${oben ? y - balkenHoehe : y + 7}" x2="${r1(k.x)}" y2="${r1(fuss)}" stroke="${SCHWARZ}" stroke-width="1"/>`;
      s += `<rect x="${r1(kx - k.w / 2)}" y="${r1(ky)}" width="${r1(k.w)}" height="${r1(k.h)}" rx="3" fill="#fff" stroke="${SCHWARZ}" stroke-width="1.2"/>`;
      s += text(kx, ky + 4 + zeile / 2, k.kopf, { groesse, fett: true });
      if (zeigen) k.zeilen.forEach((z, i) => { s += text(kx, ky + 4 + zeile * (i + 1.5), z, { groesse }); });
      s += "</g>";
    }
    marken.forEach((t, i) => {
      const x = xVon(t), mitText = i % jede === 0, name = leben ? String(t) : jahrText(t), tb = textBreite(name, 14);
      s += `<line class="strich" data-jahr="${t}" data-x="${r1(x)}" x1="${r1(x)}" y1="${y - (mitText ? 7 : 4)}" x2="${r1(x)}" y2="${y + (mitText ? 7 : 4)}" stroke="${SCHWARZ}" stroke-width="${mitText ? 1.8 : 1}"/>`;
      if (mitText) s += `<rect x="${r1(x - tb / 2 - 1)}" y="${y + 10}" width="${r1(tb + 2)}" height="16" fill="#fff" stroke="none"/>${text(x, y + 18, name, { groesse: 14 })}`;
    });
    const hoehe = y + tiefe + untenStufen * stufe + 2;
    let unten = "";
    const offeneTexte = liste3.filter((e) => e.offen).map((e) => e.text).sort((a, b) => a.localeCompare(b, "de"));
    if (liste2 && offeneTexte.length > 0) unten = `<div class="zl-liste">${offeneTexte.map((t) => `<span>${maskiere(t)}</span>`).join("")}</div>`;
    el.innerHTML = svg(breite, r1(hoehe), f.defs() + s) + unten;
  }

  const KREIS_MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  const KREIS_TAGE = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
  const TAGESZEITEN = ["Morgen", "Mittag", "Abend", "Nacht"];
  const STUNDEN_NAMEN = Array.from({ length: 24 }, (_, i) => String(i));
  const KREISE = { jahr: KREIS_MONATE, woche: KREIS_TAGE, tag: TAGESZEITEN, stunden: STUNDEN_NAMEN };
  const JAHRESZEITEN = [
    { name: "Frühling", monate: [2, 3, 4], farbe: "#7CC36A", muster: 2 },
    { name: "Sommer", monate: [5, 6, 7], farbe: "#FFD23F", muster: 0 },
    { name: "Herbst", monate: [8, 9, 10], farbe: "#F28C28", muster: 1 },
    { name: "Winter", monate: [11, 0, 1], farbe: "#6FA8DC", muster: 3 },
  ];

  function jahreskreis(el) {
    const art = attr(el, "art", "jahr"), beschriftung = attr(el, "beschriftung", "voll"), mitZeiten = attr(el, "jahreszeiten", "nein") === "ja", markiert = liste(el, "markiert"), g = num(el, "groesse", 320);
    const namen = KREISE[art];
    if (!namen) abbruch(`Die Art „${art}“ gibt es nicht.`);
    if (!["voll", "leer"].includes(beschriftung)) abbruch(`Die Beschriftung „${beschriftung}“ gibt es nicht.`);
    if (mitZeiten && art !== "jahr") abbruch("Jahreszeiten gibt es nur beim Jahreskreis.");
    for (const m of markiert) if (!namen.includes(m)) abbruch(`„${m}“ gehört nicht zu diesem Kreis.`);
    const f = fuellung(), sw = istSw(), n = namen.length, band = mitZeiten ? 18 : 0, r = g / 2 - 2 - band, r0 = g * 0.09, c = g / 2, zeigen = beschriftung === "voll" || loesungSichtbar(el);
    const groesse = n === 24 ? 13 : 15;
    const radial = n === 12;
    const laenge = r - r0 - 10;
    if (radial && textBreite("September", groesse) > laenge) abbruch("Der Kreis ist zu klein für die Beschriftung.");
    if (!radial && n !== 24 && textBreite("Donnerstag", groesse) > 2 * (r * 0.62) * Math.sin(Math.PI / n)) abbruch("Der Kreis ist zu klein für die Beschriftung.");
    const punkt = (rad, w) => [c + rad * Math.sin(w), c - rad * Math.cos(w)];
    const sektor = (a, b, innen, aussen) => {
      const [x1, y1] = punkt(aussen, a), [x2, y2] = punkt(aussen, b), [x3, y3] = punkt(innen, b), [x4, y4] = punkt(innen, a), gross = b - a > Math.PI ? 1 : 0;
      return `M${r1(x1)} ${r1(y1)}A${r1(aussen)} ${r1(aussen)} 0 ${gross} 1 ${r1(x2)} ${r1(y2)}L${r1(x3)} ${r1(y3)}A${r1(innen)} ${r1(innen)} 0 ${gross} 0 ${r1(x4)} ${r1(y4)}Z`;
    };
    const teil = (2 * Math.PI) / n;
    let s = "";
    namen.forEach((name, i) => {
      const a = i * teil, b = a + teil, an = markiert.includes(name);
      const fuell = an ? (sw ? f.von(1) : "color-mix(in srgb,var(--haupt) 30%,#fff)") : "#fff";
      s += `<path class="segment" data-name="${name}" data-nr="${i}" data-start="${r1((a * 180) / Math.PI)}"${an ? " data-markiert" : ""} d="${sektor(a, b, r0, r)}" fill="${fuell}" stroke="${SCHWARZ}" stroke-width="1.5"/>`;
    });
    if (mitZeiten) {
      for (const z of JAHRESZEITEN) {
        for (const m of z.monate) {
          const a = m * teil, b = a + teil;
          s += `<path class="jahreszeit" data-zeit="${z.name}" d="${sektor(a, b, r, r + band)}" fill="${sw ? f.von(z.muster) : z.farbe}" stroke="${SCHWARZ}" stroke-width="1"/>`;
        }
      }
    }
    if (zeigen) {
      namen.forEach((name, i) => {
        const w = (i + 0.5) * teil, tb = textBreite(name, groesse);
        if (radial) {
          const grad = (w * 180) / Math.PI, links = w > Math.PI, [x, y] = punkt(r - 8 - tb / 2, w), dreh = links ? grad + 90 : grad - 90;
          s += `<g class="kreistext" transform="rotate(${r1(dreh)} ${r1(x)} ${r1(y)})"><rect x="${r1(x - tb / 2 - 2)}" y="${r1(y - 9)}" width="${r1(tb + 4)}" height="18" fill="#fff" stroke="none"/>${text(x, y, name, { groesse })}</g>`;
        } else {
          const [x, y] = punkt(n === 24 ? r - 14 : r * 0.62, w);
          s += `<g class="kreistext"><rect x="${r1(x - tb / 2 - 2)}" y="${r1(y - 9)}" width="${r1(tb + 4)}" height="18" fill="#fff" stroke="none"/>${text(x, y, name, { groesse })}</g>`;
        }
      });
    }
    let h = g;
    if (mitZeiten) {
      let lx = 2, ly = g + 8;
      for (const z of JAHRESZEITEN) {
        const b = 24 + textBreite(z.name, 14) + 12;
        if (lx + b > g && lx > 2) { lx = 2; ly += 22; }
        s += `<g class="legende" data-legende="${z.name}"><rect x="${r1(lx)}" y="${ly}" width="18" height="16" fill="${sw ? f.von(z.muster) : z.farbe}" stroke="${SCHWARZ}" stroke-width="1"/>${text(lx + 22, ly + 8, z.name, { groesse: 14, anker: "start" })}</g>`;
        lx += b;
      }
      h = ly + 22;
    }
    el.innerHTML = svg(g, h, f.defs() + s);
  }

  function windrose(el) {
    const richtungen = attr(el, "richtungen", "4"), beschriftung = attr(el, "beschriftung", "voll"), g = num(el, "groesse", 170);
    if (!["4", "8"].includes(richtungen)) abbruch("Eine Windrose hat 4 oder 8 Richtungen.");
    if (!["voll", "leer", "norden"].includes(beschriftung)) abbruch(`Die Beschriftung „${beschriftung}“ gibt es nicht.`);
    const c = g / 2, platz = 28, R = c - platz, b = R * 0.16;
    const zacke = (w, lang, voll, gesamt) => {
      const sin = Math.sin(w), cos = Math.cos(w), sp = [c + lang * sin, c - lang * cos], l = [c - b * cos, c - b * sin], rr = [c + b * cos, c + b * sin];
      const flaeche = (p) => `M${r1(c)} ${r1(c)}L${r1(p[0])} ${r1(p[1])}L${r1(sp[0])} ${r1(sp[1])}Z`;
      return `<path d="${flaeche(l)}" fill="${gesamt ? SCHWARZ : "#fff"}" stroke="${SCHWARZ}" stroke-width="1.2"/><path d="${flaeche(rr)}" fill="${voll ? SCHWARZ : "#fff"}" stroke="${SCHWARZ}" stroke-width="1.2"/>`;
    };
    const achter = richtungen === "8";
    const haupt = ["N", "O", "S", "W"], neben = ["NO", "SO", "SW", "NW"];
    let s = "";
    if (achter) neben.forEach((_, i) => { s += zacke(Math.PI / 4 + (i * Math.PI) / 2, R * 0.62, false, false); });
    haupt.forEach((name, i) => { s += zacke((i * Math.PI) / 2, R, true, name === "N"); });
    const schild = (name, w, fernab) => {
      const x = c + fernab * Math.sin(w), y = c - fernab * Math.cos(w), norden = name === "N";
      const zeigen = beschriftung === "voll" || (beschriftung === "norden" && norden);
      if (zeigen) return `<g class="richtung" data-richtung="${name}">${text(x, y, name, { groesse: norden ? 22 : 17, fett: norden })}</g>`;
      return `<g class="richtung" data-richtung="${name}" data-leer stroke="${SCHWARZ}">${antwortfeld(el, x - 15, y - 12, 30, 24, name, { groesse: 16 })}</g>`;
    };
    haupt.forEach((name, i) => { s += schild(name, (i * Math.PI) / 2, R + 15); });
    if (achter) neben.forEach((name, i) => { s += schild(name, Math.PI / 4 + (i * Math.PI) / 2, R * 0.62 + 19); });
    el.innerHTML = svg(g, g, s);
  }

  const PLAN_FLAECHEN = { leer: "frei", strasse: "Straße", wasser: "Wasser", wald: "Wald", wiese: "Wiese", platz: "Platz" };
  const PLAN_FARBEN = { strasse: "#A9A9A9", wasser: "#8EC5F2", wald: "#5FA768", wiese: "#C6E6A8", platz: "#EADBB5" };
  const PLAN_MUSTER = {
    wasser: `<path d="M0 4H16M0 12H16" stroke="${SCHWARZ}" stroke-width="1.2"/>`,
    wald: `<path d="M8 2L12 9H4ZM8 9V13" stroke="${SCHWARZ}" stroke-width="1" fill="none"/>`,
    wiese: `<path d="M3 7L4.5 11L6 7M11 13L12.5 16L14 13" stroke="${SCHWARZ}" stroke-width="1" fill="none"/>`,
    platz: `<circle cx="4" cy="4" r="1.2" fill="${SCHWARZ}" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="${SCHWARZ}" stroke="none"/>`,
  };
  const PLAN_SYMBOLE = {
    ort: {
      schule: { name: "Schule", d: "M3 21V10L12 5L21 10V21ZM12 5V1L16 2.5L12 4M10 21V15H14V21" },
      kirche: { name: "Kirche", d: "M6 21V10L12 5L18 10V21ZM12 5V0M10 2H14M10 21V16H14V21" },
      rathaus: { name: "Rathaus", d: "M3 9L12 3L21 9ZM3 21H21M6 9V21M10 9V21M14 9V21M18 9V21" },
      bahnhof: { name: "Bahnhof", d: "M6 3H18V16H6ZM6 10H18M9 16L6 21M15 16L18 21M9 13H9.5M14.5 13H15" },
      bushaltestelle: { name: "Bushaltestelle", d: "M12 1A11 11 0 1 0 12 23A11 11 0 1 0 12 1ZM8 6V18M16 6V18M8 12H16" },
      spielplatz: { name: "Spielplatz", d: "M3 21L6 4H18L21 21M12 4V14M9 14H15" },
      haus: { name: "Haus", d: "M4 21V11L12 4L20 11V21Z" },
      baum: { name: "Baum", d: "M12 2A7 7 0 1 0 12 16A7 7 0 1 0 12 2ZM12 16V22M8 22H16" },
      bruecke: { name: "Brücke", d: "M2 9H22M2 15H22M6 9V15M12 9V15M18 9V15M2 6L5 9M22 6L19 9M2 18L5 15M22 18L19 15" },
      post: { name: "Post", d: "M2 6H22V18H2ZM2 6L12 13L22 6" },
      krankenhaus: { name: "Krankenhaus", d: "M3 3H21V21H3ZM9 7H15V10H18V15H15V18H9V15H6V10H9Z" },
      parkplatz: { name: "Parkplatz", d: "M3 3H21V21H3ZM9 18V6H14A3.5 3.5 0 0 1 14 13H9" },
    },
    raum: {
      tisch: { name: "Tisch", d: "M3 6H21V18H3Z" },
      stuhl: { name: "Stuhl", d: "M7 7H17V19H7ZM5 4H19V7H5Z" },
      tafel: { name: "Tafel", d: "M2 9H22V15H2ZM6 15V18M18 15V18" },
      tuer: { name: "Tür", d: "M4 21V3M4 3A18 18 0 0 1 22 21M2 21H22" },
      fenster: { name: "Fenster", d: "M2 9H22V15H2ZM2 12H22M8 9V15M16 9V15" },
      schrank: { name: "Schrank", d: "M3 5H21V19H3ZM3 5L21 19M21 5L3 19" },
      teppich: { name: "Teppich", d: "M5 4H19V20H5ZM2 7H5M2 12H5M2 17H5M19 7H22M19 12H22M19 17H22" },
    },
  };
  const planZelle = (q, spalten, zeilen) => {
    const m = String(q).match(/^([A-Z])(\d+)$/);
    if (!m) abbruch(`„${q}“ ist kein Planquadrat. So sieht eines aus: B3.`);
    const x = m[1].charCodeAt(0) - 65, y = Number(m[2]) - 1;
    if (x >= spalten || y < 0 || y >= zeilen) abbruch(`Das Planquadrat ${q} liegt außerhalb des Plans.`);
    return { x, y };
  };

  function plan(el) {
    const art = attr(el, "art", "ort"), spalten = num(el, "spalten", 6), zeilen = num(el, "zeilen", 5), boden = raster(el, "boden"), objekte = paare(el, "objekte"), mitQuadraten = attr(el, "planquadrate", "ja") === "ja", mitLegende = attr(el, "legende", "ja") === "ja", massstab = attr(el, "massstab", null), nordpfeil = attr(el, "nordpfeil", "nein") === "ja", aufgabe = attr(el, "aufgabe", "keine"), weg = liste(el, "weg"), kaestchen = num(el, "kaestchen", 1.2);
    const satz = PLAN_SYMBOLE[art];
    if (!satz) abbruch(`Die Art „${art}“ gibt es nicht.`);
    if (!["keine", "finden", "einzeichnen", "weg"].includes(aufgabe)) abbruch(`Die Aufgabe „${aufgabe}“ gibt es nicht.`);
    if (!(spalten >= 1 && spalten <= 26 && zeilen >= 1 && zeilen <= 30)) abbruch("Der Plan hat 1 bis 26 Spalten und 1 bis 30 Zeilen.");
    if (kaestchen < 0.8) abbruch("Ein Kästchen misst mindestens 0,8 cm.");
    const k = cm(kaestchen), rand = mitQuadraten ? 24 : 2, breite = rand + spalten * k + 2, sw = istSw();
    if (breite > SATZSPIEGEL) abbruch("Der Plan ist zu breit für die Seite. Nimm weniger Spalten.");
    const orte = new Map();
    for (const { name, wert } of objekte) {
      if (!satz[name]) abbruch(`Das Symbol „${name}“ gibt es hier nicht. Erlaubt: ${Object.keys(satz).join(", ")}.`);
      for (const q of trenneListe(wert)) {
        const { x, y } = planZelle(q, spalten, zeilen), schluessel = `${x},${y}`;
        if (orte.has(schluessel)) abbruch(`Im Planquadrat ${q} steht schon ein Symbol.`);
        orte.set(schluessel, { name, q, x, y });
      }
    }
    const zeigeSymbole = aufgabe !== "einzeichnen" || loesungSichtbar(el);
    const id = `abb-plan${++fuellungsNr}`;
    const genutzt = new Set();
    const fuellen = (art2) => {
      if (art2 === "leer") return "#fff";
      if (!sw) return PLAN_FARBEN[art2];
      if (art2 === "strasse") return "#808080";
      return `url(#${id}-${art2})`;
    };
    let s = "";
    boden.forEach((reihe, y) => reihe.forEach((z, x) => {
      if (!PLAN_FLAECHEN[z]) abbruch(`Die Fläche „${z}“ gibt es nicht.`);
      if (x >= spalten || y >= zeilen) abbruch("Der Boden ist größer als der Plan.");
      if (z !== "leer") {
        genutzt.add(z);
        s += `<rect class="flaeche" data-flaeche="${z}" data-q="${String.fromCharCode(65 + x)}${y + 1}" x="${r1(rand + x * k)}" y="${r1(rand + y * k)}" width="${r1(k)}" height="${r1(k)}" fill="${fuellen(z)}" stroke="none"/>`;
      }
    }));
    let linien = "";
    for (let i = 0; i <= spalten; i++) linien += `M${r1(rand + i * k)} ${rand}V${r1(rand + zeilen * k)}`;
    for (let i = 0; i <= zeilen; i++) linien += `M${rand} ${r1(rand + i * k)}H${r1(rand + spalten * k)}`;
    s += `<path class="planlinien" d="${linien}" fill="none" stroke="#4A4A4A" stroke-width="1"/>`;
    if (mitQuadraten) {
      for (let i = 0; i < spalten; i++) s += text(rand + (i + 0.5) * k, 11, String.fromCharCode(65 + i), { groesse: 15, fett: true });
      for (let i = 0; i < zeilen; i++) s += text(11, rand + (i + 0.5) * k, i + 1, { groesse: 15, fett: true });
    }
    const symbol = (name, x, y, g) => `<g class="symbol" data-symbol="${name}" transform="translate(${r1(x)} ${r1(y)}) scale(${r1(g / 24)})"><rect x="-1" y="-1" width="26" height="26" rx="3" fill="#fff" stroke="none"/><path d="${satz[name].d}" fill="none" stroke="${SCHWARZ}" stroke-width="${r1(1.6 * (24 / g) * 0.75)}" stroke-linejoin="round"/></g>`;
    if (zeigeSymbole) {
      for (const o of orte.values()) s += symbol(o.name, rand + o.x * k + k * 0.12, rand + o.y * k + k * 0.12, k * 0.76);
    }
    if (aufgabe === "weg") {
      if (weg.length < 2) abbruch("Ein Weg hat mindestens zwei Planquadrate.");
      const punkte = weg.map((q) => planZelle(q, spalten, zeilen));
      punkte.slice(1).forEach((p, i) => {
        const v = punkte[i];
        if (Math.abs(p.x - v.x) + Math.abs(p.y - v.y) !== 1) abbruch(`${weg[i]} und ${weg[i + 1]} liegen nicht nebeneinander.`);
      });
      const mitte = (p) => [rand + (p.x + 0.5) * k, rand + (p.y + 0.5) * k];
      if (loesungSichtbar(el)) s += `<polyline class="weg" points="${punkte.map((p) => mitte(p).map(r1).join(",")).join(" ")}" fill="none" stroke="${SCHWARZ}" stroke-width="3.5" stroke-dasharray="8 4"/>`;
      [[punkte[0], "S"], [punkte.at(-1), "Z"]].forEach(([p, t]) => {
        const [x, y] = mitte(p);
        s += `<g class="wegmarke" data-marke="${t}"><circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(k * 0.26)}" fill="#fff" stroke="${SCHWARZ}" stroke-width="1.8"/>${text(x, y, t, { groesse: 15, fett: true })}</g>`;
      });
    }
    let y = rand + zeilen * k + 8;
    if (massstab !== null) {
      const m = massstab.match(/^1 Kästchen = (.+)$/);
      if (!m) abbruch("Den Maßstab schreibt man so: 1 Kästchen = 100 m.");
      masstab(el);
      s += `<g class="massstabsleiste" data-laenge="${r1(k)}"><path d="M${rand} ${y + 2}v8h${r1(k)}v-8" fill="none" stroke="${SCHWARZ}" stroke-width="2"/>${text(rand + k + 8, y + 7, m[1], { groesse: 15, anker: "start" })}</g>`;
    }
    if (nordpfeil) {
      const x = rand + spalten * k - 12;
      s += `<g class="nordpfeil"><path d="M${r1(x)} ${y + 26}V${y + 8}M${r1(x - 6)} ${y + 15}L${r1(x)} ${y + 6}L${r1(x + 6)} ${y + 15}" fill="none" stroke="${SCHWARZ}" stroke-width="2"/>${text(x - 16, y + 16, "N", { groesse: 17, fett: true })}</g>`;
    }
    if (massstab !== null || nordpfeil) y += 34;
    if (mitLegende) {
      const eintraege = [...new Set([...orte.values()].map((o) => o.name))].map((name) => ({ name, titel: satz[name].name, symbol: true })).concat([...genutzt].map((z) => ({ name: z, titel: PLAN_FLAECHEN[z], symbol: false })));
      let lx = rand;
      for (const e of eintraege) {
        const b = 30 + textBreite(e.titel, 15) + 12;
        if (lx + b > breite + 4 && lx > rand) { lx = rand; y += 30; }
        const bild = e.symbol ? symbol(e.name, lx, y, 24) : `<rect x="${r1(lx)}" y="${y}" width="24" height="24" fill="${fuellen(e.name)}" stroke="${SCHWARZ}" stroke-width="1"/>`;
        s += `<g class="legende" data-legende="${e.name}">${bild}${text(lx + 30, y + 12, e.titel, { groesse: 15, anker: "start" })}</g>`;
        lx += b;
      }
      if (eintraege.length > 0) y += 32;
    }
    if (aufgabe === "finden" || aufgabe === "einzeichnen") {
      const je = new Map();
      for (const o of orte.values()) je.set(o.name, [...(je.get(o.name) ?? []), o.q]);
      for (const [name, qs] of je) {
        const titel = satz[name].name, antwort = qs.join(", "), bw = Math.max(70, textBreite(antwort, 15) + 16);
        s += `<g class="planfrage" data-frage="${name}">${text(rand, y + 14, titel, { groesse: 15, anker: "start" })}`;
        const fx = rand + textBreite(titel, 15) + 12;
        s += aufgabe === "finden" ? `<g stroke="${SCHWARZ}">${antwortfeld(el, fx, y, bw, 28, antwort, { groesse: 15 })}</g>` : text(fx, y + 14, antwort, { groesse: 15, fett: true, anker: "start" });
        s += "</g>";
        y += 34;
      }
    }
    const defs = sw && genutzt.size ? `<defs>${[...genutzt].filter((z) => PLAN_MUSTER[z]).map((z) => `<pattern id="${id}-${z}" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#fff" stroke="none"/>${PLAN_MUSTER[z]}</pattern>`).join("")}</defs>` : "";
    el.innerHTML = svg(r1(breite), r1(y), defs + s);
  }

  /* Natur und Technik */
  const STROM_LAST = { lampe: "Lampe", motor: "Motor", summer: "Summer" };
  const STROM_LEITER = { eisen: "Eisen", kupfer: "Kupfer", alufolie: "Alufolie" };
  const STROM_NICHTLEITER = { holz: "Holz", gummi: "Gummi", plastik: "Plastik", glas: "Glas", papier: "Papier" };
  const STROM_NAMEN = { batterie: "Batterie", schalter: "Schalter", kabel: "Kabel", ...STROM_LAST, ...STROM_LEITER, ...STROM_NICHTLEITER };
  const stromTeile = (woerter) => woerter.map((w) => {
    const [art, zustand = null] = w.split(":").map((t) => t.trim());
    if (!STROM_NAMEN[art]) abbruch(`Das Teil „${art}“ gibt es nicht.`);
    if (art === "schalter" && !["offen", "zu"].includes(zustand)) abbruch("Ein Schalter ist offen oder zu.");
    return { art, zustand };
  });
  /** Ein Zweig leitet, wenn kein Schalter offen ist und kein Nichtleiter drinsteckt. Ohne Verbraucher ist er ein Kurzschluss. */
  const stromLeitet = (t) => !STROM_NICHTLEITER[t.art] && !(t.art === "schalter" && t.zustand === "offen");
  const stromkreis = (teile, zweig = []) => {
    if (!teile.some((t) => t.art === "batterie")) abbruch("Im Kreis fehlt die Batterie.");
    if (zweig.some((t) => t.art === "batterie")) abbruch("Die Batterie gehört in den Hauptkreis.");
    const a = teile.filter((t) => t.art !== "batterie"), zweige = zweig.length > 0 ? [a, zweig] : [a];
    const leitet = (z) => z.every(stromLeitet), hatLast = (z) => z.some((t) => STROM_LAST[t.art]);
    const kurz = zweige.some((z) => leitet(z) && !hatLast(z));
    const laufen = kurz ? [] : zweige.filter((z) => leitet(z) && hatLast(z)).flatMap((z) => z.filter((t) => STROM_LAST[t.art]));
    return { ergebnis: kurz ? "kurzschluss" : laufen.length > 0 ? "ja" : "nein", laufen };
  };

  function schaltplan(el) {
    const teile = stromTeile(liste(el, "teile")), zweig = stromTeile(liste(el, "zweig")), art = attr(el, "art", "symbole"), aufgabe = attr(el, "aufgabe", "keine");
    if (!["symbole", "bild"].includes(art)) abbruch(`Die Art „${art}“ gibt es nicht.`);
    if (!["keine", "leuchtet", "vervollstaendigen", "benennen"].includes(aufgabe)) abbruch(`Die Aufgabe „${aufgabe}“ gibt es nicht.`);
    const { ergebnis, laufen } = stromkreis(teile, zweig), loesung = loesungSichtbar(el), bild = art === "bild", benennen = aufgabe === "benennen";
    const stellen = Math.max(teile.length - 1, zweig.length), breit = Math.max(280, benennen ? 100 * (stellen + 1) + 48 : 96 * stellen + 48), abstand = benennen ? 118 : 88, links = 24, rechts = breit - 24;
    const oben = 34, mitte = zweig.length ? oben + abstand : null, unten = oben + abstand * (zweig.length ? 2 : 1);
    const zeigeWirkung = aufgabe === "keine" || (aufgabe === "leuchtet" && loesung);
    const strahl = istSw() ? SCHWARZ : "var(--haupt)";
    const zeichne = (t, x, y) => {
      const hg = (b, h) => `<rect x="${r1(x - b / 2)}" y="${r1(y - h / 2)}" width="${b}" height="${h}" fill="#fff" stroke="none"/>`;
      if (t.art === "kabel") return "";
      if (t.art === "batterie") {
        if (bild) return `${hg(62, 34)}<rect x="${x - 27}" y="${y - 15}" width="54" height="30" rx="3" fill="#fff" stroke="${SCHWARZ}" stroke-width="2"/>${text(x - 15, y, "+", { groesse: 18, fett: true })}${text(x + 15, y, "−", { groesse: 18, fett: true })}`;
        return `${hg(30, 44)}<line x1="${x - 6}" y1="${y - 18}" x2="${x - 6}" y2="${y + 18}" stroke="${SCHWARZ}" stroke-width="2"/><line x1="${x + 6}" y1="${y - 9}" x2="${x + 6}" y2="${y + 9}" stroke="${SCHWARZ}" stroke-width="5"/>${text(x - 16, y - 16, "+", { groesse: 14, fett: true })}${text(x + 18, y - 16, "−", { groesse: 14, fett: true })}`;
      }
      if (t.art === "lampe") {
        const hell = zeigeWirkung && laufen.includes(t);
        const strahlen = hell ? Array.from({ length: 8 }, (_, i) => {
          const w = (i * Math.PI) / 4, a = 19, z = 27;
          return `<line class="lichtstrahl" x1="${r1(x + a * Math.cos(w))}" y1="${r1(y + a * Math.sin(w))}" x2="${r1(x + z * Math.cos(w))}" y2="${r1(y + z * Math.sin(w))}" stroke="${strahl}" stroke-width="2.5"/>`;
        }).join("") : "";
        if (bild) return `${hg(40, 40)}${strahlen}<circle cx="${x}" cy="${y - 3}" r="13" fill="#fff" stroke="${SCHWARZ}" stroke-width="2"/><path d="M${x - 5} ${y - 1}q2.5 -6 5 0q2.5 6 5 0" fill="none" stroke="${SCHWARZ}" stroke-width="1.5"/><rect x="${x - 8}" y="${y + 9}" width="16" height="9" fill="#fff" stroke="${SCHWARZ}" stroke-width="2"/>`;
        return `${hg(36, 36)}${strahlen}<circle cx="${x}" cy="${y}" r="14" fill="#fff" stroke="${SCHWARZ}" stroke-width="2"/><path d="M${r1(x - 9.9)} ${r1(y - 9.9)}L${r1(x + 9.9)} ${r1(y + 9.9)}M${r1(x + 9.9)} ${r1(y - 9.9)}L${r1(x - 9.9)} ${r1(y + 9.9)}" stroke="${SCHWARZ}" stroke-width="2"/>`;
      }
      if (t.art === "schalter") {
        const hebel = t.zustand === "offen" ? `L${x + 15} ${y - 15}` : `L${x + 18} ${y}`;
        return `${hg(44, 34)}<circle cx="${x - 18}" cy="${y}" r="3" fill="${SCHWARZ}" stroke="none"/><circle cx="${x + 18}" cy="${y}" r="3" fill="${SCHWARZ}" stroke="none"/><path d="M${x - 22} ${y}H${x - 18}${hebel}M${x + 18} ${y}H${x + 22}" fill="none" stroke="${SCHWARZ}" stroke-width="2.2"/>`;
      }
      if (t.art === "motor") return `${hg(36, 36)}<circle cx="${x}" cy="${y}" r="14" fill="#fff" stroke="${SCHWARZ}" stroke-width="2"/>${text(x, y, "M", { groesse: 16, fett: true })}`;
      if (t.art === "summer") return `${hg(36, 30)}<path d="M${x - 13} ${y + 8}A13 13 0 0 1 ${x + 13} ${y + 8}Z" fill="#fff" stroke="${SCHWARZ}" stroke-width="2"/>`;
      return `${hg(64, 30)}<rect x="${x - 30}" y="${y - 12}" width="60" height="24" fill="#fff" stroke="${SCHWARZ}" stroke-width="1.8"/>${text(x, y, STROM_NAMEN[t.art], { groesse: 14 })}`;
    };
    const luecke = aufgabe === "vervollstaendigen", drahtUnten = (mitte ?? oben) + (unten - (mitte ?? oben)) / 2;
    let s = `<g class="draht" fill="none" stroke="${SCHWARZ}" stroke-width="2"><path d="M${links} ${oben}H${rechts}V${luecke ? drahtUnten - 14 : unten}"/><path d="M${rechts} ${luecke ? drahtUnten + 14 : unten}V${unten}H${links}V${oben}"/>${mitte === null ? "" : `<path d="M${links} ${mitte}H${rechts}"/>`}</g>`;
    if (luecke && loesung) s += `<line class="kabel-loesung" x1="${rechts}" y1="${drahtUnten - 14}" x2="${rechts}" y2="${drahtUnten + 14}" stroke="${SCHWARZ}" stroke-width="3.5"/>`;
    const setze = (reihe, y, inSchritten) => {
      const n = reihe.length;
      reihe.forEach((t, i) => {
        const x = inSchritten(i, n);
        s += `<g class="teil" data-teil="${t.art}"${t.zustand ? ` data-zustand="${t.zustand}"` : ""}${STROM_LAST[t.art] ? ` data-laeuft="${laufen.includes(t) ? "ja" : "nein"}"` : ""}>${zeichne(t, x, y)}</g>`;
        if (benennen && t.art !== "kabel") s += `<g class="name" data-name="${STROM_NAMEN[t.art]}" stroke="${SCHWARZ}">${antwortfeld(el, x - 44, y + 26, 88, 26, STROM_NAMEN[t.art], { groesse: 14 })}</g>`;
      });
    };
    const verteilen = (i, n) => links + ((rechts - links) * (i + 1)) / (n + 1);
    const batterien = teile.filter((t) => t.art === "batterie"), rest = teile.filter((t) => t.art !== "batterie");
    setze(rest, oben, verteilen);
    if (mitte !== null) setze(zweig, mitte, verteilen);
    setze(batterien, unten, verteilen);
    let h = unten + (benennen ? 60 : 26);
    if (aufgabe === "leuchtet") {
      const last = [...rest, ...zweig].find((t) => STROM_LAST[t.art])?.art ?? "lampe";
      const frage = { lampe: "Leuchtet die Lampe?", motor: "Läuft der Motor?", summer: "Summt der Summer?" }[last];
      s += text(links, h + 8, frage, { groesse: 16, anker: "start" });
      h += 24;
      const x0 = links;
      const kreuz = (name, x, an) => `<g class="wahl" data-wahl="${name}"><rect x="${r1(x)}" y="${h}" width="18" height="18" fill="#fff" stroke="${SCHWARZ}" stroke-width="1.6"/>${an && loesung ? `<path d="M${r1(x + 3)} ${h + 3}L${r1(x + 15)} ${h + 15}M${r1(x + 15)} ${h + 3}L${r1(x + 3)} ${h + 15}" stroke="${SCHWARZ}" stroke-width="2.4"/>` : ""}${text(x + 24, h + 9, name, { groesse: 16, anker: "start" })}</g>`;
      s += kreuz("ja", x0, ergebnis === "ja") + kreuz("nein", x0 + 66, ergebnis !== "ja");
      h += 28;
      if (ergebnis === "kurzschluss" && loesung) {
        s += `<g class="kurzschluss">${text(links, h + 8, "Kurzschluss: Batterie wird heiß", { groesse: 16, fett: true, anker: "start" })}</g>`;
        h += 26;
      }
    }
    el.setAttribute("data-ergebnis", ergebnis);
    el.innerHTML = svg(breit, h, s);
  }

  function kreislauf(el) {
    const stationen = paare(el, "stationen"), art = attr(el, "art", "kreis"), offen = liste(el, "offen"), pfeile = (attr(el, "pfeile", "") || "").split(";").map((t) => t.trim());
    if (!["kreis", "ablauf"].includes(art)) abbruch(`Die Art „${art}“ gibt es nicht.`);
    if (stationen.length < 3 || stationen.length > 8) abbruch("Es sind 3 bis 8 Stationen.");
    const loesung = loesungSichtbar(el), mitBild = stationen.some((t) => t.wert);
    const n = stationen.length, pfeilZahl = art === "kreis" ? n : n - 1;
    const pfeilText = (i) => {
      const t = pfeile[i] ?? "";
      return offen.includes(`p${i + 1}`) && !loesung ? "" : t;
    };
    const kasten = (t, i, stil) => {
      const frei = offen.includes(String(i + 1)) && !loesung, quelle = el.getAttribute(`data-bild-${i}`) ?? t.wert;
      const bild = t.wert ? `<img class="kl-bild" src="${maskiere(quelle)}" alt="${frei ? "" : maskiere(t.name)}">` : "";
      return `<div class="kl-station${frei ? " leer" : ""}" data-station="${i + 1}" style="${stil}">${bild}<span>${frei ? "" : maskiere(t.name)}</span></div>`;
    };
    if (art === "ablauf") {
      const teile = stationen.map((t, i) => {
        const fest = `width:${mitBild ? 120 : 110}px`;
        const pfeil = i < n - 1 ? `<div class="kl-pfeil" data-pfeil="${i + 1}"><span>${maskiere(pfeilText(i))}</span><svg width="44" height="14" viewBox="0 0 44 14"><path d="M1 7H34M32 1L43 7L32 13Z" fill="${SCHWARZ}" stroke="${SCHWARZ}" stroke-width="1.8"/></svg></div>` : "";
        return kasten(t, i, fest) + pfeil;
      });
      el.innerHTML = `<div class="kl-ablauf">${teile.join("")}</div>`;
      return;
    }
    const D = n > 5 || mitBild ? 560 : 440, w = n > 6 ? 118 : 130, h = mitBild ? 104 : 48, R = (D - w) / 2, H = 2 * R + h + 2, cx = D / 2, cy = H / 2;
    const lage = (i) => {
      const g = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      return [cx + R * Math.cos(g), cy + R * Math.sin(g), g];
    };
    if (n > 2) {
      const [ax, ay] = lage(0), [bx, by] = lage(1);
      if (Math.abs(ax - bx) < w + 4 && Math.abs(ay - by) < h + 4) abbruch("Zu viele Stationen für die Breite.");
    }
    const draussen = (x, y, i) => {
      const [sx, sy] = lage(i);
      return Math.abs(x - sx) > w / 2 + 7 || Math.abs(y - sy) > h / 2 + 7;
    };
    let s = "";
    for (let i = 0; i < pfeilZahl; i++) {
      const [, , g0] = lage(i), j = (i + 1) % n, ende = g0 + (2 * Math.PI) / n, schritt = 0.01;
      let a = g0, z = ende;
      while (a < ende && !draussen(cx + R * Math.cos(a), cy + R * Math.sin(a), i)) a += schritt;
      while (z > g0 && !draussen(cx + R * Math.cos(z), cy + R * Math.sin(z), j)) z -= schritt;
      if (z - a < 0.08) abbruch("Zu viele Stationen für die Breite.");
      const p = (t) => [cx + R * Math.cos(t), cy + R * Math.sin(t)];
      const [x1, y1] = p(a), [x2, y2] = p(z), tang = z + Math.PI / 2, [mx, my] = p((a + z) / 2);
      const spitze = `M${r1(x2)} ${r1(y2)}L${r1(x2 - 11 * Math.cos(tang - 0.45))} ${r1(y2 - 11 * Math.sin(tang - 0.45))}L${r1(x2 - 11 * Math.cos(tang + 0.45))} ${r1(y2 - 11 * Math.sin(tang + 0.45))}Z`;
      s += `<g class="kl-bogen" data-pfeil="${i + 1}"><path d="M${r1(x1)} ${r1(y1)}A${r1(R)} ${r1(R)} 0 0 1 ${r1(x2)} ${r1(y2)}" fill="none" stroke="${SCHWARZ}" stroke-width="2"/><path d="${spitze}" fill="${SCHWARZ}" stroke="none"/>`;
      if (pfeile[i]) {
        const innen = 0.76, tx = cx + (mx - cx) * innen, ty = cy + (my - cy) * innen, inhaltText = pfeilText(i), tb = textBreite(pfeile[i], 15);
        s += inhaltText ? `<rect x="${r1(tx - tb / 2 - 2)}" y="${r1(ty - 10)}" width="${r1(tb + 4)}" height="20" fill="#fff" stroke="none"/>${text(tx, ty, inhaltText, { groesse: 15 })}` : `<line x1="${r1(tx - tb / 2)}" y1="${r1(ty + 8)}" x2="${r1(tx + tb / 2)}" y2="${r1(ty + 8)}" stroke="${SCHWARZ}" stroke-width="1.4"/>`;
      }
      s += "</g>";
    }
    const kaesten = stationen.map((t, i) => {
      const [x, y] = lage(i);
      return kasten(t, i, `left:${r1(x - w / 2)}px;top:${r1(y - h / 2)}px;width:${w}px;height:${h}px`);
    }).join("");
    el.innerHTML = `<div class="kl-kreis" style="width:${r1(D)}px;height:${r1(H)}px">${svg(r1(D), r1(H), s)}${kaesten}</div>`;
  }

  const VERKEHRSZEICHEN = { 101: "Gefahrstelle", 102: "Kreuzung mit Vorfahrt von rechts", 136: "Kinder", 138: "Radverkehr", 205: "Vorfahrt gewähren", 206: "Halt! Vorfahrt gewähren", 220: "Einbahnstraße", 237: "Radweg", 239: "Gehweg", 240: "Gemeinsamer Geh- und Radweg", 250: "Verbot für Fahrzeuge aller Art", 254: "Verbot für Radverkehr", 267: "Verbot der Einfahrt", 274: "Zulässige Höchstgeschwindigkeit", 301: "Vorfahrt", 306: "Vorfahrtstraße", 350: "Fußgängerüberweg", 357: "Sackgasse" };

  function verkehrszeichen(el) {
    const nummer = attr(el, "nummer", "205"), groesse = num(el, "groesse", 90), ausmalen = attr(el, "ausmalen", "nein") === "ja";
    if (!VERKEHRSZEICHEN[nummer]) abbruch(`Das Verkehrszeichen ${nummer} gibt es hier nicht.`);
    const variante = ausmalen && !loesungSichtbar(el) ? "-kontur" : istSw() ? "-grau" : "";
    const quelle = el.getAttribute(`data-bild${variante}`) ?? `bilder/verkehrszeichen/${nummer}${variante}.svg`;
    el.innerHTML = `<img class="vz-bild" src="${maskiere(quelle)}" alt="Zeichen ${nummer}: ${maskiere(VERKEHRSZEICHEN[nummer])}" style="height:${r1(groesse)}px">`;
  }

  const WETTER_FORMEN = {
    sonne: { sonne: [30, 30, 12] },
    heiter: { sonne: [20, 20, 10], wolke: true },
    wolke: { wolke: true },
    regen: { wolke: true, unten: "M20 46l-3 9M31 46l-3 9M42 46l-3 9" },
    schnee: { wolke: true, unten: "M20 47v8M16.500 49l7 4M23.500 49l-7 4M40 47v8M36.500 49l7 4M43.500 49l-7 4" },
    gewitter: { wolke: true, blitz: "M33 40L25 51H32L27 60L39 47H32L37 40Z" },
    nebel: { unten: "M8 18H52M12 28H48M8 38H52M12 48H48" },
  };

  function wetter(el) {
    const symbol = attr(el, "symbol", null), geheim = attr(el, "loesung", null), wind = num(el, "wind", 0), groesse = num(el, "groesse", 60);
    const name = symbol ?? geheim;
    if (name === null) abbruch("Ein Wettersymbol fehlt.");
    const form = WETTER_FORMEN[name];
    if (!form) abbruch(`Das Wettersymbol „${name}“ gibt es nicht.`);
    if (![0, 1, 2, 3].includes(wind)) abbruch("Wind hat 0 bis 3 Striche.");
    if (symbol === null && !loesungSichtbar(el)) {
      el.innerHTML = svg(60, 60, `<rect class="wetter-leer" x="2" y="2" width="56" height="56" rx="4" fill="#fff" stroke="#808080" stroke-width="1.5" stroke-dasharray="4 4"/>`, [groesse, groesse]);
      return;
    }
    const gelb = istSw() ? "#fff" : "#FFD23F", wolkenBild = 'M16 42A9 9 0 0 1 15 24A11 11 0 0 1 36 19A10 10 0 0 1 48 42Z';
    let s = "";
    if (form.sonne) {
      const [x, y, r] = form.sonne;
      const strahlen = Array.from({ length: 8 }, (_, i) => {
        const w = (i * Math.PI) / 4;
        return `M${r1(x + (r + 3) * Math.cos(w))} ${r1(y + (r + 3) * Math.sin(w))}L${r1(x + (r + 9) * Math.cos(w))} ${r1(y + (r + 9) * Math.sin(w))}`;
      }).join("");
      s += `<path d="${strahlen}" stroke="${SCHWARZ}" stroke-width="2" fill="none"/><circle cx="${x}" cy="${y}" r="${r}" fill="${gelb}" stroke="${SCHWARZ}" stroke-width="2"/>`;
    }
    if (form.wolke) s += `<path class="wetter-wolke" d="${wolkenBild}" fill="#fff" stroke="${SCHWARZ}" stroke-width="2" stroke-linejoin="round"/>`;
    if (form.unten) s += `<path d="${form.unten}" fill="none" stroke="${SCHWARZ}" stroke-width="2" stroke-linecap="round"/>`;
    if (form.blitz) s += `<path d="${form.blitz}" fill="${gelb}" stroke="${SCHWARZ}" stroke-width="1.6" stroke-linejoin="round"/>`;
    for (let i = 0; i < wind; i++) s += `<line class="wetter-wind" x1="50" y1="${r1(12 + i * 6)}" x2="59" y2="${r1(12 + i * 6)}" stroke="${SCHWARZ}" stroke-width="2"/>`;
    el.setAttribute("data-symbol", name);
    el.innerHTML = svg(60, 60, s, [groesse, groesse]);
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
    "x-gitter": gitter, "x-figur": figur, "x-tangram": tangram,
    "x-hunderterfeld": hunderterfeld, "x-hundertertafel": hundertertafel, "x-rechenrahmen": rechenrahmen, "x-rechenstrich": rechenstrich,
    "x-zahlenmauer": zahlenmauer, "x-rechendreieck": rechendreieck, "x-zahlenhaus": zahlenhaus, "x-zahlenkette": zahlenkette, "x-zauberdreieck": zauberdreieck, "x-rechenrad": rechenrad,
    "x-lineatur": lineatur, "x-silben": silben, "x-wortarten": wortarten, "x-satzglieder": satzglieder, "x-wortbausteine": wortbausteine, "x-zeitleiste": zeitleiste, "x-jahreskreis": jahreskreis, "x-windrose": windrose, "x-plan": plan, "x-schaltplan": schaltplan, "x-kreislauf": kreislauf, "x-verkehrszeichen": verkehrszeichen, "x-wetter": wetter,
    "x-geld": geld, "x-skala": skala, "x-strecke": strecke, "x-kalender": kalender, "x-zeitspanne": zeitspanne,
    "x-punktfeld": punktfeld, "x-malkreuz": malkreuz, "x-schriftlich": schriftlich,
    "x-wuerfelbau": wuerfelbau, "x-wuerfelnetz": wuerfelnetz, "x-koerper": koerper };

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
    ansichtenVon, wuerfelVon, verdeckteWuerfel, WUERFELNETZE, NICHT_NETZE, netzZellen, falteNetz, istWuerfelnetz, netzLaschen, netzLage, AUGEN_DER_SEITE, vielflach, KOERPER_ZAHLEN,
    tafelOrt, ausschnittZahlen, rechenstrichWerte, leseSprung,
    mauerWerte, mauerEindeutig, istEindeutig, RECHENDREIECK_GLEICHUNGEN, zauberLoesungen, ketteWerte, leseOperator,
    malkreuzRechnung, addiere, subtrahiereErweitern, subtrahiereEntbuendeln, multipliziere, dividiere, moeglicheFehler, rechnungsplan,
    MUENZEN, SCHEINE, betragText, mindestStueckelung, skalaStriche, kalenderMonat, isoWoche, zeitStationen, dauerText, uhrText,
    ANDIKA_X_HOEHE, lineaturMass, silbenTeile, pruefeSilben, WORTARTEN, ROLLEN, wortartenTeile, satzLesen, satzUmstellen, kleinImSatz, pruefeBausteine, zeitPos, jahrText, KREISE, PLAN_SYMBOLE, stromTeile, stromkreis, VERKEHRSZEICHEN, WETTER_FORMEN,
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => window.zeichneAbbildungen());
  else window.zeichneAbbildungen();
})();
