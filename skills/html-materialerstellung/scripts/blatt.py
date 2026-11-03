#!/usr/bin/env python3
"""Grundschul-Material aus HTML bauen: prüfen, PDF (A4), Lösungsblatt, Vorschaubilder.

Aufrufe:
    python3 blatt.py bauen blatt.html [-o ausgabe/] [--ohne-loesung] [--nur-pruefen] [--bericht bericht.json]
                           [--schritte] [--notizen] [--nur-zusatz] [--profil farbe|sw]
    python3 blatt.py uebersicht a.html b.html [c.html] [-o ausgabe/]

bauen erzeugt in ausgabe/ (Standard: Ordner der Quelle):
    NAME.html             eigenständige HTML-Datei (Schriften, Bilder, Skripte eingebettet)
    NAME.pdf              druckfertiges A4-PDF
    NAME-loesung.pdf      Lösungsblatt (wenn die Quelle data-l / loesung= enthält)
    NAME-s1.png …         Vorschau je Seite, NAME-s1-a1.png … Ausschnitt je Aufgabe
                          (für die visuelle Endkontrolle), NAME-loesung-s1.png
und gibt den Prüfbericht aus (FEHLER / WARNUNG / HINWEIS). Exit-Code 1 bei FEHLER.
--profil sw stellt ein farbiges Blatt in Graustufen dar (assets/graustufen.js), ohne die Quelle zu ändern; ohne Angabe
gilt die Klasse am <body> der Quelle.
--bericht schreibt ihn zusätzlich als JSON (seiten, meldungen mit code und ziele, fehler), z. B. für die Schoolbox.

Folien (body class folie): NAME.html ist dann die Offline-Präsentation (praesentation.js eingebettet, startet mit
einem Startbildschirm); das PDF bleibt die normale Seitenfolge, alles aufgedeckt. Zusätzlich auf Wunsch:
    --schritte            NAME-schritte.pdf: eine Seite je Schritt (vor dem ersten Schritt, jeder data-schritt,
                          jedes .aufdecken), zum Blättern auf dem iPad ohne Internet
    --notizen             NAME-notizen.pdf: A4 hoch, je Blatt zwei Folien klein mit Notizen und Ablauf, zum
                          Ausdrucken; wird wie das Blatt geprüft (nur FEHLER, „Folien mit Notizen: …“)
    --nur-zusatz          nur diese Ausgaben bauen, ohne Blatt, Vorschauen und Lösung

uebersicht baut 2–3 Entwürfe, legt die ersten Seiten nebeneinander in entwuerfe.png
und entwuerfe.html und meldet je Entwurf, ob er auf die Seite passt.

Die Quelle bindet ein: <link rel="stylesheet" href="blatt.css">, <script src="abbildungen.js">,
Bilder per <img src="bilder/willi-strich.png">. Gesucht wird neben der Quelle, dann in assets/.
Braucht Chromium (Playwright-Chromium, chromium oder google-chrome). PNG über pypdfium2,
sonst pdftoppm.
"""
import argparse
import base64
import fcntl
import glob
import hashlib
import html
import io
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
# Abbildungen, die ihre Lösung selbst berechnen: Sie brauchen kein loesung= und trotzdem ein Lösungsblatt. Die alten
# Elemente aus der ersten Fassung gehören nicht dazu, sonst bekämen Blätter ohne jede Lösung ein leeres Lösungsblatt.
OHNE_LOESUNGSANGABE = r"<x-(?!spielplan|uhr|menge|dienes|strichpunkt|stellentafel|zwanzigerfeld|zahlenstrahl|timer|probe|gluecksrad|wuerfel|urne|diagramm|gitter|figur|koerper|hunderterfeld|hundertertafel|rechenrahmen|punktfeld|geld|skala|kalender|lineatur|silben|wortarten|satzglieder|wortbausteine|zeitleiste|jahreskreis|windrose|plan|schaltplan|kreislauf|verkehrszeichen|wetter|rhythmus|noten)[a-z]"
MIT_LOESUNG = r"<x-spielplan[^>]* loesungen=|<x-diagramm[^>]* offen=|<x-gitter[^>]* (?:aufgabe|zaehlen)=|<x-wuerfelbau[^>]* fragen=|<x-wuerfelnetz[^>]* aufgabe=|<x-koerper[^>]* markiere=|<x-hundertertafel[^>]* (?:luecken|zufall)=|<x-geld[^>]* aufgabe=|<x-skala[^>]* aufgabe=|<x-kalender[^>]* luecken=|<x-silben[^>]* aufgabe=|<x-wortarten[^>]* aufgabe=|<x-satzglieder[^>]* aufgabe=|<x-wortbausteine[^>]* aufgabe=|<x-zeitleiste[^>]*: ?offen|<x-jahreskreis[^>]* beschriftung=.leer|<x-windrose[^>]* beschriftung=.(?:leer|norden)|<x-plan[^>]* aufgabe=|<x-schaltplan[^>]* aufgabe=.(?:leuchtet|vervollstaendigen|benennen)|<x-kreislauf[^>]* offen=|<x-verkehrszeichen[^>]* ausmalen=.ja|<x-rhythmus[^>]* aufgabe=.(?:silben|noten|ergaenzen)|<x-noten[^>]* aufgabe=.(?:benennen|zeichnen)"
SEITE = {"a4-quer": "A4 landscape", "a3-hoch": "A3", "a5-hoch": "A5", "folie": "338.67mm 190.5mm", "minibuch": "A4 landscape"}


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


