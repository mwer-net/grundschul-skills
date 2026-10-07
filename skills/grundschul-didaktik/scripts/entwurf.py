#!/usr/bin/env python3
"""Schnelle Entwürfe (First Drafts) als HTML-Vorschau, ohne Canva.

Rendert 2–3 Entwürfe eines Materials nebeneinander als Seiten im echten
Format (A4 hoch/quer, A3, Folie 16:9) mit echtem Text, Nummernkreisen,
Niveau-Punkten, Platzhaltern für Bilder und Fußzeile – im s/w- oder
Farbprofil. Passt ein Entwurf nicht auf die Seite, wird das rot markiert.

Aufruf:
    python3 entwurf.py entwurf.json -o entwurf.html [--png entwurf.png]

Eingabe (JSON, Felder außer "entwuerfe" optional):
{
  "titel": "Uhrzeit Kl. 2",
  "klasse": 2,
  "profil": "sw",                 # "sw" oder "farbe"
  "palette": "Himmel",            # Sonnig | Himmel | Wiese | Beere (nur Farbe)
  "format": "a4-hoch",            # a4-hoch | a4-quer | a3-hoch | folie
  "entwuerfe": [
    {
      "name": "A · Kompakt üben",
      "idee": "viele gleichartige Items, ein Strategietipp",
      "ueberschrift": "Wie spät ist es?",
      "ziel": "Ich kann volle und halbe Stunden ablesen.",
      "wahlhilfe": "Wähle deine Aufgaben. Fang dort an, wo du sicher bist.",
      "aufgaben": [
        {"anweisung": "Lies ab. Schreibe die Uhrzeit auf.", "niveau": 1,
         "tipp": "Erst der kleine Zeiger: Er zeigt die Stunde.",
         "items": ["3 Uhr", "halb 5", "7 Uhr", "halb 10"],
         "bild": "Uhr", "bildhoehe": 88, "linie": true},
        {"anweisung": "Willi hat sich vertan. Finde 2 Fehler.", "niveau": 3,
         "zeilen": 3},
        {"anweisung": "Sternchenaufgabe: Wer mag, knobelt hier.", "stern": true,
         "platz": 120, "platzinfo": "eigene Uhr zeichnen"}
      ],
      "fuss": true,
      "notiz": "Lösungsblatt als Seite 2"
    }
  ]
}

Aufgabenfelder: "anweisung" (Pflicht), "niveau" 1–3, "stern", "tipp"
(Leitfigur-Sprechblase), "text" (Fließtext/Beispiel), "items" (Liste,
in Reihen), "spalten", "bild" (Platzhalter je Item), "bildhoehe" (px),
"linie" (Antwortlinie je Item), "zeilen" (Schreiblinien), "platz" (freie
Fläche in px) mit "platzinfo".

Kartenformate (Lernspiel, Bild-/Wortkarten): statt "aufgaben" ein Feld
"karten": {"raster": [2, 4], "items": [{"text": "der Hund", "bild": "Hund",
"ecke": "●"}]}.
"""
import argparse
import html
import json
import os
import shutil
import sys
from pathlib import Path

FORMATE = {  # Breite, Höhe in Canva-px (96 dpi)
    "a4-hoch": (794, 1123),
    "a4-quer": (1123, 794),
    "a3-hoch": (1123, 1587),
    "folie": (1280, 720),
}

PALETTEN = {  # Hauptfarbe, Akzent, dunkle Variante (Schrift/Nummernkreis)
    "Sonnig": ("#F28C28", "#2A9D8F", "#C4620A"),
    "Himmel": ("#3A86FF", "#FFBE0B", "#2F6FD6"),
    "Wiese": ("#43AA8B", "#F3722C", "#2E7D63"),
    "Beere": ("#E76F51", "#6A4C93", "#C2462F"),
}

# Fließtext in px je Klasse (pt × 1,33, Werte aus grundschul-didaktik)
SCHRIFT = {1: 28, 2: 24, 3: 20, 4: 18}

e = html.escape


def niveau_punkte(n):
    return "●" * max(1, min(3, int(n)))


