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
- Überschrift, Ich-kann-Ziel, ggf. Wahlhilfe – wörtlich
- alle Aufgaben mit wörtlicher Anweisung, Aufgabenformat, Niveau-Punkten bzw. ★ nach Start-Abfrage und **Beispiel-Items** (2–5 je Aufgabe, nicht alle ausformuliert)
- Platzhalter für Bilder und Abbildungen mit Größe (Uhr 88 px, Willi mit Tipp), keine echten Bilder
- Kopf und Fuß nach den gewählten Bausteinen

Keine Lösungen, keine Rechenprüfung aller Items, kein Lösungsblatt: das kommt erst im Aufgabenplan.

**Darstellung (bevorzugt): HTML-Seiten** (`html-materialerstellung`)

1. Je Entwurf eine Kopie von `assets/vorlage-arbeitsblatt.html` mit echtem Text, Beispiel-Items, exakten Abbildungen (`x-uhr` …) und Platzhaltern für neue Bilder (`.platzhalter`); `<title>` = Entwurfsname.
2. `python3 scripts/blatt.py uebersicht a.html b.html c.html -o ordner/` legt die Seiten nebeneinander (`entwuerfe.png`, `entwuerfe.html`) und markiert, ob jeder Entwurf auf die Seite passt.
3. Das Bild der Lehrkraft zeigen; wo nur Artefakte gehen, `entwuerfe.html` als Artefakt.

Die Vorschau zeigt jeden Entwurf im echten Format, Druckprofil und in der Schriftgröße der Klasse, so wie er gedruckt wird. Ein Entwurf, der nicht passt, wird rot markiert; viel ungenutzter Platz wird gemeldet.

**Ohne Code-Ausführung: Textskizze** im Chat, je Entwurf höchstens 8 Zeilen:

```
B · Willis Tag – Geschichte als Rahmen
Kopf: „Ein Tag mit Willi" · Ich kann volle und halbe Stunden ablesen. · Wähle deine Aufgaben.
1 ●   Wann macht Willi was? Verbinde.      [4 Uhren 88 px in einer Reihe, darunter: aufstehen · Schule · …]
2 ●●  Zeichne die Zeiger ein.              [Satz aus Willis Tag + 2 leere Uhren 100 px]
3 ●●● Wie lange war Willi schwimmen?       [2 Schreiblinien]
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

- Titel nach Schema `Kl2_Mathe_Uhrzeit_AB1`, Format, Druckprofil, gewählter Entwurf
- alle Texte wörtlich: Überschrift, Ich-kann-Ziel, Wahlhilfe, Anweisungen, Tipps, Fußtext, Reflexionsfrage
- alle Items vollständig, Rechnungen und Rechtschreibung geprüft
- Lösungen bzw. Erwartungshorizont
- Bildliste: welche Bilder wo, vorhandene Datei (Willi, Wilma, Wachstumsgrafik) oder neues KI-Motiv; exakte Abbildungen (Uhren, Zahlenstrahl, Mengen) mit Werten
- Seiten: Niveau-Blätter, Lösungsblatt

Den gewählten Entwurf auf die finalen Items aktualisieren und `blatt.py bauen --nur-pruefen` laufen lassen: Passt alles auf die Seite? Erst dann den Plan zeigen.

Format im Chat (Beispiel Arbeitsblatt):

```
Aufgabenplan Kl2_Mathe_Uhrzeit_AB1 · A4 hoch · s/w · Entwurf A
Kopf: „Wie spät ist es?" · Ich kann volle und halbe Stunden ablesen. · Wähle deine Aufgaben.
1 ●  Lies ab. Schreibe die Uhrzeit auf.   5 Uhren 88 px + Antwortlinie
     Uhren: 3:00 · 4:30 · 7:00 · 9:30 · 12:00
     Willi (willi-strich.png): „Schau zuerst auf den kleinen Zeiger. Er zeigt die Stunde."
     Lösung: 3 Uhr · halb 5 · 7 Uhr · halb 10 · 12 Uhr