def mit_klasse(text, klasse):
    return re.sub(r'<body([^>]*)class="([^"]*)"', lambda m: f'<body{m.group(1)}class="{m.group(2)} {klasse}"', text, count=1)


JPEG_QUALITAET = 85
RASTER = (".png", ".jpg", ".jpeg", ".webp", ".gif")
HELLIGKEIT = lambda r, g, b: round(0.299 * r + 0.587 * g + 0.114 * b)


def pillow():
    try:
        from PIL import Image, ImageOps
    except ImportError:
        sys.exit("Für die s/w-Fassung braucht blatt.py Pillow: pip install Pillow")
    return Image, ImageOps


def strich_fassung(pfad):
    """name-strich.* neben name.* mit gleichem Seitenverhältnis (1 % Spielraum), sonst None."""
    Image, _ = pillow()
    if pfad.stem.endswith("-strich") or pfad.suffix.lower() not in RASTER:
        return None
    with Image.open(pfad) as bild:
        verhaeltnis = bild.width / bild.height
    for endung in RASTER:
        kandidat = pfad.with_name(f"{pfad.stem}-strich{endung}")
        if kandidat.exists():
            with Image.open(kandidat) as strich:
                if abs(strich.width / strich.height - verhaeltnis) <= 0.01 * verhaeltnis:
                    return kandidat
    return None


def grau_bytes(pfad, masse=None):
    """Graufassung im selben Format: JPEG bleibt JPEG, Alpha bleibt. masse hält die Pixelmaße des Originals."""
    Image, ImageOps = pillow()
    with Image.open(pfad) as roh:
        bild = ImageOps.exif_transpose(roh) if roh.format == "JPEG" else roh.copy()
        mit_alpha = "A" in bild.getbands() or "transparency" in roh.info
        grau = bild.convert("RGBA").convert("LA") if mit_alpha else bild.convert("RGB").convert("L")
        if masse and grau.size != masse:
            grau = grau.resize(masse, Image.LANCZOS)
        puffer = io.BytesIO()
        dpi = {"dpi": roh.info["dpi"]} if "dpi" in roh.info else {}
        if roh.format == "JPEG":
            grau.save(puffer, "JPEG", quality=JPEG_QUALITAET, optimize=True, **dpi)
        elif roh.format == "WEBP":
            grau.save(puffer, "WEBP", quality=JPEG_QUALITAET)
        else:
            grau.save(puffer, "PNG", optimize=True, **dpi)
        return puffer.getvalue(), ("image/jpeg" if roh.format == "JPEG" else "image/webp" if roh.format == "WEBP" else "image/png")


