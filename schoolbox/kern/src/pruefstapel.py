"""Nur für Tests: viele Seiten in EINEM Chromium auswerten, statt je Seite einen Browser zu starten.

Aufruf: pruefstapel.py <Ordner von blatt.py> <auftrag.json>
Auftrag: [{"quelle": Pfad, "aus": Pfad, "element": "pruefbericht", "pruefen": true}, …]
In `aus` steht danach der Text des Elements, oder nichts, wenn die Seite es nicht rechtzeitig angelegt hat.
"""
import json
import sys
import tempfile
import time
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, sys.argv[1])
import blatt  # noqa: E402

FRIST = 60


def lies_element(cdp, datei, element):
    ziel = cdp.befehl("Target.createTarget", url="about:blank")["targetId"]
    sitzung = cdp.befehl("Target.attachToTarget", targetId=ziel, flatten=True)["sessionId"]
    ausdruck = f"document.getElementById({json.dumps(element)})?.textContent ?? ''"
    try:
        cdp.befehl("Page.navigate", sitzung, url=datei.resolve().as_uri())
        ende = time.time() + FRIST
        while time.time() < ende:
            wert = cdp.befehl("Runtime.evaluate", sitzung, returnByValue=True, expression=ausdruck)
            text = wert.get("result", {}).get("value") or ""
            if text:
                return text
            time.sleep(0.02)
        return ""
    finally:
        cdp.befehl("Target.closeTarget", targetId=ziel)


def main():
    auftraege = json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
        cdp = blatt.Cdp(tmp)
        try:
            for a in auftraege:
                quelle = Path(a["quelle"]).resolve()
                # Neben der Quelle, damit relative Pfade gelten wie beim Bauen
                seite = quelle.with_name(f"{quelle.stem}.stapel.html")
                seite.write_text(
                    blatt.einbetten(quelle.read_text(encoding="utf-8"), quelle.parent, pruefen=a["pruefen"],
                                    cache=blatt.bild_cache(quelle)),
                    encoding="utf-8")
                try:
                    Path(a["aus"]).write_text(lies_element(cdp, seite, a["element"]), encoding="utf-8")
                finally:
                    seite.unlink()
        finally:
            cdp.schliessen()


main()
