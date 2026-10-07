---
name: grundschul-didaktik
description: Didaktische Basis für alle Unterrichtsmaterialien der Grundschule (Klasse 1–4). Immer zuerst laden, wenn Material, Arbeitsblätter, Spiele, Plakate, Lesetexte oder Stundenplanungen für die Grundschule erstellt oder geprüft werden.
---

# Grundschul-Didaktik (Basis-Skill)

Dieser Skill ist das Fundament aller anderen Skills im Repository. Er legt fest, was jedes Material für Klasse 1–4 erfüllen muss. Fach-Skills (`fach-*`) liefern die Fachdidaktik, Material-Skills (`arbeitsblatt`, `lernspiel`, …) die Bauform, `canva-materialerstellung` die technische Umsetzung.

## Kernkonzepte: Growth Mindset und Churer Modell

Jedes Material folgt zwei Konzepten. Drei Bausteine sind wählbar und werden in der Start-Abfrage geklärt: Selbsteinschätzung unten, Niveaus zur Selbstwahl, Sternchenaufgabe ★ (`references/rueckfragen.md`). Details, Forschung und Beispiele: `references/kernkonzepte.md`.

- **Growth Mindset:** Ich-kann-Ziel oben auf dem Blatt; Wachstums-Selbsteinschätzung (Samen → Keimling → Pflanze → Blume) statt Smileys, eingeschätzt nach der Selbstkontrolle (wählbar); „noch"-Sprache; Tipps nennen Strategien, Willi/Wilma denkt im Beispiel laut vor (planen, tun, prüfen); Fehler als Lernchance; Reflexionsfrage am Ende (mit der Selbsteinschätzung); Rückmeldung konkret zum Prozess, nie zur Begabung. Wirkt nur eingebettet ins Fachlernen, nicht als eigene Mindset-Stunde.
- **Churer Modell:** Lernaufgaben in drei Niveaus ● Grundlage / ●● Kern / ●●● Herausforderung, die Kinder **wählen selbst** (Lehrkraft berät die Wahl; wählbar); jede Aufgabe ohne Lehrkraft bearbeitbar (Beispiel, Tippkarten, Selbstkontrolle); Sozialform offen; überschaubare Wahl (2–4 Möglichkeiten je Entscheidung); Stunden nach Kreisinput (10–12 min) → Lernaufgaben → Reflexion im Kreis.
- Pflanzensymbole nur für die Selbsteinschätzung, Punkte nur für Niveaus. Material muss auch im klassischen Klassenraum funktionieren.

## 1. Vor dem Erstellen klären (Rückfrage-Protokoll)

Ungenaue Anfragen sind der Normalfall ("Mach mir ein Arbeitsblatt zu Tieren"). Erstelle dann **nichts**, sondern kläre gezielt nach dem Protokoll in `references/rueckfragen.md`:

0. **Start-Abfrage zuerst:** Materialart, Medium/Format, Farbe oder Schwarz-Weiß, dann je nach Materialart Selbsteinschätzung, Churer Modell und Sternchenaufgabe – einzeln nacheinander, jeweils mit Empfehlung (`references/rueckfragen.md`). Die Antworten bestimmen Material-Skill, Canva-Format, Druckprofil und Bausteine und gelten für die ganze Unterhaltung.
1. **Abgleichen:** Was ist schon bekannt (Anfrage, Gesprächsverlauf, frühere Materialien)? Was fehlt aus der Pflichtliste unten und aus der Rückfrageliste des jeweiligen Material- und Fach-Skills?
2. **Eine Frage pro Nachricht**, in Abhängigkeitsreihenfolge (Start-Abfrage → Klasse/Bundesland → Thema/Ziel → Lerngruppe → Materialspezifisches). Jede Frage mit 2–4 konkreten Antwortoptionen und **deiner Empfehlung samt kurzer Begründung**.
3. **Nicht fragen, was du selbst herleiten kannst** (z. B. Zahlenraum aus der Klassenstufe), sondern als Annahme nennen.
4. **Erst Entwürfe, dann Aufgabenplan, dann Canva** (`references/entwurf-und-aufgabenplan.md`): 2–3 schnelle, deutlich verschiedene Entwürfe als HTML-Vorschau (`scripts/entwurf.py`) oder Textskizze zeigen; die Lehrkraft wählt und sagt, was anders sein soll. Dann den Aufgabenplan mit allen Inhalten, Items und Lösungen zur Freigabe vorlegen. Erst nach dem Ok in Canva umsetzen – Canva baut nur noch den Plan.
5. Sagt die Lehrkraft "mach einfach" oder "egal": nimm deine Empfehlungen, zeige einen Entwurf mit Aufgabenplan in einer Nachricht und liste die Annahmen auf; vor Canva trotzdem auf das Ok warten.

