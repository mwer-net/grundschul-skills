#!/usr/bin/env python3
"""Prüft ein Canva-Design auf Layoutfehler (abgeschnitten, überlappend, unbearbeitbar).

Eingabe ist die gespeicherte Antwort von `read-design` mit
`filter.fields: ["design_content"]` und `open_transaction: true` (nur dann
liefert Canva Positionen und Locator-IDs) oder die Antwort von `edit-design`
(Seite unter "document"). Die Datei darf auch das
Tool-Result-Format [{"type": "text", "text": "..."}] haben und abgeschnitten
sein (Canva kürzt große Antworten): Ausgewertet wird alles bis zur Schnittstelle,
der Bericht weist darauf hin.

  python3 layout_check.py design.json [--klasse 2] [--rand-cm 1.5] [--seite 1] [--farbe] [--ohne-skalierung] [--alle]

Ausgabe: Bericht mit FEHLER (muss behoben werden), WARNUNG (prüfen) und
HINWEIS (Bearbeitbarkeit, Platz, Übersicht), danach Vorschläge für `group_elements`.
Alle Schwellen gelten für eine A4-Seite mit 794 px Breite. Liefert Canva ein
A4/Letter-Blatt in anderer Auflösung (z. B. 1123×1587), werden Maße und
Schriftgrößen vorher auf 794 px umgerechnet; --ohne-skalierung schaltet das ab
(z. B. für echte A3-Plakate).
Ohne Option gilt das Druckprofil Schwarz-Weiß: Farb- und Grauflächen,
Hintergrundbilder, farbige Schrift und helle oder dünne Linien werden gemeldet.
Mit --farbe gilt das Farbprofil: gemeldet werden Hintergrundbilder, Flächen
hinter Aufgaben, Text mit zu wenig Kontrast und farbiger Fließtext.
Exit-Code 1, wenn FEHLER gefunden wurden.

Locator-IDs für edit-design: Seiten-ID + "-" + Element-ID (wie im Bericht).
"""
import argparse
import json
import re
import sys

PX_PRO_CM = 96 / 2.54          # Canva rechnet mit 96 px pro Zoll
DRUCKRAND_PX = 0.5 * PX_PRO_CM  # 5 mm: diesen Rand drucken Bürodrucker nicht
MIN_FLIESSTEXT_PX = {1: 26, 2: 21, 3: 19, 4: 16}  # 20/16/14/12 pt
TOL = 2.0                      # Toleranz in px für Rundungen
MAX_FLAECHE_PX2 = 3000         # ≈ 2 cm²: größere gefüllte Flächen kosten Toner und kopieren unsauber
HELL_LINIE = 140               # Grauwert (0–255) heller als ca. #808080 fällt beim Kopieren weg
DUNKEL_TEXT = 90               # Text heller als dieser Grauwert ist in s/w kontrastarm
LEERSTREIFEN_PX = 64           # ungenutzte waagerechte Streifen ab dieser Höhe melden
A4_BREITE = 794                # Bezugsbreite aller Schwellen (A4 hoch bei 96 px/Zoll)
MAX_AUFGABEN = {1: 3, 2: 4, 3: 5, 4: 6}           # Richtwert pro A4-Seite (druck-und-platz.md)
MAX_BELEGUNG = {1: 0.55, 2: 0.55, 3: 0.65, 4: 0.65}  # Anteil belegter Fläche im Satzspiegel
VOLL = False                   # --alle: jede gequetschte Stelle einzeln ausgeben
MIN_LUFT_PX = 12               # Mindestabstand zwischen Elementen nebeneinander in einer Reihe


# ---------- Einlesen (auch abgeschnittene Antworten) ----------

def lade_text(pfad):
    roh = open(pfad, encoding="utf-8").read()
    try:
        obj = json.loads(roh)
    except json.JSONDecodeError:
        return roh
    if isinstance(obj, list) and obj and isinstance(obj[0], dict) and "text" in obj[0]:
        return obj[0]["text"]
    return json.dumps(obj)


def lade_seiten(text):
    """Liefert (seiten, abgeschnitten). Vollständiges JSON oder tolerant geparst."""
    try:
        obj = json.loads(text)
        if "document" in obj:  # Antwort von edit-design: eine Seite
            return [obj["document"]["page"]], False
        return obj["design_content"]["pages"], False
    except (json.JSONDecodeError, KeyError, TypeError):
        pass
    dec = json.JSONDecoder()
    seiten = []
    for m in re.finditer(r'\{"type":"(fixed|responsive)","id":"([^"]+)",(?:"title":"(?:[^"\\]|\\.)*",)?'
                         r'"dimensions":(\{[^}]*\})', text):
        seite = {"type": m.group(1), "id": m.group(2), "dimensions": json.loads(m.group(3)), "elements": []}
        start = text.find('"elements":[', m.end())
        if start < 0:
            continue
        i = start + len('"elements":[')
        while i < len(text):
            try:
                el, i = dec.raw_decode(text, i)
            except json.JSONDecodeError:
                break
            seite["elements"].append(el)
            if i < len(text) and text[i] == ",":
                i += 1
            else:
                break
        seiten.append(seite)
    return seiten, True


