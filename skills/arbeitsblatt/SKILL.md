---
name: arbeitsblatt
description: Erstellt differenzierte Arbeitsblätter für Klasse 1–4 in allen Fächern (Übungs-, Einführungs-, Forscher- und Wiederholungsblätter) inkl. Lösung. Verwenden, wenn eine Lehrkraft ein Arbeitsblatt, AB, Übungsblatt oder Kopiervorlage möchte.
---

# Arbeitsblatt

Laden zusammen mit: `grundschul-didaktik` (Pflicht), dem passenden `fach-*`-Skill, `html-materialerstellung` für die Umsetzung.

## Rückfragen (zusätzlich zu den Pflichtangaben)

Zuerst die Start-Abfrage (`grundschul-didaktik/references/rueckfragen.md`): Materialart steht fest, Medium meist A4 hoch, dann Selbsteinschätzung unten *(Empfehlung: ja)*, Churer Modell mit Niveaus zur Selbstwahl *(Empfehlung: ja)*, Sternchenaufgabe *(Empfehlung: nein mit Niveaus, ja ohne)*. Danach nach dem Rückfrage-Protokoll, eine Frage pro Nachricht, jeweils mit Empfehlung:

1. **Funktion:** Einführung (mit Beispiel, viel Anschauung), Übung (viele gleichartige Items, Selbstkontrolle), Vertiefung/Transfer (offene Aufgaben) oder Wiederholung? *Empfehlung meist: Übung.*
2. **Zeitziel:** Wie lange soll ein Kind daran arbeiten (10 / 15 / 20 / 30 / 45 min)? *Empfehlung: 20 min.* Aus dem Zeitziel folgt die Menge, nicht aus der Seitenzahl (`grundschul-didaktik/references/druck-und-platz.md`, Abschnitt „Menge nach Arbeitszeit“).
3. **Sozialform:** frei wählbar (Standard), Einzel- oder Partnerarbeit?

Nicht fragen, sondern als Varianten in die Entwürfe legen: Differenzierungsform (Standard: je Niveau eine eigene Seite ● / ●● / ●●● in gleichem Layout, jede mit dem ganzen Zeitziel; ein Blatt mit drei Bereichen nur auf Wunsch oder bei höchstens 10 Minuten) und Rahmen/Geschichte (Leitfigur ist immer Willi oder Wilma Waschbär).

## Entwürfe und Aufgabenplan

Nach den Rückfragen 2–3 Entwürfe zeigen, erst nach Freigabe des Aufgabenplans die Endfassung bauen (`grundschul-didaktik/references/entwurf-und-aufgabenplan.md`).

- **Entwürfe unterscheiden sich** im Zugang (kompakt üben / Geschichte als Rahmen / entdeckend), in den Aufgabenformaten und im Wechsel der Formate. Die Menge ist in allen Entwürfen gleich: Sie folgt dem Zeitziel.
- **Aufgabenplan:** je Niveau jede Aufgabe mit wörtlicher Anweisung, allen Items, vorgelöstem Beispiel, Willi-/Wilma-Tipp, Minuten und ★; je Niveau die Summe der Minuten gegen das Zeitziel; Selbstkontrolle; Lösungsblatt; Bildliste.

## Aufbau

