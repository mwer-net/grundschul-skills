/* s/w als Darstellung (Schoolbox-Issue 040): rechnet alle Farben im Browser in Grau um, ohne das Layout zu ändern.
   Läuft im Bildschirm (Dokumentansicht, Editor) und, von blatt.py eingebunden, unter dem Druckmedium fürs PDF.
   Luminanz 0.299 R + 0.587 G + 0.114 B. Helle bunte Flächen (Y > 200) werden weiß, Text und Linien behalten ihren
   Wert. Reines Grau bleibt unberührt: Die Kit-Elemente zeichnen in s/w selbst damit.
   Die Quelle bleibt unberührt: Alles geschieht nur im geladenen Dokument (CSSOM und Inline-Stile).
   window.grauBereit erfüllt sich, wenn der erste Durchlauf fertig ist; danach läuft der Pass erneut, sobald neue
   Elemente oder Stylesheets dazukommen (neu gezeichnete Abbildungen). */
(function () {
  const HELL = 200;
  const FLAECHE = /background|fill$/;
  const EIGENSCHAFTEN = ["color", "background-color", "border-top-color", "border-right-color", "border-bottom-color",
    "border-left-color", "outline-color", "fill", "stroke", "stop-color", "text-decoration-color", "column-rule-color", "-webkit-text-stroke-color"];
  // Kurzformen mit var() melden ihre Einzelwerte leer; ihre festen Farben stehen nur in der Kurzform.
  const KURZFORMEN = ["background", "border", "border-top", "border-right", "border-bottom", "border-left", "outline",
    "text-decoration", "column-rule"];
  const OHNE_FARBE = /^(font|grid|animation|transition|content|quotes|counter|will-change|src|unicode|list-style-type)/;
  // Keine Schlüsselwörter: Sie sind entweder keine Farbe oder erben schon die umgerechnete.
  const KEINE = new Set(["transparent", "currentcolor", "inherit", "initial", "unset", "revert", "none", "canvastext"]);
  const TOKEN = /url\([^)]*\)|#[0-9a-f]{3,8}\b|\b(?:rgb|hsl|hwb|lab|lch|oklab|oklch|color)a?\((?:[^()]|\([^()]*\))*\)|\b[a-z]{3,}\b(?![(-])/gi;

  // Material mit einer eigenen Klasse .sw (z. B. Schlüsselwörter): Die Regel darf nicht den body treffen, der für die
  // s/w-Ansicht dieselbe Klasse trägt. body.sw selbst und .sw-wert bleiben, was sie sind.
  const EIGENE_SW = /(?<![\w)-])\.sw(?![\w-])/;

  const leinwand = document.createElement("canvas");
  leinwand.width = leinwand.height = 1;
  const stift = leinwand.getContext("2d", { willReadFrequently: true });

  const bunt = (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b) > 6;

  /** [r, g, b, a] (0–255) oder null, wenn es keine feste Farbe ist. */
  const lies = (farbe) => {
    if (/var\(/i.test(farbe) || !CSS.supports("color", farbe)) return null;
    stift.clearRect(0, 0, 1, 1);
    stift.fillStyle = farbe;
    stift.fillRect(0, 0, 1, 1);
    return [...stift.getImageData(0, 0, 1, 1).data];
  };

  const inGrau = (farbe, flaeche) => {
    const d = lies(farbe);
    if (!d || d[3] === 0) return null;
    const y = Math.round(0.299 * d[0] + 0.587 * d[1] + 0.114 * d[2]);
    const v = flaeche && y > HELL && bunt(d[0], d[1], d[2]) ? 255 : y;
    return d[3] === 255 ? `rgb(${v},${v},${v})` : `rgba(${v},${v},${v},${Math.round((d[3] / 255) * 1000) / 1000})`;
  };

  /** Ersetzt jede feste Farbe im Wert. var() bleibt: Die Variablen selbst werden ja auch umgerechnet. */
  const wertInGrau = (wert, flaeche) => wert.replace(TOKEN, (t) => {
    if (/^url\(/i.test(t) || KEINE.has(t.toLowerCase())) return t;
    return inGrau(t, flaeche) ?? t;
  });

  const eigenschaft = (stil, name, verlauf) => {
    const wert = stil.getPropertyValue(name);
    if (!wert || OHNE_FARBE.test(name)) return;
    const neu = wertInGrau(wert, FLAECHE.test(name) || (verlauf && /gradient/i.test(wert)));
    if (neu !== wert) stil.setProperty(name, neu, stil.getPropertyPriority(name));
  };

  const regeln = (liste) => {
    for (const regel of liste) {
      if (regel.cssRules && regel.cssRules.length) regeln(regel.cssRules);
      if (!regel.style) continue;
      if (EIGENE_SW.test(regel.selectorText ?? "")) regel.selectorText = regel.selectorText.replace(new RegExp(EIGENE_SW, "g"), ":not(body).sw");
      for (const name of KURZFORMEN) if (regel.style.getPropertyValue(name).includes("var(")) eigenschaft(regel.style, name, true);
      for (const name of [...regel.style]) eigenschaft(regel.style, name, true);
    }
  };

  const stylesheets = () => {
    for (const blatt of document.styleSheets) {
      if (blatt.ownerNode && blatt.ownerNode.hasAttribute("data-grau-roh")) continue;
      try { regeln(blatt.cssRules); } catch (e) { /* fremde Quelle */ }
    }
  };

  /** Was im Stylesheet nicht steht (style=, fill= in SVG) oder daraus berechnet wird. box-shadow nie: siehe Issue 040. */
  const elemente = () => {
    for (const el of document.querySelectorAll("body, body *")) {
      const stil = getComputedStyle(el);
      for (const name of EIGENSCHAFTEN) {
        const wert = stil.getPropertyValue(name);
        if (!wert || wert === "none" || wert.startsWith("url")) continue;
        const d = lies(wert);
        if (d && d[3] > 0 && bunt(d[0], d[1], d[2])) el.style.setProperty(name, inGrau(wert, FLAECHE.test(name)), "important");
      }
      const bild = stil.backgroundImage;
      if (bild && /gradient/i.test(bild)) {
        const neu = wertInGrau(bild, true);
        if (neu !== bild) el.style.setProperty("background-image", neu, "important");
      }
    }
  };

  const bilderfilter = () => {
    if (document.querySelector("style[data-grau-bilder]")) return;
    const stil = document.createElement("style");
    stil.setAttribute("data-grau-bilder", "");
    stil.setAttribute("data-grau-roh", "");
    // Nur am Bildschirm: Im PDF rastert ein Filter jedes Bild; dort wandelt blatt.py die Dateien um.
    stil.textContent = "@media screen{img,image{filter:grayscale(1)}}";
    document.head.appendChild(stil);
  };

  const durchlauf = () => { stylesheets(); elemente(); bilderfilter(); };

  const warte = (ms) => new Promise((fertig) => setTimeout(fertig, ms));

  const start = async () => {
    if (document.readyState === "loading") await new Promise((fertig) => document.addEventListener("DOMContentLoaded", fertig));
    if (document.fonts) await document.fonts.ready;
    if (window.blattBereit) await window.blattBereit;
    if (window.zeichneAbbildungen) window.zeichneAbbildungen();
    durchlauf();
    await warte(0);
    durchlauf(); // spät gezeichnete Abbildungen und Variablen aus dem ersten Durchlauf
    let geplant = null;
    new MutationObserver((meldungen) => {
      if (meldungen.every((m) => [...m.addedNodes].every((n) => n.nodeType !== 1))) return;
      clearTimeout(geplant);
      geplant = setTimeout(durchlauf, 30);
    }).observe(document.documentElement, { childList: true, subtree: true });
  };

  window.macheGrau = durchlauf;
  window.grauWert = wertInGrau;
  window.grauBereit = start();
})();