# ---------- Maßstab ----------

MASS_SCHLUESSEL = ("left", "top", "width", "height", "fontSize", "weight")


def skaliere(obj, k):
    """Rechnet Positionen, Größen, Schriftgrößen und Linienstärken mit Faktor k um."""
    if isinstance(obj, dict):
        for key, v in obj.items():
            if key in MASS_SCHLUESSEL and isinstance(v, (int, float)) and not isinstance(v, bool):
                obj[key] = v * k
            elif key not in ("viewBox", "imageBox"):
                skaliere(v, k)
    elif isinstance(obj, list):
        for v in obj:
            skaliere(v, k)


def massstab(seite):
    """Faktor auf 794 px Breite, wenn die Seite ein A4-/Letter-Blatt in anderer Auflösung ist."""
    W, H = seite["dimensions"]["width"], seite["dimensions"]["height"]
    kurz, lang = min(W, H), max(W, H)
    if abs(kurz - A4_BREITE) <= 2 or not 1.25 <= lang / kurz <= 1.45:
        return 1.0
    return A4_BREITE / kurz


# ---------- Geometrie ----------

def box(e):
    return (e["left"], e["top"], e["left"] + e["width"], e["top"] + e["height"])


def enthaelt(a, b, tol=TOL):
    """a enthält b vollständig."""
    return a[0] - tol <= b[0] and a[1] - tol <= b[1] and a[2] + tol >= b[2] and a[3] + tol >= b[3]


def schnitt(a, b):
    w = min(a[2], b[2]) - max(a[0], b[0])
    h = min(a[3], b[3]) - max(a[1], b[1])
    return (w, h) if w > TOL and h > TOL else None


def gleich(a, b, tol=TOL):
    return all(abs(x - y) <= tol for x, y in zip(a, b))


def text_von(e):
    return "".join(r.get("characters", "") for r in e.get("textRegions", []))


def schriftgroesse(e):
    groessen = [r.get("formatting", {}).get("fontSize") for r in e.get("textRegions", [])]
    groessen = [g for g in groessen if g]
    return min(groessen) if groessen else None


def name(e):
    if e["type"] == "text":
        t = text_von(e).replace("\n", " ").strip()
        return f'Text "{t[:30]}{"…" if len(t) > 30 else ""}"'
    return {"rect": "Fläche", "shape": "Form", "image": "Bild", "group": "Gruppe",
            "line": "Linie"}.get(e["type"], e["type"])


def ref(e):
    return f'{name(e)} [{e.get("locator_id", e["id"])}] @ {round(e["left"])},{round(e["top"])} ' \
           f'{round(e["width"])}×{round(e["height"])}'


# ---------- Farbe und Druck ----------

def hex_rgb(h):
    h = (h or "").lstrip("#")
    if len(h) != 6:
        return None
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def grauwert(rgb):
    """Helligkeit wie bei der Umsetzung in Graustufen (0 = schwarz, 255 = weiß)."""
    return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]


def bunt(rgb):
    return max(rgb) - min(rgb) > 24


def alle_elemente(els):
    """Elemente inklusive der Kinder von Gruppen."""
    for e in els:
        yield e
        if e.get("children"):
            yield from alle_elemente(e["children"])


def pfad_anteil(d, vb):
    """Anteil des Pfad-Rahmens an der viewBox (einfache absolute Pfade, sonst 1)."""
    if not vb or not vb.get("width") or not vb.get("height") or re.search(r"[a-z]", d):
        return 1.0
    xs, ys = [], []
    x = y = 0.0
    for cmd, args in re.findall(r"([MLHVCSAZ])([^MLHVCSAZ]*)", d):
        n = [float(v) for v in re.findall(r"-?\d*\.?\d+(?:e-?\d+)?", args)]
        if cmd in "ML" and len(n) >= 2:
            pts = list(zip(n[0::2], n[1::2]))
        elif cmd in "CS" and len(n) >= 2:
            pts = list(zip(n[0::2], n[1::2]))
        elif cmd == "A" and len(n) >= 7:
            r = max(n[0], n[1])
            x, y = n[5], n[6]
            xs += [x - r, x + r]
            ys += [y - r, y + r]
            continue
        elif cmd == "H" and n:
            pts = [(n[-1], y)]
        elif cmd == "V" and n:
            pts = [(x, n[-1])]
        else:
            continue
        for px, py in pts:
            xs.append(px)
            ys.append(py)
        x, y = pts[-1]
    if not xs:
        return 1.0
    w = min(max(xs), vb["width"]) - max(min(xs), 0)
    h = min(max(ys), vb["height"]) - max(min(ys), 0)
    return max(0.0, min(1.0, w * h / (vb["width"] * vb["height"])))