def svg_grau(text):
    """Farben in einer SVG-Datei; Bilder darin gibt es im Material nicht."""
    def hex_grau(m):
        h = m.group(1)
        h = "".join(z * 2 for z in h) if len(h) == 3 else h
        v = HELLIGKEIT(*(int(h[i:i + 2], 16) for i in (0, 2, 4)))
        return f"#{v:02x}{v:02x}{v:02x}"
    text = re.sub(r"#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b", hex_grau, text)
    return re.sub(r"rgb\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)\s*\)",
                  lambda m: "rgb({0},{0},{0})".format(HELLIGKEIT(*map(int, m.groups()))), text)


class Graufassungen:
    """Bilder fürs s/w-Profil, zwischengespeichert nach Inhalts-Hash (nur innerhalb von ausgabe/). Gibt data:-URIs zurück."""

    def __init__(self, ordner):
        self.ordner = ordner

    def _gespeichert(self, schluessel, endung, erzeuge):
        if self.ordner:
            datei = self.ordner / f"{schluessel}{endung}"
            if datei.exists():
                return datei.read_bytes()
        daten = erzeuge()
        if self.ordner:
            self.ordner.mkdir(exist_ok=True)
            tmp = self.ordner / f".{schluessel}.{os.getpid()}.tmp"
            tmp.write_bytes(daten)
            os.replace(tmp, self.ordner / f"{schluessel}{endung}")
        return daten

    def uri(self, pfad):
        pfad = Path(pfad)
        endung = pfad.suffix.lower()
        if endung == ".svg":
            daten = svg_grau(pfad.read_text(encoding="utf-8")).encode()
            return f"data:image/svg+xml;base64,{base64.b64encode(daten).decode()}"
        if endung not in RASTER:
            return daten_uri(pfad)
        Image, _ = pillow()
        with Image.open(pfad) as bild:
            masse = bild.size
            jpeg = bild.format == "JPEG"
        strich = strich_fassung(pfad)
        quelle = strich or pfad
        h = hashlib.sha256(quelle.read_bytes())
        h.update(f"{masse}{JPEG_QUALITAET}".encode())
        ablage = ".jpg" if jpeg and quelle.suffix.lower() in (".jpg", ".jpeg") else ".png"
        daten = self._gespeichert(h.hexdigest()[:32], ablage, lambda: grau_bytes(quelle, masse)[0])
        typ = "image/jpeg" if ablage == ".jpg" else "image/png"
        return f"data:{typ};base64,{base64.b64encode(daten).decode()}"

    def daten_uri(self, uri):
        """Bild, das schon als data: in der Quelle steht."""
        m = re.match(r"data:image/(png|jpeg);base64,(.*)", uri, re.S)
        if not m:
            return uri
        with tempfile.NamedTemporaryFile(suffix=f".{m.group(1)}") as tmp:
            tmp.write(base64.b64decode(m.group(2)))
            tmp.flush()
            daten, typ = grau_bytes(tmp.name)
        return f"data:{typ};base64,{base64.b64encode(daten).decode()}"


def profil_von(text):
    body = re.search(r'<body[^>]*class="([^"]*)"', text)
    return "sw" if body and "sw" in body.group(1).split() and "farbe" not in body.group(1).split() else "farbe"


def setze_profil(text, profil):
    """Klassen am <body> wie kern/src/html.ts: s/w statt farbe palette-*; die Farbansicht einer s/w-Quelle bekommt die Standardpalette."""
    def tausche(m):
        klassen = m.group(2).split()
        ohne = [k for k in klassen if k not in ("sw", "farbe") and not k.startswith("palette-")]
        if profil == "sw":
            neu = ["sw", *ohne]
        else:
            neu = ["farbe", next((k for k in klassen if k.startswith("palette-")), "palette-himmel"), *ohne]
        return f'<body{m.group(1)}class="{" ".join(neu)}"'
    return re.sub(r'<body([^>]*)class="([^"]*)"', tausche, text, count=1)


