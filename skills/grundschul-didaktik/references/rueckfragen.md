# Rückfrage-Protokoll

Ziel: Mit möglichst wenigen, gezielten Fragen ein vollständiges gemeinsames Verständnis herstellen, bevor Material entsteht. Angelehnt an das "Grill me"-Prinzip: Den Entscheidungsbaum Ast für Ast durchgehen, Abhängigkeiten der Reihe nach auflösen, zu jeder Frage eine Empfehlung geben.

## Start-Abfrage (immer zuerst)

Bevor es um Klasse, Thema oder Details geht, werden drei Grundentscheidungen geklärt. Sie bestimmen, welcher Material-Skill gilt, welches Format und welches Druckprofil. **Einzeln nacheinander**, eine Frage pro Nachricht, jede mit Optionen und Empfehlung. Was die Anfrage schon beantwortet, wird nicht gefragt, sondern kurz bestätigt („Arbeitsblatt, A4, in Farbe – richtig?" ist nicht nötig, wenn es wörtlich so dasteht).

**1. Materialart**

```
Was für ein Material brauchst du?
a) Arbeitsblatt / Übungsblatt   ← Empfehlung, wenn „Blatt" oder „üben" in der Anfrage steht
b) Lernzielkontrolle / Klassenarbeit
c) Lernspiel (Domino, Memory, Bingo …)
d) Bild- oder Wortkarten
e) etwas anderes: Lesetext, Lernplakat, Stationenlernen, Stundenplanung
```

Die Antwort legt den Material-Skill fest:

| Materialart | Skill |
|---|---|
| Arbeitsblatt, Übungsblatt, Forscherblatt | `arbeitsblatt` |
| Lernzielkontrolle, Klassenarbeit, Lernstandserhebung, Lernlandkarte | `lernzielkontrolle` |
| Lernspiel | `lernspiel` |
| Bild-, Wort-, Flashcards | `bild-und-wortkarten` |
| Lesetext, Lesespur, Lesetheater | `lesetext` |
| Lernplakat, Merkplakat, Tafelbild | `lernplakat` |
| Stationen, Lerntheke, Werkstatt, Wochenplan | `stationenlernen` |
| Stunde oder Reihe planen | `unterrichtsplanung` (Medium und Farbe erst bei den Materialien der Stunde fragen) |

**2. Medium und Format**

Nur die Optionen anbieten, die zur Materialart passen; die übliche als Empfehlung.

| Materialart | Optionen (Empfehlung fett) | Canva-Format |
|---|---|---|
| Arbeitsblatt, Lesetext, Lernzielkontrolle | **A4 hoch**, A4 quer, A5 (Heftformat) | `"Worksheet (A4 Portrait)"`; A5 als A4 quer mit 2 Feldern |
| Bild-/Wortkarten | **Tischkarten 8 pro A4**, A5-Karten (2 pro A4), Tafelkarten A4 quer, digital am Whiteboard | A4 mit Schneidelinien bzw. `"Presentation"` |
| Lernspiel | **Karten auf A4 zum Ausschneiden**, Spielplan A3/A4 | A4 / `"Poster (Portrait A3)"` |
| Lernplakat | **A3**, A2 aus A4-Kacheln, digital am Whiteboard | `"Poster (Portrait A3)"` bzw. `"Presentation"` |
| Stationenlernen | **Stationskarten A5** + Laufzettel A4, Stationskarten A4 | A4 quer mit 2 Feldern / A4 hoch |
| Präsentation / Tafelbild | **Whiteboard 16:9** | `"Presentation"` |

**3. Farbe oder Schwarz-Weiß**

```
Wird das Material farbig oder schwarz-weiß gedruckt?
a) Schwarz-weiß (Kopierer)   ← Empfehlung für Arbeitsblätter, Lernzielkontrollen, Lesetexte
b) Farbe
```

Empfehlung je nach Medium: **s/w** für Kopiervorlagen (Arbeitsblatt, Lernzielkontrolle, Lesetext, Laufzettel); **Farbe** für Präsentation/Whiteboard, Plakat, laminierte Karten und Spiele. Bei Präsentation/Whiteboard nicht fragen, sondern Farbe annehmen. Die Antwort wählt das Druckprofil in `druck-und-platz.md` und den Aufruf von `layout_check.py` (`--farbe` bei Farbe).

Die drei Antworten gelten für die ganze Unterhaltung, bis die Lehrkraft etwas anderes sagt. Beim nächsten Material derselben Art nur kurz bestätigen („Wieder A4, s/w?").

## Ablauf

1. **Bestandsaufnahme (still):** Liste intern auf, welche Angaben vorliegen, welche fehlen und welche du sicher herleiten kannst.
   - Herleitbar (nicht fragen, als Annahme nennen): Zahlenraum aus Klassenstufe und Halbjahr, Schriftgröße aus Klassenstufe, Lineatur, übliche Bearbeitungszeit.
   - Nicht herleitbar (fragen): alles, was das Ergebnis sichtbar verändert und in der Anfrage fehlt.
2. **Reihenfolge nach Abhängigkeit.** Frühere Antworten verändern spätere Fragen:
   0. Start-Abfrage: Materialart → Medium/Format → Farbe oder s/w (siehe oben)
   1. Klassenstufe (und ggf. Halbjahr), Bundesland
   2. Fach, Thema, konkretes Lernziel
   3. Funktion in der Reihe (Einführung / Übung / Vertiefung / Überprüfung)
   4. Lerngruppe (Leistungsspanne, DaZ, Förderbedarfe)
   5. Materialspezifisches (aus dem Material-Skill)
   6. Fachspezifisches (aus dem Fach-Skill)
   7. Klassenkonventionen (Schrift, Symbole, Farbcodes) – fest stehen und werden nicht gefragt: Leitfigur Willi/Wilma Waschbär, Niveaus ● / ●● / ●●●, Wachstums-Selbsteinschätzung
   8. Ausgabe (Anzahl Exemplare, Laminieren), falls für das Material relevant
3. **Eine Frage pro Nachricht.** Ausnahme: Zwei eng verbundene Kleinigkeiten dürfen zusammen gefragt werden.
4. **Jede Frage hat dieses Format:**

   ```
   Für welche Klassenstufe ist das Arbeitsblatt?
   a) Klasse 1
   b) Klasse 2   ← Empfehlung: "Uhrzeit volle/halbe Stunde" steht meist im Lehrplan Klasse 2.
   c) Klasse 3
   d) andere / jahrgangsgemischt
   ```

   Kurz halten. Keine Erklärungen, die nicht zur Entscheidung beitragen.
5. **Widersprüche und Risiken direkt ansprechen**, z. B. "Brüche stehen nicht im Grundschullehrplan – meinst du Bruchteile wie Hälfte/Viertel bei Größen?"
6. **Abbruchkriterium:** Sobald alle Pflichtangaben und die materialspezifischen Punkte klar sind, keine weiteren Fragen. Höchstens ca. 6 Fragen nach der Start-Abfrage; danach mit Empfehlungen ergänzen und Annahmen offenlegen.
7. **Briefing zur Freigabe:**

   ```
   Ich erstelle:
   - Arbeitsblatt "Die Uhr – volle und halbe Stunden", Klasse 2, A4 hoch, Schwarz-Weiß
   - Ziel: Uhrzeiten (volle/halbe Stunde) ablesen und einzeichnen
   - 3 Niveaus zur Selbstwahl (● ablesen mit Hilfsuhr, ●● ablesen + einzeichnen, ●●● Zeitspannen)
   - Ich-kann-Ziel oben, Wachstums-Selbsteinschätzung und Reflexionsfrage unten
   - Willi Waschbär gibt den Strategietipp
   - Schrift: Grundschrift 18 pt, Symbole wie im Lehrwerk
   - Plus Lösungsblatt
   Passt das so?
   ```

8. **Nach der Erstellung:** Kurz nachfragen, ob etwas angepasst werden soll (Umfang, Schwierigkeit, Bilder) – eine Frage, keine Liste.

## Was nicht passieren darf

- Losgenerieren bei einer Ein-Satz-Anfrage ohne Klassenstufe oder Ziel.
- Fragebögen mit zehn Fragen auf einmal.
- Fragen ohne Empfehlung ("Wie hättest du es gern?").
- Fragen nach Dingen, die schon gesagt wurden oder die sich herleiten lassen.

## Wiederkehrende Nutzer

Hat die Lehrkraft in derselben Unterhaltung schon Materialart, Medium, Farbe/s/w, Klasse, Bundesland, Schrift oder Symbolset genannt, gelten diese weiter. Kurz bestätigen statt neu fragen ("Wieder Klasse 2, Grundschrift?").
