---
name: lernspiel
description: Entwickelt druckbare Lernspiele für Klasse 1–4 (Domino, Memory, Bingo, Quartett, Würfel-/Brettspiel, Leiterspiel, Klammerkarten, Trimino) mit Spielanleitung und Selbstkontrolle. Verwenden, wenn eine Lehrkraft ein Spiel zum Üben oder Festigen braucht.
---

# Lernspiel

Laden mit: `grundschul-didaktik`, passendem `fach-*`, `html-materialerstellung`.

Lernspiele sind Übungsformate: Der Inhalt muss schon eingeführt sein. Das Spiel soll möglichst viele Übungsdurchgänge pro Minute erzeugen und den Inhalt nicht hinter Spielregeln verstecken.

## Rückfragen

Zuerst die Start-Abfrage (`grundschul-didaktik/references/rueckfragen.md`): Medium, Farbe und Churer Modell. Danach:

1. **Was genau wird geübt?** (z. B. "Einmaleins der 3er-Reihe", "Nomen mit Artikel", "Uhrzeit halbe Stunden")
2. **Spielform:** nur fragen, wenn die Lehrkraft eine bestimmte will; sonst zeigen die Entwürfe 2–3 passende Spielformen (Tabelle unten).
3. **Gruppengröße und Spielzeit:** Partner / 3–4 Kinder / ganze Klasse; 10 oder 20 Minuten.
4. **Wiederverwendbarkeit:** Laminieren (robuste Karten) oder einmalig auf Papier? *Laminierte Spiele meist farbig.*

Die Differenzierung folgt aus der Start-Abfrage: mit Churer Modell drei Kartensätze ● / ●● / ●●● zur Selbstwahl, Punkte in der Kartenecke; ohne ein Satz für alle, Tippkarten als Hilfe.

## Entwürfe und Aufgabenplan

Die Spielform muss nicht gefragt werden: 2–3 Entwürfe mit verschiedenen passenden Spielformen zeigen (Kartenraster mit Beispielkarten, `.karten` in `blatt.css`), erst nach Freigabe des Aufgabenplans die Endfassung bauen (`grundschul-didaktik/references/entwurf-und-aufgabenplan.md`).

- **Entwürfe unterscheiden sich** in der Spielform (Tabelle unten) und der Kartengestaltung.
- **Aufgabenplan:** vollständige Kartenliste mit Vorder- und Rückseite jeder Karte, geprüfte Kette bzw. Paare, Spielanleitung wörtlich, Kartensätze je Niveau, Raster pro Seite.

## Spielformen

| Spiel | Prinzip | Gut für | Umfang |
|---|---|---|---|
| **Domino** | Aufgabe ↔ Ergebnis, Kette | Rechnen, Bild-Wort, Reime | 12–24 Steine, geschlossene Kette als Selbstkontrolle; `x-domino` |
| **Memory** | Paare finden | Bild-Wort, Aufgabe-Ergebnis, Englisch-Vokabeln, Rhythmus und Silben (`x-rhythmus art="karte"`, `fach-musik`) | 8–16 Paare, Rückseite einheitlich |
| **Bingo** | Lehrkraft ruft, Kinder markieren | Ganze Klasse, Rechnen, Wortschatz | 3×3 (Kl. 1), 4×4 (Kl. 2–4), unterschiedliche Karten; `x-bingo` |
| **Quartett** | 4 zusammengehörige Karten | Wortfamilien, Tierarten, Formen | 6–8 Quartette |
| **Klammerkarten** | Richtige Lösung mit Klammer markieren | Einzelarbeit, Selbstkontrolle auf der Rückseite | 10–20 Karten |
| **Würfel-/Laufspiel** | Felder mit Aufgaben | Gemischte Wiederholung | 20–30 Felder, Aufgabenkarten separat; `x-spielplan`, Leiterspiel `form="leiter"` mit `leitern` |
| **Trimino / Puzzle** | Dreiecke/Teile passend legen | Rechnen, Gegensätze | Ergibt Form als Selbstkontrolle |
| **Wer-hat-…? (Ich habe – wer hat)** | Kettenspiel Klasse | Kopfrechnen, Uhrzeit, Vokabeln | Karten = Kinderzahl |

## Pflichtbestandteile

1. **Spielanleitung** für Kinder: max. 5 nummerierte Schritte mit Symbolen, Spieleranzahl, Material, Ziel. Anleitung als Karte zum Ausdrucken.
2. **Kurzinfo für die Lehrkraft:** Ich-kann-Ziel, Vorbereitung (Ausschneiden, Laminieren), Varianten.
3. **Ich-kann-Ziel und Reflexion** auf der Anleitungskarte: „Ich kann …" oben, unten eine Reflexionsfrage („Welche Aufgabe war eine gute Herausforderung?").
4. **Selbstkontrolle:** Lösung auf der Rückseite, Kontrollbild, geschlossene Kette oder Lösungskarte.
5. **Kartensatz wie gekauft:** Deckkarte, Karten gleich groß in der Setfarbe, gestaltete Rückseite zum doppelseitigen Druck, beim Domino Start und Ziel. Maße, Schnitt und Bausteine: `grundschul-didaktik/references/druck-und-platz.md`, „Ausschneide- und Legematerial“.

