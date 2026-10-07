---
name: lernzielkontrolle
description: Erstellt Lernzielkontrollen, Lernstandserhebungen, Tests, Lernlandkarten und Selbsteinschätzungsbögen für Klasse 1–4 mit Erwartungshorizont und Bewertungsvorschlag. Verwenden bei Test, Probe, Lernkontrolle, Klassenarbeit, Diagnose oder Selbsteinschätzung.
---

# Lernzielkontrolle und Lernstandsdiagnose

Laden mit: `grundschul-didaktik`, passendem `fach-*`, `html-materialerstellung`.

## Rückfragen

Zuerst die Start-Abfrage (`grundschul-didaktik/references/rueckfragen.md`); von den Bausteinen nur die Selbsteinschätzung (Niveaus und Sternchenaufgabe gibt es im Test nicht; bei Art „Selbsteinschätzung/Lernlandkarte" entfällt auch diese Frage). Danach:

1. **Art:** Benotete Lernzielkontrolle, unbenotete Lernstandserhebung (Diagnose vor der Einheit), Selbsteinschätzung/Lernlandkarte oder Kompetenzraster?
2. **Inhalte:** Welche Lernziele der Einheit werden geprüft? Liste der behandelten Inhalte bzw. Lehrwerksseiten erfragen. *Nur prüfen, was geübt wurde.*
3. **Bewertung:** Noten (ab wann im Bundesland/Schule?), Punkte oder Kompetenzstufen? *Unbenotet: Wachstumsstufen statt Smileys.* Notenschlüssel der Schule?
4. **Dauer:** 20, 30 oder 45 Minuten?
5. **Nachteilsausgleich:** Gibt es Kinder mit LRS-/Förderbedarf, die eine angepasste Fassung brauchen (größere Schrift, weniger Items, vorgelesen)?

## Entwürfe und Aufgabenplan

Nach den Rückfragen 2–3 Entwürfe zeigen, erst nach Freigabe des Aufgabenplans die Endfassung bauen (`grundschul-didaktik/references/entwurf-und-aufgabenplan.md`).

- **Entwürfe unterscheiden sich** in Aufgabenauswahl und Gewichtung der Anforderungsbereiche (nur aus dem Unterricht bekannte Formate).
- **Aufgabenplan:** jede Aufgabe mit Items, Punkten, Anforderungsbereich und Lernziel; Erwartungshorizont mit Teilpunkten; Notenschlüssel-Vorschlag; ggf. Nachteilsausgleich-Fassung.

## Aufbau Lernzielkontrolle

1. Kopf: Name, Datum, Thema, ggf. Felder für Punkte/Note. Darunter die geprüften Ich-kann-Ziele, damit die Kinder wissen, was sie zeigen sollen.
2. Aufgaben nach Anforderungsbereichen ordnen:
   - **AB I Reproduzieren** ca. 40–50 %
   - **AB II Zusammenhänge herstellen** ca. 30–40 %
   - **AB III Verallgemeinern und Reflektieren** ca. 10–20 %
3. Jede Aufgabe: Punktzahl sichtbar, Aufgabenformate bekannt aus dem Unterricht (keine neuen Formate im Test!). Keine Niveau-Wahl im benoteten Test; die Anforderungsbereiche ersetzen die Punkte ● / ●● / ●●●.
4. Abschluss: falls gewählt, Selbsteinschätzung je Ich-kann-Ziel mit Wachstumsstufen (vor Abgabe ausfüllen, fließt nie in die Note ein; nach der Rückgabe mit dem Ergebnis vergleichen: „Stimmt meine Einschätzung?"); immer ein Rückmeldefeld mit Prozess-Satzanfängen („Du hast geschafft, …", „Als Nächstes übst du …"). Nicht Erreichtes als „noch nicht" formulieren.

## Erwartungshorizont (immer mitliefern)

- Lösung jeder Aufgabe, Punkteverteilung inkl. Teilpunkte.
- Zuordnung jeder Aufgabe zu Lernziel und Anforderungsbereich (Tabelle).
- Notenschlüssel-Vorschlag, nur als Vorschlag; Schulvorgaben gehen vor.
- Hinweise zu typischen Fehlern und was sie diagnostisch bedeuten (z. B. Mathe: um 1 daneben → zählendes Rechnen; Zahlendreher bei Zehner/Einer), mit passender ● / ●● / ●●●-Lernaufgabe als nächstem Schritt.
- Rückmeldung an das Kind individuell, ohne Vergleich mit anderen oder öffentlichen Notenspiegel.

## Selbsteinschätzung / Lernlandkarte

- "Ich kann …"-Sätze aus Kindersicht, je Lernziel eine Zeile, mit Beispielaufgabe: "Ich kann Zahlen bis 100 am Hunderterfeld zeigen. (z. B. 47)".
- Skala mit den Wachstumsstufen Samen / Keimling / Pflanze / Blume (siehe `grundschul-didaktik/references/kernkonzepte.md`), dazu Spalte für Lehrkraft-Einschätzung. Keine Smileys, keine Ampel.
- Die Beispielaufgabe ist der Prüfstein: Das Kind löst sie und schätzt sich danach ein. Kinder in Klasse 1/2 überschätzen sich oft; der Vergleich mit der Lehrkraft-Spalte wird im Gespräch besprochen, nicht bewertet.
- Lernlandkarte als Weg/Insel-Karte für Kl. 1/2 ansprechend gestalten, Stationen = Lernziele.

## Qualitätscheck

- [ ] Nur Inhalte, die im Unterricht vorkamen
- [ ] Anforderungsbereiche ausgewogen
- [ ] Bearbeitbar in der Zeit (Faustregel: eigene Bearbeitungszeit × 3–4)
- [ ] Eindeutige Aufgabenstellung, keine Fangfragen
- [ ] Erwartungshorizont vollständig, Punkte summieren sich korrekt
- [ ] Nachteilsausgleich-Fassung inhaltsgleich
- [ ] Selbsteinschätzung mit Wachstumsstufen (falls gewählt), Rückmeldung prozessorientiert

## Umsetzung (`html-materialerstellung`)

- Erwartungshorizont über die Lösungs-Markierungen (`data-l`, `nur-loesung`) als eigenes PDF (`-loesung.pdf`), nie auf dem Testblatt.
- Bewertungsfelder rechts am Rand in einer Spalte.
- Druckprofil aus der Start-Abfrage (meist s/w), Aufgaben ohne Kasten mit hängender Nummer (`grundschul-didaktik/references/druck-und-platz.md`); die gewonnene Höhe geht an die Schreibflächen, nicht an mehr Aufgaben.
