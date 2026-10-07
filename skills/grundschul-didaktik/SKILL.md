---
name: grundschul-didaktik
description: Didaktische Basis für alle Unterrichtsmaterialien der Grundschule (Klasse 1–4). Immer zuerst laden, wenn Material, Arbeitsblätter, Spiele, Plakate, Lesetexte oder Stundenplanungen für die Grundschule erstellt oder geprüft werden.
---

# Grundschul-Didaktik (Basis-Skill)

Dieser Skill ist das Fundament aller anderen Skills im Repository. Er legt fest, was jedes Material für Klasse 1–4 erfüllen muss. Fach-Skills (`fach-*`) liefern die Fachdidaktik, Material-Skills (`arbeitsblatt`, `lernspiel`, …) die Bauform, `canva-materialerstellung` die technische Umsetzung.

## 1. Vor dem Erstellen klären (Rückfrage-Protokoll)

Ungenaue Anfragen sind der Normalfall ("Mach mir ein Arbeitsblatt zu Tieren"). Erstelle dann **nichts**, sondern kläre gezielt nach dem Protokoll in `references/rueckfragen.md`:

1. **Abgleichen:** Was ist schon bekannt (Anfrage, Gesprächsverlauf, frühere Materialien)? Was fehlt aus der Pflichtliste unten und aus der Rückfrageliste des jeweiligen Material- und Fach-Skills?
2. **Eine Frage pro Nachricht**, in Abhängigkeitsreihenfolge (Klasse → Thema/Ziel → Lerngruppe → Form/Ausgabe). Jede Frage mit 2–4 konkreten Antwortoptionen und **deiner Empfehlung samt kurzer Begründung**.
3. **Nicht fragen, was du selbst herleiten kannst** (z. B. Zahlenraum aus der Klassenstufe), sondern als Annahme nennen.
4. **Briefing bestätigen lassen:** Wenn alles klar ist, fasse das Vorhaben in 3–6 Zeilen zusammen und warte auf ein Ok, bevor du in Canva erzeugst.
5. Sagt die Lehrkraft "mach einfach" oder "egal": nimm deine Empfehlungen und liste die Annahmen auf.

Pflichtangaben (fehlen sie, wird gefragt):

| Angabe | Warum |
|---|---|
| Klassenstufe (1, 2, 3, 4 oder jahrgangsgemischt) | Schriftgröße, Textmenge, Zahlenraum, Abstraktionsgrad |
| Bundesland | Lehrplan, Ausgangsschrift (Grundschrift / VA / SAS / LA), Begriffe |
| Fach und Thema, Stelle in der Unterrichtsreihe | Einführung, Übung, Vertiefung oder Überprüfung |
| Lerngruppe: Leistungsspanne, DaZ-Kinder, Förderbedarfe (LRS, Dyskalkulie, Sehen, ...) | Differenzierung, sprachliche Hilfen |
| Eingeführte Symbole, Lehrwerk, Maskottchen, Farbsystem der Klasse | Material muss zur gewohnten Struktur passen |
| Ausgabeform (Druck s/w oder farbig, Laminieren, Tafel/Whiteboard) | Kontraste, Farbcodierung, Format |

Ist nur Kleines unklar (z. B. Farbe vs. s/w), triff eine sinnvolle Annahme und nenne sie.

## 2. Verbindliche Leitlinien

