/* Präsentations-Laufzeit für Folien (Skill praesentation), ohne Abhängigkeiten.
   Aktiv nur mit ?praesentation=1 in der Adresse oder class="praesentieren" am <body>; sonst bleibt das Dokument
   eine normale, druckbare Seite (Ansicht, PDF und blatt.py sehen davon nichts).
     Weiter:  → ↓ Bild-ab Leertaste Enter, Antippen rechts (zwei Drittel), Wischen nach links
     Zurück:  ← ↑ Bild-auf Rücktaste, Antippen links (ein Drittel), Wischen nach rechts
     B oder . schwarzer Bildschirm, Pos1/Ende erste/letzte Folie, Esc beendet.
   Weiter deckt zuerst die data-schritt der Folie der Reihe nach auf, dann die .aufdecken, dann kommt die nächste
   Folie; Zurück nimmt genau das Letzte zurück. Eine Folie, zu der man zurückgeht, steht so da, wie man sie verlassen
   hat (alles aufgedeckt). .aufdecken: Antippen deckt einzeln auf. x-timer: Antippen startet und hält an.
   Für eine Hülle (Schoolbox) gibt es window.praesentation und die Ereignisse praesentation:stand und
   praesentation:ende (abbrechbar: dann beendet die Hülle). */
(function () {
  if (window.praesentation) return;

  // „?“ als Hintergrund statt als ::after: Bricht die Lösung um, bekommt jedes Zeilenstück sein eigenes „?“.
  const FRAGEZEICHEN = "data:image/svg+xml," + encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 24'><text x='10' y='20' text-anchor='middle' " +
    "font-family='sans-serif' font-weight='700' font-size='24' fill='white'>?</text></svg>");
  const STIL = `
html.praesentieren,body.praesentieren{height:100%;overflow:hidden;background:#000;touch-action:none;
  -webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}
body.praesentieren{padding:0;margin:0}
body.praesentieren .seite{display:none;position:fixed;left:50%;top:50%;margin:0;box-shadow:none;
  transform:translate(-50%,-50%) scale(var(--skala,1))}
body.praesentieren .seite.aktiv{display:flex}
body.praesentieren [data-schritt]{transition:opacity .3s,visibility .3s}
body.praesentieren .schritt-zu{opacity:0;visibility:hidden}
body.praesentieren .aufdecken.zu{color:transparent;background:var(--haupt) url("${FRAGEZEICHEN}") center/auto 70% no-repeat;
  border-radius:.25em;cursor:pointer;-webkit-box-decoration-break:clone;box-decoration-break:clone}
body.praesentieren .aufdecken.zu *{visibility:hidden}
body.praesentieren x-timer{cursor:pointer}
body.praesentieren x-timer .timer-text{width:0;display:flex;justify-content:center;white-space:nowrap}
body.praesentieren x-timer.letzte-minute .timer-scheibe{fill:var(--akzent)!important}
body.praesentieren.sw x-timer.letzte-minute .timer-scheibe{opacity:.45}
.praesentation-schwarz{display:none;position:fixed;inset:0;background:#000;z-index:2147483646}
body.praesentieren.schwarz .praesentation-schwarz{display:block}
.praesentation-nummer{display:none;position:fixed;right:12px;bottom:10px;z-index:2147483645;pointer-events:none;
  font:600 16px/1 Fredoka,sans-serif;color:#fff;background:rgba(0,0,0,.45);border-radius:999px;padding:6px 12px}
body.praesentieren .praesentation-nummer{display:block}
body.praesentieren.ohne-nummer .praesentation-nummer{display:none}
@media (prefers-reduced-motion:reduce){body.praesentieren [data-schritt]{transition:none}}`;

  const WEITER = ["ArrowRight", "ArrowDown", "PageDown", " ", "Spacebar", "Enter"];
  const ZURUECK = ["ArrowLeft", "ArrowUp", "PageUp", "Backspace"];
  const WISCHEN = 50; // px, und deutlich mehr waagerecht als senkrecht
  const TIPPEN = 12; // px: so wenig darf sich der Finger beim Antippen bewegen

  let folien = [], info = [], nr = 0, schwarz = false, stil = null, nummer = null, abdeckung = null, ende = null;
  const timer = new Map();
  let uhr = null;

  const zahl = (el) => parseFloat(el.getAttribute("data-schritt"));
  const schritteIn = (verlauf) => verlauf.filter((v) => v === "s").length;

  function stand() {
    const i = info[nr];
    const fertig = i ? schritteIn(i.verlauf) === i.stufen.length && i.aufdecken.every((a) => i.verlauf.includes(a)) : true;
    return { folie: nr + 1, folien: folien.length, schwarz, ende: nr === folien.length - 1 && fertig };
  }

  function skaliere() {
    const f = folien[nr];
    if (!f || !f.offsetWidth) return;
    document.body.style.setProperty("--skala", String(Math.min(innerWidth / f.offsetWidth, innerHeight / f.offsetHeight)));
  }

  function zeige() {
    folien.forEach((f, i) => f.classList.toggle("aktiv", i === nr));
    const { aufdecken, stufen, verlauf } = info[nr];
    const n = schritteIn(verlauf);
    const grenze = n ? stufen[n - 1] : -Infinity;
    folien[nr].querySelectorAll("[data-schritt]").forEach((el) => {
      const s = zahl(el);
      el.classList.toggle("schritt-zu", !isNaN(s) && s > grenze);
    });
    aufdecken.forEach((a) => a.classList.toggle("zu", !verlauf.includes(a)));
    document.body.classList.toggle("schwarz", schwarz);
    nummer.textContent = `${nr + 1} / ${folien.length}`;
    skaliere();
    window.dispatchEvent(new CustomEvent("praesentation:stand", { detail: stand() }));
  }

  function setzeSchwarz(an) {
    schwarz = an === undefined ? !schwarz : !!an;
    zeige();
  }

  function weiter() {
    if (schwarz) return setzeSchwarz(false);
    const i = info[nr];
    const naechste = i.aufdecken.find((a) => !i.verlauf.includes(a));
    if (schritteIn(i.verlauf) < i.stufen.length) i.verlauf.push("s");
    else if (naechste) i.verlauf.push(naechste);
    else if (nr < folien.length - 1) info[++nr].verlauf = [];
    else return;
    zeige();
  }

  function zurueck() {
    if (schwarz) return setzeSchwarz(false);
    const i = info[nr];
    if (i.verlauf.length) i.verlauf.pop();
    else if (nr > 0) {
      const vorige = info[--nr];
      vorige.verlauf = [...vorige.stufen.map(() => "s"), ...vorige.aufdecken];
    } else return;
    zeige();
  }

  function gehe(index) {
    nr = Math.min(Math.max(index, 0), folien.length - 1);
    info[nr].verlauf = [];
    schwarz = false;
    zeige();
  }

  function deckeAuf(a) {
    const i = info[nr];
    if (!i.verlauf.includes(a)) i.verlauf.push(a);
    zeige();
  }

  // Timer: Restzeit aus der Uhrzeit, nicht aus gezählten Takten; so stimmt sie auch nach einer Pause des Browsers.
  function timerStand(el) {
    let t = timer.get(el);
    if (!t) {
      const ms = (parseFloat(el.getAttribute("minuten")) || 10) * 60000;
      t = { dauer: ms, rest: ms, seit: null };
      timer.set(el, t);
    }
    return t;
  }
  const restVon = (t) => (t.seit === null ? t.rest : Math.max(0, t.rest - (Date.now() - t.seit)));

  function zeichneTimer(el) {
    const t = timerStand(el);
    const r = restVon(t);
    if (r <= 0 && t.seit !== null) Object.assign(t, { rest: 0, seit: null });
    const zustand = r <= 0 ? "um" : t.seit !== null ? "laeuft" : t.rest < t.dauer ? "pause" : "bereit";
    el.setAttribute("rest", String(r / 60000));
    if (window.zeichneAbbildungen) window.zeichneAbbildungen(el);
    el.dataset.zustand = zustand;
    el.classList.toggle("letzte-minute", zustand !== "bereit" && r > 0 && r <= 60000);
    const text = el.querySelector(".timer-text");
    const minuten = Math.ceil(r / 60000);
    if (text && zustand === "laeuft") text.textContent = `noch ${minuten} ${minuten === 1 ? "Minute" : "Minuten"}`;
    if (text && zustand === "pause") text.textContent = "Pause";
    if (text && zustand === "um") text.textContent = "Die Zeit ist um.";
  }

  function takt() {
    const laufend = [...timer].filter(([, t]) => t.seit !== null).map(([el]) => el);
    laufend.forEach(zeichneTimer);
    const weiterLaufend = laufend.some((el) => timer.get(el).seit !== null);
    if (weiterLaufend && uhr === null) uhr = setInterval(takt, 1000);
    if (!weiterLaufend && uhr !== null) {
      clearInterval(uhr);
      uhr = null;
    }
  }

  function tippeTimer(el) {
    const t = timerStand(el);
    const r = restVon(t);
    if (r <= 0) Object.assign(t, { rest: t.dauer, seit: null });
    else if (t.seit === null) t.seit = Date.now();
    else Object.assign(t, { rest: r, seit: null });
    zeichneTimer(el);
    takt();
  }

  function tippe(ziel, x) {
    const verdeckt = ziel && ziel.closest(".aufdecken.zu");
    const uhrZiel = ziel && ziel.closest("x-timer");
    if (!schwarz && verdeckt) deckeAuf(verdeckt);
    else if (!schwarz && ziel && ziel.closest(".aufdecken")) return;
    else if (!schwarz && uhrZiel) tippeTimer(uhrZiel);
    else if (x < innerWidth / 3) zurueck();
    else weiter();
  }

  function taste(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return false;
    const k = e.key;
    if (k === " " && e.shiftKey) zurueck();
    else if (WEITER.includes(k)) weiter();
    else if (ZURUECK.includes(k)) zurueck();
    else if (k === "b" || k === "B" || k === ".") setzeSchwarz();
    else if (k === "Home") gehe(0);
    else if (k === "End") gehe(folien.length - 1);
    else if (k === "Escape") beenden();
    else if (k !== "F5") return false; // F5 senden manche Klicker zum Starten; nicht neu laden
    return true;
  }

  function beenden() {
    if (!window.dispatchEvent(new CustomEvent("praesentation:ende", { cancelable: true }))) return;
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    aus();
  }

  function aus() {
    ende.abort();
    clearInterval(uhr);
    uhr = null;
    document.documentElement.classList.remove("praesentieren");
    document.body.classList.remove("praesentieren", "schwarz", "ohne-nummer");
    document.body.style.removeProperty("--skala");
    document.querySelectorAll(".aktiv, .schritt-zu, .aufdecken.zu").forEach((el) =>
      el.classList.remove("aktiv", "schritt-zu", "zu"));
    [stil, nummer, abdeckung].forEach((el) => el.remove());
    delete window.praesentation;
    window.dispatchEvent(new CustomEvent("praesentation:stand", { detail: null }));
  }

  // Lädt alle Bilder und Schriften, auch die der verborgenen Folien. Danach übersteht die Präsentation Aussetzer
  // im WLAN. beiFortschritt(fertig, gesamt) meldet den Stand.
  function vorladen(beiFortschritt) {
    const bilder = [...document.images];
    const schriften = [];
    if (document.fonts) document.fonts.forEach((f) => schriften.push(f));
    const gesamt = bilder.length + schriften.length;
    let fertig = 0;
    const eins = () => {
      fertig++;
      if (beiFortschritt) beiFortschritt(fertig, gesamt);
    };
    const bild = (img) => {
      img.loading = "eager";
      const geladen = img.complete ? Promise.resolve() : new Promise((ok) => {
        img.addEventListener("load", ok, { once: true });
        img.addEventListener("error", ok, { once: true });
      });
      return geladen.then(() => (img.decode ? img.decode().catch(() => {}) : null)).then(eins);
    };
    if (beiFortschritt) beiFortschritt(0, gesamt);
    return Promise.all([...bilder.map(bild), ...schriften.map((f) => f.load().catch(() => {}).then(eins))])
      .then(() => ({ gesamt }));
  }

  function start() {
    const schalter = new URLSearchParams(location.search).get("praesentation") === "1";
    if (window.praesentation || (!schalter && !document.body.classList.contains("praesentieren"))) return;
    folien = [...document.querySelectorAll(".seite")];
    if (!folien.length) return;
    info = folien.map((f) => ({
      stufen: [...new Set([...f.querySelectorAll("[data-schritt]")].map(zahl).filter((s) => !isNaN(s)))].sort((a, b) => a - b),
      aufdecken: [...f.querySelectorAll(".aufdecken")],
      verlauf: [],
    }));
    stil = document.createElement("style");
    stil.textContent = STIL;
    document.head.appendChild(stil);
    abdeckung = document.createElement("div");
    abdeckung.className = "praesentation-schwarz";
    nummer = document.createElement("div");
    nummer.className = "praesentation-nummer";
    nummer.setAttribute("aria-live", "polite");
    document.body.append(abdeckung, nummer);
    document.documentElement.classList.add("praesentieren");
    document.body.classList.add("praesentieren");

    ende = new AbortController();
    const mit = { signal: ende.signal };
    // Antippen und Wischen über Pointer-Ereignisse, nicht über click: Safari auf dem iPad schickt click nur an
    // Elemente, die selbst etwas Anklickbares sind, nicht an einen Listener am document.
    let druck = null;
    addEventListener("resize", skaliere, mit);
    document.addEventListener("keydown", (e) => {
      if (taste(e)) e.preventDefault();
    }, mit);
    document.addEventListener("pointerdown", (e) => {
      druck = e.isPrimary && (e.pointerType !== "mouse" || e.button === 0)
        ? { x: e.clientX, y: e.clientY, id: e.pointerId } : null;
    }, mit);
    document.addEventListener("pointercancel", () => {
      druck = null;
    }, mit);
    document.addEventListener("pointerup", (e) => {
      if (!druck || e.pointerId !== druck.id) return;
      const dx = e.clientX - druck.x, dy = e.clientY - druck.y;
      druck = null;
      if (Math.abs(dx) >= WISCHEN && Math.abs(dx) > 1.5 * Math.abs(dy)) {
        if (dx < 0) weiter();
        else zurueck();
      } else if (Math.hypot(dx, dy) < TIPPEN) {
        tippe(e.target instanceof Element ? e.target : null, e.clientX);
      }
    }, mit);
    document.addEventListener("visibilitychange", takt, mit);

    window.praesentation = {
      weiter, zurueck, taste, vorladen, stand, beenden,
      gehe: (n) => gehe(n - 1),
      schwarz: setzeSchwarz,
      nummer: (an) => document.body.classList.toggle("ohne-nummer", !an),
    };
    zeige();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