def render_aufgabe(a, nr):
    kreis = '<span class="nr stern">★</span>' if a.get("stern") else f'<span class="nr">{nr}</span>'
    niveau = f'<span class="niveau">{niveau_punkte(a["niveau"])}</span>' if a.get("niveau") else ""
    teile = [f'<div class="kopfzeile">{kreis}<span class="anw">{e(a["anweisung"])}</span>{niveau}</div>']
    body = []
    if a.get("tipp"):
        body.append(f'<div class="tipp"><span class="figur">Willi</span><span class="blase">{e(a["tipp"])}</span></div>')
    if a.get("text"):
        body.append(f'<div class="text">{e(a["text"])}</div>')
    items = a.get("items") or []
    if items:
        spalten = a.get("spalten") or min(len(items), 4)
        zellen = []
        for it in items:
            z = ""
            if a.get("bild"):
                h = int(a.get("bildhoehe", 80))
                z += f'<div class="bild" style="height:{h}px">{e(a["bild"])}</div>'
            z += f'<div class="item">{e(str(it))}</div>' if str(it) else ""
            if a.get("linie"):
                z += '<div class="antwort"></div>'
            zellen.append(f'<div class="zelle">{z}</div>')
        body.append(f'<div class="raster" style="grid-template-columns:repeat({spalten},1fr)">{"".join(zellen)}</div>')
    for _ in range(int(a.get("zeilen", 0))):
        body.append('<div class="schreiblinie"></div>')
    if a.get("platz"):
        body.append(f'<div class="bild frei" style="height:{int(a["platz"])}px">{e(a.get("platzinfo", "Platz"))}</div>')
    teile.append(f'<div class="koerper">{"".join(body)}</div>')
    return f'<section class="aufgabe">{"".join(teile)}</section>'


def render_karten(k):
    sp, zl = (k.get("raster") or [2, 4])[:2]
    zellen = []
    for it in k.get("items", []):
        z = f'<span class="ecke">{e(it.get("ecke", ""))}</span>' if it.get("ecke") else ""
        if it.get("bild"):
            z += f'<div class="bild karte-bild">{e(it["bild"])}</div>'
        if it.get("text"):
            z += f'<div class="kartentext">{e(it["text"])}</div>'
        zellen.append(f'<div class="karte">{z}</div>')
    return (f'<div class="karten" style="grid-template-columns:repeat({sp},1fr);'
            f'grid-template-rows:repeat({zl},1fr)">{"".join(zellen)}</div>')


def render_seite(d, cfg):
    teile = []
    if not d.get("karten") or d.get("ueberschrift"):
        if not d.get("karten"):
            teile.append('<div class="namenszeile">Name: ______________ &nbsp; Datum: __________</div>')
        if d.get("ueberschrift"):
            teile.append(f'<h1>{e(d["ueberschrift"])}</h1>')
        ziel = []
        if d.get("ziel"):
            ziel.append(f'<b>{e(d["ziel"])}</b>')
        if d.get("wahlhilfe"):
            ziel.append(e(d["wahlhilfe"]))
        if ziel:
            teile.append(f'<div class="ziel">{" · ".join(ziel)}</div>')
    if d.get("karten"):
        teile.append(render_karten(d["karten"]))
    nr = 0
    for a in d.get("aufgaben", []):
        if not a.get("stern"):
            nr += 1
        teile.append(render_aufgabe(a, nr))
    if d.get("fuss"):
        ziel = e(d.get("ziel", "Ich kann …"))
        teile.append(
            '<footer><div><b>' + ziel + '</b><br>Male an, wie weit du schon bist:'
            '<div class="reflexion">Was hat dir geholfen? ☐ Willis Tipp ☐ das Beispiel ☐ ein anderes Kind</div></div>'
            '<div class="bild wachstum">Samen · Keimling · Pflanze · Blume</div></footer>')
    return "".join(teile)


