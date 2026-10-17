/* Automatische Layoutprüfung im Browser. blatt.py fügt dieses Skript nur zur Prüfung ein und liest
   das Ergebnis aus dem JSON-Element #pruefbericht. Stufen: FEHLER, WARNUNG, HINWEIS.
   Jede Meldung hat neben dem Text einen Code (ueberlauf, rand, ueberlappung, schrift-klein, farbe-sw …) und die
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
  const bunt = (c) => { const [r, g, b, a = 1] = rgb(c); return a > 0.05 && Math.max(r, g, b) - Math.min(r, g, b) > 24; };

  await Promise.all(["16px Andika", "700 16px Andika", "600 16px Fredoka"].map((f) => document.fonts.load(f).catch(() => 0)));
  if (!document.fonts.check("16px Andika")) melde("FEHLER", 0, "schrift-fehlt", "Schrift Andika nicht geladen (fonts/ fehlt?)");
  if (!document.fonts.check("600 16px Fredoka")) melde("FEHLER", 0, "schrift-fehlt", "Schrift Fredoka nicht geladen (fonts/ fehlt?)");

  const seiten = [];
  // nur äußere Seiten: In „Folien mit Notizen“ stecken die Folien verkleinert in einem Blatt
  [...document.querySelectorAll(".seite")].filter((s) => !s.parentElement.closest(".seite")).forEach((S, si) => {
    const nr = si + 1, P = S.getBoundingClientRect(), rand = parseFloat(getComputedStyle(S).paddingLeft);
    const innen = { l: P.left + rand - 1, t: P.top + rand - 1, r: P.right - rand + 1, b: P.bottom - rand + 1 };
    const rel = (r) => [Math.round(r.left - P.left), Math.round(r.top - P.top), Math.round(r.width), Math.round(r.height)];
    // sb: das nächste Element mit Nummer, denn die Zeichnung einer Abbildung (svg) hat keine eigene
    const ziel = (e) => { const m = e.closest("[data-sb]"); return { sb: m ? +m.getAttribute("data-sb") : null, name: kurz(e), rechteck: rel(e.getBoundingClientRect()) }; };
    const alle = [...S.querySelectorAll("*")].filter((e) => !e.closest("svg") || e.tagName.toLowerCase() === "svg").filter(sichtbar);

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
      const rat = e.closest(".notizblatt") ? "Notiz kürzen" : "kürzen, Item streichen oder zweite Seite";
      melde("FEHLER", nr, ganz ? "ueberlauf" : "rand", `„${kurz(e)}“ ${wo} → ${rat}`, [ziel(e)]);
    });

    // 2. Abgeschnittener oder zu breiter Text
    alle.filter((e) => e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 0 && getComputedStyle(e).overflowX !== "visible")
      .forEach((e) => melde("FEHLER", nr, "abgeschnitten", `„${kurz(e)}“ ist abgeschnitten`, [ziel(e)]));

    // 3. Überlappungen zwischen Inhalten
    const INHALT = "img,svg,.blase,.anw,h1,.ziel,.wahlhilfe,.zeile,.antwort,table,.nr,.schreiblinie,.kartentext,.item,.platzhalter,x-stellentafel,.timer-text,.leerstelle,.vermutung";
    const teile = alle.filter((e) => e.matches(INHALT)), paare = [];
    const schneidet = (a, b) => {
      const A = a.getBoundingClientRect(), C = b.getBoundingClientRect();
      const w = Math.min(A.right, C.right) - Math.max(A.left, C.left), h = Math.min(A.bottom, C.bottom) - Math.max(A.top, C.top);
      return w > 2 && h > 2 ? [Math.round(w), Math.round(h)] : null;
    };
    for (let i = 0; i < teile.length; i++) for (let j = i + 1; j < teile.length; j++) {
      const a = teile[i], b = teile[j];
      if (a.contains(b) || b.contains(a)) continue;
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
      if (!t.textContent.trim() || !p || p.closest("svg,.nr,.namenszeile,.platzhalter,.loesung-marke") || !sichtbar(p)) continue;
      const text = `„${t.textContent.trim().slice(0, 30)}“ (${getComputedStyle(p).fontSize})`;
      if (parseFloat(getComputedStyle(p).fontSize) < min - 0.5 && !klein.has(text)) klein.set(text, p);
    }
    if (klein.size) {
      const erste = [...klein].slice(0, 4);
      melde("WARNUNG", nr, "schrift-klein", `Schrift kleiner als ${min} px ${folie ? "auf Folien (Leseentfernung)" : `für Klasse ${kl}`}: ${erste.map(([t]) => t).join(", ")}`, erste.map(([, p]) => ziel(p)));
    }

    // 5. Druckprofil
    if (B.classList.contains("sw")) {
      const farbig = alle.filter((e) => { const c = getComputedStyle(e); return bunt(c.color) || bunt(c.backgroundColor) || bunt(c.borderTopColor); });
      if (farbig.length) melde("WARNUNG", nr, "farbe-sw", `Farbe im s/w-Profil: ${farbig.slice(0, 3).map(kurz).join(", ")}`, farbig.slice(0, 3).map(ziel));
    }
    alle.filter((e) => e.tagName === "DIV" || e.tagName === "SECTION").forEach((e) => {
      const c = getComputedStyle(e), r = e.getBoundingClientRect();
      const [R, G, Bl, a = 1] = rgb(c.backgroundColor);
      if (a > 0.05 && (R + G + Bl) / 3 < 245 && r.width * r.height > 4000 && !e.closest(".karten"))
        melde("WARNUNG", nr, "flaeche", `Fläche hinter „${kurz(e)}“ (${c.backgroundColor}) → Aufgaben ohne Kasten und Fläche`, [ziel(e)]);
    });

    // 6. Bilder: geladen, Auflösung, im s/w-Profil wirklich schwarz-weiß
    S.querySelectorAll("img").forEach((im) => {
      if (!im.complete || !im.naturalWidth) return melde("FEHLER", nr, "bild-fehlt", `Bild fehlt: ${im.getAttribute("src").slice(0, 60)}`, [ziel(im)]);
      const r = im.getBoundingClientRect(), dpi = Math.round((im.naturalWidth / r.width) * 96);
      if (dpi < 150) melde("HINWEIS", nr, "bild-unscharf", `Bild „${im.alt || "ohne alt"}“ hat im Druck nur ${dpi} dpi (unscharf) → Original in voller Größe einsetzen`, [ziel(im)]);
      if (B.classList.contains("sw")) {
        try {
          const c = document.createElement("canvas"); c.width = 64; c.height = 64;
          const x = c.getContext("2d"); x.drawImage(im, 0, 0, 64, 64);
          const d = x.getImageData(0, 0, 64, 64).data; let s = 0, n = 0;
          for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) { s += Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]); n++; }
          if (n && s / n > 30) melde("WARNUNG", nr, "bild-farbig", `Bild „${im.alt || im.getAttribute("src").slice(0, 30)}“ ist farbig → im s/w-Profil die Strich-Version nehmen`, [ziel(im)]);
        } catch (e) { /* fremde Quelle */ }
      }
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
    if (rest > 150 && !S.querySelector(".karten") && !folie)
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
