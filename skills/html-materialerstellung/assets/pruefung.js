/* Automatische Layoutprüfung im Browser. blatt.py fügt dieses Skript nur zur Prüfung ein und liest
   das Ergebnis aus dem JSON-Element #pruefbericht. Stufen: FEHLER, WARNUNG, HINWEIS. */
(async function () {
 const M = [];
 try {
  await document.fonts.ready;
  await Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))));
  if (window.zeichneAbbildungen) window.zeichneAbbildungen();
  await new Promise((r) => setTimeout(r, 100));

  const B = document.body;
  const melde = (stufe, seite, text) => M.push({ stufe, seite, text });
  const kl = +((B.className.match(/kl(\d)/) || [0, 2])[1]);
  const RICHTWERT = { 1: 3, 2: 4, 3: 5, 4: 6 }[kl] || 6;
  const fs = parseFloat(getComputedStyle(B).fontSize);
  const kurz = (el) => el.matches(".antwort") && !el.textContent.trim() ? "Antwortlinie" : (el.textContent || el.getAttribute("alt") || el.tagName.toLowerCase()).trim().replace(/\s+/g, " ").slice(0, 40);
  const sichtbar = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden"; };
  const rgb = (c) => (c.match(/[\d.]+/g) || []).map(Number);
  const bunt = (c) => { const [r, g, b, a = 1] = rgb(c); return a > 0.05 && Math.max(r, g, b) - Math.min(r, g, b) > 24; };

  await Promise.all(["16px Andika", "700 16px Andika", "600 16px Fredoka"].map((f) => document.fonts.load(f).catch(() => 0)));
  if (!document.fonts.check("16px Andika")) melde("FEHLER", 0, "Schrift Andika nicht geladen (fonts/ fehlt?)");
  if (!document.fonts.check("600 16px Fredoka")) melde("FEHLER", 0, "Schrift Fredoka nicht geladen (fonts/ fehlt?)");

  const seiten = [];
  document.querySelectorAll(".seite").forEach((S, si) => {
    const nr = si + 1, P = S.getBoundingClientRect(), rand = parseFloat(getComputedStyle(S).paddingLeft);
    const innen = { l: P.left + rand - 1, t: P.top + rand - 1, r: P.right - rand + 1, b: P.bottom - rand + 1 };
    const rel = (r) => [Math.round(r.left - P.left), Math.round(r.top - P.top), Math.round(r.width), Math.round(r.height)];
    const alle = [...S.querySelectorAll("*")].filter((e) => !e.closest("svg") || e.tagName.toLowerCase() === "svg").filter(sichtbar);

    // 1. Seitenrand und Seitenende
    const raus = alle.filter((e) => !e.closest(".karten,.loesung-marke,[data-rand-ok]")).filter((e) => {
      const r = e.getBoundingClientRect();
      return r.left < innen.l || r.top < innen.t || r.right > innen.r || r.bottom > innen.b;
    });
    raus.filter((e) => !raus.includes(e.parentElement)).forEach((e) => {
      const r = e.getBoundingClientRect();
      const um = Math.round(Math.max(innen.l - r.left, innen.t - r.top, r.right - innen.r, r.bottom - innen.b));
      const wo = (r.bottom > P.bottom || r.right > P.right ? "ragt aus der Seite" : "ragt in den Seitenrand") + ` (${um} px)`;
      melde("FEHLER", nr, `„${kurz(e)}“ ${wo} → kürzen, Item streichen oder zweite Seite`);
    });

    // 2. Abgeschnittener oder zu breiter Text
    alle.filter((e) => e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 0 && getComputedStyle(e).overflowX !== "visible")
      .forEach((e) => melde("FEHLER", nr, `„${kurz(e)}“ ist abgeschnitten`));

    // 3. Überlappungen zwischen Inhalten
    const INHALT = "img,svg,.blase,.anw,h1,.ziel,.wahlhilfe,.zeile,.antwort,table,.nr,.schreiblinie,.kartentext,.item,.platzhalter,x-stellentafel";
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
      .forEach(([a, b, [w, h]]) => melde("FEHLER", nr, `„${kurz(a)}“ überlappt „${kurz(b)}“ (${w} × ${h} px)`));

    // 4. Schriftgröße nach Klasse
    const min = Math.round(fs * 0.8), klein = new Set();
    const walker = document.createTreeWalker(S, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const t = walker.currentNode, p = t.parentElement;
      if (!t.textContent.trim() || !p || p.closest("svg,.nr,.namenszeile,.platzhalter,.loesung-marke") || !sichtbar(p)) continue;
      if (parseFloat(getComputedStyle(p).fontSize) < min - 0.5) klein.add(`„${t.textContent.trim().slice(0, 30)}“ (${getComputedStyle(p).fontSize})`);
    }
    if (klein.size) melde("WARNUNG", nr, `Schrift kleiner als ${min} px für Klasse ${kl}: ${[...klein].slice(0, 4).join(", ")}`);

    // 5. Druckprofil
    if (B.classList.contains("sw")) {
      const farbig = alle.filter((e) => { const c = getComputedStyle(e); return bunt(c.color) || bunt(c.backgroundColor) || bunt(c.borderTopColor); });
      if (farbig.length) melde("WARNUNG", nr, `Farbe im s/w-Profil: ${farbig.slice(0, 3).map(kurz).join(", ")}`);
    }
    alle.filter((e) => e.tagName === "DIV" || e.tagName === "SECTION").forEach((e) => {
      const c = getComputedStyle(e), r = e.getBoundingClientRect();
      const [R, G, Bl, a = 1] = rgb(c.backgroundColor);
      if (a > 0.05 && (R + G + Bl) / 3 < 245 && r.width * r.height > 4000 && !e.closest(".karten"))
        melde("WARNUNG", nr, `Fläche hinter „${kurz(e)}“ (${c.backgroundColor}) → Aufgaben ohne Kasten und Fläche`);
    });

    // 6. Bilder: geladen, Auflösung, im s/w-Profil wirklich schwarz-weiß
    S.querySelectorAll("img").forEach((im) => {
      if (!im.complete || !im.naturalWidth) return melde("FEHLER", nr, `Bild fehlt: ${im.getAttribute("src").slice(0, 60)}`);
      const r = im.getBoundingClientRect(), dpi = Math.round((im.naturalWidth / r.width) * 96);
      if (dpi < 150) melde("HINWEIS", nr, `Bild „${im.alt || "ohne alt"}“ hat im Druck nur ${dpi} dpi (unscharf) → Original in voller Größe einsetzen`);
      if (B.classList.contains("sw")) {
        try {
          const c = document.createElement("canvas"); c.width = 64; c.height = 64;
          const x = c.getContext("2d"); x.drawImage(im, 0, 0, 64, 64);
          const d = x.getImageData(0, 0, 64, 64).data; let s = 0, n = 0;
          for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) { s += Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]); n++; }
          if (n && s / n > 30) melde("WARNUNG", nr, `Bild „${im.alt || im.getAttribute("src").slice(0, 30)}“ ist farbig → im s/w-Profil die Strich-Version nehmen`);
        } catch (e) { /* fremde Quelle */ }
      }
    });

    // 7. Aufgaben: Anzahl, Abstände, Ausschnitte für die visuelle Endkontrolle
    const auf = [...S.querySelectorAll(".aufgabe")];
    const nichtStern = auf.filter((a) => !a.querySelector(".nr.stern")).length;
    if (nichtStern > RICHTWERT) melde("WARNUNG", nr, `${nichtStern} Aufgaben (+★): Richtwert Klasse ${kl} sind höchstens ${RICHTWERT} → Übersicht vor Menge`);
    for (let i = 1; i < auf.length; i++) {
      const gap = auf[i].getBoundingClientRect().top - auf[i - 1].getBoundingClientRect().bottom;
      if (gap < 20) melde("WARNUNG", nr, `Nur ${Math.round(gap)} px zwischen Aufgabe ${i} und ${i + 1}`);
    }

    // 8. Ungenutzter Platz
    const fuss = S.querySelector(".fuss");
    const inhalt = [...S.children].filter((e) => e !== fuss && sichtbar(e));
    const unten = Math.max(P.top + rand, ...inhalt.map((e) => e.getBoundingClientRect().bottom));
    const rest = Math.round((fuss ? fuss.getBoundingClientRect().top - 16 : innen.b) - unten);
    if (rest > 150 && !S.querySelector(".karten"))
      melde("HINWEIS", nr, `${rest} px frei unten → ${kl <= 2 ? "Abstand zwischen Aufgaben vergrößern (--abstand), nicht auffüllen" : "Item oder Aufgabe ergänzen"}`);

    const ph = S.querySelectorAll(".platzhalter").length;
    if (ph) melde("HINWEIS", nr, `${ph} Platzhalter (Entwurf)`);
    seiten.push({ nr, rest, breite: Math.round(P.width), aufgaben: auf.map((a) => rel(a.getBoundingClientRect())) });
  });

  var ergebnis = { klasse: kl, seiten };
 } catch (e) { M.push({ stufe: "FEHLER", seite: 0, text: "Prüfskript: " + e.message }); }
  const out = document.createElement("script");
  out.type = "application/json"; out.id = "pruefbericht";
  out.textContent = JSON.stringify(Object.assign({ seiten: [] }, typeof ergebnis === "undefined" ? {} : ergebnis, { meldungen: M }));
  document.body.appendChild(out);
})();
