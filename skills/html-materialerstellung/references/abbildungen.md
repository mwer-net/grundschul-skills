# Katalog der Abbildungen

Inhalt: Wo steht welches Element · Aufgabenformate · Freies Element

Alle `x-…`-Elemente aus `assets/abbildungen.js`. Sie sind berechnet, nie von Hand gezeichnet und nie KI-Bilder. Vollständige Beispiele im Blatt: `assets/muster/`.

**Für alle gilt:**

- Lösung erscheint nur auf dem Lösungsblatt und im Beispiel (`class="beispiel"` am Container).
- Farbe aus der Palette, Text bleibt schwarz. In der s/w-Ansicht zeichnen die Elemente selbst mit Schwarz, Grau, Form und Muster.
- Unzulässige Angaben zeichnen einen gestrichelten Kasten mit dem Grund. `blatt.py` meldet ihn als FEHLER mit dem Namen der Abbildung.
- Attributformate: Liste mit Leerzeichen oder `;`, wenn Einträge Leerzeichen enthalten; Paare `Name: Wert; Name: Wert`; Raster zeilenweise `0 1 1 / 0 1 0`. Zahlen auf dem Blatt: Dezimalkomma, ab fünf Stellen mit schmalem Leerzeichen (U+202F).
- Mit `seed="…"` hängt alles Gemischte nur am Attribut: gleicher Seed, gleiches Bild in Vorschau, PDF und Lösung.
- Ist ein Element maßstäblich (echte Zentimeter), kommt die Prüfmeldung `masstab`: beim Anlegen `--druckhinweis "In Originalgröße drucken (100 %)"` setzen.

## Wo steht welches Element

Die Elemente stehen nach Bereich in eigenen Dateien. Lies vor dem Einsatz eines Elements seine Datei ganz. Beim Bau neuen Materials verlangt die Schoolbox das, bevor sie baut.

