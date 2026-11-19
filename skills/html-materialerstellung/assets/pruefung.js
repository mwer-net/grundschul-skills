/* Automatische Layoutprüfung im Browser. blatt.py fügt dieses Skript nur zur Prüfung ein und liest
   das Ergebnis aus dem JSON-Element #pruefbericht. Stufen: FEHLER, WARNUNG, HINWEIS.
   Jede Meldung hat neben dem Text einen Code (ueberlauf, rand, ueberlappung, schrift-klein, kontrast-sw …) und die
   betroffenen Elemente als ziele: [{ sb, name, rechteck: [x, y, breite, hoehe] auf der Seite }], sb = data-sb aus
   dem Editor der Schoolbox, sonst null. Mit data-manuell am <script> prüft es nicht von selbst: Dann ruft der
   Editor window.pruefeBlatt({ warten: false }) und bekommt den Bericht zurück. */
(function () {
/* Baukasten und Thema (055). Die Listen sind die Quelle für den erzeugten Abschnitt in references/layout.md. */
 const THEMA_VARIABLEN = ["--haupt", "--akzent", "--dunkel", "--linie", "--fuell", "--text", "--strich"];
 const THEMA_SCHMUCK = ["color", "background", "border", "outline", "box-shadow", "font-family", "font-weight", "font-style", "text-decoration", "text-shadow", "opacity", "fill", "stroke", "letter-spacing"];
 const KIT_MINDEST = 90; // Prozent; Abnahme aus Issue 055
 const pruefeBaukasten = (melde) => {
  const regelnVon = (sheet) => { try { return [...sheet.cssRules]; } catch { return null; } };
  const sheets = [...document.styleSheets];
  // blatt.py bettet Stylesheets ein und nennt die Datei in data-quelle.
  const datei = (x) => x.ownerNode?.dataset?.quelle || (x.href || "").split("/").pop();
  const blatt = sheets.find((x) => datei(x) === "blatt.css");
  const regeln = blatt && regelnVon(blatt);
  if (!regeln) return null; // Ohne Lesezugriff lieber nichts melden als Falsches.
  const klassenIn = (text) => [...text.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((t) => t[1]);
  const kit = new Set();
  const sammle = (liste) => liste.forEach((r) => { if (r.selectorText) klassenIn(r.selectorText).forEach((k) => kit.add(k)); if (r.cssRules) sammle([...r.cssRules]); });
  sammle(regeln);
  const thema = sheets.find((x) => datei(x) === "thema.css");
  for (const r of (thema && regelnVon(thema)) || []) {
   if (!r.selectorText) continue;
   const fremd = klassenIn(r.selectorText).filter((k) => !kit.has(k));
   if (fremd.length > 0) melde("HINWEIS", 0, "thema-klasse", `thema.css: Klasse ohne Registereintrag: ${fremd.join(", ")} → Kit-Klasse nehmen oder in das Register aufnehmen`);
   const falsch = [...r.style].filter((n) => (n.startsWith("--") ? !THEMA_VARIABLEN.includes(n) : !THEMA_SCHMUCK.some((e) => n === e || n.startsWith(`${e}-`))));
   if (falsch.length > 0) melde("HINWEIS", 0, "thema-layout", `thema.css: „${r.selectorText}“ setzt ${[...new Set(falsch)].join(", ")} → ein Thema ändert nur das Aussehen, nicht das Layout`);
  }
  // Auftakt (217): Schauseite ohne Schema, eigene Klassen für Szenen sind erwünscht.
  if (document.body.matches(".folie.auftakt")) return null;
  const el = [...document.querySelectorAll(".seite *")].filter((e) => e.classList.length > 0 && !e.closest("svg") && !istInAbbildung(e) && !e.hasAttribute("data-erzeugt"));
  if (el.length === 0) return null;
  const imKit = el.filter((e) => [...e.classList].every((k) => kit.has(k))).length, anteil = Math.round((imKit / el.length) * 100);
  if (anteil < KIT_MINDEST) melde("HINWEIS", 0, "kit-anteil", `Kit-Anteil ${anteil} % (Ziel ${KIT_MINDEST} %) → Kit-Bausteine statt eigener Klassen, Aussehen über thema.css`);
  return anteil;
 };
 /* Gestaltung (096). DRUCKRAND steht gleich in kern/src/gestaltung-arten.ts, ein Test vergleicht beides. */
 const DRUCKRAND = 19; // px, 5 mm: Schuldrucker drucken nicht randlos
 /* Was im Druckrand fehlen würde (Briefing 4.1); Formen ohne Text, Streuung, Seitenfläche und Seitenrahmen dürfen dorthin. */
 const IM_DRUCKRAND = "img.bild-frei, img.figur-frei, .form-text, .schmuck, [data-frei][data-lage]";
 const VERDECKT_MIN = 400; // px² Schnittfläche
 /* Minibuch: Kanten jeder Seite, die nach dem Drucken am Blattrand liegen (o, l, u, r). blatt.css legt die Seiten im
    Druck 4 × 2 und dreht die obere Reihe, also liegt immer die untere Kante außen, an den Spalten 1 und 4 dazu eine
    seitliche. Alle anderen Kanten sind Falz oder Schnitt: Dort gilt nur die 4-mm-Regel (rand). */
 const MINIBUCH_AUSSEN = { 1: "ur", 2: "ul", 3: "u", 4: "u", 5: "ur", 6: "ul", 7: "u", 8: "u" };
 const figurName = (wert) => { const t = (wert || "").trim().replace(/[-_]+/g, " "); return t ? t[0].toUpperCase() + t.slice(1) : ""; };
 /** Name eines Gestaltungselements: data-name, Figur, alt, Titel von Claude, Text, zuletzt die Art. */
 const nameDerGestaltung = (el) => {
  const text = el.matches("svg.form,svg.streuung") ? "" : (el.textContent || "").trim();
  const art = el.matches("svg.form") ? el.getAttribute("data-form") : el.matches("svg.streuung") ? "Streuung" : "";
  return el.getAttribute("data-name") || figurName(el.getAttribute("data-figur")) || el.getAttribute("alt") || el.getAttribute("data-frei-titel") || text || art || el.localName;
 };
 const istInAbbildung = (e) => { for (let p = e.parentElement; p; p = p.parentElement) if (p.localName.startsWith("x-")) return true; return e.localName.startsWith("x-"); };

 /* Symmetrie (245): Wörter, an denen eine Anweisung von Symmetrie spricht. */
 const SYMMETRIE_WORT = /symmetr|spiegel|achse|hälfte|faltlinie/i;

 /* Platz und Größe (249). Die Maße sind die Quelle für den erzeugten Abschnitt platz-je-klasse in
    grundschul-didaktik/references/druck-und-platz.md. */
 const PX_MM = 96 / 25.4;
 const ZEICHENFELD_MIN = { 1: 50, 2: 50, 3: 40, 4: 40 }; // mm je Seite, Zeichenfeld ohne data-fuer
 const FELD_RAND = 5; // mm je Seite um das, was in ein Feld mit data-fuer kommt
 const LINIEN_MIN = { satz: { 1: 2, 2: 2, 3: 1, 4: 1 }, begruendung: { 1: 3, 2: 3, 3: 2, 4: 2 } };
 const ANTWORTEN = ["wort", "zahl", "satz", "begruendung"];
 const LEERFELD_MIN = 10; // mm: kleinere Rahmen sind Kästchen zum Ankreuzen oder für eine Ziffer
 const BEGRUENDUNG_WORT = /(?<!\p{L})(?:weil|begründ\p{L}*|erklär\p{L}*)(?!\p{L})/iu;
 const SCHAUSEITE = ".fall,.deckblatt";
 const FORM = "path,rect,circle,ellipse,polygon,polyline,line,text,image,use";

 const pruefe = async ({ warten = true } = {}) => {
 const M = [];
 let ergebnis;
 try {
  await document.fonts.ready;
  if (warten) {
   if (window.blattBereit) await window.blattBereit; // Umbau der Seiten, z. B. Folien mit Notizen
   if (window.grauBereit) await window.grauBereit; // s/w-Ansicht
   await Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))));
   if (window.zeichneAbbildungen) window.zeichneAbbildungen();
   await new Promise((r) => setTimeout(r, 100));
  }

  const B = document.body;
  const melde = (stufe, seite, code, text, ziele = []) => M.push({ stufe, seite, code, text, ziele });
  const kl = +((B.className.match(/kl(\d)/) || [0, 2])[1]);
  // Zeitziel in Minuten (`data-zeit` am body): Material, dessen Menge nach Arbeitszeit geplant ist (druck-und-platz.md,
  // „Menge nach Arbeitszeit“). Ohne die Angabe gelten die alten Richtwerte, damit Bestand unverändert geprüft wird.
  const zeitziel = +B.dataset.zeit || 0, loesungsblatt = B.classList.contains("loesung");
  // Neues Material (`data-satz="2"`, blatt.css): gesetzt wie ein Schulbuch. Eine Arbeitsseite ist dort eher zu leer als
  // zu voll; Folien, Plakate (A3) und Seiten für die Lehrkraft setzt der Satz nicht dichter.
  const satz2 = B.dataset.satz === "2" && !B.matches(".folie,.a3-hoch,.lehrkraft");
  const RICHTWERT = satz2 ? { 1: 6, 2: 8, 3: 9, 4: 10 }[kl] || 8 : zeitziel ? { 1: 5, 2: 6, 3: 7, 4: 8 }[kl] || 8 : { 1: 3, 2: 4, 3: 5, 4: 6 }[kl] || 6;
  // Die Schwellen sind die Quelle für den erzeugten Abschnitt pruef-schwellen in grundschul-didaktik/references/druck-und-platz.md.
  const KOPF_MAX = 210, FUSS_MAX = 150, FREI_MAX = 90, FREI_HINWEIS = 150;
  const ZEIT_KNAPP = 0.85, ZEIT_VIEL = 1.25; // Anteil am Zeitziel: darunter zu wenig, darüber zu viel
  const AUFGABEN_MIN = 4, TEILE_MIN = 12, LEER_MAX = 35, ABSTAND_MIN = satz2 ? 10 : 20;
  const SCHRIFT_MIN = 0.8; // Anteil an der Schrift der Klasse
  const FLAECHE_HELL = 245, FLAECHE_MIN = 4000; // Grauwert von 255, px²
  const DPI_MIN = 150, BILD_SPANNE_MIN = 40; // Spanne der Grauwerte von 255
  // Woran ein Kind auf der Seite etwas tut: Items einer Reihe oder Stellen zum Schreiben, je Aufgabe mindestens eine.
  const TEIL = ".antwort,.schreiblinie,.luecke,.platz,.malfeld,td[data-l],x-ankreuzen .ankreuzen,x-richtigfalsch tbody tr,.zeile-frei";
  const teilaufgaben = (a) => Math.max(1, a.querySelectorAll(".reihe > .zelle").length, a.querySelectorAll(TEIL).length);
  const zeitGruppen = new Map(); // Punkte des Niveaus → Minuten; 0 steht für Aufgaben ohne Niveau
  let zeitSeite = 0, zeitFehlt = [];
  const meldeZeit = () => {
    if (!zeitGruppen.size && !zeitFehlt.length) return;
    if (zeitFehlt.length) melde("WARNUNG", zeitSeite, "zeit-fehlt", `${zeitFehlt.length} ${zeitFehlt.length === 1 ? "Aufgabe" : "Aufgaben"} ohne Zeitangabe → data-min an der Aufgabe ergänzen`, zeitFehlt);
    const alle = zeitGruppen.get(0) || 0, niveaus = [...zeitGruppen.keys()].filter((n) => n > 0);
    const wege = niveaus.length ? niveaus.map((n) => [n, alle + zeitGruppen.get(n)]) : [[0, alle]];
    wege.sort((a, b) => a[1] - b[1]);
    const [n, min] = wege[0], [nv, max] = wege[wege.length - 1];
    const fuer = (k) => (k ? `Die Aufgaben für ${"●".repeat(k)} reichen` : "Die Aufgaben reichen");
    if (!zeitFehlt.length && min < zeitziel * ZEIT_KNAPP)
      melde("WARNUNG", zeitSeite, "zeit-knapp", `${fuer(n)} für etwa ${Math.round(min)} min, Ziel sind ${zeitziel} min → Aufgaben oder Items ergänzen${n ? ", oder je Niveau eine eigene Seite" : ""}`, []);
    // Nur beim Bauen (225): Die Obergrenze ist für Claude; im Editor soll vorhandenes Material nicht mehr melden.
    if (warten && !zeitFehlt.length && max > zeitziel * ZEIT_VIEL)
      melde("WARNUNG", zeitSeite, "zeit-viel", `${fuer(nv)} für etwa ${Math.round(max)} min, Ziel sind ${zeitziel} min → Aufgabe auf ein weiteres Blatt oder zur Sternchenaufgabe machen`, []);
    zeitGruppen.clear(); zeitFehlt = [];
  };
  if (warten) window.kitAnteil = pruefeBaukasten(melde); // Nur beim Bauen: Im Editor hilft der Hinweis der Lehrkraft nicht.
  const fs = parseFloat(getComputedStyle(B).fontSize);
  const folie = B.classList.contains("folie"), mitNotizen = !!document.querySelector(".seite .notiz");
  const kurz = (el) => el.matches('[data-lage="frei"]') ? nameDerGestaltung(el).trim().replace(/\s+/g, " ").slice(0, 40) : el.dataset.name || (el.matches(".antwort") && !el.textContent.trim() ? "Antwortlinie" : (el.textContent || el.getAttribute("alt") || el.tagName.toLowerCase()).trim().replace(/\s+/g, " ").slice(0, 40));
  const ausgeblendet = (e) => e.closest("[data-aus]") !== null; // display: none, gehört in keine Prüfung außer „ausgeblendet“
  const sichtbar = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden"; };
  const rgb = (c) => (c.match(/[\d.]+/g) || []).map(Number);
  // WCAG 1.4.3 verlangt für große Schrift 3:1; Fließtext auf den Blättern hat 18–28 px und zählt dazu.
  const KONTRAST_MIN = 3;
  const FARBWORT = /(?<!\p{L})(?:rot|blau|grün|gelb|orange|lila|violett|rosa|pink|braun|türkis|bunt|farbig)(?:e|en|er|es|em)?(?!\p{L})/giu;
  const leuchtdichte = (r, g, b) => { const k = (w) => { w /= 255; return w <= 0.03928 ? w / 12.92 : ((w + 0.055) / 1.055) ** 2.4; }; return 0.2126 * k(r) + 0.7152 * k(g) + 0.0722 * k(b); };
  const kontrast = (x, y) => (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  /** Kleinster Kontrast des Texts zu seiner Fläche; null, wenn ein Bild dahinter liegt. Verläufe zählen mit jedem Farbstopp. */
  const kontrastZurFlaeche = (el) => {
    const [tr, tg, tb, ta = 1] = rgb(getComputedStyle(el).color);
    if (ta < 0.05) return null;
    const schichten = [];
    let verlauf = [];
    for (let e = el; e; e = e.parentElement) {
      const c = getComputedStyle(e);
      if (/url\(/.test(c.backgroundImage)) return null;
      if (/gradient/.test(c.backgroundImage) && !verlauf.length) verlauf = (c.backgroundImage.match(/rgba?\([^)]*\)/g) || []).map(rgb);
      const f = rgb(c.backgroundColor);
      if ((f[3] ?? 1) > 0) schichten.push(f);
      if ((f[3] ?? 1) === 1) break;
    }
    const auf = (f, g) => { const a = f[3] ?? 1; return [0, 1, 2].map((i) => f[i] * a + g[i] * (1 - a)); };
    const grund = schichten.reduceRight((unten, f) => auf(f, unten), [255, 255, 255]);
    const flaechen = verlauf.length ? verlauf.map((f) => auf(f, grund)) : [grund];
    return Math.min(...flaechen.map((f) => { const t = auf([tr, tg, tb, ta], f); return kontrast(leuchtdichte(...t), leuchtdichte(...f)); }));
  };

  await Promise.all(["16px Andika", "700 16px Andika", "600 16px Fredoka"].map((f) => document.fonts.load(f).catch(() => 0)));
  if (!document.fonts.check("16px Andika")) melde("FEHLER", 0, "schrift-fehlt", "Schrift Andika nicht geladen (fonts/ fehlt?)");
  if (!document.fonts.check("600 16px Fredoka")) melde("FEHLER", 0, "schrift-fehlt", "Schrift Fredoka nicht geladen (fonts/ fehlt?)");
  if (document.querySelector('[schrift="va"],.schreibschrift')) {
    await document.fonts.load('16px "Playwrite DE VA"').catch(() => 0);
    if (!document.fonts.check('16px "Playwrite DE VA"')) melde("FEHLER", 0, "schrift-fehlt", "Schreibschrift nicht geladen (fonts/ fehlt?)");
  }

  const seiten = [];
  const felder = []; // Messung für den Prüflauf (249), Abschnitt 9c
  const feldzahl = document.querySelectorAll(".seite").length;
  if (B.classList.contains("minibuch") && feldzahl !== 8) melde("FEHLER", 0, "minibuch-seiten", `Ein Mini-Book hat genau 8 Seiten, dieses hat ${feldzahl} → --vorlage minibuch als Ausgangspunkt nehmen`);
  // nur äußere Seiten: In „Folien mit Notizen“ stecken die Folien verkleinert in einem Blatt
  [...document.querySelectorAll(".seite")].filter((s) => !s.parentElement.closest(".seite")).forEach((S, si) => {
    let seitenLeer = null;
    const nr = si + 1, P = S.getBoundingClientRect(), stil = getComputedStyle(S), rand = parseFloat(stil.paddingLeft), randOben = parseFloat(stil.paddingTop), randUnten = parseFloat(stil.paddingBottom);
    const innen = { l: P.left + rand - 1, t: P.top + randOben - 1, r: P.right - rand + 1, b: P.bottom - randUnten + 1 };
    const rel = (r) => [Math.round(r.left - P.left), Math.round(r.top - P.top), Math.round(r.width), Math.round(r.height)];
    // sb: das nächste Element mit Nummer, denn die Zeichnung einer Abbildung (svg) hat keine eigene
    const ziel = (e) => { const m = e.closest("[data-sb]"); return { sb: m ? +m.getAttribute("data-sb") : null, name: kurz(e), rechteck: rel(e.getBoundingClientRect()) }; };
    const alle = [...S.querySelectorAll("*")].filter((e) => !e.closest("svg") || e.tagName.toLowerCase() === "svg").filter(sichtbar);

    // 0. Abbildungen, die nicht gezeichnet werden konnten (meldeFehler in abbildungen.js)
    [...S.querySelectorAll("[data-fehler]")].filter((e) => !ausgeblendet(e)).forEach((e) => {
      const name = e.dataset.name || (window.abbildungsName ? window.abbildungsName(e.localName) : e.localName);
      melde("FEHLER", nr, "abbildung", `Abbildung „${name}“: ${e.getAttribute("data-fehler")}`, [ziel(e)]);
    });
    // 0b. Gezeichnet, aber über dem Zahlenraum der Klasse (warne in abbildungen.js, 207): erlaubt, nur zu prüfen
    [...S.querySelectorAll("[data-warnung]")].filter((e) => !ausgeblendet(e) && !e.hasAttribute("data-fehler")).forEach((e) => {
      const name = e.dataset.name || (window.abbildungsName ? window.abbildungsName(e.localName) : e.localName);
      melde("WARNUNG", nr, "zahlenraum", `Abbildung „${name}“: ${e.getAttribute("data-warnung")}`, [ziel(e)]);
    });
    if (S.querySelector("[data-masstab]") && !M.some((m) => m.code === "masstab"))
      melde("HINWEIS", nr, "masstab", "In Originalgröße drucken (100 %, nicht „An Seite anpassen“) → --druckhinweis beim Anlegen setzen", [ziel(S.querySelector("[data-masstab]"))]);

    // Gestaltung (091): die zwei Ebenen und alles, was frei liegt oder an einem Baustein hängt. Eigene Codes: 096.
    // 215: Ebenen über einem Bild (.bild-lagen) liegen mit Absicht übereinander und werden am Platz beschnitten.
    const GESTALTUNG = ".ebene,[data-lage],.bild-lagen";

    // 1. Seitenrand und Seitenende
    // Zeilennummern (data-zeilennummern) setzt abbildungen.js mit Absicht in den Rand und kleiner als den Text (194-35).
    const raus = alle.filter((e) => !e.closest(`.karten,.loesung-marke,.fuss-zeile,.zeilennummer,[data-rand-ok],${GESTALTUNG}`)).filter((e) => {
      const r = e.getBoundingClientRect();
      return r.left < innen.l || r.top < innen.t || r.right > innen.r || r.bottom > innen.b;
    });
    raus.filter((e) => !raus.includes(e.parentElement)).forEach((e) => {
      const r = e.getBoundingClientRect();
      const um = Math.round(Math.max(innen.l - r.left, innen.t - r.top, r.right - innen.r, r.bottom - innen.b));
      const ganz = r.bottom > P.bottom || r.right > P.right;
      const wo = (ganz ? "ragt aus der Seite" : "ragt in den Seitenrand") + ` (${um} px)`;
      const rat = e.closest(".notizblatt") ? "Notiz kürzen" : B.classList.contains("minibuch") ? "kürzen oder verkleinern, nichts an die Falz" : "kürzen, Item streichen oder zweite Seite";
      melde("FEHLER", nr, ganz ? "ueberlauf" : "rand", `„${kurz(e)}“ ${wo} → ${rat}`, [ziel(e)]);
    });

    // 2. Abgeschnittener oder zu breiter Text; eine Ebene schneidet mit Absicht am Blattrand ab
    // 107: Text in einer Form mit Text (.form-inhalt) läuft nach unten über, darum dort auch die Höhe
    alle.filter((e) => !e.classList.contains("ebene") && !e.classList.contains("flaeche") && !e.classList.contains("bild-lagen") && ((e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 0 && getComputedStyle(e).overflowX !== "visible") || (e.classList.contains("form-inhalt") && e.scrollHeight > e.clientHeight + 2 && e.clientHeight > 0)))
      .forEach((e) => melde("FEHLER", nr, "abgeschnitten", `„${kurz(e)}“ ist abgeschnitten → Text kürzen oder dem Element mehr Breite geben (weniger Spalten)`, [ziel(e)]));
    // 2b. Fläche im Stapel (115): sie schneidet an ihrem Rand ab; ein Element, das darüber hinausragt, wird gekappt
    alle.filter((f) => f.classList.contains("flaeche")).forEach((f) => {
      const F = f.getBoundingClientRect();
      [...f.children].filter((e) => e.matches('[data-lage="frei"]')).forEach((e) => {
        const r = e.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return;
        if (r.left < F.left - 2 || r.top < F.top - 2 || r.right > F.right + 2 || r.bottom > F.bottom + 2) {
          melde("FEHLER", nr, "abgeschnitten", `„${kurz(e)}“ ist abgeschnitten (liegt über den Rand der Fläche hinaus) → Fläche höher ziehen oder das Element verkleinern und nach innen schieben`, [ziel(e)]);
        }
      });
    });

    // 3. Überlappungen zwischen Inhalten
    const INHALT = "img,svg:not(.kl-kreis>svg),.spiel-zelle,.kreuz-hinweise li,.raetsel-liste li,.kreuz-titel,.raetsel-wort>span,.blase,.anw,h1,.ziel,.wahlhilfe,.zeile,.antwort,table,.nr,.schreiblinie,.kartentext,.item,.platzhalter,x-wortarten,x-satzglieder,x-wortbausteine,.kl-station,.kl-pfeil,x-stellentafel,x-silben,.timer-text,.leerstelle,.vermutung";
    const teile = alle.filter((e) => e.matches(INHALT)), paare = [];
    const schneidet = (a, b) => {
      const A = a.getBoundingClientRect(), C = b.getBoundingClientRect();
      const w = Math.min(A.right, C.right) - Math.max(A.left, C.left), h = Math.min(A.bottom, C.bottom) - Math.max(A.top, C.top);
      return w > 2 && h > 2 ? [Math.round(w), Math.round(h)] : null;
    };
    for (let i = 0; i < teile.length; i++) for (let j = i + 1; j < teile.length; j++) {
      const a = teile[i], b = teile[j];
      if (a.contains(b) || b.contains(a)) continue;
      if (a.closest(`[data-ueberlagert-ok],${GESTALTUNG}`) || b.closest(`[data-ueberlagert-ok],${GESTALTUNG}`)) continue;
      const s = schneidet(a, b);
      if (s) paare.push([a, b, s]);
    }
    // nur das äußerste überlappende Paar melden
    paare.filter(([a, b]) => !paare.some(([c, d]) => (c !== a || d !== b) &&
        ((c.contains(a) && d.contains(b)) || (c.contains(b) && d.contains(a)))))
      .forEach(([a, b, [w, h]]) => melde("FEHLER", nr, "ueberlappung", `„${kurz(a)}“ überlappt „${kurz(b)}“ (${w} × ${h} px) → Abstand vergrößern, Spalten senken oder das zweite Element in die nächste Zeile`, [ziel(a), ziel(b)]));

    // 3b. Gestaltung (096): außerhalb der Seite, im Druckrand, verdeckt Inhalt. Gemessen wird das Rechteck nach dem
    // Drehen; erst alle Rechtecke sammeln, dann vergleichen. Teile einer Gruppe zählen mit ihr.
    const flaecheVon = (r) => Math.max(0, r.right - r.left) * Math.max(0, r.bottom - r.top);
    const schnitt = (a, b) => ({ left: Math.max(a.left, b.left), top: Math.max(a.top, b.top), right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom) });
    const gestaltung = alle.filter((e) => e.matches('[data-lage="frei"]') && !e.parentElement.closest("[data-lage]")).map((e) => [e, e.getBoundingClientRect()]);
    const kanten = B.classList.contains("minibuch") ? MINIBUCH_AUSSEN[nr] || "" : "olur";
    gestaltung.forEach(([e, r]) => {
      const ganz = flaecheVon(r), sichtbarer = schnitt(r, P);
      if (ganz > 0 && flaecheVon(sichtbarer) < ganz / 2) return melde("FEHLER", nr, "aussen", `„${kurz(e)}“ liegt außerhalb der Seite → in die Seite holen`, [ziel(e)]);
      // Auftakt (217): nur für den Beamer, Szenen laufen bis an den Rand.
      if (!e.matches(IM_DRUCKRAND) || e.closest("[data-rand-ok]") || B.matches(".folie.auftakt") || flaecheVon(sichtbarer) === 0) return;
      const abstand = { o: sichtbarer.top - P.top, l: sichtbarer.left - P.left, u: P.bottom - sichtbarer.bottom, r: P.right - sichtbarer.right };
      const knapp = [...kanten].map((k) => abstand[k]).filter((a) => a < DRUCKRAND);
      if (knapp.length) melde("WARNUNG", nr, "druckrand", `„${kurz(e)}“ liegt im Druckrand (${Math.max(0, Math.round(Math.min(...knapp)))} px vom Blattrand) → etwas nach innen ziehen`, [ziel(e)]);
    });
    // Was hinten liegt, verdeckt nie etwas. Gegen alle Inhalte, auch die der eigenen Aufgabe am Anker.
    const verdeckbar = [...teile.filter((e) => !e.closest(GESTALTUNG)), ...[...S.querySelectorAll(".loesung-marke")].filter(sichtbar)].map((e) => [e, e.getBoundingClientRect()]);
    gestaltung.filter(([e]) => (e.closest(".ebene.vorne") || e.hasAttribute("data-anker")) && !e.closest("[data-ueberlagert-ok]")).forEach(([e, r]) => {
      let unter = null, groesste = VERDECKT_MIN;
      for (const [c, cr] of verdeckbar) {
        const f = flaecheVon(schnitt(r, cr));
        if (f > groesste) { unter = c; groesste = f; }
      }
      if (unter) melde("HINWEIS", nr, "verdeckt", `„${kurz(e)}“ verdeckt „${kurz(unter)}“ (${Math.round(groesste)} px²) → verschieben oder nach hinten legen`, [ziel(e), ziel(unter)]);
    });

    // 4. Schriftgröße nach Klasse
    const min = Math.round(fs * SCHRIFT_MIN), klein = new Map();
    const walker = document.createTreeWalker(S, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const t = walker.currentNode, p = t.parentElement;
      if (!t.textContent.trim() || !p || p.closest("svg,.nr,.namenszeile,.platzhalter,.loesung-marke,.fuss-zeile,.zeilennummer,.seite.lk,.lehrkraft,[data-klein-ok]") || !sichtbar(p)) continue;
      const text = `„${t.textContent.trim().slice(0, 30)}“ (${getComputedStyle(p).fontSize})`;
      if (parseFloat(getComputedStyle(p).fontSize) < min - 0.5 && !klein.has(text)) klein.set(text, p);
    }
    if (klein.size) {
      const erste = [...klein].slice(0, 4);
      melde("WARNUNG", nr, "schrift-klein", `Schrift kleiner als ${min} px ${folie ? "auf Folien (Leseentfernung)" : `für Klasse ${kl}`}: ${erste.map(([t]) => t).join(", ")} → font-size am Element entfernen; die Größe setzt blatt.css`, erste.map(([, p]) => ziel(p)));
    }

    // 5. s/w-Ansicht: Farben rechnet graustufen.js um, zu melden ist nur, was dabei verloren geht
    if (B.classList.contains("sw")) {
      const schwach = [], worte = new Set(), farbworte = [];
      const pruefer = document.createTreeWalker(S, NodeFilter.SHOW_TEXT);
      while (pruefer.nextNode()) {
        const t = pruefer.currentNode, p = t.parentElement;
        if (!t.textContent.trim() || !p || p.closest("svg,.loesung-marke") || !sichtbar(p)) continue;
        const k = kontrastZurFlaeche(p);
        if (k !== null && k < KONTRAST_MIN && !schwach.includes(p)) schwach.push(p);
        for (const m of t.textContent.matchAll(FARBWORT)) { worte.add(m[0].toLowerCase()); if (!farbworte.includes(p)) farbworte.push(p); }
      }
      if (schwach.length) melde("HINWEIS", nr, "kontrast-sw", `In s/w kaum lesbar (Kontrast unter ${KONTRAST_MIN}:1): ${schwach.slice(0, 3).map(kurz).join(", ")}`, schwach.slice(0, 3).map(ziel));
      if (worte.size) melde("HINWEIS", nr, "farbwort-sw", `Der Text nennt Farben (${[...worte].slice(0, 4).join(", ")}), in s/w sind sie nicht zu sehen → Merkmal in Worten nennen`, farbworte.slice(0, 3).map(ziel));
    }
    // 5b. s/w-Druck (249): Die Quelle ist s/w oder der Auftrag nennt s/w-Druck (data-sw-druck setzt blatt.py nur zur
    // Prüfung). Dann ist schwacher Text auf einer Schauseite eine WARNUNG; der HINWEIS oben bleibt, wie er war.
    if (B.classList.contains("sw") && B.hasAttribute("data-sw-druck") && (S.matches(SCHAUSEITE) || B.classList.contains("a3-hoch"))) {
      const blass = [], leser = document.createTreeWalker(S, NodeFilter.SHOW_TEXT);
      while (leser.nextNode()) {
        const t = leser.currentNode, p = t.parentElement;
        if (!t.textContent.trim() || !p || p.closest("svg,.loesung-marke") || !sichtbar(p) || blass.includes(p)) continue;
        const k = kontrastZurFlaeche(p);
        if (k !== null && k < KONTRAST_MIN) blass.push(p);
      }
      if (blass.length) melde("WARNUNG", nr, "kontrast-sw-schau", `Schauseite in s/w kaum lesbar (Kontrast unter ${KONTRAST_MIN}:1), gedruckt wird s/w: ${blass.slice(0, 3).map(kurz).join(", ")} → dunklere Schrift oder hellere Fläche`, blass.slice(0, 3).map(ziel));
    }
    alle.filter((e) => e.tagName === "DIV" || e.tagName === "SECTION").forEach((e) => {
      const c = getComputedStyle(e), r = e.getBoundingClientRect();
      const [R, G, Bl, a = 1] = rgb(c.backgroundColor);
      if (a > 0.05 && (R + G + Bl) / 3 < FLAECHE_HELL && r.width * r.height > FLAECHE_MIN && !e.closest(`.karten,.seite.fall,[data-flaeche-ok],${GESTALTUNG}`))
        melde("WARNUNG", nr, "flaeche", `Fläche hinter „${kurz(e)}“ (${c.backgroundColor}) → Aufgaben ohne Kasten und Fläche`, [ziel(e)]);
    });

    // 6. Bilder: geladen, Auflösung
    [...S.querySelectorAll("img")].filter((im) => !ausgeblendet(im)).forEach((im) => {
      if (!im.complete || !im.naturalWidth) return melde("FEHLER", nr, "bild-fehlt", `Bild fehlt: ${im.getAttribute("src").slice(0, 60)}`, [ziel(im)]);
      const r = im.getBoundingClientRect(), dpi = Math.round((im.naturalWidth / r.width) * 96);
      if (B.classList.contains("sw")) {
        try {
          const c = document.createElement("canvas"); c.width = 64; c.height = 64;
          const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, 64, 64); x.drawImage(im, 0, 0, 64, 64); // auf dem Papier: Strichzeichnungen sind sonst nur Linien
          const d = x.getImageData(0, 0, 64, 64).data, y = [];
          for (let i = 0; i < d.length; i += 4) y.push(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
          y.sort((a, b) => a - b);
          // Spanne zwischen 1 und 99 % der Grauwerte (dünne Striche zählen noch); unter 40 von 255 verschwimmen die Formen im Druck.
          if (y[Math.floor(y.length * 0.99)] - y[Math.floor(y.length * 0.01)] < BILD_SPANNE_MIN) melde("HINWEIS", nr, "bild-kontrast-sw", `Bild „${im.alt || im.getAttribute("src").slice(0, 30)}“ hat in s/w kaum Kontrast`, [ziel(im)]);
        } catch (e) { /* fremde Quelle */ }
      }
      if (dpi < DPI_MIN) melde("HINWEIS", nr, "bild-unscharf", `Bild „${im.alt || "ohne alt"}“ hat im Druck nur ${dpi} dpi (unscharf) → Original in voller Größe einsetzen`, [ziel(im)]);
    });

    // 7. Aufgaben: Anzahl, Abstände, Ausschnitte für die visuelle Endkontrolle
    const auf = [...S.querySelectorAll(".aufgabe")];
    const nichtStern = auf.filter((a) => !a.querySelector(".nr.stern")).length;
    if (nichtStern > RICHTWERT) melde("WARNUNG", nr, "aufgaben-viele", `${nichtStern} Aufgaben (+★): Richtwert Klasse ${kl} sind höchstens ${RICHTWERT} → auf Vorder- und Rückseite verteilen`, [ziel(S)]);
    // 7a. Menge nach Arbeitszeit: Jede Seite ist ein Weg; `data-weiter` an der Seite setzt die vorige fort.
    if (zeitziel && auf.length && !loesungsblatt) {
      if (!S.hasAttribute("data-weiter")) { meldeZeit(); zeitSeite = nr; }
      auf.filter((a) => !a.querySelector(".nr.stern")).forEach((a) => {
        const min = parseFloat(a.dataset.min), punkte = a.querySelectorAll(":scope > .anw .niveau i").length;
        if (!(min > 0)) return zeitFehlt.push(ziel(a));
        zeitGruppen.set(punkte, (zeitGruppen.get(punkte) || 0) + min);
      });
      const kopf = S.querySelector(":scope > .kopf");
      const kopfHoehe = kopf ? Math.round(auf[0].getBoundingClientRect().top - (P.top + randOben)) : 0;
      if (kopfHoehe > KOPF_MAX) melde("WARNUNG", nr, "rahmen-gross", `Kopf ist ${kopfHoehe} px hoch (höchstens ${KOPF_MAX}) → Namenszeile, Kopf und Tipp als Bausteine aus der Vorlage, Tipp neben seine Aufgabe`, [ziel(kopf)]);
      const fussEl = S.querySelector(":scope > .fuss"), fussHoehe = fussEl ? Math.round(fussEl.getBoundingClientRect().height) : 0;
      if (fussHoehe > FUSS_MAX) melde("WARNUNG", nr, "rahmen-gross", `Fuß ist ${fussHoehe} px hoch (höchstens ${FUSS_MAX}) → Baustein .fuss aus der Vorlage unverändert übernehmen, Text kürzen`, [ziel(fussEl)]);
    }
    // Nur Aufgaben, die in dieser Fassung stehen: „Nur Lösung“ auf dem Arbeitsblatt hat keinen Kasten (193-28).
    const gezeigt = auf.map((a, i) => [a, i + 1]).filter(([a]) => a.getClientRects().length > 0);
    for (let i = 1; i < gezeigt.length; i++) {
      const [vorige, v] = gezeigt[i - 1], [a, n] = gezeigt[i];
      const gap = a.getBoundingClientRect().top - vorige.getBoundingClientRect().bottom;
      if (gap < ABSTAND_MIN) melde("WARNUNG", nr, "abstand-knapp", `Nur ${Math.round(gap)} px zwischen Aufgabe ${v} und ${n} → eigene margin an der Aufgabe entfernen`, [ziel(vorige), ziel(a)]);
    }

    // 8. Ungenutzter Platz (Folien dürfen leer sein: eine Aussage je Folie)
    const fuss = S.querySelector(".fuss");
    const inhalt = [...S.children].filter((e) => e !== fuss && !e.classList.contains("ebene") && !e.classList.contains("fuss-zeile") && sichtbar(e));
    const unten = Math.max(P.top + randOben, ...inhalt.map((e) => e.getBoundingClientRect().bottom));
    const rest = Math.round((fuss ? fuss.getBoundingClientRect().top - 16 : innen.b) - unten);
    // Folgt eine automatische Seite (data-weiter="auto", Schoolbox 206), passte der nächste Block nicht mehr hierher.
    const folgtAuto = !!S.nextElementSibling?.matches('.seite[data-weiter="auto"]');
    const freiZaehlt = !folgtAuto && !S.querySelector(".karten,.schneidebogen") && !folie && !B.classList.contains("minibuch");
    // Satz 2: Arbeitsseite heißt A4 mit Aufgaben. `data-dicht-ok` an der Seite, wenn sie mit Absicht wenig trägt
    // (Forscherbogen, Bastelvorlage, große Zeichnung); A5 sind Stationskarten.
    const arbeitsseite = satz2 && auf.length > 0 && freiZaehlt && !B.classList.contains("a5-hoch") && !S.matches("[data-dicht-ok],.fall,.deckblatt,.lk");
    if (zeitziel && auf.length && rest > FREI_MAX && freiZaehlt)
      melde("WARNUNG", nr, "platz-frei", `${rest} px frei unten → Item, Reihe oder Aufgabe ergänzen (Menge nach Arbeitszeit)`, [ziel(S)]);
    else if (arbeitsseite && rest > FREI_MAX)
      melde("WARNUNG", nr, "platz-frei", `${rest} px frei unten → Item, Reihe oder Aufgabe ergänzen (eine Arbeitsseite ist gefüllt wie im Schulbuch)`, [ziel(S)]);
    else if (rest > FREI_HINWEIS && freiZaehlt)
      melde("HINWEIS", nr, "platz-frei", `${rest} px frei unten → Item, Reihe oder Aufgabe ergänzen`, [ziel(S)]);
    // 8b. Satz 2: zu wenig auf einer Arbeitsseite. Die Fläche zählt in Feldern von 6 px; jedes Stück Inhalt belegt sich
    // selbst und eine halbe Schrifthöhe ringsum, damit Wort- und Zeilenabstände nicht als leer gelten. Ist unten ohnehin
    // Platz frei (platz-frei), sagt die Fläche nichts Neues.
    if (arbeitsseite && !loesungsblatt) {
      const teile = auf.reduce((n, a) => n + teilaufgaben(a), 0);
      if (auf.length < AUFGABEN_MIN || teile < TEILE_MIN)
        melde("WARNUNG", nr, "inhalt-wenig", `${auf.length} ${auf.length === 1 ? "Aufgabe" : "Aufgaben"} mit ${teile} Teilaufgaben: Eine Arbeitsseite trägt mindestens ${AUFGABEN_MIN} Aufgaben und ${TEILE_MIN} Teilaufgaben → Items in Reihen ergänzen, weitere Aufgabe; trägt die Seite mit Absicht wenig (Forscherbogen, Bastelvorlage), data-dicht-ok an die Seite`, [ziel(S)]);
      const Z = 6, um = fs / 2, sp = Math.ceil((innen.r - innen.l) / Z), ze = Math.ceil((innen.b - innen.t) / Z), feld = new Uint8Array(sp * ze);
      const belege = (r) => {
        if (r.width < 1 || r.height < 1) return;
        const x1 = Math.max(0, Math.floor((r.left - um - innen.l) / Z)), x2 = Math.min(sp - 1, Math.floor((r.right + um - innen.l) / Z));
        const y1 = Math.max(0, Math.floor((r.top - um - innen.t) / Z)), y2 = Math.min(ze - 1, Math.floor((r.bottom + um - innen.t) / Z));
        for (let y = y1; y <= y2; y++) if (x2 >= x1) feld.fill(1, y * sp + x1, y * sp + x2 + 1);
      };
      const umrandet = (e) => { const c = getComputedStyle(e); return parseFloat(c.borderTopWidth) > 0 && parseFloat(c.borderBottomWidth) > 0 && parseFloat(c.borderLeftWidth) > 0; };
      alle.filter((e) => !e.closest(GESTALTUNG) && e !== S && (e.matches(`img,svg,canvas,table,.nr,${TEIL}`) || umrandet(e))).forEach((e) => belege(e.getBoundingClientRect()));
      const leser = document.createTreeWalker(S, NodeFilter.SHOW_TEXT), bereich = document.createRange();
      while (leser.nextNode()) {
        const t = leser.currentNode, p = t.parentElement;
        if (!t.textContent.trim() || !p || p.closest(`svg,${GESTALTUNG}`) || !sichtbar(p)) continue;
        bereich.selectNodeContents(t);
        [...bereich.getClientRects()].forEach(belege);
      }
      const leer = Math.round(100 * (1 - feld.reduce((n, v) => n + v, 0) / feld.length));
      if (leer > LEER_MAX && rest <= FREI_MAX)
        melde("WARNUNG", nr, "inhalt-wenig", `${leer} % der Seite sind leer (höchstens ${LEER_MAX} %) → Reihen mit mehr Spalten, Items oder eine Aufgabe ergänzen, Abbildungen nebeneinander`, [ziel(S)]);
      seitenLeer = leer;
    }
    // 8c. Satz 2: Ausschneide- und Legematerial (214). Karten und Dominosteine schneidet die Lehrkraft, Teile im
    // Schneidebogen die Kinder. Maße: grundschul-didaktik/references/druck-und-platz.md, „Ausschneide- und Legematerial“.
    if (satz2) {
      const MM = 96 / 25.4, mm = (px) => Math.round(px / MM);
      const TEILE_MAX = 9, KANTE_MIN = { karte: 50, stein: 50, kind: 40 }, STEIN_LANG_MIN = 105, MOTIV_MIN = 0.5, SCHNITT_MIN = 5; // mm
      const stuecke = [
        ...[...S.querySelectorAll(".karten > .karte:not(.pass)")].map((e) => ["karte", e]),
        ...[...S.querySelectorAll(".domino-stein")].map((e) => ["stein", e]),
        ...[...S.querySelectorAll(".schneidebogen > *")].map((e) => ["kind", e]),
      ].filter(([, e]) => !ausgeblendet(e) && sichtbar(e));
      if (stuecke.length > TEILE_MAX && !B.classList.contains("a5-hoch"))
        melde("WARNUNG", nr, "teile-viele", `${stuecke.length} Teile zum Ausschneiden auf der Seite (höchstens ${TEILE_MAX} je A4, lieber 4–6) → größere Teile: weniger Spalten und Zeilen, der Rest auf die nächste Seite`, stuecke.slice(0, 3).map(([, e]) => ziel(e)));
      const NAME = { karte: ["Karte", "Karten"], stein: ["Dominostein", "Dominosteine"], kind: ["Teil zum Selbstschneiden", "Teile zum Selbstschneiden"] };
      const anzahl = (art, n) => `${n} ${NAME[art][n === 1 ? 0 : 1]}`;
      const RAT_KLEIN = {
        karte: `kurze Kante unter ${KANTE_MIN.karte} mm → weniger Spalten oder Zeilen in .karten (Standard 70 × 100 mm, höchstens ${TEILE_MAX} je A4)`,
        stein: `kleiner als ${STEIN_LANG_MIN} × ${KANTE_MIN.stein} mm → je-seite weglassen, bei vielen Steinen a4-quer`,
        kind: `kurze Kante unter ${KANTE_MIN.kind} mm → --teil-b und --teil-h auf 40–50 mm, weniger Teile je Bogen`,
      };
      for (const art of ["karte", "stein", "kind"]) {
        const eigene = stuecke.filter(([a]) => a === art).map(([, e]) => e);
        if (!eigene.length) continue;
        const mass = (e) => { const r = e.getBoundingClientRect(); return [r.width / MM, r.height / MM]; };
        const klein = eigene.filter((e) => {
          const [b, h] = mass(e), kurz = Math.min(b, h), lang = Math.max(b, h);
          return art === "stein" ? kurz < KANTE_MIN.stein - 0.5 || lang < STEIN_LANG_MIN - 0.5 : kurz < KANTE_MIN[art] - 0.5;
        });
        if (klein.length) {
          const [b, h] = mass(klein[0]);
          melde("WARNUNG", nr, "teil-klein", `${anzahl(art, klein.length)} ${klein.length === 1 ? "ist" : "sind"} zu klein (${Math.round(b)} × ${Math.round(h)} mm): ${RAT_KLEIN[art]}`, klein.slice(0, 3).map(ziel));
        }
        // Motiv: Bilder, Zeichnungen und Abbildungen einer Karte zusammen, gemessen an der Karte ohne 5 mm Rand
        if (art !== "stein") {
          let kleinstes = 1;
          const motivKlein = eigene.filter((e) => {
            if (e.matches(".rueckseite,.deckkarte")) return false;
            const motive = [...e.querySelectorAll("img,svg,canvas")].filter((m) => !m.closest(".ecke") && !m.parentElement.closest("svg") && sichtbar(m));
            if (!motive.length) return false;
            const K = e.getBoundingClientRect(), rs = motive.map((m) => m.getBoundingClientRect());
            const flaeche = (Math.max(...rs.map((r) => r.right)) - Math.min(...rs.map((r) => r.left))) * (Math.max(...rs.map((r) => r.bottom)) - Math.min(...rs.map((r) => r.top)));
            const anteil = flaeche / Math.max(1, (K.width - 10 * MM) * (K.height - 10 * MM));
            if (anteil < MOTIV_MIN) kleinstes = Math.min(kleinstes, anteil);
            return anteil < MOTIV_MIN;
          });
          if (motivKlein.length)
            melde("WARNUNG", nr, "motiv-klein", `${anzahl(art, motivKlein.length)} mit kleinem Motiv (${Math.round(kleinstes * 100)} % der Fläche, Ziel 60–70 %) → Motiv größer: Bild ohne feste Größe, x-gitter ohne kaestchen (füllt die Karte von selbst), oder die Karte kleiner`, motivKlein.slice(0, 3).map(ziel));
        }
        // Abstand zur Schnittkante: Text und Bilder mindestens 5 mm vom Rand des Teils
        let naechster = Infinity;
        const knapp = eigene.filter((e) => {
          const K = e.getBoundingClientRect(), rechtecke = [];
          const leser = document.createTreeWalker(e, NodeFilter.SHOW_TEXT), bereich = document.createRange();
          while (leser.nextNode()) {
            const t = leser.currentNode;
            if (!t.textContent.trim() || !t.parentElement || t.parentElement.closest("svg") || !sichtbar(t.parentElement)) continue;
            bereich.selectNodeContents(t);
            rechtecke.push(...bereich.getClientRects());
          }
          [...e.querySelectorAll("img,svg,canvas")].filter((m) => !m.parentElement.closest("svg") && sichtbar(m)).forEach((m) => rechtecke.push(m.getBoundingClientRect()));
          const abstand = Math.min(Infinity, ...rechtecke.filter((r) => r.width > 0 && r.height > 0).map((r) => Math.min(r.left - K.left, r.top - K.top, K.right - r.right, K.bottom - r.bottom)));
          if (abstand < SCHNITT_MIN * MM - 1) naechster = Math.min(naechster, abstand);
          return abstand < SCHNITT_MIN * MM - 1;
        });
        if (knapp.length)
          melde("WARNUNG", nr, "schnitt-knapp", `${anzahl(art, knapp.length)} mit Inhalt nur ${Math.max(0, mm(naechster))} mm an der Schnittkante (mindestens ${SCHNITT_MIN} mm) → Innenabstand aus blatt.css lassen, Text kürzen oder Motiv kleiner`, knapp.slice(0, 3).map(ziel));
      }
      // 249: Was die Kinder sonst ausschneiden (.ausschneiden, Motiv mit Schnittkontur data-schnitt), gilt wie ein Teil
      // im Schneidebogen.
      const ausschnitt = [...S.querySelectorAll(".ausschneiden,[data-schnitt]")].filter((e) => !e.closest(".karte,.schneidebogen") && !e.parentElement.closest(".ausschneiden,[data-schnitt]") && !ausgeblendet(e) && sichtbar(e));
      const schnittMass = (e) => { const r = e.getBoundingClientRect(); return [r.width / MM, r.height / MM]; };
      const zuKlein = ausschnitt.filter((e) => Math.min(...schnittMass(e)) < KANTE_MIN.kind - 0.5);
      if (zuKlein.length) {
        const [b, h] = schnittMass(zuKlein[0]);
        melde("WARNUNG", nr, "teil-klein", `${anzahl("kind", zuKlein.length)} ${zuKlein.length === 1 ? "ist" : "sind"} zu klein (${Math.round(b)} × ${Math.round(h)} mm): kurze Kante unter ${KANTE_MIN.kind} mm → Motiv oder Teil größer setzen, weniger Teile je Seite`, zuKlein.slice(0, 3).map(ziel));
      }
    }
    if (folie && mitNotizen && !S.querySelector(".notiz")) melde("HINWEIS", nr, "notiz-fehlt", "Folie ohne Notiz für die Lehrkraft", [ziel(S)]);

    const ph = [...S.querySelectorAll(".platzhalter")].filter((e) => !ausgeblendet(e));
    if (ph.length) melde("HINWEIS", nr, "platzhalter", `${ph.length} Platzhalter (Entwurf)`, ph.map(ziel));
    // 8. Symmetrie (245): Fragt ein Gitter nur nach einer Achse, nennt die Anweisung sie.
    auf.forEach((a, ai) => {
      const anw = (a.querySelector(":scope > .anw")?.textContent || "").replace(/\s+/g, " ").trim(), nrText = `A${a.querySelector(":scope > .nr")?.textContent.trim() || ai + 1}`;
      a.querySelectorAll('x-gitter[aufgabe="pruefen"][nur]').forEach((g) => {
        const wort = g.getAttribute("nur");
        if (["senkrecht", "waagerecht"].includes(wort) && SYMMETRIE_WORT.test(anw) && !anw.toLowerCase().includes(wort))
          melde("FEHLER", nr, "symmetrie-achse", `${nrText}: Das Gitter zählt nur die ${wort}e Achse, die Anweisung nennt sie nicht → „${wort}“ in die Anweisung schreiben`, [ziel(g)]);
      });
    });

    // 9. Platz und Größe (249). Maße in mm; die Aufgabe heißt wie ihre Nummer („A3“), außerhalb einer Aufgabe null.
    const mmVon = (e) => { const r = e.getBoundingClientRect(); return [r.width / PX_MM, r.height / PX_MM]; };
    const aufgabeVon = (e) => { const a = e.closest(".aufgabe"); return a && auf.includes(a) ? `A${a.querySelector(":scope > .nr")?.textContent.trim() || auf.indexOf(a) + 1}` : null; };
    const vorn = (wo) => (wo ? `${wo}: ` : "");
    // 9a. Felder mit Zweck: data-fuer="80x95" nennt in mm, was hineinkommt; gedreht einlegen gilt (ein Faltschnitt dreht sich).
    [...S.querySelectorAll(".feld-kleben,.feld-zeichnen")].filter((e) => !ausgeblendet(e) && sichtbar(e)).forEach((e) => {
      const kleben = e.classList.contains("feld-kleben"), [b, h] = mmVon(e), fuer = e.getAttribute("data-fuer");
      const feld = `${vorn(aufgabeVon(e))}${kleben ? "Klebefeld" : "Zeichenfeld"} ${Math.round(b)} × ${Math.round(h)} mm`;
      if (fuer !== null) {
        const t = /^\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*$/.exec(fuer);
        if (!t) return melde("FEHLER", nr, "feld-fuer", `${feld}: data-fuer="${fuer}" ist kein Maß → Breite x Höhe in mm, z. B. data-fuer="80x95"`, [ziel(e)]);
        const [fb, fh] = [t[1], t[2]].map((w) => parseFloat(w.replace(",", ".")));
        const passt = (x, y) => b + 0.5 >= x + 2 * FELD_RAND && h + 0.5 >= y + 2 * FELD_RAND;
        if (!passt(fb, fh) && !passt(fh, fb))
          melde("FEHLER", nr, "feld-klein", `${feld}, hinein soll ${Math.round(fb)} × ${Math.round(fh)} mm → Feld mindestens ${Math.ceil(fb + 2 * FELD_RAND)} × ${Math.ceil(fh + 2 * FELD_RAND)} mm (${FELD_RAND} mm Rand je Seite): --b und --h am Feld, eine Spalte weniger oder eigene Zeile`, [ziel(e)]);
        return;
      }
      if (kleben) return melde("WARNUNG", nr, "feld-fuer", `${feld} ohne data-fuer → Maß dessen, was hineinkommt, in mm setzen (data-fuer="80x95"), dann prüft blatt.py, ob es passt`, [ziel(e)]);
      const min = ZEICHENFELD_MIN[kl] || ZEICHENFELD_MIN[2];
      if (Math.min(b, h) + 0.5 < min) melde("WARNUNG", nr, "feld-klein", `${feld}: Klasse ${kl} braucht zum Zeichnen mindestens ${min} × ${min} mm → --b und --h größer, eine Spalte weniger, oder data-fuer mit dem Maß der Zeichnung`, [ziel(e)]);
    });
    // 9b. Schreiblinien nach Antwort: data-antwort an der Aufgabe oder an einer Gruppe von Linien
    const LINIE = ".schreiblinie,.zeile-frei";
    const zeigt = (e) => sichtbar(e) && !ausgeblendet(e) && !e.closest(".nur-loesung");
    [...S.querySelectorAll("[data-antwort]")].filter((e) => !ausgeblendet(e)).forEach((e) => {
      const art = e.getAttribute("data-antwort"), wo = vorn(aufgabeVon(e));
      if (!ANTWORTEN.includes(art)) return melde("FEHLER", nr, "antwort-menge", `${wo}data-antwort="${art}" gibt es nicht → ${ANTWORTEN.join(", ")}`, [ziel(e)]);
      const min = LINIEN_MIN[art]?.[kl] ?? LINIEN_MIN[art]?.[2];
      const linien = (e.matches(LINIE) ? [e] : [...e.querySelectorAll(LINIE)]).filter((l) => zeigt(l) && l.closest("[data-antwort]") === e);
      if (!min || (!linien.length && e.querySelector("[data-antwort]"))) return;
      const name = art === "satz" ? "einen Satz" : "eine Begründung";
      if (linien.length < min) melde("WARNUNG", nr, "linien-wenig", `${wo}${linien.length} ${linien.length === 1 ? "Schreiblinie" : "Schreiblinien"} für ${name}, Klasse ${kl} braucht mindestens ${min} → weitere .schreiblinie`, [ziel(e)]);
    });
    // Begründen ohne Angabe, wie viel: ein HINWEIS je Seite, damit er keine wichtigeren verdrängt
    const offen = auf.filter((a) => {
      if (!a.getClientRects().length || a.matches("[data-antwort]") || a.querySelector("[data-antwort]")) return false;
      if (![...a.querySelectorAll(`${LINIE},.antwort`)].some(zeigt)) return false;
      const leser = document.createTreeWalker(a, NodeFilter.SHOW_TEXT);
      while (leser.nextNode()) {
        const p = leser.currentNode.parentElement;
        if (p && !p.closest("svg,.tipp,.blase,.nur-loesung") && sichtbar(p) && BEGRUENDUNG_WORT.test(leser.currentNode.textContent)) return true;
      }
      return false;
    });
    if (offen.length) melde("HINWEIS", nr, "antwort-menge", `${offen.map(aufgabeVon).join(", ")}: Begründen oder Erklären, aber wie viel schreibt das Kind? → data-antwort="satz" oder "begruendung" an die Aufgabe, dann zählt blatt.py die Schreiblinien`, offen.slice(0, 3).map(ziel));
    // 9c. Messung für den Prüflauf: leere Felder (Rahmen ohne Text und ohne Abbildung, auch als Rechteck in eigenem
    // SVG) und Teile zum Ausschneiden mit ihrem Motiv. Kästchen unter LEERFELD_MIN, Schreiblinien (nur ein Strich
    // unten) und Rahmen um ganze Aufgaben (mit Text) fallen von selbst heraus; Abbildungen (x-…) haben eigene Maße.
    const hell = (farbe) => { const [r, g, b, a = 1] = rgb(farbe); return farbe === "none" || a < 0.05 || (r + g + b) / 3 >= 240; };
    const duenn = (r) => r.width <= 4 || r.height <= 4; // Falt-, Schnitt- und Hilfslinien
    const gross = ([b, h]) => b >= LEERFELD_MIN && h >= LEERFELD_MIN;
    const gerahmt = (e) => { const c = getComputedStyle(e); return ["Top", "Right", "Bottom", "Left"].every((k) => parseFloat(c[`border${k}Width`]) > 0 && c[`border${k}Style`] !== "none"); };
    // Ein Rahmen ohne Breite (nur seine Striche) zählt mit: Er sieht aus wie eine Linie und ist kein Feld mehr.
    // Bilder mit Rand sind kein Feld; ein Rahmen um mehr als die halbe Seite ist Schmuck (Seitenrahmen, Deckblatt).
    const halbeSeite = ((innen.r - innen.l) * (innen.b - innen.t)) / 2;
    const leerKasten = alle.filter((e) => e !== S && !e.matches("svg,hr,img,canvas,video,iframe,object,embed,input,textarea,select") && !e.closest(GESTALTUNG) && !istInAbbildung(e) && gerahmt(e) && Math.max(...mmVon(e)) >= LEERFELD_MIN && e.getBoundingClientRect().width * e.getBoundingClientRect().height <= halbeSeite && !e.innerText.trim() && ![...e.querySelectorAll("img,svg,canvas,video,input,textarea")].some(sichtbar));
    const leerRechteck = [...S.querySelectorAll("svg rect")].filter((r) => !istInAbbildung(r) && !r.closest(GESTALTUNG)).filter((r) => {
      const c = getComputedStyle(r), R = r.getBoundingClientRect();
      if (c.stroke === "none" || !(parseFloat(c.strokeWidth) > 0) || !hell(c.fill) || !gross(mmVon(r))) return false;
      return ![...r.ownerSVGElement.querySelectorAll(FORM)].some((x) => {
        if (x === r) return false;
        const X = x.getBoundingClientRect();
        return X.width > 0 && X.height > 0 && !duenn(X) && X.left >= R.left - 2 && X.right <= R.right + 2 && X.top >= R.top - 2 && X.bottom <= R.bottom + 2;
      });
    });
    const motiv = (e) => {
      const rs = [];
      e.querySelectorAll("img").forEach((im) => {
        if (!sichtbar(im) || !im.naturalWidth) return;
        const r = im.getBoundingClientRect(), s = Math.min(r.width / im.naturalWidth, r.height / im.naturalHeight);
        rs.push(getComputedStyle(im).objectFit === "contain" ? { width: im.naturalWidth * s, height: im.naturalHeight * s } : r);
      });
      e.querySelectorAll("svg,canvas").forEach((g) => {
        if (g.parentElement.closest("svg") || !sichtbar(g)) return;
        if (g.tagName === "canvas") return rs.push(g.getBoundingClientRect());
        const teile = [...g.querySelectorAll(FORM)].map((x) => x.getBoundingClientRect()).filter((X) => X.width > 0 && X.height > 0 && !duenn(X));
        if (!teile.length) return;
        rs.push({ width: Math.max(...teile.map((X) => X.right)) - Math.min(...teile.map((X) => X.left)), height: Math.max(...teile.map((X) => X.bottom)) - Math.min(...teile.map((X) => X.top)) });
      });
      if (!rs.length) return null;
      const grosses = rs.reduce((m, r) => (r.width * r.height > m.width * m.height ? r : m));
      return [Math.round(grosses.width / PX_MM), Math.round(grosses.height / PX_MM)];
    };
    const zumSchneiden = [...S.querySelectorAll(".karten > .karte:not(.pass),.domino-stein,.schneidebogen > *,.ausschneiden,[data-schnitt]")].filter((e) => !e.parentElement.closest(".karte,.ausschneiden,[data-schnitt]") && !ausgeblendet(e) && sichtbar(e));
    const gruppen = new Map();
    const sammle = (art, e, extra = {}) => {
      const [b, h] = mmVon(e).map(Math.round), aufgabe = aufgabeVon(e), schluessel = JSON.stringify([art, aufgabe, b, h]);
      const g = gruppen.get(schluessel) || { seite: nr, aufgabe, art, anzahl: 0, breite: b, hoehe: h };
      g.anzahl += 1;
      if (extra.motiv !== undefined) {
        const m = extra.motiv, f = (x) => (x ? x[0] * x[1] : -1);
        if (!g.motiv) g.motiv = { klein: m, gross: m };
        else {
          if (f(m) < f(g.motiv.klein)) g.motiv.klein = m;
          if (f(m) > f(g.motiv.gross)) g.motiv.gross = m;
        }
      }
      gruppen.set(schluessel, g);
    };
    [...leerKasten.filter((e) => !leerKasten.some((o) => o !== e && o.contains(e))), ...leerRechteck]
      .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)).forEach((e) => sammle("leer", e));
    zumSchneiden.forEach((e) => sammle("teil", e, { motiv: motiv(e) }));
    felder.push(...gruppen.values());

    seiten.push({ nr, rest, breite: Math.round(P.width), aufgaben: auf.map((a) => rel(a.getBoundingClientRect())), ...(seitenLeer === null ? {} : { leer: seitenLeer }) });
  });
  meldeZeit();

  // Ausgeblendetes (data-aus) wird nicht gedruckt (F10): einmal je Material, Ziel ist das erste.
  const aus = [...document.querySelectorAll("[data-aus]")].filter((e) => !e.parentElement.closest("[data-aus]"));
  if (aus.length) {
    const [erstes] = aus, m = erstes.closest("[data-sb]"), eins = aus.length === 1;
    melde("HINWEIS", 0, "ausgeblendet", `${aus.length} ${eins ? "Element ist" : "Elemente sind"} ausgeblendet und ${eins ? "wird" : "werden"} nicht gedruckt → in den Ebenen wieder einblenden`, [{ sb: m ? +m.getAttribute("data-sb") : null, name: kurz(erstes), rechteck: [0, 0, 0, 0] }]);
  }

  ergebnis = { klasse: kl, seiten };
  ergebnis.felder = felder;
 } catch (e) { M.push({ stufe: "FEHLER", seite: 0, code: "pruefskript", text: "Prüfskript: " + e.message, ziele: [] }); }
 return Object.assign({ seiten: [] }, ergebnis, { meldungen: M });
 };

 window.pruefeBlatt = pruefe;
 const skript = document.currentScript;
 if (skript && skript.hasAttribute("data-manuell")) return;
 pruefe().then((bericht) => {
  const out = document.createElement("script");
  out.type = "application/json"; out.id = "pruefbericht";
  out.textContent = JSON.stringify(bericht);
  document.body.appendChild(out);
 });
})();