def einbetten(quelltext, quelle_dir, pruefen=False, loesung=False, modus=None, profil=None, cache=None):
    """Eigenständiges HTML: CSS, Schriften, Skripte und Bilder einbetten.

    modus (nur Folien): "start" (Offline-Präsentation), "schritte" oder "notizen" bettet praesentation.js ein und
    setzt die Klasse praesentation-<modus> am <body>; "notizen" druckt auf A4 hoch.
    profil: ohne Angabe gilt die Quelle. Bei s/w (auch aus der Quelle) läuft assets/graustufen.js mit und alle Bilder
    werden Graufassungen (oder name-strich, wenn es das gibt); cache ist der Ordner, in dem die Fassungen bleiben."""
    grau = Graufassungen(cache) if (profil or profil_von(quelltext)) == "sw" else None
    bild_uri = grau.uri if grau else daten_uri

    def css_ersetzen(m):
        p = suche(m.group(1), quelle_dir)
        if not p:
            sys.exit(f"Stylesheet {m.group(1)} nicht gefunden.")
        css = p.read_text(encoding="utf-8")
        def url_uri(ziel):  # Schriften bleiben, wie sie sind; nur Bilder aus eigenem CSS werden grau
            return bild_uri(ziel) if ziel.suffix.lower() in (*RASTER, ".svg") else daten_uri(ziel)
        css = re.sub(r"url\((?!data:)([^)]+)\)",
                     lambda u: f"url({url_uri(suche(u.group(1).strip(chr(34) + chr(39)), p.parent))})"
                     if suche(u.group(1).strip(chr(34) + chr(39)), p.parent) else u.group(0), css)
        return f"<style>\n{css}\n</style>"

    def js_ersetzen(m):
        p = suche(m.group(1), quelle_dir)
        if not p:
            sys.exit(f"Skript {m.group(1)} nicht gefunden.")
        return f"<script>\n{p.read_text(encoding='utf-8')}\n</script>"

    def bild_ersetzen(m):
        src = m.group(2)
        if grau and src.startswith("data:"):
            return f"{m.group(1)}{grau.daten_uri(src)}{m.group(3)}"
        # `${` steht in Vorlagen aus dem eingebetteten abbildungen.js.
        if src.startswith(("data:", "http:", "https:", "${")):
            return m.group(0)
        p = suche(src, quelle_dir)
        if not p:
            print(f"FEHLER  Bild nicht gefunden: {src}", file=sys.stderr)
            return m.group(0)
        return f"{m.group(1)}{bild_uri(p)}{m.group(3)}"

    # Diese Bilder setzt erst abbildungen.js ein; im eigenständigen HTML müssen sie schon am Element hängen.
    def zeichen_ersetzen(m):
        nummer = re.search(r'\snummer="(\d+)"', m.group(0))
        if not nummer:
            return m.group(0)
        dazu = ""
        for variante in ("", "-grau", "-kontur"):
            p = suche(f"bilder/verkehrszeichen/{nummer.group(1)}{variante}.svg", quelle_dir)
            if p:
                dazu += f' data-bild{variante}="{bild_uri(p)}"'
        return f"{m.group(0)[:-1]}{dazu}>"

    def stationen_ersetzen(m):
        stationen = re.search(r'\sstationen="([^"]*)"', m.group(0))
        dazu = ""
        for i, station in enumerate((stationen.group(1) if stationen else "").split(";")):
            src = html.unescape(station.partition(":")[2].strip())
            if not src or src.startswith(("data:", "http:", "https:")):
                continue
            p = suche(src, quelle_dir)
            if p:
                dazu += f' data-bild-{i}="{bild_uri(p)}"'
            else:
                print(f"FEHLER  Bild nicht gefunden: {src}", file=sys.stderr)
        return f"{m.group(0)[:-1]}{dazu}>"

    # Mini-Inhalte `bild:katze.png`: gezählt wie miniBilder() in abbildungen.js
    def mini_ersetzen(m):
        quellen = []
        for treffer in re.finditer(r"bild:([^;:\"]+)", m.group(0)):
            src = html.unescape(treffer.group(1).strip())
            if src not in quellen:
                quellen.append(src)
        dazu = ""
        for i, src in enumerate(quellen):
            if src.startswith(("data:", "http:", "https:")):
                continue
            p = suche(src, quelle_dir)
            if p:
                dazu += f' data-mini-{i}="{bild_uri(p)}"'
            else:
                print(f"FEHLER  Bild nicht gefunden: {src}", file=sys.stderr)
        return f"{m.group(0)[:-1]}{dazu}>"

    if profil and profil != profil_von(quelltext):
        quelltext = setze_profil(quelltext, profil)
    t = re.sub(r'<link[^>]+href="([^"]+\.css)"[^>]*>', css_ersetzen, quelltext)
    t = re.sub(r'<script[^>]+src="([^"]+\.js)"[^>]*>\s*</script>', js_ersetzen, t)
    t = re.sub(r'(<img[^>]+src=")([^"]+)(")', bild_ersetzen, t)
    if grau:  # <image> in eigenem SVG; in Farbe bleibt alles, wie es ist
        t = re.sub(r'(<image\b[^>]*?\bhref=")([^"]+)(")', bild_ersetzen, t)
    t = re.sub(r"<x-verkehrszeichen\b[^>]*>", zeichen_ersetzen, t)
    t = re.sub(r"<x-kreislauf\b[^>]*>", stationen_ersetzen, t)
    t = re.sub(r"<x-(?:bingo|domino|spielplan|suchsel|kreuzwort)\b[^>]*>", mini_ersetzen, t)
    body = re.search(r'<body[^>]*class="([^"]*)"', t)
    fmt = next((SEITE[k] for k in (body.group(1).split() if body else []) if k in SEITE), None)
    if fmt and modus != "notizen":
        t = t.replace("</head>", f"<style>@page{{size:{fmt};margin:0}}</style>\n</head>", 1)
    if loesung:
        t = mit_klasse(t, "loesung")
    if modus:
        js = (ASSETS / "praesentation.js").read_text(encoding="utf-8")
        t = mit_klasse(t, f"praesentation-{modus}").replace("</head>", f"<script>\n{js}\n</script>\n</head>", 1)
    if profil_von(quelltext) == "sw":
        js = (ASSETS / "graustufen.js").read_text(encoding="utf-8")
        t = t.replace("</body>", f"<script>\n{js}\n</script>\n</body>")
    if pruefen:
        js = (ASSETS / "pruefung.js").read_text(encoding="utf-8")
        t = t.replace("</body>", f"<script>\n{js}\n</script>\n</body>")
    return t


