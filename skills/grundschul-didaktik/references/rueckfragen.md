# Rückfrage-Protokoll

Ziel: Mit möglichst wenigen, gezielten Fragen ein vollständiges gemeinsames Verständnis herstellen, bevor Material entsteht. Angelehnt an das "Grill me"-Prinzip: Den Entscheidungsbaum Ast für Ast durchgehen, Abhängigkeiten der Reihe nach auflösen, zu jeder Frage eine Empfehlung geben.

## Start-Abfrage (immer zuerst)

Bevor es um Klasse, Thema oder Details geht, werden die Grundentscheidungen geklärt: drei immer (Materialart, Medium, Farbe), drei weitere je nach Materialart (Selbsteinschätzung, Churer Modell, Sternchenaufgabe). Sie bestimmen, welcher Material-Skill gilt, welches Format, welches Druckprofil und welche Bausteine das Blatt hat. **Einzeln nacheinander**, eine Frage pro Nachricht, jede mit Optionen und Empfehlung. Was die Anfrage schon beantwortet, wird nicht gefragt, sondern kurz bestätigt („Arbeitsblatt, A4, in Farbe – richtig?" ist nicht nötig, wenn es wörtlich so dasteht).

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

| Materialart | Optionen (Empfehlung fett) | Format (`<body>`-Klasse) |
|---|---|---|
| Arbeitsblatt, Lesetext, Lernzielkontrolle | **A4 hoch**, A4 quer, A5 (Heftformat) | Standard; `a4-quer`; `a5-hoch` |
| Bild-/Wortkarten | **Tischkarten 8 pro A4**, A5-Karten (2 pro A4), Tafelkarten A4 quer, digital am Whiteboard | `.karten` auf A4 bzw. `folie` |
| Lernspiel | **Karten auf A4 zum Ausschneiden**, Spielplan A3/A4 | `.karten` auf A4 / `a3-hoch` |
| Lernplakat | **A3**, A2 aus A4-Kacheln, digital am Whiteboard | `a3-hoch` bzw. `folie` |
| Stationenlernen | **Stationskarten A5** + Laufzettel A4, Stationskarten A4 | `a5-hoch` oder `a4-quer` mit 2 Karten / Standard |
| Präsentation / Tafelbild | **Whiteboard 16:9** | `folie` |

**3. Farbe oder Schwarz-Weiß**

```
Wird das Material farbig oder schwarz-weiß gedruckt?
a) Schwarz-weiß (Kopierer)   ← Empfehlung für Arbeitsblätter, Lernzielkontrollen, Lesetexte
b) Farbe
```

Empfehlung je nach Medium: **s/w** für Kopiervorlagen (Arbeitsblatt, Lernzielkontrolle, Lesetext, Laufzettel); **Farbe** für Präsentation/Whiteboard, Plakat, laminierte Karten und Spiele. Bei Präsentation/Whiteboard nicht fragen, sondern Farbe annehmen. Die Antwort wählt das Druckprofil in `druck-und-platz.md` (`<body class="sw">` bzw. `class="farbe palette-…"`).

**4.–6. Bausteine des Blatts**

Welche dieser Fragen gestellt wird, hängt von der Materialart ab. Bei allen anderen Materialarten (Karten, Plakat, Präsentation) entfallen sie; bei `unterrichtsplanung` erst bei den Materialien der Stunde fragen.

| Materialart | 4. Selbsteinschätzung | 5. Churer Modell | 6. Sternchenaufgabe |
|---|---|---|---|
| Arbeitsblatt, Lesetext, Stationenlernen | ja | ja | ja |
| Lernspiel | – | ja | – |
| Lernzielkontrolle | ja | – (benotet nie Niveau-Wahl) | – |

**4. Selbsteinschätzung (Growth Mindset)**

```
Soll unten auf dem Blatt die Selbsteinschätzung stehen (Samen → Keimling → Pflanze → Blume + Reflexionsfrage)?
a) Ja   ← Empfehlung
b) Nein
```

Nein: Der Fußbereich mit Wachstumsgrafik und Reflexionsfrage entfällt, der Platz geht an Aufgaben. Ich-kann-Ziel oben, „noch"-Sprache, Strategietipps und lautes Denken der Leitfigur bleiben (das ist Qualität jeder Aufgabe, kein Baustein). Bei Stationenlernen entfällt die Wachstumsspalte auf dem Laufzettel, bei der Lernzielkontrolle der Selbsteinschätzungsteil am Ende.

**5. Churer Modell (Niveaus zur Selbstwahl)**

```
Sollen die Kinder aus drei Schwierigkeitsstufen wählen (● Grundlage / ●● Kern / ●●● Herausforderung, Churer Modell)?
a) Ja   ← Empfehlung
b) Nein, alle bearbeiten dieselben Aufgaben
```

Nein: keine Niveau-Punkte, keine Wahlhilfe, keine getrennten Niveau-Blätter oder -Kartensätze. Die Aufgaben steigen trotzdem im Anspruch und beginnen mit einem vorgelösten Beispiel.

**6. Sternchenaufgabe**

```
Soll es am Ende eine Sternchenaufgabe ★ geben (eine Knobelaufgabe für alle, die möchten)?
a) Ja   ← Empfehlung, wenn Churer „nein"
b) Nein ← Empfehlung, wenn Churer „ja" (●●● bietet schon die Herausforderung)
```

Ja: genau eine Aufgabe ★ als letzte Aufgabe, zusätzlich zu den übrigen (auch zu ●●●). Offen, knobelnd, begründen oder erfinden, keine „mehr vom Gleichen". Gerahmt als Angebot für alle („Sternchenaufgabe: Wer mag, knobelt hier."), nie als „für die Schnellen". Freiwillig, nicht Teil des Pflichtpensums.