CSS = """
:root{--txt:#1D1D1B;--haupt:%(haupt)s;--akzent:%(akzent)s;--dunkel:%(dunkel)s;--fs:%(fs)spx;--w:%(w)spx;--h:%(h)spx;--scale:%(scale)s}
*{box-sizing:border-box}
body{margin:0;padding:24px;background:#e9e9e6;font-family:Andika,Arial,sans-serif;color:var(--txt)}
.leiste{font:15px/1.4 system-ui,sans-serif;margin:0 0 16px;max-width:1400px}
.reihe{display:flex;flex-wrap:wrap;gap:28px;align-items:flex-start}
.entwurf{display:flex;flex-direction:column;gap:8px}
.label{font:600 17px system-ui,sans-serif}
.idee{font:14px system-ui,sans-serif;color:#555;max-width:calc(var(--w)*var(--scale));min-height:2.8em}
.notiz{font:14px system-ui,sans-serif;color:#555;max-width:calc(var(--w)*var(--scale))}
.frei{font:600 14px system-ui,sans-serif;color:#8a6d00;min-height:1.4em}
.huelle{width:calc(var(--w)*var(--scale));height:calc(var(--h)*var(--scale));overflow:hidden;cursor:zoom-in;box-shadow:0 2px 10px rgba(0,0,0,.15)}
.huelle.gross{width:var(--w);height:auto;cursor:zoom-out}
.seite{width:var(--w);height:var(--h);padding:60px;background:#fff;transform:scale(var(--scale));transform-origin:0 0;overflow:hidden;position:relative;font-size:var(--fs);line-height:1.4}
.gross .seite{transform:none}
.seite.zuviel{outline:6px solid #d00;outline-offset:-6px}
.warnung{display:none;font:600 14px system-ui,sans-serif;color:#b00}
.zuviel-w .warnung{display:block}
.namenszeile{font-size:calc(var(--fs)*.7);margin-bottom:8px}
h1{font-family:Fredoka,'Baloo 2',sans-serif;font-weight:600;color:var(--dunkel);font-size:calc(var(--fs)*1.6);margin:0 0 4px;line-height:1.15}
.ziel{font-size:calc(var(--fs)*.8);margin-bottom:24px}
.aufgabe{margin-bottom:28px;padding-bottom:0}
.aufgabe+.aufgabe{border-top:1px solid var(--linie);padding-top:20px}
.kopfzeile{display:flex;align-items:flex-start;gap:14px}
.nr{flex:0 0 34px;height:34px;border-radius:50%%;background:var(--dunkel);color:#fff;font:700 20px/34px Fredoka,sans-serif;text-align:center}
.nr.stern{background:none;color:var(--dunkel);font-size:30px}
.anw{flex:1;font-weight:700}
.niveau{color:var(--dunkel);letter-spacing:2px;white-space:nowrap}
.koerper{margin:10px 0 0 48px}
.raster{display:grid;gap:24px}
.zelle{display:flex;flex-direction:column;align-items:center;gap:6px}
.bild{width:100%%;border:2px dashed #9a9a9a;border-radius:10px;display:flex;align-items:center;justify-content:center;text-align:center;color:#777;font:14px system-ui,sans-serif;padding:4px}
.antwort{width:88%%;border-bottom:2px solid var(--txt);height:calc(var(--fs)*1.4)}
.schreiblinie{border-bottom:1.5px solid var(--txt);height:calc(var(--fs)*1.9)}
.text{margin-bottom:8px}
.tipp{display:flex;gap:10px;align-items:center;margin-bottom:10px;font-size:calc(var(--fs)*.8)}
.figur{flex:0 0 64px;height:64px;border:2px dashed #9a9a9a;border-radius:50%%;display:flex;align-items:center;justify-content:center;font:13px system-ui,sans-serif;color:#777}
.blase{border:2px solid var(--akzent-linie);border-radius:14px;padding:6px 12px}
footer{position:absolute;left:60px;right:60px;bottom:60px;border-top:1.5px solid var(--linie);padding-top:10px;display:flex;gap:16px;font-size:calc(var(--fs)*.75)}
footer>div:first-child{flex:1}
.reflexion{margin-top:6px}
.wachstum{flex:0 0 200px;height:90px}
.karten{display:grid;height:calc(var(--h) - 120px)}
.karte{border:1.5px dashed #555;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:12px}
.karte-bild{height:55%%;width:80%%}
.kartentext{font-size:calc(var(--fs)*1.2);font-weight:700;text-align:center}
.ecke{position:absolute;top:6px;right:10px;color:var(--dunkel)}
"""

JS = """
document.querySelectorAll('.huelle').forEach(h=>{h.onclick=()=>h.classList.toggle('gross')});
document.querySelectorAll('.seite').forEach(s=>{
  const f=s.querySelector('footer');const fh=f?f.offsetHeight+16:0;
  let unten=0;[...s.children].forEach(c=>{if(c.tagName!=='FOOTER')unten=Math.max(unten,c.offsetTop+c.offsetHeight)});
  const rest=s.clientHeight-60-fh-unten;
  if(rest<0||s.scrollHeight>s.clientHeight+1){s.classList.add('zuviel');s.closest('.entwurf').classList.add('zuviel-w')}
  else if(rest>150&&!s.querySelector('.karten')){s.closest('.entwurf').querySelector('.frei').textContent='Ungenutzt unten: '+Math.round(rest)+' px (Item oder Aufgabe ergänzen)'}
});
"""


