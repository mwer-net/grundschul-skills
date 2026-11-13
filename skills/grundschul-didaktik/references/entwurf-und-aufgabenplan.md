# Entwürfe und Aufgabenplan

Ziel: Die Lehrkraft sieht früh, wie das Material aussehen wird, und entscheidet, **bevor** Inhalte ausformuliert, Lösungen geprüft und Bilder erzeugt werden. Die Endfassung setzt nur noch einen freigegebenen Aufgabenplan um, ohne inhaltliche Schleifen.

Warum: Alle Items, Lösungen, Bilder und die Endkontrolle kosten ein Vielfaches an Zeit und Tokens gegenüber einem Entwurf. Gefällt die Richtung erst danach nicht, ist dieser Aufwand verloren. Entwürfe entstehen schon im echten Layout (`html-materialerstellung`); der gewählte Entwurf wird zur Endfassung ausgebaut, nicht neu gebaut.

## Ablauf

| Phase | Was | Werkzeug | Ende |
|---|---|---|---|
| 1. Klären | Start-Abfrage und wenige Rückfragen (`rueckfragen.md`) | Chat | Grundlagen klar |
| 2. Entwürfe | 2–3 schnelle, deutlich verschiedene Entwürfe | HTML + `blatt.py uebersicht` | Lehrkraft wählt |
| 3. Feedback | eine Frage: welcher Entwurf, was ändern | Chat | Richtung klar |
| 4. Aufgabenplan | exakte Inhalte nach Materialart, mit Lösungen | Chat + `blatt.py` (Platzprüfung) | **Freigabe** |
| 5. Umsetzung | Entwurf zur Endfassung ausbauen, KI-Bilder, prüfen, PDF | `html-materialerstellung` | Material fertig |

Vor der Freigabe in Phase 4 wird kein KI-Bild erzeugt (Canva `generate-image`).

## Phase 1: Klären – kurz halten

Nach der Start-Abfrage nur fragen, was die Entwürfe nicht zeigen können: Klasse, Thema und Lernziel, Funktion in der Reihe, Besonderheiten der Lerngruppe. Höchstens ca. 4 Fragen. **Nicht fragen, sondern als Varianten in die Entwürfe legen:** Aufgabenformate, Geschichte/Rahmen, Form der Differenzierung, Spielform, Kartentyp. Was die Lehrkraft dazu schon gesagt hat, gilt für alle Entwürfe.

## Phase 2: Entwürfe

**2–3 Entwürfe**, die sich auf ein bis zwei Achsen klar unterscheiden (Tabelle unten), nicht nur in Details. Jeder Entwurf hat:

- Namen und eine Zeile Idee („B · Willis Tag – Geschichte als Rahmen, Uhrzeiten zuordnen")
- Überschrift und Ich-kann-Ziel – wörtlich
- alle Aufgaben mit wörtlicher Anweisung, Aufgabenformat, Niveau-Punkten bzw. ★ nach Start-Abfrage und **Beispiel-Items** (2–5 je Aufgabe, nicht alle ausformuliert)
- Platzhalter für Bilder und Abbildungen mit Größe (Uhr 88 px, Willi mit Tipp), keine echten Bilder
- Kopf und Fuß nach den gewählten Bausteinen

Keine Lösungen, keine Rechenprüfung aller Items, kein Lösungsblatt: das kommt erst im Aufgabenplan.

**Darstellung (bevorzugt): HTML-Seiten** (`html-materialerstellung`)

1. Je Entwurf eine Kopie von `assets/vorlage-arbeitsblatt.html` mit echtem Text, Beispiel-Items, exakten Abbildungen (`x-uhr` …) und Platzhaltern für neue Bilder (`.platzhalter`); `<title>` = Entwurfsname.
2. `python3 scripts/blatt.py uebersicht a.html b.html c.html -o ordner/` legt die Seiten nebeneinander (`entwuerfe.png`, `entwuerfe.html`) und markiert, ob jeder Entwurf auf die Seite passt.
3. Das Bild der Lehrkraft zeigen; wo nur Artefakte gehen, `entwuerfe.html` als Artefakt.

Mit Schoolbox: Entwürfe mit `schoolbox entwuerfe` registrieren und den Link geben statt des Bildes. Der Befehl prüft die Entwürfe selbst und meldet, ob sie auf die Seite passen; Schritt 2 entfällt dann (Ablauf in `html-materialerstellung`, Abschnitt „Mit Schoolbox“).

Die Vorschau zeigt jeden Entwurf im echten Format und in der Schriftgröße der Klasse, so wie er gedruckt wird. Ein Entwurf, der nicht passt, wird rot markiert; viel ungenutzter Platz wird gemeldet.

**Ohne Code-Ausführung: Textskizze** im Chat, je Entwurf höchstens 8 Zeilen:

```
B · Willis Tag – Geschichte als Rahmen
Kopf: „Ein Tag mit Willi" · Ich kann volle und halbe Stunden ablesen. · Zeitziel 20 min, je Niveau eine Seite
Seite ●, gezeigt als Beispiel; ●● und ●●● im selben Aufbau
1  Wann macht Willi was? Verbinde.      [5 Uhren 88 px, darunter: aufstehen · Schule · …]   4 min
2  Lies ab. Schreibe die Uhrzeit auf.   [8 Uhren in zwei Reihen]                            5 min
3  Zeichne die Zeiger ein.              [Satz aus Willis Tag + 4 leere Uhren 100 px]        5 min
4  Eine Stunde später …                 [6 Zeilen]                                          3 min
5  Was machst du um halb 8? Schreibe.   [2 Schreiblinien]                                   4 min
Fuß: Wachstums-Selbsteinschätzung + Reflexionsfrage
```

Zu den Entwürfen eine Empfehlung mit einem Satz Begründung.

## Phase 3: Feedback

Eine Nachricht, eine Frage:

```
Welcher Entwurf passt, und was soll anders sein?
a) A  ← Empfehlung: die meisten Übungsitems, passt zur Funktion „Übung".
b) B
c) C
Mischen geht auch („A, aber Aufgabe 3 aus B"). Änderungen gern dazuschreiben.
```

Kleine Änderungen fließen direkt in den Aufgabenplan. Will die Lehrkraft etwas grundlegend anderes, **ein** überarbeiteter Entwurf, dann weiter. Höchstens eine zusätzliche Entwurfsrunde; danach Rückfrage, was genau fehlt.

## Phase 4: Aufgabenplan

Der Aufgabenplan legt **jeden Inhalt exakt fest**, der später auf dem Blatt steht. Er ersetzt das bisherige Briefing zur Freigabe. Was er enthält, hängt von der Materialart ab (Tabelle unten). Immer:

- Titel nach Schema `Kl2_Mathe_Uhrzeit_AB1`, Format, gewählter Entwurf
- alle Texte wörtlich: Überschrift, Ich-kann-Ziel, Anweisungen, Tipps, Fußtext, Reflexionsfrage
- Zeitziel, je Aufgabe die geschätzten Minuten, je Niveau die Summe (`druck-und-platz.md`, Abschnitt „Menge nach Arbeitszeit“)
- alle Items vollständig, Rechnungen und Rechtschreibung geprüft
- Lösungen bzw. Erwartungshorizont
- Bildliste: welche Bilder wo, vorhandene Datei (Willi, Wilma, Wachstumsgrafik) oder neues KI-Motiv; exakte Abbildungen (Uhren, Zahlenstrahl, Mengen) mit Werten
- Seiten: je Niveau eine Seite (mit Rückseite, wenn das Zeitziel sie braucht), Lösungsblatt

Den gewählten Entwurf auf die finalen Items aktualisieren und `blatt.py bauen --nur-pruefen` laufen lassen: Passt alles auf die Seite? Erst dann den Plan zeigen.

Format im Chat (Beispiel Arbeitsblatt):

```
Aufgabenplan Kl2_Mathe_Uhrzeit_AB1 · A4 hoch · Entwurf A · Zeitziel 20 min
Kopf: „Wie spät ist es?" · Ich kann volle und halbe Stunden ablesen.

Seite ● (Vorder- und Rückseite, 21 min)
1  Lies ab. Schreibe die Uhrzeit auf.   8 Uhren 88 px + Antwortlinie, die erste vorgelöst   5 min
   Uhren: 3:00 · 7:00 · 10:00 · 12:00 · 4:30 · 9:30 · 1:30 · 6:30
   Willi: „Erst der kleine Zeiger. Er zeigt die Stunde."
   Lösung: 3 Uhr · 7 Uhr · 10 Uhr · 12 Uhr · halb 5 · halb 10 · halb 2 · halb 7
2  Zeichne die Zeiger ein.   4 leere Uhren 100 px: 9 Uhr · halb 5 · halb 9 · halb 12   4 min
3  …
★  Wer mag, knobelt: …   (zählt nicht zur Zeit)

Seite ●● (… min)   …
Seite ●●● (… min)  …

Fuß (letzte Seite jedes Niveaus): Ich kann … So gut kann ich das schon. Kreuze an: (Wachstumsgrafik mit 4 Kreisen) · Was hat dir geholfen? ● ☐ … ☐ … · ●● ☐ … ☐ … · ●●● ☐ … ☐ … (je Niveau nur, was dort vorkommt)
Lösungsblatt zu jeder Seite (Lösungen fett, unterstrichen)
Passt das so? Danach baue ich die Endfassung als PDF; der Inhalt ändert sich dann nicht mehr.
```

Erst nach dem Ok der Lehrkraft beginnt Phase 5. Änderungswünsche danach werden im Plan eingearbeitet und kurz bestätigt, nicht am fertigen Blatt ausprobiert.

## Was je Materialart variiert und festgelegt wird

| Materialart | Entwürfe unterscheiden sich in | Aufgabenplan legt fest |
|---|---|---|
| `arbeitsblatt` | Zugang (kompakt üben / Geschichte als Rahmen / entdeckend), Aufgabenformate und ihr Wechsel; die Menge folgt in allen Entwürfen dem Zeitziel | je Niveau jede Aufgabe mit Anweisung, allen Items, Beispiel, Tipp, Minuten und ★; Summe je Niveau; Selbstkontrolle; Lösungsblatt |
| `klassenarbeit` | Aufgabenauswahl, Gewichtung der Anforderungsbereiche, Anordnung, ggf. gleichwertige Wahlaufgaben | Haupt- und Probearbeit parallel; jede Aufgabe mit Items, Punkten, Anforderungsbereich und Ich-kann-Ziel; Erwartungshorizont mit Teilpunkten; Bearbeitungszeit; Notenschlüssel (Schulvorgabe oder Vorschlag); ggf. Nachteilsausgleich-Fassung |
| `lernzielkontrolle` | Aufgabenauswahl und Gewichtung der Anforderungsbereiche; bei Lernlandkarten die Bildidee | jede Aufgabe mit Items und Ich-kann-Ziel; Erwartungshorizont; Auswertungsraster je Ziel statt Punkten; ggf. Nachteilsausgleich-Fassung |
| `lernspiel` | Spielform (z. B. Domino / Memory / Klammerkarten), Kartengestaltung | vollständige Kartenliste (Vorder- und Rückseite jeder Karte), geprüfte Kette bzw. Paare, Spielanleitung wörtlich, Kartensätze je Niveau, Raster pro Seite |
| `bild-und-wortkarten` | Kartentyp (Bild + Wort / Bild vorn, Wort hinten / nur Wort), Größe und Raster | Wortliste mit Artikel (ggf. Plural, Silben), Bildmotiv je Karte, Bildstil, Rückseite |
| `lesetext` | Textsorte bzw. Rahmen, Aufgabenformate; im Entwurf nur die ersten 2–3 Sätze | ganzer Text je Fassung mit Wortzahl und Lesestufe, Aufgaben, Lösungen, Zeilennummern |
| `lernplakat` | Aufbau (Regel + Beispiele / Schrittfolge / Lückenplakat), Anordnung | alle Texte wörtlich, Beispiele, Bildliste, Schriftgrößen für die Leseentfernung |
| `praesentation` | Einstieg (Bildimpuls mit Frage / Rätsel mit Vermutungen / Geschichte von Willi oder Wilma); ein Entwurf ist nur die Einstiegsfolie, den Ablauf nennt der `<title>` | je Folie Zweck, Bild, Text wörtlich, Aufdeck-Schritte in ihrer Reihenfolge, Lösung, Notiz und Minuten; Lernaufgaben mit Niveau bzw. ★, Reflexionsfrage |
| `stationenlernen` | Stationsmix (Zugänge, Pflicht/Wahl), Layout der Stationskarte; im Entwurf Stationsübersicht + eine Musterkarte | jede Station vollständig (Auftrag, Material, Niveaus, Tippkarte, Lösung), Laufzettel, Ritualkarte |
| `unterrichtsplanung` | keine Entwürfe (die Planung im Chat ist der Entwurf; gedruckt wird sie als Verlaufsplan in A4 quer) | – ; die Materialien der Stunde laufen einzeln durch diesen Ablauf |

## Abkürzungen

- **„Mach einfach"**: ein Entwurf nach den Empfehlungen und der Aufgabenplan in einer Nachricht; vor der Endfassung trotzdem auf das Ok warten.
- **Folgematerial im selben Stil** („wie das letzte Blatt"): keine Entwürfe, direkt der Aufgabenplan mit dem bestätigten Layout.
- **Kleine Korrektur an einem fertigen Material**: direkt in der HTML-Quelle ändern und neu bauen, kein neuer Plan.

## In der Schoolbox

Bestellt die Lehrkraft ein Material im Assistenten der Schoolbox, läuft derselbe Ablauf mit drei Unterschieden:

1. **Die Antworten aus dem Assistenten sind die Start-Abfrage und die Rückfragen.** Sie stehen im Auftrag. Du fragst nichts nach; was offen ist, entscheidest du nach den Empfehlungen der Skills und nennst es im Plan als Annahme.
2. **Es gilt „Mach einfach“:** kein Vergleich mehrerer Entwürfe, sondern gleich der Aufgabenplan nach deiner Empfehlung. Die Lehrkraft gibt ihn in der Schoolbox frei („So bauen“) oder schreibt, was anders sein soll; dann kommt der geänderte Plan. Vor der Freigabe änderst du `material.html` nicht.
3. **Gebaut und geprüft wird mit dem Werkzeug `bauen`** statt mit `blatt.py bauen`. Es liefert denselben Prüfbericht und legt die Seitenbilder unter `ansicht/` ab; die visuelle Endkontrolle (`html-materialerstellung/references/visuelle-endkontrolle.md`) machst du an diesen Bildern, genau wie sonst.

Der Plan ist die ganze Antwort, als einfacher Text ohne Markdown, im Format von Phase 4, so knapp, dass die Lehrkraft ihn in einer Minute prüfen kann:

- erste Zeile: Titel, Klasse, Fach, Zeitziel, Seiten je Niveau
- Ich-kann-Ziel wörtlich
- je Niveau eine Überschrift mit der Summe der Minuten, darunter je Aufgabe eine Zeile: Nummer, Anweisung wörtlich, Format und Anzahl der Items (zwei, drei Items als Beispiel, nicht alle), Minuten
- Tipp der Leitfigur, Fuß, Bilder: welche vorhandenen, und welche neuen aus Canva (je Bild Motiv und Aufgabe; höchstens drei, nur wenn das Bild den Weglass-Test in `kindgerecht-gestalten.md` besteht, sonst „keine neuen Bilder“)
- zuletzt die Annahmen, je eine Zeile, die mit „Annahme:“ beginnt

Alle Items, die Lösungen und die Rechenprüfung entstehen erst beim Bauen. Dort gilt der freigegebene Plan: gleiche Aufgaben, gleiche Reihenfolge, gleiche Menge. Zeigt der Prüfbericht, dass eine Seite nicht passt oder nicht gefüllt ist, änderst du Items oder verteilst auf die Rückseite, nicht den Plan.

## Was nicht passieren darf

- KI-Bilder erzeugen oder alle Items ausarbeiten, bevor der Aufgabenplan freigegeben ist.
- Ein Plan ohne Minuten, oder einer, dessen Summe je Niveau das Zeitziel nicht erreicht.
- Entwürfe, die sich nur in Farben oder Details unterscheiden.
- Inhalte beim Bauen umformulieren oder ausprobieren; Inhalt kommt nur aus dem Plan.
- Mehr als zwei Entwurfsrunden ohne gezielte Rückfrage.