def fuellungen(e):
    """(rgb, stroke_rgb, stroke_weight, strichbild) je Pfad einer Form.

    strichbild: Pfad aus mehreren Teilpfaden (Uhrstriche, Zeiger, Ringe). Seine
    Fläche lässt sich nicht aus dem Rahmen ablesen und wird nicht als Fläche gewertet."""
    for p in e.get("paths", []):
        fill = (p.get("fill") or {}).get("color") or {}
        stroke = p.get("stroke") or {}
        d = p.get("d", "")
        strichbild = len(re.findall(r"[Mm]", d)) > 1 or pfad_anteil(d, e.get("viewBox")) < 0.5
        yield (hex_rgb(fill.get("color")) if fill.get("type") == "solid" else None,
               hex_rgb((stroke.get("color") or {}).get("color")), stroke.get("weight", 0) or 0, strichbild)


def pruefe_druck(seite, els, figuren, add):
    """Schwarz-Weiß-Druck: Toner, Kopierbarkeit, Kontrast."""
    W, H = seite["dimensions"]["width"], seite["dimensions"]["height"]
    hg = seite.get("background") or {}
    if hg.get("media"):
        add("WARNUNG", "Seitenhintergrund ist ein Bild: kostet Toner und kopiert unsauber. Bild entfernen, weiß lassen.")
    hg_rgb = hex_rgb((hg.get("color") or {}).get("color") if isinstance(hg.get("color"), dict) else hg.get("color"))
    if hg_rgb and grauwert(hg_rgb) < 250:
        add("WARNUNG", f"Seitenhintergrund ist nicht weiß ({hg.get('color')}): weißen Hintergrund verwenden.")

    alle = list(alle_elemente(els))
    deckung = 0.0
    gefuellte_flaechen = []
    for e in alle:
        if e["type"] != "shape" or not all(k in e for k in ("width", "height")):
            continue
        flaeche = e["width"] * e["height"]
        duenn = min(e["width"], e["height"]) <= 4  # als Rechteck gebaute Linie
        for fill, stroke, weight, strichbild in fuellungen(e):
            if fill and grauwert(fill) < 250 and not strichbild:
                deckung += flaeche * (1 - grauwert(fill) / 255)
                gefuellte_flaechen.append((box(e), grauwert(fill)))
                if duenn:
                    if grauwert(fill) > HELL_LINIE:
                        add("WARNUNG", f"Linie zu hell für Kopien (Grauwert {round(grauwert(fill))}, "
                                       f"höchstens ca. #808080): {ref(e)}")
                    if min(e["width"], e["height"]) < 1:
                        add("WARNUNG", f"Linie dünner als 1 px, verschwindet beim Kopieren: {ref(e)}")
                elif flaeche > MAX_FLAECHE_PX2:
                    add("WARNUNG", f"Gefüllte Fläche ({round(flaeche / PX_PRO_CM ** 2, 1)} cm²) kostet Toner und "
                                   f"kopiert unsauber. Entfernen oder nur Kontur: {ref(e)}")
                elif bunt(fill):
                    add("HINWEIS", f"Farbige Füllung wird in s/w grau. Schwarz (#1D1D1B) verwenden: {ref(e)}")
            if weight and stroke:
                if grauwert(stroke) > HELL_LINIE:
                    add("WARNUNG", f"Kontur zu hell für Kopien (Grauwert {round(grauwert(stroke))}): {ref(e)}")
                elif bunt(stroke):
                    add("HINWEIS", f"Farbige Kontur wird in s/w grau. Schwarz/dunkelgrau verwenden: {ref(e)}")
                if weight < 1 and not any(enthaelt(bx, box(e)) for bx in figuren):
                    add("WARNUNG", f"Kontur dünner als 1 px ({weight}), verschwindet beim Kopieren: {ref(e)}")

    for t in (e for e in alle if e["type"] == "text"):
        farben = {r.get("formatting", {}).get("color") for r in t.get("textRegions", [])} - {None}
        for c in farben:
            rgb = hex_rgb(c)
            if not rgb or grauwert(rgb) <= DUNKEL_TEXT:
                continue
            unter = [g for bx, g in gefuellte_flaechen if enthaelt(bx, box(t), tol=4)]
            if grauwert(rgb) > 230 and unter:
                if min(unter) > DUNKEL_TEXT:
                    add("WARNUNG", f"Weiße Schrift auf heller/farbiger Fläche ist in s/w kaum lesbar. "
                                   f"Fläche schwarz (#1D1D1B) färben: {ref(t)}")
                continue  # weiße Ziffer im schwarzen Nummernkreis ist gewollt
            add("WARNUNG", f"Schrift in {c} wird in s/w {'grau und kontrastarm' if grauwert(rgb) < 230 else 'unsichtbar'}. "
                           f"Schwarz (#1D1D1B) verwenden: {ref(t)}")

    bilder = [e for e in alle if (e.get("fill") or {}).get("media") or e["type"] == "image"]
    if bilder:
        add("HINWEIS", f"{len(bilder)} Bild(er): Für s/w als Strichzeichnung einsetzen (Leitfigur und "
                       f"Wachstumsgrafik in der Strich-Version). Farbige Bilder werden zu Grauflächen.")
    prozent = 100 * deckung / (W * H)
    if prozent >= 1:
        add("WARNUNG" if prozent >= 3 else "HINWEIS",
            f"Formen und Flächen decken ca. {prozent:.1f} % der Seite (ohne Text und Bilder; eine "
            f"Textseite hat ca. 5 %). Flächen entfernen spart Toner.")


