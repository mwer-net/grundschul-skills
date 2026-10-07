---
name: bild-und-wortkarten
description: Erstellt Bildkarten, Wortkarten, Flashcards, Anlautkarten, Wortspeicher und Satzstreifen für Tafel, Pinnwand und Freiarbeit in Klasse 1–4. Verwenden bei Bild-/Wortkarten, Flashcards (Englisch), Anlautbildern, Wortspeicher oder Tafelmaterial.
---

# Bild- und Wortkarten

Laden mit: `grundschul-didaktik`, passendem `fach-*`, `html-materialerstellung`.

## Rückfragen

1. **Einsatz:** Tafel/Whiteboard für die ganze Klasse (groß, A5 bis A4), Partner-/Freiarbeit (klein, ca. 7 × 10 cm, 8 pro A4) oder Wortspeicher an der Wand?
2. **Inhalt:** Wortliste vorhanden oder soll ich sie aus Lehrplan/Thema erstellen? *Empfehlung: Ich schlage 12–16 Wörter vor, du streichst.*
3. **Kartentyp:** nicht fragen, sondern in den Entwürfen zeigen (nur Bild, nur Wort, Bild + Wort, Bild vorne/Wort hinten), außer die Lehrkraft hat ihn genannt.
4. **Sprachliche Hilfen:** Artikel mit Farbcode? Pluralform? Silbenbögen?
5. **Bildstil:** Illustration (einheitlich) oder Fotos? *Sachthemen: Fotos; Wortschatz/Englisch: Illustration.*

## Entwürfe und Aufgabenplan

2–3 Entwürfe mit je 4–8 Beispielkarten zeigen (`.karten` in `blatt.css`), erst nach Freigabe des Aufgabenplans die Endfassung bauen (`grundschul-didaktik/references/entwurf-und-aufgabenplan.md`). Bilder erst danach erzeugen.

- **Entwürfe unterscheiden sich** im Kartentyp (Bild + Wort / Bild vorn, Wort hinten / nur Wort) und in Größe und Raster.
- **Aufgabenplan:** Wortliste mit Artikel (ggf. Plural, Silben), Bildmotiv je Karte, Bildstil, Rückseite.

## Regeln

- **Ein Begriff pro Karte**, Bild eindeutig und typisch (prototypischer Vertreter: "Vogel" = Spatz/Amsel, nicht Pinguin).
- Nomen immer mit Artikel (DaZ: Artikel farbig – Klassenkonvention erfragen; im s/w-Profil Artikel fett und mit Symbol, Kinder malen die Farbe an).
- Schrift: Tafelkarten 72–120 pt, Tischkarten 24–36 pt; Druckschrift der Klasse.
- Anlautkarten: Anlaut muss eindeutig hörbar sein (Igel für I, nicht Indianer; Ei nicht für E). Für Vokale langen und kurzen Laut beachten; mit der Anlauttabelle des Lehrwerks abgleichen.
- Englisch-Flashcards: Bild vorne ohne Text (für Hör- und Sprechphase), Wort auf der Rückseite oder separate Wortkarte zum späteren Zuordnen.
- Einheitlicher Rahmen und Stil, Rückseite mit Themensymbol.

## Varianten

- **Wortspeicher-Plakat:** Bild + Wort + Artikel, thematisch gruppiert, Platz zum Ergänzen.
- **Satzstreifen:** Satzanfänge und Satzmuster für Gespräche/Texte ("Ich sehe …", "Ich vermute, dass …").
- **Wortartenkarten:** Nomen/Verben/Adjektive farbig umrandet (Farbprofil) bzw. mit unterschiedlicher Rahmenlinie und Wortart-Symbol (s/w-Profil).
- **Zahl-/Mengenkarten:** Zahl, Punktbild in Fünferstruktur, Zahlwort.

## Qualitätscheck

- [ ] Alle Bilder eindeutig dem Wort zuordenbar
- [ ] Rechtschreibung, Artikel, Plural geprüft
- [ ] Größe zum Einsatz passend (Tafelkarten aus 6 m Entfernung lesbar)
- [ ] Doppelseitiger Druck passgenau

## Umsetzung (`html-materialerstellung`)

- Tafelkarten: `a4-quer`, eine Karte pro Seite. Tischkarten: 8 pro A4 (`.karten` mit `--spalten:2`, 4 Zeilen), Schneidelinien sind die gestrichelten Ränder.
- Bilder für ein Set in einem Rutsch mit gleichem Stil-Satz per Canva `generate-image` erzeugen und als Dateien holen (`html-materialerstellung/references/bilder.md`).
