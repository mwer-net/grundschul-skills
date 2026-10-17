"""Bilder für die Schoolbox aufbereiten (Pillow): Uploads aufnehmen und Graustufen-Fassungen anlegen.

    python3 bild.py aufnehmen <eingabe> <ziel-ohne-endung>
    python3 bild.py graustufen <eingabe> <ziel-ohne-endung>

Schreibt <ziel>.png oder <ziel>.jpg und gibt {"datei", "breite", "hoehe"} als JSON aus. Ein Bild, das sich nicht
lesen lässt, endet mit Exit 2 und einer Meldung auf stderr.

Aufnehmen entfernt alle Metadaten (EXIF mit GPS-Ort und Kamera, XMP, Kommentare). Die Drehung aus EXIF wird vorher
ins Bild übernommen, sonst stünde ein Hochkant-Foto vom iPad danach quer. Das Farbprofil bleibt: Es verrät nichts
und hält die Farben von iPad-Fotos (Display P3) richtig.
"""

import json
import sys
import warnings

from PIL import Image, ImageOps, UnidentifiedImageError

KANTE = 2400  # längste Kante: druckscharf über eine ganze A4-Seite (gut 200 dpi)
Image.MAX_IMAGE_PIXELS = 120_000_000
warnings.simplefilter("error", Image.DecompressionBombWarning)
VERLUSTFREI = {"PNG", "GIF", "BMP", "TIFF"}


def oeffne(pfad):
    try:
        bild = Image.open(pfad)
        bild.load()
        return bild
    except (UnidentifiedImageError, Image.DecompressionBombError, Image.DecompressionBombWarning, OSError) as fehler:
        print(f"Bild nicht lesbar: {fehler}", file=sys.stderr)
        sys.exit(2)


def hat_transparenz(bild):
    if bild.mode in ("RGBA", "LA", "PA") or (bild.mode == "P" and "transparency" in bild.info):
        alpha = bild.convert("RGBA").getchannel("A")
        return alpha.getextrema()[0] < 255
    return False


def speichere(bild, ziel, verlustfrei, profil):
    """PNG bei Transparenz oder verlustfreier Quelle (Strichzeichnungen bleiben scharf), sonst JPEG."""
    bild.info = {}
    extra = {"icc_profile": profil} if profil else {}
    if verlustfrei:
        datei = f"{ziel}.png"
        bild.save(datei, "PNG", **extra)
    else:
        datei = f"{ziel}.jpg"
        bild.save(datei, "JPEG", quality=90, optimize=True, **extra)
    return {"datei": datei, "breite": bild.width, "hoehe": bild.height}


def aufnehmen(eingabe, ziel):
    roh = oeffne(eingabe)
    profil = roh.info.get("icc_profile") if roh.mode != "CMYK" else None
    verlustfrei = roh.format in VERLUSTFREI
    bild = ImageOps.exif_transpose(roh)
    if hat_transparenz(bild):
        bild, verlustfrei = bild.convert("RGBA"), True
    elif bild.mode not in ("RGB", "L"):
        bild = bild.convert("RGB")
    bild.thumbnail((KANTE, KANTE), Image.LANCZOS)
    return speichere(bild, ziel, verlustfrei, profil)


def graustufen(eingabe, ziel):
    roh = oeffne(eingabe)
    bild = ImageOps.exif_transpose(roh)
    if hat_transparenz(bild):
        bild, verlustfrei = bild.convert("LA"), True
    else:
        bild, verlustfrei = bild.convert("RGB").convert("L"), roh.format in VERLUSTFREI
    return speichere(bild, ziel, verlustfrei, None)


def main():
    if len(sys.argv) != 4 or sys.argv[1] not in ("aufnehmen", "graustufen"):
        sys.exit(__doc__)
    befehl, eingabe, ziel = sys.argv[1:]
    ergebnis = aufnehmen(eingabe, ziel) if befehl == "aufnehmen" else graustufen(eingabe, ziel)
    print(json.dumps(ergebnis))


if __name__ == "__main__":
    main()
