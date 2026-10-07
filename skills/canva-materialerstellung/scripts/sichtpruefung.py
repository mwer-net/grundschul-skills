#!/usr/bin/env python3
"""Zerlegt ein Canva-Vorschaubild in vergrößerte Ausschnitte für die visuelle Endkontrolle.

Das Vorschaubild aus `read-design` (`thumbnails`) ist nur ca. 424×600 px groß;
Fehler in Abbildungen, gequetschte Beispiele und Umbrüche fallen darin kaum auf.
Das Skript schneidet Kopf, jede Aufgabe und Fuß einzeln aus, vergrößert sie und
speichert sie als PNG. Jeder Ausschnitt wird danach angesehen und gegen die
Checkliste in `references/visuelle-endkontrolle.md` geprüft.

  python3 sichtpruefung.py vorschau.png [--design design.json] [--seite 1] [--aus ausschnitte] [--farbe]

Mit --design (gespeicherte Antwort von read-design oder edit-design) wird an den
Nummernkreisen der Aufgaben geschnitten, sonst in vier überlappende Streifen.
Mit --farbe entsteht zusätzlich eine Graustufen-Fassung der ganzen Seite
(Farbblätter werden oft doch s/w kopiert).
"""
import argparse
import os
import sys

from PIL import Image, ImageOps

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import layout_check as lc  # noqa: E402

ZIELBREITE = 1200  # px je Ausschnitt nach dem Vergrößern


def baender_aus_design(pfad, seite_nr):
    """Liefert (Seitenhöhe, [(name, oben, unten), …]) in Design-px, geschnitten an den Aufgabennummern."""
    seiten, _ = lc.lade_seiten(lc.lade_text(pfad))
    if not seiten:
        sys.exit("Keine Seite im Design gefunden.")
    seite = seiten[min(seite_nr, len(seiten)) - 1]
    W, H = seite["dimensions"]["width"], seite["dimensions"]["height"]
    els = [e for e in seite["elements"] if all(k in e for k in ("left", "top", "width", "height"))]
    tops = sorted(round(k["top"]) for k in lc.nummernkreise(els))
    if not tops:
        return W, H, None
    luft = 16 * W / lc.A4_BREITE
    grenzen = [max(0, t - luft) for t in tops]
    baender = [("kopf", 0, grenzen[0] + luft)]
    for i, oben in enumerate(grenzen):
        unten = grenzen[i + 1] + luft if i + 1 < len(grenzen) else H
        baender.append((f"aufgabe_{i + 1}", oben, unten))
    return W, H, baender


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("bild")
    p.add_argument("--design", help="read-design/edit-design-Antwort derselben Seite")
    p.add_argument("--seite", type=int, default=1)
    p.add_argument("--aus", default="ausschnitte")
    p.add_argument("--farbe", action="store_true", help="zusätzlich Graustufen-Fassung speichern")
    a = p.parse_args()

    bild = Image.open(a.bild).convert("RGB")
    bw, bh = bild.size
    os.makedirs(a.aus, exist_ok=True)

    baender = None
    if a.design:
        W, H, baender = baender_aus_design(a.design, a.seite)
        if baender is None:
            print("Keine Nummernkreise gefunden, schneide in Streifen.")
        else:
            k = bh / H
            baender = [(n, o * k, u * k) for n, o, u in baender]
    if baender is None:
        hoehe = bh / 3
        baender = [(f"streifen_{i + 1}", max(0, i * bh / 4 - 0.1 * hoehe), min(bh, i * bh / 4 + hoehe))
                   for i in range(4)]

    dateien = []
    for name, oben, unten in baender:
        if unten - oben < 4:
            continue
        aus = bild.crop((0, int(oben), bw, int(min(bh, unten + 1))))
        f = ZIELBREITE / aus.width
        aus = aus.resize((ZIELBREITE, max(1, int(aus.height * f))), Image.LANCZOS)
        ziel = os.path.join(a.aus, f"{name}.png")
        aus.save(ziel)
        dateien.append(ziel)
    if a.farbe:
        ziel = os.path.join(a.aus, "graustufen.png")
        ImageOps.grayscale(bild).save(ziel)
        dateien.append(ziel)

    print("Ausschnitte zum Ansehen (jeden einzeln öffnen und gegen die Checkliste prüfen):")
    for d in dateien:
        print(" ", d)
    print("Checkliste: references/visuelle-endkontrolle.md (Abbildung stimmt, Beispiel nicht gequetscht, "
          "auf einen Blick verständlich, nichts abgeschnitten/überlappend/umgebrochen, genug Luft).")


if __name__ == "__main__":
    main()
