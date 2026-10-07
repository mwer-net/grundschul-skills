#!/usr/bin/env python3
"""Prüft ein Canva-Design auf Layoutfehler (abgeschnitten, überlappend, unbearbeitbar).

Eingabe ist die gespeicherte Antwort von `read-design` mit
`filter.fields: ["design_content"]` und `open_transaction: true` (nur dann
liefert Canva Positionen und Locator-IDs). Die Datei darf auch das
Tool-Result-Format [{"type": "text", "text": "..."}] haben und abgeschnitten
sein (Canva kürzt große Antworten): Ausgewertet wird alles bis zur Schnittstelle,
der Bericht weist darauf hin.

  python3 layout_check.py design.json [--klasse 2] [--rand-cm 1.5] [--seite 1]

Ausgabe: Bericht mit FEHLER (muss behoben werden), WARNUNG (prüfen) und
HINWEIS (Bearbeitbarkeit), danach Vorschläge für `group_elements`.
Exit-Code 1, wenn FEHLER gefunden wurden.
"""
import argparse
import json
import re
import sys

PX_PRO_CM = 96 / 2.54          # Canva rechnet mit 96 px pro Zoll
DRUCKRAND_PX = 0.5 * PX_PRO_CM  # 5 mm: diesen Rand drucken Bürodrucker nicht
MIN_FLIESSTEXT_PX = {1: 26, 2: 21, 3: 19, 4: 16}  # 20/16/14/12 pt
TOL = 2.0                      # Toleranz in px für Rundungen


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
        return obj["design_content"]["pages"], False
    except (json.JSONDecodeError, KeyError, TypeError):
        pass
    dec = json.JSONDecoder()
    seiten = []
    for m in re.finditer(r'\{"type":"(fixed|responsive)","id":"([^"]+)","dimensions":(\{[^}]*\})', text):
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


# ---------- Prüfungen ----------

def pruefe_seite(seite, klasse, rand_px):
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
        container = [f for f in flaechen if enthaelt(box(f), bt) and f["width"] > t["width"] + 4]
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

    # 8. Bearbeitbarkeit: lose Teilelemente gruppieren
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
    a = p.parse_args()

    seiten, abgeschnitten = lade_seiten(lade_text(a.datei))
    if not seiten:
        sys.exit("Keine Seiten mit Elementen gefunden. read-design mit open_transaction und design_content lesen.")
    fehler = 0
    for nr, seite in enumerate(seiten, 1):
        if a.seite and nr != a.seite:
            continue
        befunde, vorschlaege = pruefe_seite(seite, a.klasse, a.rand_cm * PX_PRO_CM)
        d = seite["dimensions"]
        print(f"== Seite {nr} ({round(d['width'])}×{round(d['height'])} px, {len(seite['elements'])} Elemente) ==")
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
