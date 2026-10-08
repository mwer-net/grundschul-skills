---
name: lernzielkontrolle
description: Erstellt unbenotete Lernzielkontrollen, Lernstandserhebungen, Lernlandkarten und Selbsteinschätzungsbögen („Fit für die Arbeit") für Klasse 1–4 mit Erwartungshorizont und Auswertung nach Ich-kann-Zielen. Verwenden bei Lernkontrolle, Lernstand, Diagnose, Test ohne Note, Lernlandkarte oder Selbsteinschätzung. Benotete Arbeiten: `klassenarbeit`.
---

# Lernzielkontrolle und Lernstandsdiagnose

Laden mit: `grundschul-didaktik`, passendem `fach-*`, `html-materialerstellung`. Für benotete Klassenarbeiten (Kl. 3/4, in Kl. 2 nach Schulkonzept) gilt `klassenarbeit`.

Unbenotete Überprüfungen zeigen Kind und Lehrkraft, wo das Kind steht und was als Nächstes dran ist. In Klasse 1/2 sind sie die Regel (Schulbericht statt Noten, Rahmen in `klassenarbeit`).

## Rückfragen

Zuerst die Start-Abfrage (`grundschul-didaktik/references/rueckfragen.md`); von den Bausteinen nur die Selbsteinschätzung (bei Lernlandkarte und Selbsteinschätzungsbogen entfällt auch diese Frage, sie sind selbst Selbsteinschätzung). Danach:

1. **Art:** Lernzielkontrolle am Ende einer Einheit, Lernstandserhebung vor der Einheit, Lernlandkarte oder Selbsteinschätzungsbogen „Fit für die Arbeit"? *Empfehlung Kl. 1/2: Lernzielkontrolle mit Auswertung nach Ich-kann-Zielen.*
2. **Inhalte:** Welche Ich-kann-Ziele der Einheit werden geprüft? Behandelte Inhalte bzw. Lehrwerksseiten erfragen. *Nur prüfen, was geübt wurde.*
3. **Dauer:** 15, 20 oder 30 Minuten? *Empfehlung Kl. 1: 15 min, Kl. 2: 20 min.*
4. **Nachteilsausgleich:** Brauchen Kinder eine Fassung mit größerer Schrift, mehr Platz oder vorgelesenen Aufgaben? Die Aufgaben bleiben gleich (`klassenarbeit`, Abschnitt Nachteilsausgleich).

## Entwürfe und Aufgabenplan

Ablauf nach `grundschul-didaktik/references/entwurf-und-aufgabenplan.md`.

- **Entwürfe unterscheiden sich** in Aufgabenauswahl und Gewichtung der Anforderungsbereiche (nur aus dem Unterricht bekannte Formate), bei Lernlandkarten in der Bildidee (Weg, Inseln, Garten).
- **Aufgabenplan:** jede Aufgabe mit Items und Ich-kann-Ziel; Erwartungshorizont; Auswertungsraster je Ziel; ggf. Fassung mit Nachteilsausgleich.

## Aufbau Lernzielkontrolle

1. Kopf: Name, Datum, Thema; darunter die geprüften Ich-kann-Ziele, damit die Kinder wissen, was sie zeigen sollen.
2. Aufgaben je Ich-kann-Ziel gruppiert, steigend vom Reproduzieren (AB I) zum Erklären und Übertragen (AB II/III), Gewichtung wie in `klassenarbeit`. Nur bekannte Aufgabenformate, keine Niveau-Wahl (alle zeigen dasselbe Ziel), keine Sternchenaufgabe.
3. Keine Punkte und keine Note. Ausgewertet wird je Ich-kann-Ziel: „sicher", „teilweise", „noch nicht".
4. Abschluss: falls gewählt, Selbsteinschätzung je Ich-kann-Ziel mit Wachstumsstufen (vor Abgabe ausfüllen; nach der Rückgabe mit dem Ergebnis vergleichen: „Stimmt meine Einschätzung?"); immer ein Rückmeldefeld mit Prozess-Satzanfängen („Du hast geschafft, …", „Als Nächstes übst du …").

## Erwartungshorizont (immer mitliefern)

- Lösung jeder Aufgabe und Zuordnung zu Ich-kann-Ziel und Anforderungsbereich (Tabelle).
- Auswertungsraster: ab wann ein Ziel „sicher" erreicht ist.
- Typische Fehler mit diagnostischer Bedeutung (z. B. Mathe: um 1 daneben → zählendes Rechnen; Zahlendreher bei Zehner/Einer) und passender Lernaufgabe ● / ●● / ●●● als nächstem Schritt.
- Rückmeldung an das Kind individuell, ohne Vergleich mit anderen.

## Lernlandkarte und Selbsteinschätzungsbogen

- „Ich kann …"-Sätze aus Kindersicht, je Lernziel eine Zeile, mit Beispielaufgabe: „Ich kann Zahlen bis 100 am Hunderterfeld zeigen. (z. B. 47)".
- Skala mit den Wachstumsstufen Samen / Keimling / Pflanze / Blume (`grundschul-didaktik/references/kernkonzepte.md`), dazu eine Spalte für die Einschätzung der Lehrkraft. Keine Smileys, keine Ampel.
- Die Beispielaufgabe ist der Prüfstein: Das Kind löst sie, kontrolliert und schätzt sich danach ein. Kinder in Klasse 1/2 überschätzen sich oft; der Vergleich mit der Lehrkraft-Spalte wird im Gespräch besprochen, nicht bewertet.
- Lernlandkarte für Kl. 1/2 als Weg- oder Inselkarte, Stationen = Lernziele.
- **„Fit für die Arbeit"** vor einer Klassenarbeit: dieselben Ich-kann-Ziele wie die Arbeit, je Ziel eine Beispielaufgabe und ein Verweis auf passende Lernaufgaben ● / ●● / ●●● zum Weiterüben (`klassenarbeit`, Ablauf).

## Qualitätscheck

- [ ] Nur Inhalte, die im Unterricht vorkamen
- [ ] Jede Aufgabe einem Ich-kann-Ziel zugeordnet, Anforderungsbereiche ausgewogen
- [ ] Bearbeitbar in der Zeit (Faustregel: eigene Bearbeitungszeit × 3–4)
- [ ] Eindeutige Aufgabenstellung, keine Fangfragen
- [ ] Keine Punkte, keine Note; Auswertung je Ziel
- [ ] Fassung mit Nachteilsausgleich inhaltsgleich
- [ ] Selbsteinschätzung mit Wachstumsstufen (falls gewählt), Rückmeldung prozessorientiert

## Umsetzung (`html-materialerstellung`)

- Erwartungshorizont über die Lösungs-Markierungen (`data-l`, `nur-loesung`) als eigenes PDF (`-loesung.pdf`), nie auf dem Blatt der Kinder.
- Druckprofil aus der Start-Abfrage (meist s/w), Aufgaben ohne Kasten mit hängender Nummer (`grundschul-didaktik/references/druck-und-platz.md`); die gewonnene Höhe geht an die Schreibflächen, nicht an mehr Aufgaben.