Pflichtangaben (fehlen sie, wird gefragt):

| Angabe | Warum |
|---|---|
| Materialart (Arbeitsblatt, Lernzielkontrolle, Spiel, Karten …) | Welcher Material-Skill gilt |
| Medium/Format (A4, A5-Karten, Plakat, Präsentation …) | Canva-Format, Schriftgrößen, Raster |
| Farbe oder Schwarz-Weiß | Druckprofil (`references/druck-und-platz.md`) |
| Selbsteinschätzung, Niveaus, Sternchenaufgabe (je nach Materialart) | Bausteine des Blatts (`references/rueckfragen.md`) |
| Klassenstufe (1, 2, 3, 4 oder jahrgangsgemischt) | Schriftgröße, Textmenge, Zahlenraum, Abstraktionsgrad |
| Bundesland | Lehrplan, Ausgangsschrift (Grundschrift / VA / SAS / LA), Begriffe |
| Fach und Thema, Stelle in der Unterrichtsreihe | Einführung, Übung, Vertiefung oder Überprüfung |
| Lerngruppe: Leistungsspanne, DaZ-Kinder, Förderbedarfe (LRS, Dyskalkulie, Sehen, ...) | Differenzierung, sprachliche Hilfen |
| Eingeführte Symbole, Lehrwerk, Farbsystem der Klasse | Material muss zur gewohnten Struktur passen |
| Ausgabe (Laminieren, Anzahl), falls relevant | Robustheit, Kartenformat |

Ist nur Kleines unklar, triff eine sinnvolle Annahme und nenne sie. Bei „mach einfach": Kopiervorlagen schwarz-weiß, Präsentation, Plakat, laminierte Karten und Spiele in Farbe; Selbsteinschätzung ja, Niveaus ja, Sternchenaufgabe nein. Nicht gefragt wird nach Ich-kann-Ziel, Kennzeichnung der Niveaus (● / ●● / ●●●) und Leitfigur Willi/Wilma Waschbär: Sie stehen fest.

## 2. Verbindliche Leitlinien

1. **Kompetenzorientierung:** Jedes Material benennt sein Lernziel als beobachtbare Handlung ("Die Kinder können Zahlen bis 20 im Zwanzigerfeld darstellen."). Orientierung an den KMK-Bildungsstandards Primarbereich (Fassung 2022) und dem Lehrplan des Bundeslandes.
2. **Ein Ziel pro Material:** Ein Arbeitsblatt, ein Spiel, ein Plakat übt genau eine Sache. Lieber zwei schlanke Blätter als ein überladenes.
3. **Kognitive Belastung gering halten (Cognitive Load):** Nur Bilder, die zur Aufgabe gehören. Dekorative Bilder ohne Bezug ("seductive details") lenken nachweislich ab. Cliparts als Füllmaterial nie.
4. **Handeln – Bild – Symbol (EIS-Prinzip, Bruner) plus Sprache:** Inhalte möglichst enaktiv vorbereiten (Material, Handlung), ikonisch darstellen und dann symbolisch notieren. Darstellungswechsel ausdrücklich verlangen ("Lege – zeichne – schreibe").
5. **Differenzierung ist Standard, nicht Extra:** Mit Churer Modell drei Niveaus zur Selbstwahl; ohne Churer Modell Aufgaben steigend im Anspruch, mit Tipps und offenen Aufgaben, ggf. Sternchenaufgabe (siehe `references/kernkonzepte.md` und `references/differenzierung.md`). Gemeinsamer Lerngegenstand für alle, unterschiedliche Zugänge.
6. **Sprachsensibel:** Kurze Sätze, bekannte Wörter, Wortspeicher und Satzanfänge als Hilfe. Siehe `references/sprachsensibel.md`.
7. **Selbstständigkeit:** Klare, gleichbleibende Arbeitsanweisungen mit Symbolen; Selbstkontrolle wo möglich (Lösungskarte, Kontrollzahl, Bildpuzzle).
8. **Altersgerecht ansprechend (Emotional Design):** Das schön machen, was ohnehin da ist – nicht etwas dazustellen. Runde Formen, Aufgabennummern in Kreisen, Farbe als Akzent (im Farbprofil), als Leitfigur immer Willi oder Wilma Waschbär mit Funktion (zeigt das Beispiel, gibt Tipps), kindgerechte Überschriftenschrift, Geschichten-Rahmen ("Hilf Willi Waschbär …"). Das verbessert nachweislich Motivation und Behalten. Bilder nur, wenn das Kind sie zum Lösen braucht – unnütze Grafiken lenken ab. Details und Prüffragen: `references/kindgerecht-gestalten.md`.
9. **Fachlich korrekt:** Rechtschreibung nach amtlichem Regelwerk, mathematisch saubere Sprache ("Ergebnis", nicht "Lösungszahl"), sachlich richtige Abbildungen (Tierteile, Pflanzen, Uhrzeiten).
10. **Vielfalt und Inklusion:** Namen, Familien, Hautfarben und Lebenswelten divers und unaufgeregt darstellen. Keine Klischees.
11. **Druckprofil und kompaktes Layout:** Gestaltet wird nach dem Profil aus der Start-Abfrage: **Schwarz-Weiß** (tonersparend, Strichzeichnungen, keine Farb- oder Grauflächen) oder **Farbe** (Farbe als Akzent an Nummern, Überschrift, Figur und Bildern, keine Farbflächen hinter Aufgaben). In beiden Profilen nutzt die Seite ihren Platz für Aufgaben statt für Kästen und Innenabstände. Details: `references/druck-und-platz.md`.