1. Kopfzeile: `Name: ______  Datum: ______`, mit Churer Modell rechts die Niveau-Punkte der Seite. Unter der Überschrift das **Ich-kann-Ziel**. Die Kinder wählen ihre Seite; die Wahlhilfe („Fang dort an, wo du sicher bist.") sagt die Lehrkraft beim Austeilen, sie steht nur auf einem Blatt, auf dem sich die Niveaus eine Seite teilen.
2. Überschrift (max. 5 Wörter, kindgerecht: "Wie spät ist es?" statt "Uhrzeiten ablesen").
3. Aufgaben steigend im Anspruch, **ohne Kasten** mit hängender Nummer, jede auf einen Blick verständlich. So viele Aufgaben und Items, dass ein Kind des Niveaus das Zeitziel braucht, mit Wechsel der Formate; reicht eine Seite nicht, geht es auf der Rückseite weiter (`grundschul-didaktik/references/druck-und-platz.md`, Abschnitt „Menge nach Arbeitszeit“). Mit Churer Modell hat jedes Niveau seine eigene Seite zum selben Ziel:
   - Seite ● Grundlage: kleine Schritte, jede Aufgabenart mit vorgelöstem Beispiel ("So geht's"), Hilfen (Wortspeicher, Anschauung), einfache Zahlen und Wörter.
   - Seite ●● Kern: Übung zum Lernziel, dann Anwendung in einer Sachsituation.
   - Seite ●●● Herausforderung: weniger Hilfen, größere Zahlen oder längere Texte, dazu offen, knobelnd, begründen, erfinden; gern „Willi hat sich vertan".
   - Auf jeder Seite steigen die Aufgaben vom Sicheren zum Neuen. Alle Seiten sehen gleich aus und haben gleich viel Arbeit, kein Niveau ist „das kurze Blatt“.
   - Ohne Churer Modell dieselbe Steigerung ohne Punkte und Wahlhilfe: alle bearbeiten alle Aufgaben, die erste mit vorgelöstem Beispiel.
   - Willi oder Wilma gibt einen Strategietipp direkt bei der Aufgabe, zu der er gehört; Tipps und Rückmeldungen in „noch"-Sprache.
   - Falls gewählt: **Sternchenaufgabe ★** als letzte Aufgabe, freiwillig für alle („Wer mag, knobelt hier."), offen oder knobelnd, keine „mehr vom Gleichen". ★ statt Nummernkreis bzw. vor der Nummer.
4. Fußzeile (nur wenn Selbsteinschätzung gewählt), schlank und ohne Fläche: Ich-kann-Satz mit „So gut kann ich das schon. Kreuze an:“ + Wachstumsgrafik mit vier Kreisen zum Ankreuzen (Samen → Keimling → Pflanze → Blume; Baustein `.wachstum` in der Vorlage) und Reflexionsfrage („Was hat dir geholfen?"; Kl. 1/2 zum Ankreuzen oder mündlich im Kreis, ab Kl. 3 schriftlich). Optional ein Rückmeldefeld für die Lehrkraft. Ohne Selbsteinschätzung entfällt der Fuß, der Platz geht an Aufgaben.
5. Separates Lösungsblatt zur Selbstkontrolle (gleiches Layout, Lösungen fett, unterstrichen und in der Akzentfarbe).

## Bewährte Aufgabenformate

| Format | Geeignet für | Hinweis |
|---|---|---|
| Zuordnen / Verbinden | Kl. 1–2, Begriffe, Bild-Wort | Max. 6 Paare, `x-zuordnen` |
| Lückentext mit Wortauswahl | Deutsch, Sachunterricht | `x-lueckentext`, `x-wortspeicher` |
| Ankreuzen / Einkreisen | Verständnis, Wortarten | `x-ankreuzen`, `x-richtigfalsch` |
| Malen nach Ergebnis / Bildpuzzle | Mathe-Übung mit Selbstkontrolle | Farbschlüssel als ausgeschriebene Farbnamen, Bild als Strichzeichnung |
| Zahlenmauer, Rechendreieck, Zahlenhaus | Mathe, produktives Üben | Siehe `fach-mathematik` |
| Beschriften | Sachunterricht (Körper, Pflanze) | `x-beschriften` mit Wortspeicher |
| Schreibrahmen | Texte, Protokolle | Satzanfänge vorgeben, Element `x-schreibrahmen` (Lineatur nach der Klasse) |
| Forscheraufgabe / offene Aufgabe | Alle Fächer, natürliche Differenzierung | "Finde möglichst viele …" |
| Fehler finden („Willi hat sich vertan") | Rechnen ab Kl. 2, Rechtschreibung erst ab Kl. 3 | Fehleranzahl angeben ("Finde 3 Fehler.") |

Mathe-Rechenformate (`x-zahlenmauer`, `x-rechendreieck`, `x-zahlenhaus`) als Item-Reihen in `.reihe`, alle gleich groß.

Die Elemente beschreibt `html-materialerstellung/references/abbildungen.md`, Abschnitt „Aufgabenformate“; eigenes Aussehen einer Reihe: `html-materialerstellung/references/layout.md`, Abschnitt „Baukasten und Thema“.

## Kontrolle durch Kinder (Selbstkontrolle)

- Lösungswort aus Buchstaben der Ergebnisse: `x-loesungswort` mit `bezug` auf die Aufgabe (Abschnitt „Rätsel“ in `html-materialerstellung/references/abbildungen.md`), meldet geänderte Lösungen
- Summe aller Ergebnisse als Kontrollzahl
- Bild entsteht beim Ausmalen
- Lösungsstreifen zum Umklappen am Rand

Suchsel und Kreuzworträtsel (`x-suchsel`, `x-kreuzwort`) nur mit Anschlussaufgabe (Wörter aufschreiben, Sätze bilden), nicht als bloße Beschäftigung.

## Qualitätscheck

Zusätzlich zur Basis-Checkliste:
- [ ] Erstes Item jeder neuen Aufgabenart vorgelöst
- [ ] Aufgaben steigen im Anspruch
- [ ] Platz reicht für Kinderschrift (Mindestgrößen eingehalten), keine Kästen, schlanker Kopf und Fuß, keine Leerstreifen
- [ ] Zeitziel erreicht: Minuten je Aufgabe geschätzt, Summe je Niveau stimmt, jedes Niveau auf eigener Seite, Formate wechseln
- [ ] Keine Flächen hinter Aufgaben, Text schwarz, Farbe nur als Akzent und nie als einzige Information (`grundschul-didaktik/references/gestaltung.md`)
- [ ] Lösungsblatt vollständig und korrekt
- [ ] Visuelle Endkontrolle bestanden: Abbildungen exakt, Beispiel nicht gequetscht, für ein Kind der Klasse auf einen Blick verständlich
- [ ] Bausteine wie gewählt: Fuß mit Selbsteinschätzung, Niveau-Punkte, Sternchenaufgabe nur, wenn in der Start-Abfrage bestätigt
- [ ] Niveau-Varianten (falls gewählt) optisch gleichwertig, Kennzeichnung nur mit Punkten

## Umsetzung (`html-materialerstellung`)

- Ausgangspunkt `assets/vorlage-arbeitsblatt.html`, A4 hoch. Niveau-Varianten (falls als getrennte Blätter gewählt) als weitere `.seite` in derselben Datei.
- Layout nach `html-materialerstellung/references/layout.md`; `blatt.py bauen` ohne FEHLER.
- Lösungen im selben HTML (`data-l`, `loesung=`, `nur-loesung`); `blatt.py` erzeugt das Lösungsblatt mit identischem Layout.
- Danach **visuelle Endkontrolle** (`html-materialerstellung/references/visuelle-endkontrolle.md`): jeden Aufgaben-Ausschnitt ansehen, Abbildungen nachzählen, Beispiel und Verständlichkeit für die Klasse prüfen, Befunde selbst beheben. Erst dann PDF und Vorschau zeigen.
- Dateiname/Titel: `Kl{K}_{Fach}_{Thema}_AB{Nr}`.

**Aufgabenformate:** Lückentext, Wortspeicher, Ankreuzen, Richtig/Falsch, Zuordnen, Sortieren, Beschriften und Schreibrahmen sind fertige Elemente, siehe `html-materialerstellung/references/abbildungen.md`, Abschnitt „Aufgabenformate“.