2 ●● …
Fuß: Ich kann … · Male an, wie weit du schon bist: (wachstum-strich.png) · Was hat dir geholfen? ☐ … ☐ …
Seite 2: Lösungsblatt (Lösungen fett, unterstrichen)
Passt das so? Danach baue ich die Endfassung als PDF; der Inhalt ändert sich dann nicht mehr.
```

Erst nach dem Ok der Lehrkraft beginnt Phase 5. Änderungswünsche danach werden im Plan eingearbeitet und kurz bestätigt, nicht am fertigen Blatt ausprobiert.

## Was je Materialart variiert und festgelegt wird

| Materialart | Entwürfe unterscheiden sich in | Aufgabenplan legt fest |
|---|---|---|
| `arbeitsblatt` | Zugang (kompakt üben / Geschichte als Rahmen / entdeckend), Aufgabenformate, Item-Dichte, Differenzierungsform (ein Blatt mit ● ●● ●●● oder drei Blätter) | jede Aufgabe mit Anweisung, allen Items, Beispiel, Tipp, Niveau bzw. ★; Selbstkontrolle; Lösungsblatt |
| `lernzielkontrolle` | Aufgabenauswahl und Gewichtung der Anforderungsbereiche | jede Aufgabe mit Items, Punkten, Anforderungsbereich und Lernziel; Erwartungshorizont mit Teilpunkten; Notenschlüssel-Vorschlag; ggf. Nachteilsausgleich-Fassung |
| `lernspiel` | Spielform (z. B. Domino / Memory / Klammerkarten), Kartengestaltung | vollständige Kartenliste (Vorder- und Rückseite jeder Karte), geprüfte Kette bzw. Paare, Spielanleitung wörtlich, Kartensätze je Niveau, Raster pro Seite |
| `bild-und-wortkarten` | Kartentyp (Bild + Wort / Bild vorn, Wort hinten / nur Wort), Größe und Raster | Wortliste mit Artikel (ggf. Plural, Silben), Bildmotiv je Karte, Bildstil, Rückseite |
| `lesetext` | Textsorte bzw. Rahmen, Aufgabenformate; im Entwurf nur die ersten 2–3 Sätze | ganzer Text je Fassung mit Wortzahl und Lesestufe, Aufgaben, Lösungen, Zeilennummern |
| `lernplakat` | Aufbau (Regel + Beispiele / Schrittfolge / Lückenplakat), Anordnung | alle Texte wörtlich, Beispiele, Bildliste, Schriftgrößen für die Leseentfernung |
| `stationenlernen` | Stationsmix (Zugänge, Pflicht/Wahl), Layout der Stationskarte; im Entwurf Stationsübersicht + eine Musterkarte | jede Station vollständig (Auftrag, Material, Niveaus, Tippkarte, Lösung), Laufzettel, Ritualkarte |
| `unterrichtsplanung` | keine Entwürfe (Ergebnis ist Text) | – ; die Materialien der Stunde laufen einzeln durch diesen Ablauf |

## Abkürzungen

- **„Mach einfach"**: ein Entwurf nach den Empfehlungen und der Aufgabenplan in einer Nachricht; vor der Endfassung trotzdem auf das Ok warten.
- **Folgematerial im selben Stil** („wie das letzte Blatt"): keine Entwürfe, direkt der Aufgabenplan mit dem bestätigten Layout.
- **Kleine Korrektur an einem fertigen Material**: direkt in der HTML-Quelle ändern und neu bauen, kein neuer Plan.

## Was nicht passieren darf

- KI-Bilder erzeugen oder alle Items ausarbeiten, bevor der Aufgabenplan freigegeben ist.
- Entwürfe, die sich nur in Farben oder Details unterscheiden.
- Inhalte beim Bauen umformulieren oder ausprobieren; Inhalt kommt nur aus dem Plan.
- Mehr als zwei Entwurfsrunden ohne gezielte Rückfrage.
