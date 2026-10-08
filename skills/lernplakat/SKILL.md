---
name: lernplakat
description: Gestaltet Lernplakate, Merkplakate, Anschauungsposter und Tafelbilder bzw. Whiteboard-Folien für Klasse 1–4. Verwenden bei Merkplakat, Lernplakat, Regelplakat, Anschauungsmaterial für die Wand, Tafelbild oder Präsentation für den Unterricht.
---

# Lernplakat und Tafelbild

Laden mit: `grundschul-didaktik`, passendem `fach-*`, `html-materialerstellung`.

Ein Lernplakat sichert Wissen dauerhaft im Raum. Es wird im Unterricht gemeinsam erarbeitet oder als Ergebnis aufgehängt und muss aus der Entfernung funktionieren.

## Rückfragen

Zuerst die Start-Abfrage (`grundschul-didaktik/references/rueckfragen.md`): Medium (A3, A2 aus A4-Kacheln oder Whiteboard) und Farbe; die Bausteine entfallen. Danach:

1. **Zweck:** Merkplakat (Regel/Strategie), Anschauung (Zahlenstrahl, Uhr, Alphabet), Wortspeicher, Klassenregeln/Rituale, Lernkultur (Wachstumsstufen, „noch"-Sätze, Hilfe-Regel) oder Tafelbild für den Kreisinput?
2. **Kernaussage:** Welche eine Regel/Strategie soll hängen bleiben? Gibt es Lehrwerksformulierungen, die übernommen werden sollen?
3. **Teilweise leer lassen?** Plakat mit Lücken zum gemeinsamen Ausfüllen im Unterricht?

## Entwürfe und Aufgabenplan

2–3 Entwürfe zeigen (Format `a3-hoch` bzw. `folie` am `<body>`), erst nach Freigabe des Aufgabenplans die Endfassung bauen (`grundschul-didaktik/references/entwurf-und-aufgabenplan.md`).

- **Entwürfe unterscheiden sich** im Aufbau (Regel + Beispiele / Schrittfolge / Lückenplakat) und in der Anordnung.
- **Aufgabenplan:** alle Texte wörtlich, Beispiele, Bildliste, Schriftgrößen für die Leseentfernung.

## Regeln

- **Eine Kernaussage pro Plakat**, max. 3 Teilinformationen. Lesbar aus 5–6 m: Überschrift ≥ 100 pt, Text ≥ 48 pt (A3).
- Beispiel-orientiert: Regel + 1–2 farbig markierte Beispiele ("Nomen schreibt man groß: der **H**und, die **S**onne").
- Strategien als nummerierte Schritte mit Symbolen (z. B. Rechenweg "Erst zum Zehner, dann weiter").
- Farbcodes konsistent mit Arbeitsblättern und Klassenkonvention.
- Willi oder Wilma Waschbär mit Funktion (spricht den Merksatz oder den Strategietipp in der Sprechblase), eine Figur pro Plakat.
- Fachlich exakte Begriffe in Kindersprache, keine falschen Vereinfachungen ("Minus macht kleiner" stimmt später nicht – lieber "Wegnehmen").

## Tafelbild / Whiteboard-Folien

- Für den Kreisinput (10–12 min): Ich-kann-Ziel oben, Erarbeitung in der Mitte, Ergebnis/Merksatz unten gerahmt, zum Schluss eine Folie mit den Lernaufgaben (mit Niveaus ● / ●● / ●●● zur Auswahl, sonst in der Reihenfolge, ggf. mit Sternchenaufgabe ★).
- Für die Reflexion: Folie mit der Reflexionsfrage, mit Wachstumsgrafik, wenn die Selbsteinschätzung gewählt ist.
- Pro Folie ein Schritt; max. 3 Folien pro Unterrichtsphase.
- Bilder groß, Text minimal; das Tafelbild entsteht im Unterricht, nicht als fertiger Vortrag.
- Kinder-Ergebnisse einplanen (leere Felder, Platz für Wortkarten).

## Qualitätscheck

- [ ] Eine Kernaussage, sofort erkennbar
- [ ] Aus der letzten Reihe lesbar
- [ ] Fachlich korrekt und anschlussfähig für spätere Klassen
- [ ] Konsistent mit Arbeitsblättern (Begriffe, Farben, Symbole)

## Umsetzung (`html-materialerstellung`)

- Merkplakat: `<body class="… a3-hoch">`; A2 im Copyshop aus dem A3-PDF hochskalieren.
- Tafelbild: `<body class="… folie">` (16:9), PDF für das Whiteboard, PNG-Vorschau aus `blatt.py` als Bild.
- Schriftgrößen für die Leseentfernung über eigenes `<style>` (z. B. `--fs:40px`).
