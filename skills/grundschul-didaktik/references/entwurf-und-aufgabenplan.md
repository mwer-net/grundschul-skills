# Entwürfe und Aufgabenplan (vor Canva)

Ziel: Die Lehrkraft sieht früh, wie das Material aussehen wird, und entscheidet, **bevor** die teure Canva-Umsetzung beginnt. Canva baut nur noch einen freigegebenen Aufgabenplan, ohne inhaltliche Schleifen.

Warum: Der Aufbau in Canva (Design anlegen, Layout per `edit-design` setzen, prüfen, korrigieren) kostet ein Vielfaches an Zeit und Tokens gegenüber Entwurf und Plan. Gefällt das Ergebnis erst nach der Umsetzung nicht, ist dieser Aufwand verloren.

## Ablauf

| Phase | Was | Werkzeug | Ende |
|---|---|---|---|
| 1. Klären | Start-Abfrage und wenige Rückfragen (`rueckfragen.md`) | Chat | Grundlagen klar |
| 2. Entwürfe | 2–3 schnelle, deutlich verschiedene Entwürfe | `scripts/entwurf.py` → HTML | Lehrkraft wählt |
| 3. Feedback | eine Frage: welcher Entwurf, was ändern | Chat | Richtung klar |
| 4. Aufgabenplan | exakte Inhalte nach Materialart, mit Lösungen | Chat + `entwurf.py` (Platzprüfung) | **Freigabe** |
| 5. Umsetzung | Plan wörtlich in Canva bauen, prüfen, exportieren | `canva-materialerstellung` | Material fertig |

Vor Phase 4 wird nichts in Canva angelegt und kein Bild erzeugt (`generate-image`).

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

**Darstellung (bevorzugt): `scripts/entwurf.py`**

1. Entwürfe als kleines JSON schreiben (Aufbau im Kopf des Skripts, Muster: `scripts/entwurf-beispiel.json`).
2. `python3 scripts/entwurf.py entwurf.json -o entwurf.html` (optional `--png entwurf.png`, braucht playwright).
3. Die HTML-Datei der Lehrkraft zeigen: als Datei ausgeben bzw. im Arbeitsordner ablegen; wo nur Artefakte gehen, den Inhalt der HTML-Datei als HTML-Artefakt ausgeben.

Die Vorschau zeigt alle Entwürfe nebeneinander im echten Format (A4 hoch/quer, A3, Folie, Kartenraster), im gewählten Druckprofil, mit Schriftgröße nach Klasse. Ein Entwurf, der nicht auf die Seite passt, wird rot markiert; viel ungenutzter Platz wird angezeigt. Das ersetzt die erste Platzbudget-Rechnung.

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

Der Aufgabenplan legt **jeden Inhalt exakt fest**, der später in Canva steht. Er ersetzt das bisherige Briefing zur Freigabe. Was er enthält, hängt von der Materialart ab (Tabelle unten). Immer:

- Titel nach Schema `Kl2_Mathe_Uhrzeit_AB1`, Format, Druckprofil, gewählter Entwurf
- alle Texte wörtlich: Überschrift, Ich-kann-Ziel, Wahlhilfe, Anweisungen, Tipps, Fußtext, Reflexionsfrage
- alle Items vollständig, Rechnungen und Rechtschreibung geprüft
- Lösungen bzw. Erwartungshorizont
- Bildliste: welche Bilder wo, mit vorhandener Media-ID (Willi, Wilma, Wachstumsgrafik) oder als neues Motiv; exakte Abbildungen (Uhren, Zahlenstrahl) als Vektor mit Werten
- Seiten: Niveau-Blätter, Lösungsblatt

Den gewählten Entwurf im JSON auf die finalen Items aktualisieren und `entwurf.py` erneut laufen lassen: Passt alles auf die Seite? Erst dann den Plan zeigen.

Format im Chat (Beispiel Arbeitsblatt):

```
Aufgabenplan Kl2_Mathe_Uhrzeit_AB1 · A4 hoch · s/w · Entwurf A
Kopf: „Wie spät ist es?" · Ich kann volle und halbe Stunden ablesen. · Wähle deine Aufgaben.
1 ●  Lies ab. Schreibe die Uhrzeit auf.   5 Uhren 88 px + Antwortlinie
     Uhren: 3:00 · 4:30 · 7:00 · 9:30 · 12:00
     Willi (Strich MAHXWZ6fTfM): „Schau zuerst auf den kleinen Zeiger. Er zeigt die Stunde."
     Lösung: 3 Uhr · halb 5 · 7 Uhr · halb 10 · 12 Uhr
2 ●● …
Fuß: Ich kann … · Male an, wie weit du schon bist: (Wachstum Strich MAHXWdlD_qM) · Was hat dir geholfen? ☐ … ☐ …
Seite 2: Lösungsblatt (Lösungen fett, unterstrichen)
Passt das so? Danach setze ich es in Canva um; der Inhalt ändert sich dann nicht mehr.
```

Erst nach dem Ok der Lehrkraft beginnt Phase 5. Änderungswünsche danach werden im Plan eingearbeitet und kurz bestätigt, nicht in Canva ausprobiert.

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

- **„Mach einfach"**: ein Entwurf nach den Empfehlungen und der Aufgabenplan in einer Nachricht; vor Canva trotzdem auf das Ok warten.
- **Folgematerial im selben Stil** („wie das letzte Blatt"): keine Entwürfe, direkt der Aufgabenplan mit dem bestätigten Layout.
- **Kleine Korrektur an einem fertigen Canva-Material**: direkt in Canva ändern, kein neuer Plan.

## Was nicht passieren darf

- Canva-Design anlegen oder Bilder erzeugen, bevor der Aufgabenplan freigegeben ist.
- Entwürfe, die sich nur in Farben oder Details unterscheiden.
- Inhalte in Canva umformulieren oder ausprobieren; Inhalt kommt nur aus dem Plan.
- Mehr als zwei Entwurfsrunden ohne gezielte Rückfrage.
