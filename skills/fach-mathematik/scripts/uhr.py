#!/usr/bin/env python3
"""Erzeugt fachlich exakte Uhr-Zifferblätter als PNG (transparent oder weiß).

Beispiele:
  python3 uhr.py 7:00 uhr_7.png          # Uhr mit Zeigern
  python3 uhr.py 2:30 uhr_halb3.png      # Stundenzeiger steht korrekt zwischen 2 und 3
  python3 uhr.py leer uhr_leer.png       # Zifferblatt ohne Zeiger zum Einzeichnen
  python3 uhr.py 7:00 uhr.png --minuten  # mit Minutenzahlen außen (ab Kl. 3)

Nur Pillow nötig. KI-generierte Uhren zeigen oft falsche Zeiten – deshalb exakt rechnen.
"""
import argparse
import math
from PIL import Image, ImageDraw, ImageFont

FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
]


def load_font(size):
    for path in FONT_CANDIDATES:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def draw_clock(time, out, size=800, minutes=False, transparent=False):
    s = size * 4  # Supersampling für glatte Kanten
    img = Image.new("RGBA", (s, s), (255, 255, 255, 0 if transparent else 255))
    d = ImageDraw.Draw(img)
    c = s / 2
    r = s * (0.40 if minutes else 0.46)
    black = (0, 0, 0, 255)

    d.ellipse([c - r, c - r, c + r, c + r], fill=(255, 255, 255, 255), outline=black, width=int(s * 0.018))

    for i in range(60):  # Minutenstriche, Stundenstriche dicker
        a = math.radians(i * 6 - 90)
        hour = i % 5 == 0
        r1 = r * (0.86 if hour else 0.92)
        d.line([c + r1 * math.cos(a), c + r1 * math.sin(a),
                c + r * 0.97 * math.cos(a), c + r * 0.97 * math.sin(a)],
               fill=black, width=int(s * (0.010 if hour else 0.004)))

    font = load_font(int(r * 0.17))
    for h in range(1, 13):
        a = math.radians(h * 30 - 90)
        x, y = c + r * 0.74 * math.cos(a), c + r * 0.74 * math.sin(a)
        d.text((x, y), str(h), font=font, fill=black, anchor="mm")

    if minutes:
        mfont = load_font(int(r * 0.11))
        for m in range(0, 60, 5):
            a = math.radians(m * 6 - 90)
            x, y = c + r * 1.13 * math.cos(a), c + r * 1.13 * math.sin(a)
            d.text((x, y), str(m), font=mfont, fill=(90, 90, 90, 255), anchor="mm")

    if time != "leer":
        hh, mm = (int(p) for p in time.split(":"))
        ma = math.radians(mm * 6 - 90)
        ha = math.radians(((hh % 12) + mm / 60) * 30 - 90)
        # Minutenzeiger: lang und schmal; Stundenzeiger: kurz und dick
        d.line([c, c, c + r * 0.62 * math.cos(ma), c + r * 0.62 * math.sin(ma)], fill=black, width=int(s * 0.016))
        d.line([c, c, c + r * 0.40 * math.cos(ha), c + r * 0.40 * math.sin(ha)], fill=black, width=int(s * 0.032))

    dot = s * 0.022
    d.ellipse([c - dot, c - dot, c + dot, c + dot], fill=black)

    img.resize((size, size), Image.LANCZOS).save(out)


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("zeit", help='z. B. "7:00", "2:30" oder "leer"')
    p.add_argument("datei", help="Ausgabedatei (.png)")
    p.add_argument("--groesse", type=int, default=800)
    p.add_argument("--minuten", action="store_true", help="Minutenzahlen außen anzeigen")
    p.add_argument("--transparent", action="store_true")
    a = p.parse_args()
    draw_clock(a.zeit, a.datei, a.groesse, a.minuten, a.transparent)
