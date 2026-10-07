#!/usr/bin/env python3
"""Kopiert eine Canva-Seite per edit-design-Operationen (z. B. für das Lösungsblatt).

`edit-design` kennt keine Operation zum Duplizieren einer Seite. Dieses Skript
baut aus der gespeicherten `read-design`-Antwort (design_content, mit
open_transaction) die Operationen, die eine Seite auf einer neuen, leeren Seite
nachbauen. Zwei Schritte, weil `add_text` immer 16 px, normal, linksbündig setzt
und Canva die IDs der neuen Texte erst in der Antwort nennt:

1) Bauen:
   python3 seite_kopieren.py bauen design.json --ziel PAGE_ID [--seite 1]
          [--ohne ELEMENT_ID ...] [--ersetze "Alt=Neu" ...] [--aus kopie]
   → kopie_ops.json (insert_shape, insert_fill, add_text) an edit-design geben
     (bei sehr vielen Operationen in Teilen, z. B. je 150),
   → kopie_format.json merkt sich Schrift je Text.

2) Formatieren:
   python3 seite_kopieren.py formatieren kopie_format.json antwort.json --ziel PAGE_ID
   antwort.json = gespeicherte Antwort von edit-design (oder read-design der Zielseite).
   → format_text-Operationen auf stdout; an edit-design geben.

Gruppen werden nicht kopiert (gemeldet); vorher auflösen oder danach neu gruppieren.
Lösungen danach als eigene Texte ergänzen (fett, unterstrichen).
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import layout_check as lc  # noqa: E402


def bauen(a):
    seiten, abgeschnitten = lc.lade_seiten(lc.lade_text(a.design))
    if abgeschnitten:
        print("ACHTUNG: Antwort abgeschnitten, nur enthaltene Elemente werden kopiert.", file=sys.stderr)
    seite = seiten[a.seite - 1]
    ersetze = dict(r.split("=", 1) for r in a.ersetze)
    ops, formate = [], []
    for e in seite["elements"]:
        if e["id"] in a.ohne or not all(k in e for k in ("left", "top", "width", "height")):
            continue
        pos = {"left": e["left"], "top": e["top"], "width": e["width"], "height": e["height"]}
        if e["type"] == "group":
            print(f"Gruppe nicht kopiert: {e['id']}", file=sys.stderr)
        elif e["type"] == "shape":
            vb = e.get("viewBox") or {}
            for pfad in e.get("paths", []):
                o = {"type": "insert_shape", "page_id": a.ziel, **pos, "path": pfad["d"],
                     "view_box_width": vb.get("width", e["width"]), "view_box_height": vb.get("height", e["height"])}
                fill = (pfad.get("fill") or {}).get("color") or {}
                if fill.get("color"):
                    o["color"] = fill["color"].upper()
                stroke = pfad.get("stroke") or {}
                if stroke.get("weight"):
                    o["stroke_color"] = (stroke.get("color") or {}).get("color", "#1D1D1B").upper()
                    o["stroke_weight"] = stroke["weight"]
                ops.append(o)
        elif (e.get("fill") or {}).get("media"):
            m = e["fill"]["media"]
            ops.append({"type": "insert_fill", "page_id": a.ziel, "asset_type": "image", "asset_id": m["mediaId"],
                        "alt_text": (m.get("altText") or {}).get("text", ""), **pos})
        elif e["type"] == "text":
            regionen = e.get("textRegions", [])
            text = "".join(r.get("characters", "") for r in regionen).rstrip("\n")
            text = ersetze.get(text, text)
            f = (regionen[0].get("formatting", {}) if regionen else {})
            ops.append({"type": "add_text", "page_id": a.ziel, "text": text,
                        "left": e["left"], "top": e["top"], "width": e["width"]})
            formate.append({"text": text, "left": e["left"], "top": e["top"], "formatting": {
                k2: v for k2, v in {
                    "font_size": round(f["fontSize"]) if f.get("fontSize") else None,
                    "font_weight": f.get("fontWeight"),
                    "font_style": f.get("fontStyle"),
                    "color": f.get("color", "").upper() or None,
                    "line_height": f.get("lineHeight"),
                    "text_align": f.get("textAlign"),
                    "decoration": f.get("decoration"),
                }.items() if v is not None}})
    json.dump(ops, open(f"{a.aus}_ops.json", "w"), ensure_ascii=False, separators=(",", ":"))
    json.dump(formate, open(f"{a.aus}_format.json", "w"), ensure_ascii=False)
    print(f"{len(ops)} Operationen → {a.aus}_ops.json, {len(formate)} Texte → {a.aus}_format.json")


def formatieren(a):
    formate = json.load(open(a.formate))
    seiten, _ = lc.lade_seiten(lc.lade_text(a.antwort))
    seite = next((s for s in seiten if s["id"] == a.ziel), seiten[-1])
    texte = [e for e in seite["elements"] if e["type"] == "text"]
    erlaubt = {"font_size", "font_weight", "font_style", "color", "line_height", "text_align", "decoration"}
    ops, vergeben, fehlt = [], set(), 0
    for f in formate:
        treffer = [e for e in texte if e["id"] not in vergeben and lc.text_von(e).strip() == f["text"].strip()
                   and abs(e["left"] - f["left"]) < 2 and abs(e["top"] - f["top"]) < 2]
        if not treffer:
            fehlt += 1
            print(f"nicht gefunden: {f['text'][:40]!r} @ {round(f['left'])},{round(f['top'])}", file=sys.stderr)
            continue
        e = treffer[0]
        vergeben.add(e["id"])
        ops.append({"type": "format_text", "locator_id": f"{seite['id']}-{e['id']}",
                    "formatting": {k: v for k, v in f["formatting"].items() if k in erlaubt}})
    print(json.dumps(ops, ensure_ascii=False, separators=(",", ":")))
    print(f"{len(ops)} format_text-Operationen, {fehlt} Texte nicht gefunden", file=sys.stderr)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="schritt", required=True)
    b = sub.add_parser("bauen")
    b.add_argument("design")
    b.add_argument("--ziel", required=True, help="page_id der neuen, leeren Seite (aus add_page)")
    b.add_argument("--seite", type=int, default=1, help="Quellseite (1-basiert)")
    b.add_argument("--ohne", nargs="*", default=[], help="Element-IDs, die nicht kopiert werden")
    b.add_argument("--ersetze", nargs="*", default=[], help='ganzen Text ersetzen: "Alt=Neu"')
    b.add_argument("--aus", default="kopie")
    f = sub.add_parser("formatieren")
    f.add_argument("formate")
    f.add_argument("antwort")
    f.add_argument("--ziel", required=True)
    a = p.parse_args()
    bauen(a) if a.schritt == "bauen" else formatieren(a)


if __name__ == "__main__":
    main()
