---
name: stationenlernen
description: Plant und erstellt offene Lernformen für Klasse 1–4 – Stationenlernen, Lerntheke, Werkstatt und Wochenplan – mit Stationskarten, Laufzettel, Lösungskarten und Reflexion. Verwenden, wenn eine Lehrkraft Stationen, Lernzirkel, Lerntheke, Werkstatt oder einen Wochenplan vorbereiten möchte.
---

# Stationenlernen, Lerntheke, Wochenplan

Laden mit: `grundschul-didaktik`, passendem `fach-*`, ggf. `arbeitsblatt`/`lernspiel` für einzelne Stationen, `html-materialerstellung`.

## Rückfragen

Zuerst die Start-Abfrage (`grundschul-didaktik/references/rueckfragen.md`) inklusive Selbsteinschätzung, Churer Modell und Sternchenaufgabe; die Antworten gelten für alle Stationen. Danach:

1. **Form:** Stationen (alle Stationen für alle, freie Reihenfolge), Lerntheke (Kinder wählen nach Selbsteinschätzung, Lehrkraft berät), Werkstatt (längere Einheit) oder Wochenplan (Aufgaben für eine Woche)? *Empfehlung: Stationen für Üben eines eingeführten Themas.*
2. **Zeitrahmen:** Anzahl Stunden/Tage? *Daraus folgt die Stationenzahl (Faustregel: 2–3 Stationen pro Schulstunde).*
3. **Pflicht- und Wahlstationen:** Wie viele Pflichtstationen? *Empfehlung: ca. 60 % Pflicht, 40 % Wahl.*
4. **Raum und Material:** Welche Materialien (Wendeplättchen, Lupen, Tablets) sind da? Gibt es Platz für Gruppentische?
5. **Erfahrung der Klasse mit offenen Formen:** Erste Stationenarbeit? (Dann weniger Stationen, sehr klare Rituale.)

## Entwürfe und Aufgabenplan

Nach den Rückfragen 2–3 Entwürfe zeigen (Stationsübersicht + eine Musterkarte je Entwurf), erst nach Freigabe des Aufgabenplans die Endfassung bauen (`grundschul-didaktik/references/entwurf-und-aufgabenplan.md`).

- **Entwürfe unterscheiden sich** im Stationsmix (Zugänge, Pflicht/Wahl) und im Layout der Stationskarte.
- **Aufgabenplan:** jede Station vollständig (Auftrag, Material, Niveaus, Tippkarte, Lösung), Laufzettel, Ritualkarte.

## Bausteine

### Stationskarte (A5 oder A4, laminierbar)
- Stationsnummer groß + Symbol (gleich auf Laufzettel und Lösungskarte); Stationsfarbe im Farbprofil, im s/w-Profil Symbol als Unterscheidung (`grundschul-didaktik/references/druck-und-platz.md`)
- Ich-kann-Ziel der Station
- Titel (kindgerecht), Sozialform-Symbol (👤 👥 👨‍👩‍👧), ggf. „Pflicht" / „Wahl" als Wort (Punkte sind für Niveaus reserviert)
- Material-Liste mit Bildern
- Arbeitsauftrag in max. 3 Schritten
- Differenzierung: mit Churer Modell ● / ●● / ●●● zur Selbstwahl, sonst eine Aufgabenfolge für alle; immer gestufte Tippkarten
- Falls gewählt: Sternchenaufgabe ★ als letzter, freiwilliger Auftrag auf der Karte

### Laufzettel (A4, pro Kind)
- Name, Zeitraum, Ich-kann-Ziel(e) der Einheit
- Tabelle: Station | Pflicht/Wahl | erledigt ☐ | kontrolliert ☐ | Wie weit bin ich? Samen / Keimling / Pflanze / Blume (letzte Spalte nur, wenn Selbsteinschätzung gewählt)
- Platz für Rückmeldung der Lehrkraft mit Prozess-Satzanfängen („Deine Strategie …", „Als Nächstes kannst du …")

### Lösungskarten
- Gleiche Nummer/Farbe wie Station, an der Kontrollstation ausgelegt

### Regeln-Plakat / Ritualkarte
- Leise arbeiten, Station aufgeräumt verlassen, Hilfe: erst Tippkarte, dann ein anderes Kind, dann Lehrkraft.

### Abschluss / Reflexion
- Reflexion im Kreis oder kurzer Bogen: Wachstums-Selbsteinschätzung je Ich-kann-Ziel (falls gewählt), "Was hat dir geholfen?", "Welche Station war eine gute Herausforderung?", "Was übst du als Nächstes?".

## Stationen gestalten

- Unterschiedliche Zugänge mischen: handelnd (Material legen), spielerisch (Spiel), schriftlich (AB), kreativ (Plakat, Zeichnen), digital (App/QR-Code), forschend.
- Jede Station ca. 10–20 Minuten.
- Stationen unabhängig voneinander (freie Reihenfolge), außer bewusst aufbauende Pflichtstationen ("erst Station 1").
- Mindestens eine Knobelstation (●●● bzw. ohne Niveaus ★), die allen offensteht (nicht nur „den Schnellen").

## Wochenplan (Besonderheiten)

- Fächer durch Symbol (im Farbprofil zusätzlich Farbe) getrennt, Pflicht- und Wahlaufgaben klar markiert.
- Aufgaben mit Seiten-/Materialangabe ("AH S. 12, Nr. 1–3").
- Abhakfeld pro Aufgabe, Unterschrift Lehrkraft/Eltern optional.
- Plan auf 1 A4-Seite, Kl. 1 mit vielen Symbolen statt Text.

## Qualitätscheck

- [ ] Stationsnummer, Symbol (und ggf. Farbe) stimmen auf Karte, Laufzettel und Lösung überein
- [ ] Pflichtpensum in der Zeit realistisch für langsamere Kinder
- [ ] Material pro Station genannt und vorhanden
- [ ] Selbstkontrolle an jeder geeigneten Station
- [ ] Wechsel der Zugänge (nicht nur Arbeitsblätter)

## Umsetzung (`html-materialerstellung`)

- Eine HTML-Datei pro Bestandteil-Typ (Stationskarten, Laufzettel), Stationen als `.seite`; Lösungen über die Lösungs-Markierungen.
- Stationskarten A5: `<body class="… a5-hoch">` oder zwei pro A4 quer (`a4-quer`, `.karten` mit `--spalten:2`).