def baue_html(spec):
    fmt = spec.get("format", "a4-hoch")
    if fmt not in FORMATE:
        sys.exit(f"Unbekanntes Format {fmt!r}; erlaubt: {', '.join(FORMATE)}")
    w, h = FORMATE[fmt]
    klasse = int(spec.get("klasse", 2))
    farbe = spec.get("profil", "sw") == "farbe"
    if farbe:
        haupt, akzent, dunkel = PALETTEN.get(spec.get("palette", "Himmel"), PALETTEN["Himmel"])
        linie, akzent_linie = akzent, akzent
    else:
        haupt = akzent = dunkel = "#1D1D1B"
        linie, akzent_linie = "#808080", "#1D1D1B"
    n = max(1, len(spec["entwuerfe"]))
    scale = round(min(0.62, 1300 / (n * w + (n - 1) * 40)), 3)
    css = CSS % dict(haupt=haupt, akzent=akzent, dunkel=dunkel, fs=SCHRIFT.get(klasse, 22), w=w, h=h, scale=scale)
    css += f":root{{--linie:{linie};--akzent-linie:{akzent_linie}}}"
    profil = "Farbe, Palette " + spec.get("palette", "Himmel") if farbe else "Schwarz-Weiß"
    kopf = (f'<p class="leiste"><b>{e(spec.get("titel", "Entwürfe"))}</b> · Klasse {klasse} · {e(fmt)} · {e(profil)}. '
            'Gestrichelte Flächen sind Platzhalter für Bilder und Abbildungen. Klick auf eine Seite vergrößert sie.</p>')
    spalten = []
    for i, d in enumerate(spec["entwuerfe"]):
        name = d.get("name") or f"Entwurf {chr(65 + i)}"
        idee = f'<div class="idee">{e(d.get("idee", ""))}</div>'
        notiz = f'<div class="notiz">{e(d["notiz"])}</div>' if d.get("notiz") else ""
        spalten.append(
            f'<div class="entwurf"><div class="label">{e(name)}</div>{idee}'
            '<div class="warnung">Passt nicht auf die Seite: kürzen oder zweite Seite.</div><div class="frei"></div>'
            f'<div class="huelle"><div class="seite">{render_seite(d, spec)}</div></div>{notiz}</div>')
    return ('<!doctype html><html lang="de"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<title>Entwürfe {e(spec.get("titel", ""))}</title>'
            '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Andika&family=Fredoka:wght@600&display=swap">'
            f'<style>{css}</style></head><body>{kopf}<div class="reihe">{"".join(spalten)}</div>'
            f'<script>{JS}</script></body></html>')


def png(html_pfad, png_pfad):
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Hinweis: playwright fehlt, kein PNG erzeugt (HTML direkt zeigen).", file=sys.stderr)
        return False
    with sync_playwright() as p:
        try:
            b = p.chromium.launch()
        except Exception:
            pfad = os.environ.get("CHROMIUM_PATH") or shutil.which("chromium") or shutil.which("chromium-browser")
            if not pfad:
                print("Hinweis: kein Browser für PNG gefunden (HTML direkt zeigen).", file=sys.stderr)
                return False
            b = p.chromium.launch(executable_path=pfad)
        s = b.new_page(viewport={"width": 1400, "height": 900})
        s.goto(Path(html_pfad).resolve().as_uri())
        s.wait_for_timeout(800)
        s.screenshot(path=png_pfad, full_page=True)
        b.close()
    return True


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("spec", help="JSON-Datei mit den Entwürfen")
    ap.add_argument("-o", "--out", default="entwurf.html")
    ap.add_argument("--png", help="zusätzlich Screenshot als PNG (braucht playwright)")
    args = ap.parse_args()
    spec = json.loads(Path(args.spec).read_text(encoding="utf-8"))
    if not spec.get("entwuerfe"):
        sys.exit("Feld 'entwuerfe' fehlt oder ist leer.")
    Path(args.out).write_text(baue_html(spec), encoding="utf-8")
    print(f"HTML: {args.out}")
    if args.png and png(args.out, args.png):
        print(f"PNG: {args.png}")


if __name__ == "__main__":
    main()
