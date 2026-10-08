#!/usr/bin/env python3
"""Grundschul-Material aus HTML bauen: prüfen, PDF (A4), Lösungsblatt, Vorschaubilder.

Aufrufe:
    python3 blatt.py bauen blatt.html [-o ausgabe/] [--ohne-loesung] [--nur-pruefen] [--bericht bericht.json]
    python3 blatt.py uebersicht a.html b.html [c.html] [-o ausgabe/]

bauen erzeugt in ausgabe/ (Standard: Ordner der Quelle):
    NAME.html             eigenständige HTML-Datei (Schriften, Bilder, Skripte eingebettet)
    NAME.pdf              druckfertiges A4-PDF
    NAME-loesung.pdf      Lösungsblatt (wenn die Quelle data-l / loesung= enthält)
    NAME-s1.png …         Vorschau je Seite, NAME-s1-a1.png … Ausschnitt je Aufgabe
                          (für die visuelle Endkontrolle), NAME-loesung-s1.png
und gibt den Prüfbericht aus (FEHLER / WARNUNG / HINWEIS). Exit-Code 1 bei FEHLER.
--bericht schreibt ihn zusätzlich als JSON (seiten, meldungen, fehler), z. B. für die Schoolbox.

uebersicht baut 2–3 Entwürfe, legt die ersten Seiten nebeneinander in entwuerfe.png
und entwuerfe.html und meldet je Entwurf, ob er auf die Seite passt.

Die Quelle bindet ein: <link rel="stylesheet" href="blatt.css">, <script src="abbildungen.js">,
Bilder per <img src="bilder/willi-strich.png">. Gesucht wird neben der Quelle, dann in assets/.
Braucht Chromium (Playwright-Chromium, chromium oder google-chrome). PNG über pypdfium2,
sonst pdftoppm.
"""
import argparse
import base64
import glob
import html
import json
import mimetypes
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ASSETS = Path(__file__).resolve().parent.parent / "assets"
SEITE = {"a4-quer": "A4 landscape", "a3-hoch": "A3", "a5-hoch": "A5", "folie": "338.67mm 190.5mm"}


def finde_chromium():
    kandidaten = [os.environ.get("CHROMIUM_PATH")]
    kandidaten += [shutil.which(n) for n in ("chromium", "chromium-browser", "google-chrome", "google-chrome-stable", "chrome")]
    for muster in ("/opt/pw-browsers/chromium-*/chrome-linux*/chrome",
                   os.path.expanduser("~/.cache/ms-playwright/chromium-*/chrome-linux*/chrome"),
                   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
                   "/Applications/Chromium.app/Contents/MacOS/Chromium"):
        kandidaten += sorted(glob.glob(muster), reverse=True)
    for k in kandidaten:
        if k and os.path.exists(k):
            return k
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            if os.path.exists(p.chromium.executable_path):
                return p.chromium.executable_path
    except Exception:
        pass
    sys.exit("Kein Chromium gefunden. Installieren: pip install playwright && playwright install chromium "
             "(oder CHROMIUM_PATH setzen).")


def chromium(args, url, timeout=90):
    cmd = [finde_chromium(), "--headless", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
           "--allow-file-access-from-files", "--run-all-compositor-stages-before-draw",
           "--virtual-time-budget=15000", *args, url]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    return r.stdout


def daten_uri(pfad):
    typ = mimetypes.guess_type(str(pfad))[0] or ("font/woff2" if str(pfad).endswith(".woff2") else "application/octet-stream")
    return f"data:{typ};base64,{base64.b64encode(Path(pfad).read_bytes()).decode()}"


def suche(name, quelle_dir):
    for basis in (quelle_dir, ASSETS):
        p = (basis / name).resolve()
        if p.exists():
            return p
    return None


