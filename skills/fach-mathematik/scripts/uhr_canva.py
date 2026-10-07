#!/usr/bin/env python3
"""Erzeugt Canva-edit-design-Operationen für exakte Uhren als Vektorformen.

Für den Fall, dass Bilder nicht hochgeladen werden können: Die Uhr wird aus
Formen (insert_shape) und Texten (add_text) direkt im Design gebaut.

  python3 uhr_canva.py PAGE_ID LEFT TOP GROESSE ZEIT [ZEIT ...] --abstand 20

ZEIT: "7:00", "2:30" oder "leer". Mehrere Zeiten werden nebeneinander gesetzt.
Ausgabe: JSON-Liste von Operationen für mcp__Canva__edit-design.

Danach jede Uhr mit group_elements zu einem Element gruppieren (Locator-IDs aus
read-design; canva-materialerstellung/scripts/layout_check.py schlägt die
Gruppen fertig vor). Sonst besteht jede Uhr aus 16 losen Teilen, die die
Lehrkraft nicht als Ganzes verschieben kann.
"""
import argparse
import json
import math


def f(x):
    return f"{x:.1f}".rstrip("0").rstrip(".")


def clock_ops(page_id, left, top, size, time, with_numbers=True):
    ops = []
    vb = 100.0  # viewBox 0..100
    c, r = 50.0, 48.0

    # Ziffernblatt: Kreis
    circle = f"M {f(c - r)} {f(c)} A {f(r)} {f(r)} 0 1 0 {f(c + r)} {f(c)} A {f(r)} {f(r)} 0 1 0 {f(c - r)} {f(c)} Z"
    ops.append({"type": "insert_shape", "page_id": page_id, "top": top, "left": left,
                "width": size, "height": size, "path": circle, "view_box_width": vb, "view_box_height": vb,
                "color": "#FFFFFF", "stroke_color": "#000000", "stroke_weight": max(2, size / 60)})

    # Stundenstriche als dünne gefüllte Rechtecke (je ein Pfad mit 12 Teilformen)
    def tick_path(r_in, r_out, half_w, count, step):
        parts = []
        for i in range(count):
            a = math.radians(i * step - 90)
            ca, sa = math.cos(a), math.sin(a)
            px, py = -sa * half_w, ca * half_w
            x1, y1 = c + r_in * ca, c + r_in * sa
            x2, y2 = c + r_out * ca, c + r_out * sa
            parts.append(f"M {f(x1 + px)} {f(y1 + py)} L {f(x2 + px)} {f(y2 + py)} "
                         f"L {f(x2 - px)} {f(y2 - py)} L {f(x1 - px)} {f(y1 - py)} Z")
        return " ".join(parts)

    ops.append({"type": "insert_shape", "page_id": page_id, "top": top, "left": left,
                "width": size, "height": size, "path": tick_path(r * 0.84, r * 0.97, 0.9, 12, 30),
                "view_box_width": vb, "view_box_height": vb, "color": "#000000"})
    # Minutenstriche als offene Linien mit Kontur (kompakter als 60 Rechtecke)
    minute_lines = []
    for i in range(60):
        if i % 5 == 0:
            continue
        a = math.radians(i * 6 - 90)
        minute_lines.append(f"M {f(c + r * 0.91 * math.cos(a))} {f(c + r * 0.91 * math.sin(a))} "
                            f"L {f(c + r * 0.97 * math.cos(a))} {f(c + r * 0.97 * math.sin(a))}")
    ops.append({"type": "insert_shape", "page_id": page_id, "top": top, "left": left,
                "width": size, "height": size, "path": " ".join(minute_lines),
                "view_box_width": vb, "view_box_height": vb,
                "stroke_color": "#000000", "stroke_weight": max(1, round(size / 150, 1))})

    if with_numbers:
        fs = size * 0.15
        box = fs * 1.6  # Felder dürfen sich innerhalb der Uhr überlappen (wird gruppiert)
        for h in range(1, 13):
            a = math.radians(h * 30 - 90)
            x = left + (c + r * 0.68 * math.cos(a)) / vb * size
            y = top + (c + r * 0.68 * math.sin(a)) / vb * size
            ops.append({"type": "add_text", "page_id": page_id, "text": str(h),
                        "left": round(x - box / 2, 1), "top": round(y - fs * 0.7, 1), "width": round(box, 1),
                        "_format": {"font_size": max(8, round(fs)), "font_weight": "bold", "text_align": "center",
                                    "color": "#000000"}})

    def hand(angle_deg, length, half_w):
        a = math.radians(angle_deg - 90)
        ca, sa = math.cos(a), math.sin(a)
        px, py = -sa * half_w, ca * half_w
        tx, ty = c + length * ca, c + length * sa
        bx, by = c - 4 * ca, c - 4 * sa
        return (f"M {f(bx + px)} {f(by + py)} L {f(tx + px)} {f(ty + py)} "
                f"L {f(tx - px)} {f(ty - py)} L {f(bx - px)} {f(by - py)} Z")

    if time != "leer":
        hh, mm = (int(p) for p in time.split(":"))
        paths = [hand(mm * 6, r * 0.62, 1.1), hand(((hh % 12) + mm / 60) * 30, r * 0.40, 2.3)]
    else:
        paths = []
    dot = 2.6
    paths.append(f"M {f(c - dot)} {f(c)} A {f(dot)} {f(dot)} 0 1 0 {f(c + dot)} {f(c)} "
                 f"A {f(dot)} {f(dot)} 0 1 0 {f(c - dot)} {f(c)} Z")
    ops.append({"type": "insert_shape", "page_id": page_id, "top": top, "left": left,
                "width": size, "height": size, "path": " ".join(paths), "view_box_width": vb, "view_box_height": vb,
                "color": "#000000"})
    return ops


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("page_id")
    p.add_argument("left", type=float)
    p.add_argument("top", type=float)
    p.add_argument("groesse", type=float)
    p.add_argument("zeiten", nargs="+")
    p.add_argument("--abstand", type=float, default=20)
    a = p.parse_args()
    out = []
    for i, t in enumerate(a.zeiten):
        out += clock_ops(a.page_id, a.left + i * (a.groesse + a.abstand), a.top, a.groesse, t)
    print(json.dumps(out, ensure_ascii=False))