def kontrast_zu_weiss(rgb):
    """WCAG-Kontrastverhältnis einer Farbe zu Weiß."""
    def kanal(c):
        c /= 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    lum = 0.2126 * kanal(rgb[0]) + 0.7152 * kanal(rgb[1]) + 0.0722 * kanal(rgb[2])
    return 1.05 / (lum + 0.05)


def pruefe_farbe(seite, els, add):
    """Farbprofil: Farbe als Akzent, keine Flächen hinter Aufgaben, lesbare Schrift."""
    W = seite["dimensions"]["width"]
    hg = seite.get("background") or {}
    if hg.get("media"):
        add("WARNUNG", "Seitenhintergrund ist ein Bild: weiß lassen, Farbe nur als Akzent.")
    alle = list(alle_elemente(els))
    gefuellte = []
    for e in alle:
        if e["type"] != "shape" or not all(k in e for k in ("width", "height")):
            continue
        for fill, _, _, strichbild in fuellungen(e):
            if not fill or grauwert(fill) >= 250 or strichbild or min(e["width"], e["height"]) <= 4:
                continue
            gefuellte.append((box(e), fill))
            if e["width"] > 0.5 * W and e["height"] > 60:
                add("WARNUNG", f"Fläche hinter Aufgabe/Kopf/Fuß: im Farbprofil nur Akzente. Fläche entfernen: {ref(e)}")
            elif e["width"] * e["height"] > MAX_FLAECHE_PX2 and grauwert(fill) < 230:
                add("HINWEIS", f"Kräftige Farbfläche ({round(e['width'] * e['height'] / PX_PRO_CM ** 2, 1)} cm²): "
                               f"Farbe lieber als Kontur oder sehr heller Ton: {ref(e)}")
    for t in (e for e in alle if e["type"] == "text"):
        for r in t.get("textRegions", []):
            rgb = hex_rgb(r.get("formatting", {}).get("color"))
            if not rgb:
                continue
            unter = [f for bx, f in gefuellte if enthaelt(bx, box(t), tol=4)]
            if unter:
                continue  # Ziffer im Nummernkreis o. Ä.
            if kontrast_zu_weiss(rgb) < 3:
                add("WARNUNG", f"Schrift {r['formatting']['color']} hat zu wenig Kontrast zu Weiß "
                               f"({kontrast_zu_weiss(rgb):.1f}:1, mind. 3:1): {ref(t)}")
                break
            if bunt(rgb) and len(text_von(t).split()) > 6:
                add("HINWEIS", f"Längerer Text in Farbe: Anweisungen und Fließtext schwarz (#1D1D1B): {ref(t)}")
                break