def einbetten(quelltext, quelle_dir, pruefen=False, loesung=False):
    """Eigenständiges HTML: CSS, Schriften, Skripte und Bilder einbetten."""
    def css_ersetzen(m):
        p = suche(m.group(1), quelle_dir)
        if not p:
            sys.exit(f"Stylesheet {m.group(1)} nicht gefunden.")
        css = p.read_text(encoding="utf-8")
        css = re.sub(r"url\((?!data:)([^)]+)\)",
                     lambda u: f"url({daten_uri(suche(u.group(1).strip(chr(34) + chr(39)), p.parent))})"
                     if suche(u.group(1).strip(chr(34) + chr(39)), p.parent) else u.group(0), css)
        return f"<style>\n{css}\n</style>"

    def js_ersetzen(m):
        p = suche(m.group(1), quelle_dir)
        if not p:
            sys.exit(f"Skript {m.group(1)} nicht gefunden.")
        return f"<script>\n{p.read_text(encoding='utf-8')}\n</script>"

    def bild_ersetzen(m):
        src = m.group(2)
        if src.startswith(("data:", "http:", "https:")):
            return m.group(0)
        p = suche(src, quelle_dir)
        if not p:
            print(f"FEHLER  Bild nicht gefunden: {src}", file=sys.stderr)
            return m.group(0)
        return f"{m.group(1)}{daten_uri(p)}{m.group(3)}"

    t = re.sub(r'<link[^>]+href="([^"]+\.css)"[^>]*>', css_ersetzen, quelltext)
    t = re.sub(r'<script[^>]+src="([^"]+\.js)"[^>]*>\s*</script>', js_ersetzen, t)
    t = re.sub(r'(<img[^>]+src=")([^"]+)(")', bild_ersetzen, t)
    body = re.search(r'<body[^>]*class="([^"]*)"', t)
    fmt = next((SEITE[k] for k in (body.group(1).split() if body else []) if k in SEITE), None)
    if fmt:
        t = t.replace("</head>", f"<style>@page{{size:{fmt};margin:0}}</style>\n</head>", 1)
    if loesung:
        t = re.sub(r'<body([^>]*)class="([^"]*)"', r'<body\1class="\2 loesung"', t, count=1)
    if pruefen:
        js = (ASSETS / "pruefung.js").read_text(encoding="utf-8")
        t = t.replace("</body>", f"<script>\n{js}\n</script>\n</body>")
    return t


def pruefbericht(html_pfad):
    dom = chromium(["--dump-dom"], Path(html_pfad).resolve().as_uri())
    m = re.search(r'<script type="application/json" id="pruefbericht">(.*?)</script>', dom, re.S)
    if not m:
        return {"seiten": [], "meldungen": [{"stufe": "FEHLER", "seite": 0, "text": "Prüfung lief nicht durch (Skriptfehler?)"}]}
    return json.loads(html.unescape(m.group(1)))


def pdf(html_pfad, pdf_pfad):
    chromium([f"--print-to-pdf={pdf_pfad}", "--no-pdf-header-footer", "--print-to-pdf-no-header"],
             Path(html_pfad).resolve().as_uri())
    if not Path(pdf_pfad).exists():
        sys.exit("PDF wurde nicht erzeugt.")


def pngs(pdf_pfad, praefix, skala=2.0):
    """PDF-Seiten als PNG (gibt Liste der Dateien zurück)."""
    try:
        import pypdfium2 as pdfium
        doc = pdfium.PdfDocument(str(pdf_pfad))
        dateien = []
        for i in range(len(doc)):
            ziel = f"{praefix}-s{i + 1}.png"
            doc[i].render(scale=skala * 96 / 72).to_pil().save(ziel)
            dateien.append(ziel)
        doc.close()
        return dateien
    except ImportError:
        pass
    if shutil.which("pdftoppm"):
        subprocess.run(["pdftoppm", "-png", "-r", str(int(96 * skala)), str(pdf_pfad), f"{praefix}-s"], check=True)
        dateien = sorted(glob.glob(f"{praefix}-s-*.png"))
        neu = []
        for i, d in enumerate(dateien):
            os.replace(d, f"{praefix}-s{i + 1}.png")
            neu.append(f"{praefix}-s{i + 1}.png")
        return neu
    print("Hinweis: keine PNG-Vorschau (pip install pypdfium2).", file=sys.stderr)
    return []


