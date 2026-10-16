---
name: lernplakat
description: Gestaltet Lernplakate, Merkplakate und Anschauungsposter für die Wand in Klasse 1–4. Verwenden bei Lernplakat, Merkplakat, Regelplakat, Plakat oder Anschauungsmaterial für die Wand. Folien, Präsentationen und Tafelbilder für Beamer oder Whiteboard macht der Skill praesentation.
---

# Lernplakat

Laden mit: `grundschul-didaktik`, passendem `fach-*`, `html-materialerstellung`.

Ein Lernplakat sichert Wissen dauerhaft im Raum. Es wird im Unterricht gemeinsam erarbeitet oder als Ergebnis aufgehängt und muss aus der Entfernung funktionieren.

## Rückfragen

Zuerst die Start-Abfrage (`grundschul-didaktik/references/rueckfragen.md`): Medium (A3 oder A2 aus A4-Kacheln) und Farbe; die Bausteine entfallen. Folien für Beamer oder Whiteboard (Kreisinput, Tafelbild, Reflexion) macht der Skill `praesentation`. Danach:

1. **Zweck:** Merkplakat (Regel/Strategie), Anschauung (Zahlenstrahl, Uhr, Alphabet), Wortspeicher, Klassenregeln/Rituale oder Lernkultur (Wachstumsstufen, „noch"-Sätze, Hilfe-Regel)?
2. **Kernaussage:** Welche eine Regel/Strategie soll hängen bleiben? Gibt es Lehrwerksformulierungen, die übernommen werden sollen?
3. **Teilweise leer lassen?** Plakat mit Lücken zum gemeinsamen Ausfüllen im Unterricht?

## Entwürfe und Aufgabenplan

2–3 Entwürfe zeigen (Format `a3-hoch` am `<body>`), erst nach Freigabe des Aufgabenplans die Endfassung bauen (`grundschul-didaktik/references/entwurf-und-aufgabenplan.md`).

- **Entwürfe unterscheiden sich** im Aufbau (Regel + Beispiele / Schrittfolge / Lückenplakat) und in der Anordnung.
- **Aufgabenplan:** alle Texte wörtlich, Beispiele, Bildliste, Schriftgrößen für die Leseentfernung.

## Regeln

- **Eine Kernaussage pro Plakat**, max. 3 Teilinformationen. Lesbar aus 5–6 m: Überschrift ≥ 100 pt, Text ≥ 48 pt (A3).
- Beispiel-orientiert: Regel + 1–2 farbig markierte Beispiele ("Nomen schreibt man groß: der **H**und, die **S**onne").
- Strategien als nummerierte Schritte mit Symbolen (z. B. Rechenweg "Erst zum Zehner, dann weiter").
- Farbcodes konsistent mit Arbeitsblättern und Klassenkonvention.
- Willi oder Wilma Waschbär mit Funktion (spricht den Merksatz oder den Strategietipp in der Sprechblase), eine Figur pro Plakat.
- Fachlich exakte Begriffe in Kindersprache, keine falschen Vereinfachungen ("Minus macht kleiner" stimmt später nicht – lieber "Wegnehmen").

## Plakat und Folien

Entsteht zum Plakat auch eine Präsentation (Skill `praesentation`), Merksatz, Begriffe, Beispiele und Farben auf beiden gleich halten; die Merksatz-Folie kann das Plakat vorbereiten.

## Qualitätscheck

- [ ] Eine Kernaussage, sofort erkennbar
- [ ] Aus der letzten Reihe lesbar
- [ ] Fachlich korrekt und anschlussfähig für spätere Klassen
- [ ] Konsistent mit Arbeitsblättern (Begriffe, Farben, Symbole)

## Umsetzung (`html-materialerstellung`)

- Merkplakat: `<body class="… a3-hoch">`; A2 im Copyshop aus dem A3-PDF hochskalieren.
- Schriftgrößen für die Leseentfernung über eigenes `<style>` (z. B. `--fs:40px`).
- Mit Schoolbox die Druckhinweise am Dokument hinterlegen (`schoolbox dokument … --druckhinweis "…"`), z. B. „In A3 drucken“ oder „Für A2 im Copyshop aus dem A3-PDF vergrößern“.