def pruefe_platz(seite, els, rand_px, klasse, add):
    """Platz für Aufgaben statt für Kästen und Leerstreifen."""
    W, H = seite["dimensions"]["width"], seite["dimensions"]["height"]
    kaesten = []
    for e in els:
        if e["type"] not in ("shape", "rect") or e["width"] < 0.5 * W or e["height"] < 80:
            continue
        if e["width"] * e["height"] > 0.9 * W * H:
            continue
        gefuellt = any(f and grauwert(f) < 250 for f, _, _, _ in fuellungen(e))
        umrandet = any(w and s for _, s, w, _ in fuellungen(e))
        if gefuellt or umrandet:
            kaesten.append(e)
    if kaesten:
        add("HINWEIS", f"{len(kaesten)} Aufgabenkasten/-kästen über die Spaltenbreite. Kästen kosten Innenabstand: "
                       f"Aufgaben ohne Kasten mit hängender Nummer setzen (druck-und-platz.md).")
    # Leerstreifen: belegte Höhen ohne Kästen (deren Innenraum zählt nicht als genutzt)
    belegt = sorted((e["top"], e["top"] + e["height"]) for e in els
                    if e not in kaesten and e["width"] * e["height"] < 0.9 * W * H)
    oben, unten = rand_px, H - rand_px
    pos = oben
    # Kl. 1/2: Luft ist gewollt, nur große Lücken melden und nicht zum Auffüllen raten
    grenze = 3 * LEERSTREIFEN_PX if klasse in (1, 2) else LEERSTREIFEN_PX
    rat = ("Abstände gleichmäßig verteilen oder Schreibfläche vergrößern, nicht mit Items auffüllen."
           if klasse in (1, 2) else "Items ergänzen oder Schreibfläche sinnvoll vergrößern.")
    for a, b in belegt:
        if a - pos > grenze and pos < unten:
            add("HINWEIS", f"Ungenutzter Streifen von {round(min(a, unten) - pos)} px (y {round(pos)}–"
                           f"{round(min(a, unten))}): {rat}")
        pos = max(pos, b)
    if unten - pos > grenze:
        add("HINWEIS", f"Unten bleiben {round(unten - pos)} px frei: {rat}")


def nummernkreise(els):
    """Aufgabennummern: kleine runde Formen (24–48 px) mit einer Ziffer oder ★ darin bzw. ★-Text."""
    texte = [e for e in els if e["type"] == "text"]
    kreise = []
    for e in els:
        if e["type"] == "shape" and 24 <= e["width"] <= 48 and abs(e["width"] - e["height"]) <= 4:
            if any(re.fullmatch(r"\s*(\d{1,2}|★)\s*", text_von(t)) and enthaelt(box(e), box(t), tol=6)
                   for t in texte):
                kreise.append(e)
    return kreise