def ausschnitte(seiten_png, bericht, praefix):
    try:
        from PIL import Image
    except ImportError:
        return []
    dateien = []
    for s, png in zip(bericht["seiten"], seiten_png):
        im = Image.open(png)
        k = im.width / s.get("breite", 794)
        for j, (x, y, w, h) in enumerate(s["aufgaben"]):
            box = [max(0, int((x - 16) * k)), max(0, int((y - 12) * k)),
                   min(im.width, int((x + w + 16) * k)), min(im.height, int((y + h + 12) * k))]
            ziel = f"{praefix}-s{s['nr']}-a{j + 1}.png"
            im.crop(box).save(ziel)
            dateien.append(ziel)
    return dateien


def ausgeben(bericht, titel=""):
    m = bericht["meldungen"]
    if titel:
        print(f"\n== {titel}")
    for stufe in ("FEHLER", "WARNUNG", "HINWEIS"):
        for x in (x for x in m if x["stufe"] == stufe):
            wo = f"S. {x['seite']}: " if x["seite"] else ""
            print(f"{stufe:8} {wo}{x['text']}")
    f = sum(x["stufe"] == "FEHLER" for x in m)
    w = sum(x["stufe"] == "WARNUNG" for x in m)
    print(f"Prüfung: {f} Fehler, {w} Warnungen." + (" Layout ok." if not f else ""))
    return f


def bericht_schreiben(datei, bericht, meldungen, fehler):
    if datei:
        daten = {"seiten": bericht["seiten"], "meldungen": meldungen, "fehler": fehler}
        Path(datei).write_text(json.dumps(daten, ensure_ascii=False, indent=1), encoding="utf-8")


def bauen(quelle, ausgabe=None, ohne_loesung=False, nur_pruefen=False, still=False, bericht_datei=None):
    quelle = Path(quelle).resolve()
    aus = Path(ausgabe).resolve() if ausgabe else quelle.parent
    aus.mkdir(parents=True, exist_ok=True)
    name = quelle.stem
    text = quelle.read_text(encoding="utf-8")
    with tempfile.TemporaryDirectory() as tmp:
        pruef = Path(tmp) / "pruefen.html"
        pruef.write_text(einbetten(text, quelle.parent, pruefen=True), encoding="utf-8")
        bericht = pruefbericht(pruef)
        fehler = ausgeben(bericht, "" if not still else name)
        meldungen = list(bericht["meldungen"])
        if nur_pruefen:
            bericht_schreiben(bericht_datei, bericht, meldungen, fehler)
            return bericht, fehler, []
        fertig = aus / f"{name}.html"
        fertig.write_text(einbetten(text, quelle.parent), encoding="utf-8")
        pdf(fertig, aus / f"{name}.pdf")
        bilder = pngs(aus / f"{name}.pdf", str(aus / name))
        teile = ausschnitte(bilder, bericht, str(aus / name))
        erzeugt = [fertig, aus / f"{name}.pdf", *bilder, *teile]
        hat_loesung = ("data-l=" in text or "loesung=" in text or "nur-loesung" in text) and not ohne_loesung
        if hat_loesung:
            lp = Path(tmp) / "pruefen-loesung.html"
            lp.write_text(einbetten(text, quelle.parent, pruefen=True, loesung=True), encoding="utf-8")
            lb = pruefbericht(lp)
            lb["meldungen"] = [m for m in lb["meldungen"] if m["stufe"] == "FEHLER"]
            if lb["meldungen"]:
                fehler += ausgeben(lb, "Lösungsblatt")
                meldungen += [{**m, "text": f"Lösungsblatt: {m['text']}"} for m in lb["meldungen"]]
            lh = Path(tmp) / f"{name}-loesung.html"
            lh.write_text(einbetten(text, quelle.parent, loesung=True), encoding="utf-8")
            pdf(lh, aus / f"{name}-loesung.pdf")
            erzeugt += [aus / f"{name}-loesung.pdf", *pngs(aus / f"{name}-loesung.pdf", str(aus / f"{name}-loesung"))]
    bericht_schreiben(bericht_datei, bericht, meldungen, fehler)
    if not still:
        print("Erzeugt:\n  " + "\n  ".join(str(p) for p in erzeugt))
    return bericht, fehler, bilder