<!-- erzeugt: abbildungen-index -->
| Element | Wofür | Datei |
|---|---|---|
| `x-lueckentext` | Lückentext | `references/abbildungen.md` |
| `x-wortspeicher` | Wortspeicher | `references/abbildungen.md` |
| `x-ankreuzen` | Ankreuzen | `references/abbildungen.md` |
| `x-richtigfalsch` | Richtig oder falsch | `references/abbildungen.md` |
| `x-zuordnen` | Zuordnen | `references/abbildungen.md` |
| `x-sortieren` | Sortieren | `references/abbildungen.md` |
| `x-beschriften` | Beschriften | `references/abbildungen.md` |
| `x-schreibrahmen` | Schreibrahmen | `references/abbildungen.md` |
| `x-uhr` | Zifferblatt | `references/abbildungen/mathe-zahlen.md` |
| `x-menge` | Gegenstände in Reihen | `references/abbildungen/mathe-zahlen.md` |
| `x-dienes` | Mehrsystemblöcke | `references/abbildungen/mathe-zahlen.md` |
| `x-strichpunkt` | Strich-Punkt-Darstellung | `references/abbildungen/mathe-zahlen.md` |
| `x-stellentafel` | Stellenwerttafel | `references/abbildungen/mathe-zahlen.md` |
| `x-zwanzigerfeld` | Zwanzigerfeld mit Plättchen | `references/abbildungen/mathe-zahlen.md` |
| `x-zahlenstrahl` | Zahlenstrahl | `references/abbildungen/mathe-zahlen.md` |
| `x-hunderterfeld` | Hunderterfeld | `references/abbildungen/mathe-zahlen.md` |
| `x-hundertertafel` | Hundertertafel | `references/abbildungen/mathe-zahlen.md` |
| `x-rechenrahmen` | Rechenrahmen | `references/abbildungen/mathe-zahlen.md` |
| `x-rechenstrich` | Rechenstrich | `references/abbildungen/mathe-zahlen.md` |
| `x-zahlenmauer` | Zahlenmauer | `references/abbildungen/mathe-zahlen.md` |
| `x-rechendreieck` | Rechendreieck | `references/abbildungen/mathe-zahlen.md` |
| `x-zahlenhaus` | Zahlenhaus | `references/abbildungen/mathe-zahlen.md` |
| `x-zahlenkette` | Rechenkette | `references/abbildungen/mathe-zahlen.md` |
| `x-zauberdreieck` | Zauberdreieck und magisches Quadrat | `references/abbildungen/mathe-zahlen.md` |
| `x-rechenrad` | Rechenrad | `references/abbildungen/mathe-zahlen.md` |
| `x-rechenreihe` | Rechenpäckchen | `references/abbildungen/mathe-zahlen.md` |
| `x-punktfeld` | Punktfeld | `references/abbildungen/mathe-zahlen.md` |
| `x-malkreuz` | Malkreuz | `references/abbildungen/mathe-zahlen.md` |
| `x-schriftlich` | Schriftliche Rechnung | `references/abbildungen/mathe-zahlen.md` |
| `x-gitter` | Karo-, Punkt- und Geobrett-Gitter | `references/abbildungen/mathe-geometrie.md` |
| `x-symmetrie-sortieren` | Nach Achsen sortieren | `references/abbildungen/mathe-geometrie.md` |
| `x-figur` | Ebene Figur | `references/abbildungen/mathe-geometrie.md` |
| `x-tangram` | Tangram | `references/abbildungen/mathe-geometrie.md` |
| `x-wuerfelbau` | Würfelgebäude | `references/abbildungen/mathe-geometrie.md` |
| `x-wuerfelnetz` | Würfel- und Quadernetz | `references/abbildungen/mathe-geometrie.md` |
| `x-koerper` | Körper | `references/abbildungen/mathe-geometrie.md` |
| `x-geld` | Münzen und Spielgeld-Scheine | `references/abbildungen/mathe-groessen-daten.md` |
| `x-skala` | Messgerät | `references/abbildungen/mathe-groessen-daten.md` |
| `x-strecke` | Strecke zum Messen | `references/abbildungen/mathe-groessen-daten.md` |
| `x-kalender` | Monat oder Jahr | `references/abbildungen/mathe-groessen-daten.md` |
| `x-zeitspanne` | Zeitspanne am Zeitstrahl | `references/abbildungen/mathe-groessen-daten.md` |
| `x-gluecksrad` | Glücksrad | `references/abbildungen/mathe-groessen-daten.md` |
| `x-wuerfel` | Würfel | `references/abbildungen/mathe-groessen-daten.md` |
| `x-strichliste` | Strichliste | `references/abbildungen/mathe-groessen-daten.md` |
| `x-diagramm` | Diagramm | `references/abbildungen/mathe-groessen-daten.md` |
| `x-urne` | Kugeln im Säckchen | `references/abbildungen/mathe-groessen-daten.md` |
| `x-wahrscheinlichkeit` | Skala der Begriffe | `references/abbildungen/mathe-groessen-daten.md` |
| `x-kombinatorik` | Möglichkeiten | `references/abbildungen/mathe-groessen-daten.md` |
| `x-lineatur` | Schreiblinien | `references/abbildungen/deutsch.md` |
| `x-silben` | Silben | `references/abbildungen/deutsch.md` |
| `x-wortarten` | Wortarten | `references/abbildungen/deutsch.md` |
| `x-satzglieder` | Satzglieder | `references/abbildungen/deutsch.md` |
| `x-wortbausteine` | Wortbausteine | `references/abbildungen/deutsch.md` |
| `x-gesamtpunkte` | Gesamtpunkte | `references/abbildungen/klassenarbeit.md` |
| `x-notenschluessel` | Notenschlüssel | `references/abbildungen/klassenarbeit.md` |
| `x-notenspiegel` | Notenspiegel | `references/abbildungen/klassenarbeit.md` |
| `x-unterschrift` | Unterschrift und Datum | `references/abbildungen/klassenarbeit.md` |
| `x-erwartungshorizont` | Erwartungshorizont | `references/abbildungen/klassenarbeit.md` |
| `x-zeitleiste` | Zeitleiste | `references/abbildungen/sachunterricht.md` |
| `x-jahreskreis` | Jahreskreis | `references/abbildungen/sachunterricht.md` |
| `x-windrose` | Windrose | `references/abbildungen/sachunterricht.md` |
| `x-plan` | Plan | `references/abbildungen/sachunterricht.md` |
| `x-schaltplan` | Stromkreis | `references/abbildungen/sachunterricht.md` |
| `x-kreislauf` | Kreislauf | `references/abbildungen/sachunterricht.md` |
| `x-verkehrszeichen` | Verkehrszeichen | `references/abbildungen/sachunterricht.md` |
| `x-wetter` | Wettersymbol | `references/abbildungen/sachunterricht.md` |
| `x-suchsel` | Suchsel | `references/abbildungen/spiele-raetsel.md` |
| `x-kreuzwort` | Kreuzworträtsel | `references/abbildungen/spiele-raetsel.md` |
| `x-loesungswort` | Lösungswort | `references/abbildungen/spiele-raetsel.md` |
| `x-bingo` | Bingo | `references/abbildungen/spiele-raetsel.md` |
| `x-domino` | Domino | `references/abbildungen/spiele-raetsel.md` |
| `x-spielplan` | Spielplan | `references/abbildungen/spiele-raetsel.md` |
| `x-rhythmus` | Rhythmus | `references/abbildungen/musik.md` |
| `x-noten` | Noten | `references/abbildungen/musik.md` |
| `x-timer` | Zeitscheibe | `references/folien.md` |
<!-- /erzeugt: abbildungen-index -->