def pruefe_uebersicht(seite, els, figuren, klasse, rand_px, add):
    """Übersicht für Kinder: Aufgabenzahl, Belegung des Satzspiegels, gequetschte Reihen."""
    W, H = seite["dimensions"]["width"], seite["dimensions"]["height"]
    inhalt = [e for e in els if e["width"] * e["height"] < 0.9 * W * H]

    if klasse:
        n = len(nummernkreise(inhalt))
        if n > MAX_AUFGABEN[klasse]:
            add("WARNUNG", f"{n} Aufgaben auf der Seite, Richtwert für Klasse {klasse} höchstens "
                           f"{MAX_AUFGABEN[klasse]}. Aufgabe streichen oder auf zwei Seiten verteilen.")

    # Belegung auf einem 4-px-Raster (Textfelder zählen mit ihrer ganzen Breite)
    g = 4
    x0, y0, x1, y1 = rand_px, rand_px, W - rand_px, H - rand_px
    belegt = set()
    for e in inhalt:
        bx = box(e)
        for x in range(int(max(x0, bx[0]) // g), int(min(x1, bx[2]) // g)):
            for y in range(int(max(y0, bx[1]) // g), int(min(y1, bx[3]) // g)):
                belegt.add((x, y))
    gesamt = max(1, int((x1 - x0) // g) * int((y1 - y0) // g))
    anteil = len(belegt) / gesamt
    if klasse and anteil > MAX_BELEGUNG[klasse]:
        add("WARNUNG", f"Seite wirkt voll: {round(100 * anteil)} % des Satzspiegels belegt (Klasse {klasse}: "
                       f"höchstens ca. {round(100 * MAX_BELEGUNG[klasse])} %). Items oder Aufgaben streichen, "
                       f"Abstände vergrößern.")

    # Gequetscht: Elemente nebeneinander in derselben Reihe mit zu wenig Luft
    def in_figur(e):
        return any(enthaelt(bx, box(e)) for bx in figuren)

    # Nummernkreis + Ziffer neben der Anweisung ist die gewollte hängende Nummer
    nummern = nummernkreise(inhalt)
    nummer_boxen = [box(k) for k in nummern]
    kandidaten = [e for e in inhalt if not in_figur(e) and e["type"] != "group" and min(e["width"], e["height"]) > 4
                  and not any(enthaelt(nb, box(e), tol=6) for nb in nummer_boxen)]
    gemeldet = 0
    for i, a in enumerate(kandidaten):
        for b in kandidaten[i + 1:]:
            ba, bb = box(a), box(b)
            if enthaelt(ba, bb) or enthaelt(bb, ba):
                continue
            hoehe = min(ba[3], bb[3]) - max(ba[1], bb[1])
            if hoehe < 0.5 * min(a["height"], b["height"]):
                continue  # nicht in derselben Reihe
            luecke = max(bb[0] - ba[2], ba[0] - bb[2])
            typen = {a["type"], b["type"]}
            # Text neben Text (Gleichung aus Einzelfeldern) ist mit Wortabstand gewollt; gemeldet wird
            # Text, der an einer Abbildung, Tabelle oder Linie klebt
            if TOL < luecke < MIN_LUFT_PX and "text" in typen and typen != {"text"}:
                if gemeldet < 8 or VOLL:
                    add("WARNUNG", f"Gequetscht: nur {round(luecke)} px Luft nebeneinander (mind. {MIN_LUFT_PX} px, "
                                   f"zwischen Items 24–32 px): {ref(a)} / {ref(b)}")
                gemeldet += 1
    if gemeldet > 8 and not VOLL:
        add("WARNUNG", f"… und {gemeldet - 8} weitere gequetschte Stellen.")


# ---------- Prüfungen ----------

def pruefe_seite(seite, klasse, rand_px, farbe=False):
    befunde = []  # (stufe, text)
    W, H = seite["dimensions"]["width"], seite["dimensions"]["height"]
    els = [e for e in seite["elements"] if all(k in e for k in ("left", "top", "width", "height"))]

    def add(stufe, txt):
        befunde.append((stufe, txt))

    # Seitenformat
    if (round(W), round(H)) == (816, 1056):
        add("HINWEIS", "Seite ist US-Letter (816×1056 px). PDF mit size \"a4\" exportieren; Ränder großzügig halten, "
                       "weil der Inhalt beim Einpassen auf A4 leicht verschoben wird.")
    if seite.get("type") == "responsive":
        add("FEHLER", "Seite ist responsiv (Canva-Doc): keine Positionierung möglich. Neu mit festem Format anlegen.")

    flaeche_seite = W * H
    seitenhintergrund = [e for e in els if e["width"] * e["height"] > 0.9 * flaeche_seite]

    # 1. Ränder: abgeschnitten / Druckrand / Satzspiegel
    for e in els:
        if e in seitenhintergrund:
            continue
        x1, y1, x2, y2 = box(e)
        if x2 <= 0 or y2 <= 0 or x1 >= W or y1 >= H:
            add("FEHLER", f"Liegt komplett außerhalb der Seite (Restelement, löschen): {ref(e)}")
            continue
        abstand = min(x1, y1, W - x2, H - y2)
        if abstand < -TOL:
            add("FEHLER", f"Ragt über den Seitenrand und wird abgeschnitten: {ref(e)}")
        elif abstand < DRUCKRAND_PX:
            add("FEHLER", f"Liegt im nicht bedruckbaren Rand (< 5 mm, {round(abstand)} px): {ref(e)}")
        elif abstand < rand_px - TOL:
            add("WARNUNG", f"Unterschreitet den Seitenrand ({round(abstand)} px statt {round(rand_px)} px): {ref(e)}")

    # Formstapel gleicher Größe = zusammengesetzte Abbildung (z. B. Uhr aus Ebenen)
    stapel = {}
    for e in els:
        if e["type"] in ("shape", "rect"):
            stapel.setdefault(tuple(round(v) for v in box(e)), []).append(e)
    figuren = [bx for bx, teile in stapel.items() if len(teile) >= 2]

    def selbe_figur(a, b):
        return any(enthaelt(bx, box(a)) and enthaelt(bx, box(b)) for bx in figuren)

    # 2. Überlappungen
    for i, a in enumerate(els):
        for b in els[i + 1:]:
            if a in seitenhintergrund or b in seitenhintergrund:
                continue
            ba, bb = box(a), box(b)
            s = schnitt(ba, bb)
            if not s or selbe_figur(a, b):
                continue
            texte = [e for e in (a, b) if e["type"] == "text"]
            if gleich(ba, bb) and a["type"] in ("shape", "rect") and b["type"] in ("shape", "rect"):
                if a["type"] == "rect" and b["type"] == "rect":
                    add("WARNUNG", f"Zwei Flächen exakt übereinander (Dublette?): {ref(a)} / {ref(b)}")
                continue  # Formstapel (z. B. Uhr aus mehreren Ebenen) ist gewollt
            if len(texte) == 2 and text_von(a).strip() == text_von(b).strip() and gleich(ba, bb, 6):
                add("FEHLER", f"Doppelter Text übereinander: {ref(a)}")
                continue
            if len(texte) == 2:
                add("FEHLER", f"Texte überlappen: {ref(a)} / {ref(b)}")
                continue
            if enthaelt(ba, bb) or enthaelt(bb, ba):
                continue  # Inhalt liegt vollständig in seiner Fläche: gewollt
            if min(s) <= 6:
                add("WARNUNG", f"Elemente berühren sich ({round(s[0])}×{round(s[1])} px), Abstand schaffen: "
                               f"{ref(a)} / {ref(b)}")
            elif texte:
                add("FEHLER", f"Text wird teilweise überdeckt oder ragt aus seiner Fläche: {ref(a)} / {ref(b)}")
            else:
                add("WARNUNG", f"Elemente überlappen teilweise ({round(s[0])}×{round(s[1])} px): {ref(a)} / {ref(b)}")

    # 3. Innenabstand Text in Fläche
    flaechen = [e for e in els if e["type"] in ("rect", "shape") and e not in seitenhintergrund]
    for t in (e for e in els if e["type"] == "text"):
        bt = box(t)
        if any(enthaelt(bx, bt) for bx in figuren):
            continue  # Ziffern einer Uhr o. Ä. sitzen bewusst nah am Rand
        # Tabellen-/Stellenwertzellen, Kästchen und Beschriftungsfelder sind bewusst eng
        container = [f for f in flaechen if enthaelt(box(f), bt) and f["width"] > t["width"] + 4
                     and f["width"] >= 0.35 * W and f["height"] >= 80]
        if not container:
            continue
        f = min(container, key=lambda c: c["width"] * c["height"])
        bf = box(f)
        innen = min(bt[0] - bf[0], bt[1] - bf[1], bf[2] - bt[2], bf[3] - bt[3])
        if innen < 6 and f["width"] * f["height"] > 4 * t["width"] * t["height"]:
            add("WARNUNG", f"Text klebt am Rand seiner Fläche ({round(innen)} px, mind. 12 px): {ref(t)}")

    # 4. Wachstumspuffer unter Text (Text wächst bei Bearbeitung nach unten)
    for t in (e for e in els if e["type"] == "text" and len(text_von(e).strip()) > 3):
        bt = box(t)
        darunter = []
        for o in els:
            if o is t or o in seitenhintergrund:
                continue
            bo = box(o)
            if enthaelt(bo, bt):
                continue
            if bo[1] >= bt[3] - TOL and min(bt[2], bo[2]) - max(bt[0], bo[0]) > TOL:
                darunter.append(bo[1] - bt[3])
        if darunter and min(darunter) < 8:
            add("WARNUNG", f"Kein Platz zum Wachsen unter dem Text ({round(min(darunter))} px): {ref(t)}")

    # 5. Text-Inhalt und Schrift
    for t in (e for e in els if e["type"] == "text"):
        inhalt = text_von(t)
        if not inhalt.strip():
            add("WARNUNG", f"Leeres Textfeld (löschen): {ref(t)}")
            continue
        if re.search(r"[  ]{3,}|\t", inhalt.strip("\n")):
            add("HINWEIS", f"Layout mit Leerzeichen/Tabs gebaut – verrutscht bei jeder Änderung. "
                           f"Getrennte Textfelder verwenden: {ref(t)}")
        if re.search(r"_{12,}", inhalt) and not re.match(r"^\s*(Name|Datum)", inhalt):
            add("HINWEIS", f"Antwortlinie aus Unterstrichen: zu niedrig zum Schreiben, Länge ändert sich mit der "
                           f"Schrift. Besser Linienform: {ref(t)}")
        fs = schriftgroesse(t)
        woerter = len(inhalt.split())
        if fs and klasse and woerter >= 3 and fs < MIN_FLIESSTEXT_PX[klasse] - 0.5:
            add("WARNUNG", f"Schrift {round(fs)} px zu klein für Klasse {klasse} "
                           f"(mind. {MIN_FLIESSTEXT_PX[klasse]} px): {ref(t)}")
        if fs and fs < 12:
            add("WARNUNG", f"Schrift unter 12 px ist im Druck kaum lesbar: {ref(t)}")

    # 6. Drehung, Sperre
    for e in els:
        if abs(e.get("rotation", 0)) > 0.5:
            add("HINWEIS", f"Gedreht ({e['rotation']}°): erschwert Ausrichten und Bearbeiten: {ref(e)}")
        if e.get("isLocked"):
            add("HINWEIS", f"Gesperrt: {ref(e)}")

    # 7. Ausrichtung der großen Blöcke (Raster)
    bloecke = sorted((e for e in flaechen if e["width"] > 0.5 * W), key=lambda e: e["top"])
    if len(bloecke) >= 2:
        lefts = [round(b["left"]) for b in bloecke]
        rights = [round(b["left"] + b["width"]) for b in bloecke]
        if 0 < max(lefts) - min(lefts) <= 12:
            add("WARNUNG", f"Aufgabenblöcke fast, aber nicht bündig (linke Kanten {sorted(set(lefts))}).")
        if 0 < max(rights) - min(rights) <= 12:
            add("WARNUNG", f"Aufgabenblöcke unterschiedlich breit (rechte Kanten {sorted(set(rights))}).")
        luecken = [round(b2["top"] - (b1["top"] + b1["height"])) for b1, b2 in zip(bloecke, bloecke[1:])]
        luecken = [l for l in luecken if l >= -TOL]
        if luecken and min(luecken) < 16:
            add("WARNUNG", f"Abstand zwischen Blöcken zu klein ({min(luecken)} px, mind. 16–24 px).")
        if len(luecken) >= 2 and max(luecken) - min(luecken) > 8:
            add("HINWEIS", f"Abstände zwischen Blöcken uneinheitlich ({luecken} px); einen Wert verwenden.")

    # 8. Druck (s/w) und Platz
    if farbe:
        pruefe_farbe(seite, els, add)
    else:
        pruefe_druck(seite, els, figuren, add)
    pruefe_platz(seite, els, rand_px, klasse, add)
    pruefe_uebersicht(seite, els, figuren, klasse, rand_px, add)

    # 9. Bearbeitbarkeit: lose Teilelemente gruppieren
    vorschlaege = []
    vergeben = set()
    for bx in figuren:
        mitglieder = [e for e in els if enthaelt(bx, box(e)) and e["type"] != "group"]
        if len(mitglieder) >= 3:
            ids = [e.get("locator_id", e["id"]) for e in mitglieder]
            if not vergeben.intersection(ids):
                vergeben.update(ids)
                vorschlaege.append({"type": "group_elements", "locator_ids": ids})
    if vorschlaege:
        add("HINWEIS", f"{len(vorschlaege)} zusammengesetzte Abbildung(en) (z. B. Uhren) bestehen aus losen Teilen. "
                       f"Gruppieren, sonst kann die Lehrkraft sie nicht als Ganzes verschieben.")
    if len([e for e in els if e["type"] != "group"]) > 80:
        add("HINWEIS", f"{len(els)} Elemente auf der Seite: Zusammengehöriges gruppieren, Ebenenliste wird sonst "
                       f"unübersichtlich.")
    return befunde, vorschlaege


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("datei")
    p.add_argument("--klasse", type=int, choices=[1, 2, 3, 4])
    p.add_argument("--rand-cm", type=float, default=1.5, help="Seitenrand für Inhalte (Standard 1,5 cm)")
    p.add_argument("--seite", type=int, help="nur diese Seite (1-basiert)")
    p.add_argument("--farbe", action="store_true", help="Druckprofil Farbe statt Schwarz-Weiß prüfen")
    p.add_argument("--ohne-skalierung", action="store_true",
                   help="Maße nicht auf A4 mit 794 px Breite umrechnen (z. B. echtes A3-Plakat)")
    p.add_argument("--alle", action="store_true", help="alle gequetschten Stellen einzeln ausgeben")
    a = p.parse_args()
    global VOLL
    VOLL = a.alle

    seiten, abgeschnitten = lade_seiten(lade_text(a.datei))
    if not seiten:
        sys.exit("Keine Seiten mit Elementen gefunden. read-design mit open_transaction und design_content lesen.")
    fehler = 0
    for nr, seite in enumerate(seiten, 1):
        if a.seite and nr != a.seite:
            continue
        d = dict(seite["dimensions"])
        k = 1.0 if a.ohne_skalierung else massstab(seite)
        if k != 1.0:
            skaliere(seite, k)
            seite["dimensions"] = {"width": d["width"] * k, "height": d["height"] * k}
        befunde, vorschlaege = pruefe_seite(seite, a.klasse, a.rand_cm * PX_PRO_CM, a.farbe)
        print(f"== Seite {nr} ({round(d['width'])}×{round(d['height'])} px, {len(seite['elements'])} Elemente) ==")
        if k != 1.0:
            print(f"HINWEIS: Seite in anderer Auflösung, Maße für die Prüfung auf 794 px Breite umgerechnet "
                  f"(Faktor {k:.3f}). Positionen im Bericht sind umgerechnet; für edit-design durch {k:.3f} teilen.")
        for stufe in ("FEHLER", "WARNUNG", "HINWEIS"):
            for s, t in befunde:
                if s == stufe:
                    print(f"{stufe}: {t}")
        fehler += sum(1 for s, _ in befunde if s == "FEHLER")
        if not befunde:
            print("Keine Befunde.")
        if vorschlaege:
            print("Gruppierungs-Operationen für edit-design:")
            print(json.dumps(vorschlaege, ensure_ascii=False))
    if abgeschnitten:
        print("\nACHTUNG: Die Canva-Antwort war abgeschnitten. Nur die enthaltenen Elemente wurden geprüft; "
              "Rest mit filter.element_ids oder seitenweise nachlesen.")
    sys.exit(1 if fehler else 0)


if __name__ == "__main__":
    main()
