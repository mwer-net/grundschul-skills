---
name: lernspiel
description: Entwickelt druckbare Lernspiele für Klasse 1–4 (Domino, Memory, Bingo, Quartett, Würfel-/Brettspiel, Leiterspiel, Klammerkarten, Trimino) mit Spielanleitung und Selbstkontrolle. Verwenden, wenn eine Lehrkraft ein Spiel zum Üben oder Festigen braucht.
---

# Lernspiel

Laden mit: `grundschul-didaktik`, passendem `fach-*`, `html-materialerstellung`.

Lernspiele sind Übungsformate: Der Inhalt muss schon eingeführt sein. Das Spiel soll möglichst viele Übungsdurchgänge pro Minute erzeugen und den Inhalt nicht hinter Spielregeln verstecken.

## Rückfragen

1. **Was genau wird geübt?** (z. B. "Einmaleins der 3er-Reihe", "Nomen mit Artikel", "Uhrzeit halbe Stunden")
2. **Spielform:** nur fragen, wenn die Lehrkraft eine bestimmte will; sonst zeigen die Entwürfe 2–3 passende Spielformen (Tabelle unten).
3. **Gruppengröße und Spielzeit:** Partner / 3–4 Kinder / ganze Klasse; 10 oder 20 Minuten.
4. **Wiederverwendbarkeit:** Laminieren (robuste Karten) oder einmalig auf Papier? *Farbe oder s/w kommt aus der Start-Abfrage; laminierte Spiele meist farbig.*
5. **Differenzierung:** kommt aus der Start-Abfrage (Churer Modell ja/nein, `grundschul-didaktik/references/rueckfragen.md`). Ja: drei Kartensätze ● / ●● / ●●● zur Selbstwahl, Punkte in der Kartenecke *(Empfehlung)*. Nein: ein Satz für alle, Tippkarten als Hilfe.

## Entwürfe und Aufgabenplan

Die Spielform muss nicht gefragt werden: 2–3 Entwürfe mit verschiedenen passenden Spielformen zeigen (Kartenraster mit Beispielkarten, `.karten` in `blatt.css`), erst nach Freigabe des Aufgabenplans die Endfassung bauen (`grundschul-didaktik/references/entwurf-und-aufgabenplan.md`).

- **Entwürfe unterscheiden sich** in der Spielform (Tabelle unten) und der Kartengestaltung.
- **Aufgabenplan:** vollständige Kartenliste mit Vorder- und Rückseite jeder Karte, geprüfte Kette bzw. Paare, Spielanleitung wörtlich, Kartensätze je Niveau, Raster pro Seite.

## Spielformen

| Spiel | Prinzip | Gut für | Umfang |
|---|---|---|---|
| **Domino** | Aufgabe ↔ Ergebnis, Kette | Rechnen, Bild-Wort, Reime | 12–24 Steine, geschlossene Kette als Selbstkontrolle |
| **Memory** | Paare finden | Bild-Wort, Aufgabe-Ergebnis, Englisch-Vokabeln | 8–16 Paare, Rückseite einheitlich |
| **Bingo** | Lehrkraft ruft, Kinder markieren | Ganze Klasse, Rechnen, Wortschatz | 3×3 (Kl. 1), 4×4 (Kl. 2–4), unterschiedliche Karten |
| **Quartett** | 4 zusammengehörige Karten | Wortfamilien, Tierarten, Formen | 6–8 Quartette |
| **Klammerkarten** | Richtige Lösung mit Klammer markieren | Einzelarbeit, Selbstkontrolle auf der Rückseite | 10–20 Karten |
| **Würfel-/Laufspiel** | Felder mit Aufgaben | Gemischte Wiederholung | 20–30 Felder, Aufgabenkarten separat |
| **Trimino / Puzzle** | Dreiecke/Teile passend legen | Rechnen, Gegensätze | Ergibt Form als Selbstkontrolle |
| **Wer-hat-…? (Ich habe – wer hat)** | Kettenspiel Klasse | Kopfrechnen, Uhrzeit, Vokabeln | Karten = Kinderzahl |

## Pflichtbestandteile

1. **Spielanleitung** für Kinder: max. 5 nummerierte Schritte mit Symbolen, Spieleranzahl, Material, Ziel. Anleitung als Karte zum Ausdrucken.
2. **Kurzinfo für die Lehrkraft:** Ich-kann-Ziel, Vorbereitung (Ausschneiden, Laminieren), Varianten.
3. **Ich-kann-Ziel und Reflexion** auf der Anleitungskarte: „Ich kann …" oben, unten eine Reflexionsfrage („Welche Aufgabe war eine gute Herausforderung?").
4. **Selbstkontrolle:** Lösung auf der Rückseite, Kontrollbild, geschlossene Kette oder Lösungskarte.
5. **Schneidelinien** gestrichelt, Karten gleich groß, Rückseite zum doppelseitigen Druck.

## Gestaltungsregeln

- Karten mind. 6 × 6 cm (Kl. 1/2), ein Element pro Karte, Text groß (mind. 20 pt), Bild eindeutig.
- Niveaus (falls gewählt) nur mit Punkten ● / ●● / ●●● in der Kartenecke, nicht mit Farbe; Farbe nur zur Unterscheidung verschiedener Spiele.
- Rückseiten gestalten (Muster + Spielname), damit Sets nicht vermischt werden.
- Kein Gewinnen durch reines Glück: Inhalt entscheidet.
- Wenn möglich eine kooperative Variante anbieten (gemeinsam gegen die Zeit, Klassenziel). Keine Ranglisten über mehrere Runden; wer eine Aufgabe nicht weiß, darf eine Tippkarte nehmen.

## Qualitätscheck

- [ ] Jede Aufgabe hat genau eine eindeutige Lösung im Spiel (Domino: kein Ergebnis doppelt!)
- [ ] Domino-Kette schließt sich bzw. Anfang/Ende markiert
- [ ] Bingo-Karten unterscheiden sich, alle Werte werden gerufen
- [ ] Anleitung von Kindern ohne Erwachsene verständlich
- [ ] Druckbild: Vorder- und Rückseite passgenau (Spiegelung beachten)

## Umsetzung (`html-materialerstellung`)

- Kartenraster: Memory/Wortkarten 2 × 4 pro A4, Domino 2 × 6 (quer liegende Steine), Bingo 1–2 Karten pro A4.
- Kartenraster mit `.karten` (`--spalten`), Schneidelinien sind die gestrichelten Kartenränder.
- Rückseiten als eigene `.seite`, horizontal gespiegelt zur Vorderseite (Reihenfolge je Zeile umkehren).