1. **Kompetenzorientierung:** Jedes Material benennt sein Lernziel als beobachtbare Handlung ("Die Kinder können Zahlen bis 20 im Zwanzigerfeld darstellen."). Orientierung an den KMK-Bildungsstandards Primarbereich (Fassung 2022) und dem Lehrplan des Bundeslandes.
2. **Ein Ziel pro Material:** Ein Arbeitsblatt, ein Spiel, ein Plakat übt genau eine Sache. Lieber zwei schlanke Blätter als ein überladenes.
3. **Kognitive Belastung gering halten (Cognitive Load):** Nur Bilder, die zur Aufgabe gehören. Dekorative Bilder ("seductive details") lenken nachweislich ab. Ein kleines, wiederkehrendes Klassenmaskottchen als Orientierung ist ok, Cliparts als Füllmaterial nicht.
4. **Handeln – Bild – Symbol (EIS-Prinzip, Bruner) plus Sprache:** Inhalte möglichst enaktiv vorbereiten (Material, Handlung), ikonisch darstellen und dann symbolisch notieren. Darstellungswechsel ausdrücklich verlangen ("Lege – zeichne – schreibe").
5. **Differenzierung ist Standard, nicht Extra:** Mindestens zwei, besser drei Niveaus (siehe `references/differenzierung.md`). Gemeinsamer Lerngegenstand für alle, unterschiedliche Zugänge.
6. **Sprachsensibel:** Kurze Sätze, bekannte Wörter, Wortspeicher und Satzanfänge als Hilfe. Siehe `references/sprachsensibel.md`.
7. **Selbstständigkeit:** Klare, gleichbleibende Arbeitsanweisungen mit Symbolen; Selbstkontrolle wo möglich (Lösungskarte, Kontrollzahl, Bildpuzzle).
8. **Altersgerecht ansprechend:** Freundlich, klar, ruhig. Kinder mögen wiedererkennbare Figuren, Geschichten-Rahmen ("Hilf Fuchs Fridolin …"), Sammel- und Ausmalanteile. Aber: Ansprechend heißt nicht bunt und voll.
9. **Fachlich korrekt:** Rechtschreibung nach amtlichem Regelwerk, mathematisch saubere Sprache ("Ergebnis", nicht "Lösungszahl"), sachlich richtige Abbildungen (Tierteile, Pflanzen, Uhrzeiten).
10. **Vielfalt und Inklusion:** Namen, Familien, Hautfarben und Lebenswelten divers und unaufgeregt darstellen. Keine Klischees.

## 3. Gestaltung – Kurzfassung

Ausführlich in `references/gestaltung.md`. Die wichtigsten Werte:

| Klasse | Schriftgröße Fließtext | Zeilenabstand | Textmenge pro Aufgabe |
|---|---|---|---|
| 1 (Anfang) | 20–28 pt | 1,5–2 | Ein Satz oder nur Symbol + Wort |
| 1 (Ende) – 2 | 16–20 pt | 1,5 | 1–2 kurze Sätze |
| 3 | 14–16 pt | 1,5 | 2–3 Sätze |
| 4 | 12–14 pt | 1,3–1,5 | bis 4 Sätze |

- Serifenlose, kindgerechte Schrift mit eindeutigen Formen (einstöckiges a, I/l unterscheidbar). Bevorzugt die Ausgangsschrift-nahe Druckschrift des Bundeslandes; sonst Andika, Grundschrift oder eine vergleichbare Schulschrift.
- Linksbündiger Flattersatz, keine Silbentrennung, Zeilenumbruch nach Sinneinheiten.
- Großzügige Ränder und Schreibflächen; Lineatur passend zur Klassenstufe.
- Klare Aufgabenblöcke mit Nummer und Arbeitsanweisungs-Symbol.
- Kontrast mindestens 4,5:1; Farbe nie als einzige Information (Kopien sind oft s/w, rot-grün-Schwäche).

## 4. Qualitätscheck vor der Ausgabe

Prüfe jedes Material gegen diese Liste und korrigiere, bevor du es der Lehrkraft gibst:

- [ ] Lernziel klar und zum Material passend
- [ ] Klassenstufe: Schriftgröße, Textmenge, Zahlenraum, Wortschatz stimmen
- [ ] Jede Aufgabe hat Nummer, Symbol und eine kurze Anweisung mit einem Verb
- [ ] Mindestens zwei Niveaus oder ein Sternchen-/Zusatzangebot
- [ ] Keine rein dekorativen Bilder; alle Bilder eindeutig erkennbar
- [ ] Genug Platz zum Schreiben/Zeichnen
- [ ] Rechtschreibung, Zeichensetzung, Rechnungen und Lösungen geprüft
- [ ] Funktioniert in Schwarz-Weiß
- [ ] Lösung / Selbstkontrolle beigelegt (wenn sinnvoll)
- [ ] Kopfzeile: Name, Datum, ggf. Thema – aber schlank

## 5. Ausgabe an die Lehrkraft

Liefere immer:
1. Das Material (bei Canva: Link + PDF-Export, siehe `canva-materialerstellung`).
2. Eine Kurz-Info: Lernziel, Klassenstufe, Differenzierung, benötigtes Material, Zeitbedarf.
3. Die Lösung oder den Erwartungshorizont.
4. Annahmen, die du getroffen hast.

## Referenzen

- `references/rueckfragen.md` – Rückfrage-Protokoll bei ungenauen Anfragen
- `references/gestaltung.md` – Layout, Schrift, Bilder, Farben, Symbole
- `references/differenzierung.md` – Niveaustufen, Hilfekarten, offene Aufgaben
- `references/sprachsensibel.md` – DaZ, Wortspeicher, Operatoren, Satzmuster
- `references/quellen.md` – wissenschaftliche Grundlagen und Rechercheergebnisse
