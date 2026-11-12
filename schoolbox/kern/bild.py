"""Bilder für die Schoolbox aufbereiten (Pillow): Uploads aufnehmen, Vorschaubilder für die Kacheln, Figuren messen.

    python3 bild.py aufnehmen <eingabe> <ziel-ohne-endung>
    python3 bild.py vorschaubilder <breite> <hoehe> <quelle> <ziel> [<quelle> <ziel> …]
    python3 bild.py figuren <datei> [<datei> …]

Aufnehmen schreibt <ziel>.png oder <ziel>.jpg und gibt {"datei", "breite", "hoehe"} als JSON aus. Ein Bild, das sich
nicht lesen lässt, endet mit Exit 2 und einer Meldung auf stderr.

Aufnehmen entfernt alle Metadaten (EXIF mit GPS-Ort und Kamera, XMP, Kommentare). Die Drehung aus EXIF wird vorher
ins Bild übernommen, sonst stünde ein Hochkant-Foto vom iPad danach quer. Das Farbprofil bleibt: Es verrät nichts
und hält die Farben von iPad-Fotos (Display P3) richtig.

Vorschaubilder (178) schreibt je Paar ein WebP, höchstens <breite> breit und <hoehe> hoch, nie größer als die Quelle,
mit der Änderungszeit der Quelle. Ein Paar, das nicht gelingt, hält die anderen nicht auf: Ausgabe ist die JSON-Liste
[{"quelle", "ok"}] (bei "ok": false dazu "fehler"), Exit 0.

Figuren (177) misst je Datei Größe und den Anteil der Pixel mit Alpha < 16 (ohne Alphakanal 0): Daran erkennt die
Figurenbibliothek freigestellte Figuren. Ausgabe ist die JSON-Liste [{"datei", "breite", "hoehe", "durchsichtig"}];
eine unlesbare Datei misst 0 × 0, Exit 0.
"""

import json
import os
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


def vorschaubild(quelle, ziel, breite, hoehe):
    # Die Zeit vor dem Lesen: Ändert sich die Quelle währenddessen, gilt das Vorschaubild gleich als veraltet.
    st = os.stat(quelle)
    with Image.open(quelle) as roh:
        if roh.format == "JPEG":
            roh.draft("RGB", (breite, breite))
        roh.load()
        profil = roh.info.get("icc_profile") if roh.mode != "CMYK" else None
        bild = ImageOps.exif_transpose(roh)
    bild = bild.convert("RGBA" if hat_transparenz(bild) else "RGB")
    bild.thumbnail((breite, hoehe), Image.LANCZOS)
    extra = {"icc_profile": profil} if profil else {}
    bild.save(ziel, "WEBP", quality=80, method=4, **extra)
    os.utime(ziel, ns=(st.st_atime_ns, st.st_mtime_ns))


def vorschaubilder(breite, hoehe, paare):
    ergebnisse = []
    for quelle, ziel in paare:
        # Breit gefangen: Ein kaputtes Bild darf die anderen nicht abbrechen (darum nicht `oeffne`).
        try:
            vorschaubild(quelle, ziel, breite, hoehe)
            ergebnisse.append({"quelle": quelle, "ok": True})
        except Exception as fehler:
            ergebnisse.append({"quelle": quelle, "ok": False, "fehler": str(fehler) or type(fehler).__name__})
    return ergebnisse


def figur(datei):
    try:
        with Image.open(datei) as bild:
            breite, hoehe = bild.size
            if bild.mode not in ("RGBA", "LA", "PA") and "transparency" not in bild.info:
                return {"datei": datei, "breite": breite, "hoehe": hoehe, "durchsichtig": 0}
            alpha = bild.convert("RGBA").getchannel("A")
    except Exception:
        # Breit gefangen wie bei den Vorschaubildern: Eine kaputte Datei darf die anderen nicht aufhalten.
        return {"datei": datei, "breite": 0, "hoehe": 0, "durchsichtig": 0}
    anteil = sum(alpha.histogram()[:16]) / max(1, breite * hoehe)
    return {"datei": datei, "breite": breite, "hoehe": hoehe, "durchsichtig": round(anteil, 4)}


def main():
    befehl = sys.argv[1] if len(sys.argv) > 1 else None
    if befehl == "aufnehmen" and len(sys.argv) == 4:
        print(json.dumps(aufnehmen(*sys.argv[2:])))
    elif befehl == "vorschaubilder" and len(sys.argv) >= 6 and len(sys.argv) % 2 == 0:
        try:
            breite, hoehe = int(sys.argv[2]), int(sys.argv[3])
        except ValueError:
            sys.exit(__doc__)
        rest = sys.argv[4:]
        print(json.dumps(vorschaubilder(breite, hoehe, list(zip(rest[::2], rest[1::2])))))
    elif befehl == "figuren" and len(sys.argv) >= 3:
        print(json.dumps([figur(datei) for datei in sys.argv[2:]]))
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