## Aufgabenformate

### `x-lueckentext`

```html
<x-lueckentext>Der [Hund] bellt, die [[Katze]] miaut.</x-lueckentext>
<x-lueckentext darstellung="kasten" breite="wortlaenge">Die [Sonne] scheint.</x-lueckentext>
```

`[Wort]` ist eine Lücke, `[[Wort]]` schon eingetragen. `darstellung`: `linie` (Standard), `kasten`, `gepunktet`. `breite`: `einheitlich` (Standard), `wortlaenge`. Lösung: berechnet.

### `x-wortspeicher`

```html
<x-wortspeicher></x-wortspeicher>
<x-wortspeicher woerter="Hund; Maus; Pferd" spalten="3" reihenfolge="gemischt" seed="a" rahmen="0"></x-wortspeicher>
```

Ohne `woerter`: die Wörter aller Lücken derselben Aufgabe. Fehlt ein Lückenwort oder steht eines doppelt, meldet das Element es. `reihenfolge`: `alphabetisch` (Standard), `gemischt`.

### `x-ankreuzen`

```html
<x-ankreuzen fragen="Wie viele Beine hat ein Hund?: *4, 3, 6"></x-ankreuzen>
<x-ankreuzen mehrfach="1" spalten="2" seed="a" fragen="Was kann fliegen?: *Vogel, Hund, *Biene"></x-ankreuzen>
```

`*` markiert die richtige Antwort. Mindestens eine richtig, ohne `mehrfach` genau eine. Lösung: Kreuz gesetzt.

### `x-richtigfalsch`

```html
<x-richtigfalsch aussagen="Hunde bellen: r; Katzen fliegen: f"></x-richtigfalsch>
<x-richtigfalsch koepfe="daumen" aussagen="Fische schwimmen: r"></x-richtigfalsch>
```

`koepfe`: `richtigfalsch` (Standard), `janein`, `daumen`. Lösung: Kreuz gesetzt.

### `x-zuordnen`

```html
<x-zuordnen paare="Hund: bellt; Katze: miaut; Kuh: muht"></x-zuordnen>
<x-zuordnen darstellung="ziffern" seed="a" paare="3 + 4: 7; 5 + 5: 10"></x-zuordnen>
<x-zuordnen paare="Apfel: Obst: bilder/apfel.png; Möhre: Gemüse: bilder/moehre.png"></x-zuordnen>
```

`paare` ist `links: rechts: Bild links: Bild rechts`, die Bilder sind freiwillig; 2 bis 10 Paare. `darstellung`: `linien` (Standard), `ziffern`. Rechts ist nie ein Paar schon richtig, von mehreren Mischungen gilt die mit den wenigsten Kreuzungen. Lösung: Linien bzw. Ziffern. Rechts doppelte Einträge meldet das Element, weil es dann zwei Lösungen gäbe.

### `x-sortieren`

```html
<x-sortieren eintraege="Zuerst keimt der Samen.; Dann wächst der Stängel."></x-sortieren>
<x-sortieren art="bilder" eintraege="Samen: bilder/samen.png; Blume: bilder/blume.png"></x-sortieren>
<x-sortieren art="zahlen" darstellung="linien" seed="a" eintraege="3; 7; 12"></x-sortieren>
```

`eintraege` in der richtigen Reihenfolge, je `Text` oder `Text: Bild`; 2 bis 12. `art`: `saetze` (Standard), `woerter`, `bilder`, `zahlen`. `darstellung`: `ziffer` (Standard), `linien` zum Abschreiben. Die gemischte Reihenfolge ist nie schon die Lösung. Lösung: Ziffern bzw. die Reihenfolge auf den Linien.

### `x-beschriften`

```html
<x-beschriften bild="bilder/wachstum.png" alt="Pflanze" punkte="12,70: Samen; 88,25: Blume"></x-beschriften>
<x-beschriften darstellung="nummer" wortspeicher="1" bild="bilder/wachstum.png" alt="Pflanze" punkte="12,70: Samen"></x-beschriften>
```

`punkte` ist `x,y: Wort` in Prozent des Bilds. `darstellung`: `linien` (Standard, Wörter außerhalb des Bilds, Linien kreuzen sich nicht), `nummer`. Höchstens 6 Punkte je Bildhälfte. `wortspeicher="1"` zeigt die Wörter sortiert. Lösung: Wörter eingetragen.

### `x-schreibrahmen`