## 3. Gestaltung – Kurzfassung

Ausführlich in `references/gestaltung.md`. Die wichtigsten Werte:

| Klasse | Schriftgröße Fließtext | Zeilenabstand | Textmenge pro Aufgabe |
|---|---|---|---|
| 1 (Anfang) | 20–28 pt | 1,5–2 | Ein Satz oder nur Symbol + Wort |
| 1 (Ende) – 2 | 16–20 pt | 1,5 | 1–2 kurze Sätze |
| 3 | 14–16 pt | 1,5 | 2–3 Sätze |
| 4 | 12–14 pt | 1,3–1,5 | bis 4 Sätze |

- Fließtext: serifenlose, kindgerechte Schrift mit eindeutigen Formen (I/l unterscheidbar, in Klasse 1/2 einstöckiges a und g). Bevorzugt die Druckschrift des Bundeslandes; sonst Grundschrift oder Andika. Überschriften: eine runde, freundliche Display-Schrift (z. B. Fredoka, Baloo 2).
- Druckprofil aus der Start-Abfrage: **s/w** (weißer Hintergrund, Text schwarz, keine Flächen, Bilder als Strichzeichnung) oder **Farbe** (eine Palette als Akzent an Nummernkreisen, Überschrift, Linien, Figur und Bildern; Text schwarz; keine Farbflächen hinter Aufgaben). Immer: Aufgaben ohne Kasten mit hängender Nummer, getrennt durch Abstand. Niveaus (falls gewählt) nur mit Punkten kennzeichnen (`references/druck-und-platz.md`).
- Linksbündiger Flattersatz, keine Silbentrennung, Zeilenumbruch nach Sinneinheiten.
- Seitenränder ≥ 1,5 cm, ausreichende Schreibflächen; Lineatur passend zur Klassenstufe. Platz geht an Übung, nicht an Rahmen: volle Item-Reihen, schlanker Kopf und Fuß.
- Klare Aufgabenblöcke mit Nummer und Arbeitsanweisungs-Symbol.
- Kontrast mindestens 4,5:1; Farbe nie als einzige Information (Kopien sind oft s/w, rot-grün-Schwäche).

## 4. Qualitätscheck vor der Ausgabe

Prüfe jedes Material gegen diese Liste und korrigiere, bevor du es der Lehrkraft gibst. Inhaltliche Punkte (Ziel, Aufgaben, Bausteine, Sprache, Rechnungen, Lösungen) schon am Aufgabenplan prüfen, bevor er zur Freigabe geht – Korrekturen in Canva sind teuer. Gestaltung und Druck nach der Canva-Umsetzung:

- [ ] Lernziel klar und zum Material passend
- [ ] Klassenstufe: Schriftgröße, Textmenge, Zahlenraum, Wortschatz stimmen
- [ ] Jede Aufgabe hat Nummer, Symbol und eine kurze Anweisung mit einem Verb
- [ ] Bausteine wie in der Start-Abfrage gewählt (Selbsteinschätzung, Niveaus, Sternchenaufgabe) – nicht mehr, nicht weniger
- [ ] Ich-kann-Ziel oben; falls gewählt, bezieht sich die Wachstums-Selbsteinschätzung genau darauf
- [ ] Falls Niveaus gewählt: ● / ●● / ●●● zur Selbstwahl mit Wahlhilfe, gleiche Optik auf allen Niveaus; sonst Aufgaben steigend im Anspruch ohne Punkte
- [ ] Falls Sternchenaufgabe gewählt: genau eine ★-Aufgabe am Ende, offen/knobelnd, als Angebot für alle gerahmt
- [ ] Ohne Lehrkraft bearbeitbar: Beispiel mit lautem Denken der Leitfigur, Tipps mit Strategie, Selbstkontrolle (vor der Selbsteinschätzung)
- [ ] „Noch"-Sprache, keine Wertung von Begabung, keine Rankings, keine Smileys oder Ampeln
- [ ] Falls Selbsteinschätzung gewählt: Reflexionsfrage am Ende (Kl. 1/2 mündlich oder zum Ankreuzen, ab Kl. 3 schriftlich)
- [ ] Ansprechend: runde Formen und Überschrift, Farbe als Akzent (Farbprofil), Willi oder Wilma Waschbär mit Funktion
- [ ] Keine rein dekorativen Bilder (Weglass-Test); alle Bilder eindeutig erkennbar
- [ ] Genug Platz zum Schreiben/Zeichnen
- [ ] Rechtschreibung, Zeichensetzung, Rechnungen und Lösungen geprüft
- [ ] Druckprofil eingehalten; keine Flächen hinter Aufgaben; auch in Graustufen lesbar
- [ ] Seite gut genutzt: Aufgaben ohne Kasten, volle Item-Reihen, kein Leerstreifen
- [ ] Lösung / Selbstkontrolle beigelegt (wenn sinnvoll)
- [ ] Kopfzeile: Name, Datum, ggf. Thema – aber schlank

## 5. Ausgabe an die Lehrkraft

Liefere immer:
1. Das Material (bei Canva: Link + PDF-Export, siehe `canva-materialerstellung`).
2. Eine Kurz-Info: Ich-kann-Ziel, Klassenstufe, Niveaus bzw. Sternchenaufgabe und Hilfen, benötigtes Material, Zeitbedarf, Reflexionsfrage für den Kreis.
3. Die Lösung oder den Erwartungshorizont.
4. Annahmen, die du getroffen hast.

## Referenzen

- `references/kernkonzepte.md` – Growth Mindset und Churer Modell (Haltung immer, Bausteine wählbar)
- `references/rueckfragen.md` – Start-Abfrage (Materialart, Medium, Farbe/s/w, Selbsteinschätzung, Churer Modell, Sternchenaufgabe) und Rückfrage-Protokoll
- `references/entwurf-und-aufgabenplan.md` – schnelle Entwürfe zur Auswahl, exakter Aufgabenplan je Materialart, Freigabe vor Canva
- `scripts/entwurf.py` – rendert 2–3 Entwürfe als HTML-Vorschau im echten Format und Druckprofil, meldet Überlauf und Leerraum (Muster: `scripts/entwurf-beispiel.json`)
- `references/gestaltung.md` – Layout, Schrift, Bilder, Farben, Symbole
- `references/kindgerecht-gestalten.md` – Emotional Design: Formen, Leitfigur, Bildauswahl, Schriften, KI-Bild-Stil, Paletten für Farbdruck
- `references/druck-und-platz.md` – Druckprofile s/w und Farbe, Aufgaben ohne Kasten, Mindestgrößen, Platzbudget
- `references/differenzierung.md` – Niveaustufen, Hilfekarten, offene Aufgaben
- `references/sprachsensibel.md` – DaZ, Wortspeicher, Operatoren, Satzmuster
- `references/quellen.md` – wissenschaftliche Grundlagen und Rechercheergebnisse