## Gestaltungsregeln

Satzstreifen zum Legen und Umstellen: `x-satzglieder` mit `ausschneiden="ja"` (`fach-deutsch`).

- Karten so groß und so viele je A4, wie `druck-und-platz.md`, „Ausschneide- und Legematerial“, sagt: ein Element pro Karte, das Motiv füllt die Karte, Bild eindeutig. Lieber eine Seite mehr als kleine Karten.
- Niveaus (falls gewählt) mit Punkten ● / ●● / ●●● in der Kartenecke; die Setfarbe trennt Spiele und darf Kartensätze je Niveau trennen.
- Rückseiten gestalten (`.karte.rueckseite`: Muster in der Setfarbe mit Spielname oder Lösung), damit Sets nicht vermischt werden.
- Kein Gewinnen durch reines Glück: Inhalt entscheidet.
- Der Spielplan ist eine Schauseite (`grundschul-didaktik/references/kindgerecht-gestalten.md`): Er soll aussehen wie ein Spiel, das man gern aufklappt, mit Weg, Start und Ziel, Bild oder Szene zum Thema und Farbe, über den ganzen Bogen (`x-spielplan`). Ein Tabellenraster mit Kästchen ist kein Spielplan.
- Vorder- und Rückseite liegen nach dem Wenden genau aufeinander. Ein letzter Bogen mit wenigen Karten bleibt so; die Karten werden dafür nicht kleiner.
- Die Kurzinfo für die Lehrkraft ist nüchtern (`body.lehrkraft`, Muster `html-materialerstellung/assets/beispiel-lehrkraft-hinweise.html`); in einer Reihe steht sie in den Hinweisen für die Lehrkraft statt im Spiel. Zu jedem Spiel zum Ausschneiden gehört dort ein Abschnitt „Drucken und Basteln“ (Inhalt: `druck-und-platz.md`, „Ausschneide- und Legematerial“).
- Wenn möglich eine kooperative Variante anbieten (gemeinsam gegen die Zeit, Klassenziel). Keine Ranglisten über mehrere Runden; wer eine Aufgabe nicht weiß, darf eine Tippkarte nehmen.

Würfel für Spielregeln und Spielkarten kommen aus `<x-wuerfel>` (`html-materialerstellung/references/abbildungen.md`), nie als Bild. Spielwürfel mit eigenen Seiten: `<x-wuerfelnetz flaechen="…" bastel="ja">`, Druckhinweis „Originalgröße, festes Papier“.

## Qualitätscheck

- [ ] Jede Aufgabe hat genau eine eindeutige Lösung im Spiel. Domino: Kein Ergebnis doppelt und die Kette schließt sich prüft `x-domino`
- [ ] Rätsel als Spiel oder Station: `x-suchsel`, `x-kreuzwort`, zur Kontrolle `x-loesungswort` (Abschnitt „Rätsel“ im Katalog)
- [ ] Bingo: Verschiedene Karten und die vollständige Rufliste prüft `x-bingo`
- [ ] FEHLER aus `blatt.py` ernst nehmen: Sie heißen, dass das Spiel so nicht funktioniert
- [ ] Anleitung von Kindern ohne Erwachsene verständlich
- [ ] Druckbild: Vorder- und Rückseite passgenau (Spiegelung beachten)

## Umsetzung (`html-materialerstellung`)

- Bingo, Domino, Würfel-/Laufspiel und Leiterspiel über die Elemente, Abschnitt „Spiele“ in `html-materialerstellung/references/abbildungen.md`. `x-domino` setzt mit `data-satz="2"` Größe, Start und Ziel selbst (`je-seite` weglassen); Bingo 1–2 Karten pro A4.
- Spielwürfel mit eigenen Seiten über `x-wuerfelnetz`. Druckhinweise: festes Papier, laminieren, ausschneiden.
- Kartenraster mit `.karten` (`--spalten`, `--zeilen`, `--set`), vorn die `.karte.deckkarte`. Abschauen in `html-materialerstellung/assets/beispiel-kartensatz.html`.
- Rückseiten als eigene `.seite` mit `.karten.rueckseiten` in derselben Reihenfolge wie vorn; die Klasse spiegelt die Spalten für den Duplexdruck.
- Mit Schoolbox die Druckhinweise am Dokument hinterlegen (`schoolbox dokument … --druckhinweis "…"`, je Hinweis einmal), z. B. „Doppelseitig drucken, an der langen Kante wenden“, „Auf festes Papier drucken und laminieren“, „Karten an den weißen Linien zwischen den Rahmen ausschneiden“.