def uebersicht(quellen, ausgabe=None):
    from PIL import Image, ImageDraw, ImageFont
    aus = Path(ausgabe or Path(quellen[0]).resolve().parent).resolve()
    seiten, namen, status = [], [], []
    for q in quellen:
        bericht, fehler, bilder = bauen(q, aus, ohne_loesung=True, still=True)
        titel = re.search(r"<title>(.*?)</title>", Path(q).read_text(encoding="utf-8"), re.S)
        namen.append(html.unescape(titel.group(1).strip()) if titel else Path(q).stem)
        seiten.append(bilder[0] if bilder else None)
        passt = not any("Seite" in m["text"] and m["stufe"] == "FEHLER" for m in bericht["meldungen"])
        status.append("passt auf die Seite" if passt and not fehler else ("passt NICHT auf die Seite" if not passt else f"{fehler} Fehler"))
    w, h, rand, kopf = 794, 1123, 30, 70
    bild = Image.new("RGB", (rand + len(quellen) * (w + rand), h + kopf + rand), "#e9e9e6")
    zeichne = ImageDraw.Draw(bild)
    try:
        schrift = ImageFont.truetype(str(next(iter(glob.glob("/usr/share/fonts/**/DejaVuSans-Bold.ttf", recursive=True)), "")), 22)
    except Exception:
        schrift = ImageFont.load_default()
    for i, (png, n, st) in enumerate(zip(seiten, namen, status)):
        x = rand + i * (w + rand)
        zeichne.text((x, 12), n, fill="#1D1D1B", font=schrift)
        zeichne.text((x, 40), st, fill="#b00000" if "NICHT" in st or "Fehler" in st else "#2E7D32", font=schrift)
        if png:
            bild.paste(Image.open(png).convert("RGB").resize((w, h)), (x, kopf))
    ziel = aus / "entwuerfe.png"
    bild.save(ziel)
    karten = "".join(
        f'<figure><figcaption><b>{html.escape(n)}</b><br><span class="{"rot" if "NICHT" in st or "Fehler" in st else "ok"}">{st}</span>'
        f'</figcaption><img src="{daten_uri(p)}" alt="{html.escape(n)}"></figure>' for p, n, st in zip(seiten, namen, status) if p)
    (aus / "entwuerfe.html").write_text(
        '<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        '<title>Entwürfe</title><style>body{margin:0;padding:16px;background:#e9e9e6;font:15px system-ui,sans-serif}'
        '.reihe{display:flex;flex-wrap:wrap;gap:24px}figure{margin:0;flex:1 1 300px;max-width:520px}'
        'img{width:100%;box-shadow:0 2px 10px rgba(0,0,0,.15);background:#fff}.rot{color:#b00}.ok{color:#2E7D32}'
        f'</style></head><body><div class="reihe">{karten}</div></body></html>', encoding="utf-8")
    print(f"Übersicht: {ziel}\n           {aus / 'entwuerfe.html'}")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("bauen")
    b.add_argument("quelle")
    b.add_argument("-o", "--ausgabe")
    b.add_argument("--ohne-loesung", action="store_true")
    b.add_argument("--nur-pruefen", action="store_true")
    b.add_argument("--bericht", help="Prüfbericht zusätzlich als JSON-Datei")
    u = sub.add_parser("uebersicht")
    u.add_argument("quellen", nargs="+")
    u.add_argument("-o", "--ausgabe")
    a = ap.parse_args()
    if a.cmd == "bauen":
        _, fehler, _ = bauen(a.quelle, a.ausgabe, a.ohne_loesung, a.nur_pruefen, bericht_datei=a.bericht)
        sys.exit(1 if fehler else 0)
    uebersicht(a.quellen, a.ausgabe)


if __name__ == "__main__":
    main()