def pruefbericht(html_pfad):
    dom = chromium(["--dump-dom"], Path(html_pfad).resolve().as_uri())
    m = re.search(r'<script type="application/json" id="pruefbericht">(.*?)</script>', dom, re.S)
    if not m:
        return {"seiten": [], "meldungen": [{"stufe": "FEHLER", "seite": 0, "code": "pruefskript", "text": "Prüfung lief nicht durch (Skriptfehler?)", "ziele": []}]}
    return json.loads(html.unescape(m.group(1)))


class Cdp:
    """Chromium über --remote-debugging-pipe: Nur so läuft eine Seite vor dem Drucken schon unter dem Medium print."""

    def __init__(self, ordner):
        von_chrome, an_uns = os.pipe()
        von_uns, an_chrome = os.pipe()
        def kanaele():  # Chromium erwartet die Pipe auf 3 und 4; die Enden können selbst dort liegen
            lesen, schreiben = fcntl.fcntl(von_uns, fcntl.F_DUPFD, 10), fcntl.fcntl(an_uns, fcntl.F_DUPFD, 10)
            os.dup2(lesen, 3, inheritable=True)
            os.dup2(schreiben, 4, inheritable=True)
        self.proc = subprocess.Popen(
            [finde_chromium(), "--headless", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
             "--allow-file-access-from-files", "--remote-debugging-pipe", f"--user-data-dir={ordner}", "about:blank"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, preexec_fn=kanaele, close_fds=False, start_new_session=True)
        os.close(von_uns)
        os.close(an_uns)
        self.schreiben, self.lesen = os.fdopen(an_chrome, "wb"), os.fdopen(von_chrome, "rb")
        self.nr = 0

    def nachricht(self):
        puffer = bytearray()
        while True:
            z = self.lesen.read(1)
            if not z:
                raise RuntimeError("Chromium hat die Verbindung beendet.")
            if z == b"\0":
                return json.loads(puffer)
            puffer += z

    def befehl(self, methode, sitzung=None, **parameter):
        self.nr += 1
        anfrage = {"id": self.nr, "method": methode, "params": parameter}
        if sitzung:
            anfrage["sessionId"] = sitzung
        self.schreiben.write(json.dumps(anfrage).encode() + b"\0")
        self.schreiben.flush()
        while True:
            antwort = self.nachricht()
            if antwort.get("id") == self.nr:
                if "error" in antwort:
                    raise RuntimeError(f"{methode}: {antwort['error'].get('message')}")
                return antwort["result"]

    def warte_auf(self, ereignis):
        while True:
            if self.nachricht().get("method") == ereignis:
                return

    def schliessen(self):
        try:
            self.befehl("Browser.close")
        except (RuntimeError, OSError):
            pass
        try:
            self.proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            os.killpg(self.proc.pid, 9)
            self.proc.wait()
        self.schreiben.close()
        self.lesen.close()


def pdf_grau(html_pfad, pdf_pfad):
    """s/w-PDF: Der Grau-Pass rechnet unter dem Medium print, damit er nur festschreibt, was im Druck gilt."""
    # Chromium schreibt beim Beenden noch ins Profil; ein Rest in /tmp ist besser als ein abgebrochener Bau.
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as profil:
        cdp = Cdp(profil)
        try:
            ziel = cdp.befehl("Target.createTarget", url="about:blank")["targetId"]
            s = cdp.befehl("Target.attachToTarget", targetId=ziel, flatten=True)["sessionId"]
            cdp.befehl("Page.enable", s)
            cdp.befehl("Emulation.setEmulatedMedia", s, media="print")
            cdp.befehl("Page.navigate", s, url=Path(html_pfad).resolve().as_uri())
            cdp.warte_auf("Page.loadEventFired")
            lauf = cdp.befehl("Runtime.evaluate", s, awaitPromise=True, returnByValue=True, expression=(
                "(async () => { await window.grauBereit; "
                "await Promise.all([...document.images].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))); "
                "window.macheGrau(); await new Promise((r) => setTimeout(r, 100)); return 'ok'; })()"))
            if lauf.get("result", {}).get("value") != "ok":
                sys.exit(f"Grau-Pass fehlgeschlagen: {lauf.get('exceptionDetails', {}).get('text', lauf)}")
            daten = cdp.befehl("Page.printToPDF", s, printBackground=True, preferCSSPageSize=True,
                               displayHeaderFooter=False)["data"]
            Path(pdf_pfad).write_bytes(base64.b64decode(daten))
        finally:
            cdp.schliessen()


def pdf(html_pfad, pdf_pfad, grau=False):
    if grau:
        pdf_grau(html_pfad, pdf_pfad)
    else:
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
            if box[2] <= box[0] or box[3] <= box[1]:  # Aufgabe liegt ganz außerhalb der Seite (Überlauf)
                continue
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


def hat_format(text, format_name):
    body = re.search(r'<body[^>]*class="([^"]*)"', text)
    return bool(body) and format_name in body.group(1).split()


def ist_folie(text):
    return hat_format(text, "folie")


def bild_cache(quelle):
    """Zwischenspeicher nur unter einem schon vorhandenen ausgabe/ neben der Quelle; sonst rechnet jeder Bau neu."""
    ausgabe = quelle.parent / "ausgabe"
    return ausgabe / "grau-cache" if ausgabe.is_dir() else None


def folien_ausgaben(text, quelle, aus, tmp, schritte, notizen, still, profil=None):
    """--schritte und --notizen; gibt (erzeugte Dateien, Meldungen, Anzahl Fehler) zurück."""
    if not ist_folie(text):
        print("Hinweis: --schritte und --notizen gibt es nur für Folien (body class folie).", file=sys.stderr)
        return [], [], 0
    name, erzeugt, meldungen, fehler = quelle.stem, [], [], 0
    if schritte:
        sh = Path(tmp) / f"{name}-schritte.html"
        sh.write_text(einbetten(text, quelle.parent, modus="schritte", profil=profil, cache=bild_cache(quelle)), encoding="utf-8")
        pdf(sh, aus / f"{name}-schritte.pdf", grau=(profil or profil_von(text)) == "sw")
        erzeugt.append(aus / f"{name}-schritte.pdf")
    if notizen:
        np = Path(tmp) / "pruefen-notizen.html"
        np.write_text(einbetten(text, quelle.parent, pruefen=True, modus="notizen", profil=profil, cache=bild_cache(quelle)), encoding="utf-8")
        nb = pruefbericht(np)
        nb["meldungen"] = [m for m in nb["meldungen"] if m["stufe"] == "FEHLER"]
        if nb["meldungen"]:
            fehler += ausgeben(nb, "Folien mit Notizen")
            meldungen += [{**m, "text": f"Folien mit Notizen: {m['text']}"} for m in nb["meldungen"]]
        elif not still:
            print(f"Folien mit Notizen: {len(nb['seiten'])} Blätter, Prüfung ok.")
        nh = Path(tmp) / f"{name}-notizen.html"
        nh.write_text(einbetten(text, quelle.parent, modus="notizen", profil=profil, cache=bild_cache(quelle)), encoding="utf-8")
        pdf(nh, aus / f"{name}-notizen.pdf", grau=(profil or profil_von(text)) == "sw")
        erzeugt.append(aus / f"{name}-notizen.pdf")
    return erzeugt, meldungen, fehler


def bauen(quelle, ausgabe=None, ohne_loesung=False, nur_pruefen=False, still=False, bericht_datei=None,
          schritte=False, notizen=False, nur_zusatz=False, profil=None):
    quelle = Path(quelle).resolve()
    aus = Path(ausgabe).resolve() if ausgabe else quelle.parent
    aus.mkdir(parents=True, exist_ok=True)
    name = quelle.stem
    text = quelle.read_text(encoding="utf-8")
    grau = (profil or profil_von(text)) == "sw"
    cache = bild_cache(quelle)
    with tempfile.TemporaryDirectory() as tmp:
        if nur_zusatz:
            erzeugt, meldungen, fehler = folien_ausgaben(text, quelle, aus, tmp, schritte, notizen, still, profil)
            bericht_schreiben(bericht_datei, {"seiten": []}, meldungen, fehler)
            if not still:
                print("Erzeugt:\n  " + "\n  ".join(str(p) for p in erzeugt))
            return {"seiten": [], "meldungen": meldungen}, fehler, []
        pruef = Path(tmp) / "pruefen.html"
        pruef.write_text(einbetten(text, quelle.parent, pruefen=True, profil=profil, cache=cache), encoding="utf-8")
        bericht = pruefbericht(pruef)
        fehler = ausgeben(bericht, "" if not still else name)
        meldungen = list(bericht["meldungen"])
        if nur_pruefen:
            bericht_schreiben(bericht_datei, bericht, meldungen, fehler)
            return bericht, fehler, []
        fertig = aus / f"{name}.html"
        fertig.write_text(einbetten(text, quelle.parent, profil=profil, cache=cache), encoding="utf-8")
        pdf(fertig, aus / f"{name}.pdf", grau=grau)
        if ist_folie(text):  # Offline-Präsentation; das PDF oben ist aus der Fassung ohne Laufzeit entstanden
            fertig.write_text(einbetten(text, quelle.parent, modus="start", profil=profil, cache=cache), encoding="utf-8")
        bilder = pngs(aus / f"{name}.pdf", str(aus / name))
        # Im Mini-Book liegen acht Felder auf einem Blatt, die Maße aus der Prüfung passen nicht zum Druckbild
        teile = [] if hat_format(text, "minibuch") else ausschnitte(bilder, bericht, str(aus / name))
        erzeugt = [fertig, aus / f"{name}.pdf", *bilder, *teile]
        hat_loesung = ("data-l=" in text or "loesung=" in text or "nur-loesung" in text
                       or re.search(OHNE_LOESUNGSANGABE, text) or re.search(MIT_LOESUNG, text)) and not ohne_loesung
        if hat_loesung:
            lp = Path(tmp) / "pruefen-loesung.html"
            lp.write_text(einbetten(text, quelle.parent, pruefen=True, loesung=True, profil=profil, cache=cache), encoding="utf-8")
            lb = pruefbericht(lp)
            lb["meldungen"] = [m for m in lb["meldungen"] if m["stufe"] == "FEHLER"]
            if lb["meldungen"]:
                fehler += ausgeben(lb, "Lösungsblatt")
                meldungen += [{**m, "text": f"Lösungsblatt: {m['text']}"} for m in lb["meldungen"]]
            lh = Path(tmp) / f"{name}-loesung.html"
            lh.write_text(einbetten(text, quelle.parent, loesung=True, profil=profil, cache=cache), encoding="utf-8")
            pdf(lh, aus / f"{name}-loesung.pdf", grau=grau)
            erzeugt += [aus / f"{name}-loesung.pdf", *pngs(aus / f"{name}-loesung.pdf", str(aus / f"{name}-loesung"))]
        if schritte or notizen:
            mehr, zusatz, zfehler = folien_ausgaben(text, quelle, aus, tmp, schritte, notizen, still, profil)
            erzeugt += mehr
            meldungen += zusatz
            fehler += zfehler
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
    rand, kopf = 30, 70
    groessen = []
    for png in seiten:  # Hochformate 794 px breit, Querformate (a4-quer, folie) 1123 px, Seitenverhältnis wie die Seite
        if not png:
            groessen.append((794, 1123))
            continue
        with Image.open(png) as im:
            w = 794 if im.height >= im.width else 1123
            groessen.append((w, round(w * im.height / im.width)))
    bild = Image.new("RGB", (rand + sum(w + rand for w, _ in groessen), max(h for _, h in groessen) + kopf + rand), "#e9e9e6")
    zeichne = ImageDraw.Draw(bild)
    try:
        schrift = ImageFont.truetype(str(next(iter(glob.glob("/usr/share/fonts/**/DejaVuSans-Bold.ttf", recursive=True)), "")), 22)
    except Exception:
        schrift = ImageFont.load_default()
    x = rand
    for png, n, st, (w, h) in zip(seiten, namen, status, groessen):
        zeichne.text((x, 12), n, fill="#1D1D1B", font=schrift)
        zeichne.text((x, 40), st, fill="#b00000" if "NICHT" in st or "Fehler" in st else "#2E7D32", font=schrift)
        if png:
            bild.paste(Image.open(png).convert("RGB").resize((w, h)), (x, kopf))
        x += w + rand
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
    b.add_argument("--schritte", action="store_true", help="Folien: NAME-schritte.pdf, eine Seite je Schritt")
    b.add_argument("--notizen", action="store_true", help="Folien: NAME-notizen.pdf, Folien mit Notizen auf A4")
    b.add_argument("--nur-zusatz", action="store_true", help="nur --schritte/--notizen bauen")
    b.add_argument("--profil", choices=("farbe", "sw"), help="Darstellung; ohne Angabe gilt die Quelle")
    u = sub.add_parser("uebersicht")
    u.add_argument("quellen", nargs="+")
    u.add_argument("-o", "--ausgabe")
    a = ap.parse_args()
    if a.cmd == "bauen":
        if a.nur_zusatz and not (a.schritte or a.notizen):
            ap.error("--nur-zusatz braucht --schritte oder --notizen")
        _, fehler, _ = bauen(a.quelle, a.ausgabe, a.ohne_loesung, a.nur_pruefen, bericht_datei=a.bericht,
                             schritte=a.schritte, notizen=a.notizen, nur_zusatz=a.nur_zusatz, profil=a.profil)
        sys.exit(1 if fehler else 0)
    uebersicht(a.quellen, a.ausgabe)


if __name__ == "__main__":
    main()