```html
<x-schreibrahmen satzanfaenge="Zuerst; Dann; Am Ende" wortspeicher="Samen; Blume"></x-schreibrahmen>
<x-schreibrahmen planung="1" linien="1" lineatur="3" satzanfaenge="Ich sehe" beispiel="Ich sehe einen Hund."></x-schreibrahmen>
```

`satzanfaenge` mit `;` getrennt, bis 10. `linien` je Satz 1 bis 6 (Standard 2). `lineatur` `1` bis `4`; ohne Angabe folgt sie der Klasse. `planung="1"` setzt Einleitung, Hauptteil und Schluss davor. `beispiel` steht nur auf dem Lösungsblatt.

## Freies Element

Gibt es für einen Wunsch kein Element, baue im Chat ein eigenes aus statischem HTML und SVG. Sage nicht ab, weil ein Element fehlt. Es hat im Editor keine Einstellungen, geändert wird es über den Chat; darum geht ein passendes Element immer vor.

- **Außen** ein `figure`, `div` oder `svg` mit `data-frei` und einem Namen in `data-frei-titel`. Der Name steht in der Gliederung und im Inspektor. Keine eigenen `x-`-Namen: Unbekannte `x-…` bleiben leer.
- **Ist ein Teil des Blatts gewählt,** bleibt das Ergebnis genau ein Element. Passt das gewählte nicht, ersetze es durch das freie.
- **Erlaubt:** was sich drucken lässt, also HTML-Grundelemente, SVG-Formen, `<use href="#…">`, `fill="url(#…)"` als Attribut für Verläufe und Muster aus `<defs>`, `style` und `<style>` ohne `url()` und `@import`.
- **Nicht erlaubt:** Skripte, `on…`-Attribute, `javascript:`, `<iframe>`, `<object>`, `<embed>`, `<form>`, `<base>`, `<meta>`, `<link>`, `<foreignObject>`, `<image>`, Animationen (Bewegung im Auftakt nur über `data-auftritt` und `data-bewegung`, `praesentation/SKILL.md`) und jede Adresse nach außen. Bilder nur als Pfad aus der Mappe; Formen zeichnest du als SVG. Rückstriche in CSS und seltene Entitäten gehen auch nicht, schreibe das Zeichen direkt. Enthält das Element etwas davon, entsteht kein Vorschlag. Etwas zum Anklicken geht hier nicht, und das sagst du auch so.
- **Es bleibt Material:** Linien ≥ 1,5 px, tauglich für s/w, Farbe nie als einziger Träger, Text schwarz, Maße relativ zum Blatt (`viewBox` und `width="100%"` oder eine Breite innerhalb des Satzspiegels). Lösung über dieselben Wege wie sonst: `class="nur-loesung"` zeigt einen Teil nur auf dem Lösungsblatt, auch an einem `<g>`.
- **Klein halten:** Hunderte Pfade sprengen Budget und Dateigröße. Lieber weniger Punkte.

### Beispiel: Tangram mit eigenem Umriss

Ein Umriss, den `x-tangram` nicht kennt, ist ein freies Element, kein neuer Eintrag in dessen Liste. Der Umriss ist ein `<polygon>`, die Lösung sind die sieben Steine als Polygone, kein Bild.

<!-- frei-beispiel -->
```html
<figure data-frei data-frei-titel="Tangram Quadrat">
  <svg viewBox="-2 -2 124 124" width="360" height="360">
    <polygon points="0,0 120,0 120,120 0,120" fill="#ddd" stroke="#000" stroke-width="2"/>
    <g class="nur-loesung" fill="none" stroke="#000" stroke-width="2">
      <polygon points="0,0 120,0 60,60"/>
      <polygon points="0,0 0,120 60,60"/>
      <polygon points="120,120 120,60 60,120"/>
      <polygon points="120,0 120,60 90,30"/>
      <polygon points="60,60 90,90 30,90"/>
      <polygon points="60,60 90,30 120,60 90,90"/>
      <polygon points="0,120 30,90 90,90 60,120"/>
    </g>
  </svg>
  <figcaption>Lege die Form mit allen sieben Steinen.</figcaption>
</figure>
```

Ein Umriss muss lösbar sein. Nimm die sieben echten Steine, bei Seitenlänge 4 der Einheit: 2 große Dreiecke (Fläche 4), 1 mittleres (2), 2 kleine (1), Quadrat (2), Parallelogramm (2), zusammen 16. Lege zuerst die Steine in Zielform, jeder gedreht in 45°-Schritten, und nimm ihre Außenkante als Umriss. So bleibt die Fläche von selbst 16. Nenne in der Antwort offen, wenn eine Form nur ungefähr zum Wunsch passt.
