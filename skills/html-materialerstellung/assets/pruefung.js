/* Automatische Layoutprüfung im Browser. blatt.py fügt dieses Skript nur zur Prüfung ein und liest
   das Ergebnis aus dem JSON-Element #pruefbericht. Stufen: FEHLER, WARNUNG, HINWEIS.
   Jede Meldung hat neben dem Text einen Code (ueberlauf, rand, ueberlappung, schrift-klein, kontrast-sw …) und die
   betroffenen Elemente als ziele: [{ sb, name, rechteck: [x, y, breite, hoehe] auf der Seite }], sb = data-sb aus
   dem Editor der Schoolbox, sonst null. Mit data-manuell am <script> prüft es nicht von selbst: Dann ruft der
   Editor window.pruefeBlatt({ warten: false }) und bekommt den Bericht zurück. */
(function () {
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
  const RICHTWERT = { 1: 3, 2: 4, 3: 5, 4: 6 }[kl] || 6;
  const fs = parseFloat(getComputedStyle(B).fontSize);
  const folie = B.classList.contains("folie"), mitNotizen = !!document.querySelector(".seite .notiz");
  const kurz = (el) => el.dataset.name || (el.matches(".antwort") && !el.textContent.trim() ? "Antwortlinie" : (el.textContent || el.getAttribute("alt") || el.tagName.toLowerCase()).trim().replace(/\s+/g, " ").slice(0, 40));
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

  const seiten = [];
  const feldzahl = document.querySelectorAll(".seite").length;
  if (B.classList.contains("minibuch") && feldzahl !== 8) melde("FEHLER", 0, "minibuch-seiten", `Ein Mini-Book hat genau 8 Seiten, dieses hat ${feldzahl} → --vorlage minibuch als Ausgangspunkt nehmen`);
  // nur äußere Seiten: In „Folien mit Notizen“ stecken die Folien verkleinert in einem Blatt
  [...document.querySelectorAll(".seite")].filter((s) => !s.parentElement.closest(".seite")).forEach((S, si) => {
    const nr = si + 1, P = S.getBoundingClientRect(), rand = parseFloat(getComputedStyle(S).paddingLeft);
    const innen = { l: P.left + rand - 1, t: P.top + rand - 1, r: P.right - rand + 1, b: P.bottom - rand + 1 };
    const rel = (r) => [Math.round(r.left - P.left), Math.round(r.top - P.top), Math.round(r.width), Math.round(r.height)];
    // sb: das nächste Element mit Nummer, denn die Zeichnung einer Abbildung (svg) hat keine eigene
    const ziel = (e) => { const m = e.closest("[data-sb]"); return { sb: m ? +m.getAttribute("data-sb") : null, name: kurz(e), rechteck: rel(e.getBoundingClientRect()) }; };
    const alle = [...S.querySelectorAll("*")].filter((e) => !e.closest("svg") || e.tagName.toLowerCase() === "svg").filter(sichtbar);

    // 0. Abbildungen, die nicht gezeichnet werden konnten (meldeFehler in abbildungen.js)
    S.querySelectorAll("[data-fehler]").forEach((e) => {
      const name = e.dataset.name || (window.abbildungsName ? window.abbildungsName(e.localName) : e.localName);
      melde("FEHLER", nr, "abbildung", `Abbildung „${name}“: ${e.getAttribute("data-fehler")}`, [ziel(e)]);
    });
    if (S.querySelector("[data-masstab]") && !M.some((m) => m.code === "masstab"))
      melde("HINWEIS", nr, "masstab", "In Originalgröße drucken (100 %, nicht „An Seite anpassen“) → --druckhinweis beim Anlegen setzen", [ziel(S.querySelector("[data-masstab]"))]);

    // 1. Seitenrand und Seitenende
    const raus = alle.filter((e) => !e.closest(".karten,.loesung-marke,[data-rand-ok]")).filter((e) => {
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

    // 2. Abgeschnittener oder zu breiter Text
    alle.filter((e) => e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 0 && getComputedStyle(e).overflowX !== "visible")
      .forEach((e) => melde("FEHLER", nr, "abgeschnitten", `„${kurz(e)}“ ist abgeschnitten`, [ziel(e)]));

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
      if (a.closest("[data-ueberlagert-ok]") || b.closest("[data-ueberlagert-ok]")) continue;
      const s = schneidet(a, b);
      if (s) paare.push([a, b, s]);
    }
    // nur das äußerste überlappende Paar melden
    paare.filter(([a, b]) => !paare.some(([c, d]) => (c !== a || d !== b) &&
        ((c.contains(a) && d.contains(b)) || (c.contains(b) && d.contains(a)))))
      .forEach(([a, b, [w, h]]) => melde("FEHLER", nr, "ueberlappung", `„${kurz(a)}“ überlappt „${kurz(b)}“ (${w} × ${h} px)`, [ziel(a), ziel(b)]));

    // 4. Schriftgröße nach Klasse
    const min = Math.round(fs * 0.8), klein = new Map();
    const walker = document.createTreeWalker(S, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const t = walker.currentNode, p = t.parentElement;
      if (!t.textContent.trim() || !p || p.closest("svg,.nr,.namenszeile,.platzhalter,.loesung-marke,[data-klein-ok]") || !sichtbar(p)) continue;
      const text = `„${t.textContent.trim().slice(0, 30)}“ (${getComputedStyle(p).fontSize})`;
      if (parseFloat(getComputedStyle(p).fontSize) < min - 0.5 && !klein.has(text)) klein.set(text, p);
    }
    if (klein.size) {
      const erste = [...klein].slice(0, 4);
      melde("WARNUNG", nr, "schrift-klein", `Schrift kleiner als ${min} px ${folie ? "auf Folien (Leseentfernung)" : `für Klasse ${kl}`}: ${erste.map(([t]) => t).join(", ")}`, erste.map(([, p]) => ziel(p)));
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
    alle.filter((e) => e.tagName === "DIV" || e.tagName === "SECTION").forEach((e) => {
      const c = getComputedStyle(e), r = e.getBoundingClientRect();
      const [R, G, Bl, a = 1] = rgb(c.backgroundColor);
      if (a > 0.05 && (R + G + Bl) / 3 < 245 && r.width * r.height > 4000 && !e.closest(".karten,[data-flaeche-ok]"))
        melde("WARNUNG", nr, "flaeche", `Fläche hinter „${kurz(e)}“ (${c.backgroundColor}) → Aufgaben ohne Kasten und Fläche`, [ziel(e)]);
    });

    // 6. Bilder: geladen, Auflösung
    S.querySelectorAll("img").forEach((im) => {
      if (!im.complete || !im.naturalWidth) return melde("FEHLER", nr, "bild-fehlt", `Bild fehlt: ${im.getAttribute("src").slice(0, 60)}`, [ziel(im)]);
      const r = im.getBoundingClientRect(), dpi = Math.round((im.naturalWidth / r.width) * 96);
      if (B.classList.contains("sw")) {
        try {
          const c = document.createElement("canvas"); c.width = 64; c.height = 64;
          const x = c.getContext("2d"); x.drawImage(im, 0, 0, 64, 64);
          const d = x.getImageData(0, 0, 64, 64).data, y = [];
          for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) y.push(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
          y.sort((a, b) => a - b);
          // Spanne zwischen 1 und 99 % der Grauwerte (dünne Striche zählen noch); unter 40 von 255 verschwimmen die Formen im Druck.
          if (y.length && y[Math.floor(y.length * 0.99)] - y[Math.floor(y.length * 0.01)] < 40) melde("HINWEIS", nr, "bild-kontrast-sw", `Bild „${im.alt || im.getAttribute("src").slice(0, 30)}“ hat in s/w kaum Kontrast`, [ziel(im)]);
        } catch (e) { /* fremde Quelle */ }
      }
      if (dpi < 150) melde("HINWEIS", nr, "bild-unscharf", `Bild „${im.alt || "ohne alt"}“ hat im Druck nur ${dpi} dpi (unscharf) → Original in voller Größe einsetzen`, [ziel(im)]);
    });

    // 7. Aufgaben: Anzahl, Abstände, Ausschnitte für die visuelle Endkontrolle
    const auf = [...S.querySelectorAll(".aufgabe")];
    const nichtStern = auf.filter((a) => !a.querySelector(".nr.stern")).length;
    if (nichtStern > RICHTWERT) melde("WARNUNG", nr, "aufgaben-viele", `${nichtStern} Aufgaben (+★): Richtwert Klasse ${kl} sind höchstens ${RICHTWERT} → Übersicht vor Menge`, [ziel(S)]);
    for (let i = 1; i < auf.length; i++) {
      const gap = auf[i].getBoundingClientRect().top - auf[i - 1].getBoundingClientRect().bottom;
      if (gap < 20) melde("WARNUNG", nr, "abstand-knapp", `Nur ${Math.round(gap)} px zwischen Aufgabe ${i} und ${i + 1}`, [ziel(auf[i - 1]), ziel(auf[i])]);
    }

    // 8. Ungenutzter Platz (Folien dürfen leer sein: eine Aussage je Folie)
    const fuss = S.querySelector(".fuss");
    const inhalt = [...S.children].filter((e) => e !== fuss && sichtbar(e));
    const unten = Math.max(P.top + rand, ...inhalt.map((e) => e.getBoundingClientRect().bottom));
    const rest = Math.round((fuss ? fuss.getBoundingClientRect().top - 16 : innen.b) - unten);
    if (rest > 150 && !S.querySelector(".karten") && !folie && !B.classList.contains("minibuch"))
      melde("HINWEIS", nr, "platz-frei", `${rest} px frei unten → ${kl <= 2 ? "Abstand zwischen Aufgaben vergrößern (--abstand), nicht auffüllen" : "Item oder Aufgabe ergänzen"}`, [ziel(S)]);
    if (folie && mitNotizen && !S.querySelector(".notiz")) melde("HINWEIS", nr, "notiz-fehlt", "Folie ohne Notiz für die Lehrkraft", [ziel(S)]);

    const ph = [...S.querySelectorAll(".platzhalter")];
    if (ph.length) melde("HINWEIS", nr, "platzhalter", `${ph.length} Platzhalter (Entwurf)`, ph.map(ziel));
    seiten.push({ nr, rest, breite: Math.round(P.width), aufgaben: auf.map((a) => rel(a.getBoundingClientRect())) });
  });

  ergebnis = { klasse: kl, seiten };
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