Die Antworten gelten für die ganze Unterhaltung, bis die Lehrkraft etwas anderes sagt. Beim nächsten Material derselben Art nur kurz bestätigen („Wieder A4, s/w, mit Selbsteinschätzung und Niveaus?").

## Ablauf

1. **Bestandsaufnahme (still):** Liste intern auf, welche Angaben vorliegen, welche fehlen und welche du sicher herleiten kannst.
   - Herleitbar (nicht fragen, als Annahme nennen): Zahlenraum aus Klassenstufe und Halbjahr, Schriftgröße aus Klassenstufe, Lineatur, übliche Bearbeitungszeit.
   - Nicht herleitbar (fragen): alles, was das Ergebnis sichtbar verändert und in der Anfrage fehlt.
2. **Reihenfolge nach Abhängigkeit.** Frühere Antworten verändern spätere Fragen:
   0. Start-Abfrage: Materialart → Medium/Format → Farbe oder s/w → je nach Materialart Selbsteinschätzung → Churer Modell → Sternchenaufgabe (siehe oben)
   1. Klassenstufe (und ggf. Halbjahr), Bundesland
   2. Fach, Thema, konkretes Lernziel
   3. Funktion in der Reihe (Einführung / Übung / Vertiefung / Überprüfung)
   4. Lerngruppe (Leistungsspanne, DaZ, Förderbedarfe)
   5. Materialspezifisches und Fachspezifisches (aus Material- und Fach-Skill), aber nur, was die Entwürfe nicht zeigen können. Aufgabenformate, Rahmen/Geschichte, Differenzierungsform, Spielform oder Kartentyp werden nicht gefragt, sondern als Varianten in die Entwürfe gelegt (`entwurf-und-aufgabenplan.md`).
   6. Klassenkonventionen (Schrift, Symbole, Farbcodes) – fest stehen und werden nicht gefragt: Leitfigur Willi/Wilma Waschbär, Kennzeichnung der Niveaus mit ● / ●● / ●●● und Selbsteinschätzung mit Wachstumsstufen (sofern in der Start-Abfrage gewählt)
   7. Ausgabe (Anzahl Exemplare, Laminieren), falls für das Material relevant
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
6. **Abbruchkriterium:** Sobald Klasse, Thema, Ziel und Funktion klar sind, keine weiteren Fragen. Höchstens ca. 4 Fragen nach der Start-Abfrage; danach mit Empfehlungen ergänzen und Annahmen offenlegen.
7. **Entwürfe statt Briefing:** 2–3 schnelle Entwürfe zeigen, die Lehrkraft wählt und sagt, was anders sein soll. Danach den **Aufgabenplan** mit allen Inhalten und Lösungen zur Freigabe vorlegen. Erst nach dem Ok die Endfassung bauen. Ablauf, Formate und Beispiele: `entwurf-und-aufgabenplan.md`.
8. **Nach der Erstellung:** Kurz nachfragen, ob etwas angepasst werden soll – eine Frage, keine Liste.

## Was nicht passieren darf

- Losgenerieren bei einer Ein-Satz-Anfrage ohne Klassenstufe oder Ziel.
- Endfassung oder KI-Bilder ohne freigegebenen Aufgabenplan.
- Fragebögen mit zehn Fragen auf einmal.
- Fragen ohne Empfehlung ("Wie hättest du es gern?").
- Fragen nach Dingen, die schon gesagt wurden oder die sich herleiten lassen.

## Wiederkehrende Nutzer

Hat die Lehrkraft in derselben Unterhaltung schon Materialart, Medium, Farbe/s/w, Selbsteinschätzung, Niveaus, Sternchenaufgabe, Klasse, Bundesland, Schrift oder Symbolset genannt, gelten diese weiter. Kurz bestätigen statt neu fragen ("Wieder Klasse 2, Grundschrift?").
