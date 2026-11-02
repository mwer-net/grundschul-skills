# Katalog der Abbildungen

Alle `x-…`-Elemente aus `assets/abbildungen.js`. Sie sind berechnet, nie von Hand gezeichnet und nie KI-Bilder. Vollständige Beispiele im Blatt: `assets/muster/`.

**Für alle gilt:**

- Lösung erscheint nur auf dem Lösungsblatt und im Beispiel (`class="beispiel"` am Container).
- s/w: nur Schwarz und Grau, Unterschiede über Form und Muster. Farbe: Palette, Text bleibt schwarz.
- Unzulässige Angaben zeichnen einen gestrichelten Kasten mit dem Grund. `blatt.py` meldet ihn als FEHLER mit dem Namen der Abbildung, der Editor sperrt das Speichern.
- Attributformate: Liste mit Leerzeichen oder `;`, wenn Einträge Leerzeichen enthalten; Paare `Name: Wert; Name: Wert`; Raster zeilenweise `0 1 1 / 0 1 0`. Zahlen auf dem Blatt: Dezimalkomma, ab fünf Stellen mit schmalem Leerzeichen (U+202F).
- Mit `seed="…"` hängt alles Gemischte nur am Attribut: gleicher Seed, gleiches Bild in Vorschau, PDF und Lösung.
- Ist ein Element maßstäblich (echte Zentimeter), kommt die Prüfmeldung `masstab`: beim Anlegen `--druckhinweis "In Originalgröße drucken (100 %)"` setzen.

## Grundelemente

### `x-uhr`: Zifferblatt

Uhrzeit lesen und einstellen.

```html
<x-uhr zeit="4:30" groesse="88"></x-uhr>
<x-uhr loesung="4:30"></x-uhr>
```

| Attribut | Bedeutung |
|---|---|
| `zeit` | Uhrzeit mit Zeigern, `H:MM` |
| `loesung` | Uhrzeit nur in der Lösung; auf dem Arbeitsblatt fehlen die Zeiger |
| `groesse` | Durchmesser in px, Standard 88 |

Stundenzeiger deutlich kürzer und dicker. Fehler: Minuten über 59 oder Stunden über 23. Typisch falsch: Zeit als Text daneben, die im Blatt die Lösung verrät.

### `x-menge`: Gegenstände in Reihen

Zählen und Bündeln.

```html
<x-menge n="36" form="nuss" reihe="10" buendel-loesung="3"></x-menge>
```

`n` Anzahl (1 bis 100), `form` `kreis`, `plaettchen` oder `nuss`, `reihe` Reihenlänge mit Fünferlücke (1 bis 10), `groesse` Maß eines Gegenstands (8 bis 40), `buendel`/`buendel-loesung` Rahmen um volle Zehner immer bzw. nur in der Lösung.

### `x-dienes`: Mehrsystemblöcke

```html
<x-dienes z="3" e="5"></x-dienes>
```

`z` Zehner, `e` Einer.

### `x-strichpunkt`: Strich-Punkt-Darstellung

```html
<x-strichpunkt z="3" e="5"></x-strichpunkt>
```

`z` Striche, `e` Punkte in Fünferstruktur.

### `x-stellentafel`: Stellenwerttafel

Zeichnet HTML, nicht SVG.

```html
<x-stellentafel stellen="H Z E" werte="1 3 5"></x-stellentafel>
<x-stellentafel stellen="H Z E" loesung="1 3 5"></x-stellentafel>
```

`stellen` Spalten, `werte` Zahlen auf dem Blatt, `loesung` Zahlen nur in der Lösung; ohne beides leer.

### `x-zwanzigerfeld`: Zwanzigerfeld mit Plättchen

```html
<x-zwanzigerfeld n="13"></x-zwanzigerfeld>
```

`n` Plättchen, von 0 bis 20.

### `x-zahlenstrahl`: Zahlenstrahl

```html
<x-zahlenstrahl von="0" bis="100" schritt="10" zahlen="0 50 100" pfeile="30 70" breite="620"></x-zahlenstrahl>
```

`von` und `bis`, `schritt` Abstand der Striche, `zahlen` beschriftete Zahlen, `pfeile` Pfeile mit Antwortkästchen (Zahl nur in der Lösung), `breite` in px. Fehler: `bis` nicht größer als `von`, Schritt nicht passend.

### `x-timer`: Zeitscheibe

Für Folien, läuft in der Präsentation ab.

```html
<x-timer minuten="25" groesse="120"></x-timer>
```

`minuten` von 1 bis 120, `skala` 5, 10, 15, 30, 60 oder 120 Minuten (für kurze Phasen 5 oder 10, sonst ist die Scheibe kaum zu sehen), `groesse` von 120 bis 600 px, Standard 360.

## Daten und Zufall

Muster: `assets/muster/daten-und-zufall.html`.

### `x-gluecksrad`: Glücksrad

```html
<x-gluecksrad felder="rot: 1; blau: 2; gruen: 3" anteile="1 1 2" groesse="200"></x-gluecksrad>
<x-gluecksrad felder="leer: 1; leer: 2; leer: 3; leer: 4" loesung="rot blau rot rot"></x-gluecksrad>
<x-gluecksrad bastel="ja" felder="rot: 1; blau: 2; gruen: 3"></x-gluecksrad>
```

| Attribut | Bedeutung |
|---|---|
| `felder` | 2 bis 12 Felder: `Füllung: Beschriftung`, Füllung `rot`, `blau`, `gruen`, `gelb`, `orange`, `lila`, `grau`, `leer` |
| `anteile` | eine Zahl je Feld; ohne sind alle Felder gleich groß |
| `loesung` | Füllung je Feld nur auf dem Lösungsblatt; auf dem Arbeitsblatt bleibt alles weiß („Male so an, dass …“) |
| `zeiger`, `legende` | `ja` (Standard) oder `nein` |
| `bastel` | `ja`: Originalgröße Ø 12 cm mit Mitte und Hinweis zu Bleistift und Büroklammer; beim Anlegen `--druckhinweis "In Originalgröße drucken (100 %)"` |
| `groesse` | Durchmesser in px, 100 bis 460 |

s/w: Muster und Legende („Rot = schraffiert“); ohne Legende nicht zu lesen. Jedes Feld mindestens 20°, sonst Fehler. Eine Beschriftung erscheint nur, wenn sie in das Feld passt.

### `x-wuerfel`: Würfel

```html
<x-wuerfel augen="5"></x-wuerfel>
<x-wuerfel loesung="3"></x-wuerfel>
<x-wuerfel art="zahl" inhalt="12"></x-wuerfel>
<x-wuerfel ansicht="raeumlich" oben="1" vorne="2" rechts="3"></x-wuerfel>
```

`augen` 0 bis 6, `art` `augen`, `zahl`, `muster` (`inhalt` ist eine Füllung) oder `text`, `inhalt`, `loesung` nur auf dem Lösungsblatt, `ansicht` `flach` oder `raeumlich`, `groesse` 32 bis 200. Räumlich: Gegenüberliegende Seiten ergeben 7 und sind nie zusammen sichtbar, sonst Fehler. Sonderwürfel mit eigenen Seiten: `x-wuerfelnetz`.

### `x-strichliste`: Strichliste

```html
<x-strichliste werte="Hund: 7; Katze: 4" zeige="striche"></x-strichliste>
```

`werte` bis 8 Zeilen und 30 Striche je Zeile, `zeige` `striche` (Anzahl offen), `zahl` (Striche offen) oder `leer`; die fehlende Spalte steht auf dem Lösungsblatt. `groesse` Zeilenhöhe 28 bis 60. Fünferbündel: vier senkrechte Striche, der fünfte schräg darüber.

### `x-diagramm`: Diagramm

```html
<x-diagramm werte="Mo: 3; Di: 7; Mi: 12" offen="2" einheit="Kinder"></x-diagramm>
<x-diagramm art="balken" werte="Hund: 20; Katze: 35" skala="5"></x-diagramm>
<x-diagramm art="bild" werte="Äpfel: 6; Birnen: 3" symbol="stern" je="2"></x-diagramm>
```

`art` `saeulen`, `balken` oder `bild`; `werte`; `offen` Nummern der Einträge, die die Kinder zeichnen (stehen auf dem Lösungsblatt); `skala` Schritt, sonst automatisch; `bis`; `einheit` Achsenbeschriftung; `symbol` `kreis`, `quadrat`, `stern`, `herz` und `je` beim Bilddiagramm; `groesse` Höhe der Skala 100 bis 400.

Die Skala beginnt immer bei 0, höchstens 12 Linien. Werte liegen auf einem Skalenstrich oder genau dazwischen, sonst Fehler. Halbe Symbole gibt es nur bei `je="2"`.

### `x-urne`: Kugeln im Säckchen

```html
<x-urne kugeln="rot: 3; blau: 5" form="sack" seed="1"></x-urne>
<x-urne form="glas" loesung="rot: 4; gruen: 2"></x-urne>
```

`kugeln` Füllung und Anzahl, höchstens 20 Kugeln; `loesung` Kugeln nur auf dem Lösungsblatt; `form` `sack` oder `glas`; `legende`; `seed`; `groesse` 100 bis 300.

### `x-wahrscheinlichkeit`: Skala der Begriffe

```html
<x-wahrscheinlichkeit stufen="3" ereignisse="A: sicher; B: unmöglich; C: möglich"></x-wahrscheinlichkeit>
```

`stufen` 3 (unmöglich, möglich, sicher) oder 5 (zusätzlich wenig und sehr wahrscheinlich); `ereignisse` Buchstabe und Stufe. Auf dem Arbeitsblatt stehen unter jeder Stufe gleich viele leere Kästchen, damit die Anordnung die Lösung nicht verrät. Die Ereignisse selbst beschreibt die Aufgabe.

### `x-kombinatorik`: Möglichkeiten

```html
<x-kombinatorik stufen="Waffel Becher / Erdbeer Schoko Vanille"></x-kombinatorik>
<x-kombinatorik art="tabelle" stufen="Rot Blau / Hut Tuch"></x-kombinatorik>
<x-kombinatorik art="liste" stufen="Erdbeer Schoko Vanille / Erdbeer Schoko Vanille" wiederholung="nein" reihenfolge="nein"></x-kombinatorik>
```

`art` `baum`, `tabelle` (genau 2 Stufen) oder `liste`; `stufen` je Stufe die Wörter, getrennt mit `/`; `wiederholung` und `reihenfolge` `ja` (Standard) oder `nein`; `vorgegeben` wie viele Möglichkeiten schon dastehen (Standard 1). „2 aus 3 Sorten“ sind zwei gleiche Stufen. Höchstens 3 Stufen und 24 Möglichkeiten. Das Lösungsblatt zeigt alle Zweige und die Anzahl.

## Ebene Geometrie

Muster: `assets/muster/ebene-geometrie.html`. Gitter und Figuren mit `masse` sind maßstäblich: beim Anlegen `--druckhinweis "In Originalgröße drucken (100 %)"`.

### `x-gitter`: Karo-, Punkt- und Geobrett-Gitter

```html
<x-gitter spalten="12" zeilen="6" aufgabe="spiegeln" achse="senkrecht" achse-bei="6" figur="0 0 1 / 0 1 1 / 0 0 1"></x-gitter>
<x-gitter spalten="24" zeilen="4" aufgabe="fortsetzen" rapport="4" figur="1 1 0 0 / 1 0 0 0"></x-gitter>
<x-gitter spalten="10" zeilen="8" aufgabe="vergroessern" faktor="2" figur="1 1 / 1 0"></x-gitter>
<x-gitter spalten="10" zeilen="6" aufgabe="weg" start="1,4" weg="3→ 2↑ 1←"></x-gitter>
<x-gitter spalten="10" zeilen="4" zaehlen="flaeche umfang" figur="1 1 / 1 0"></x-gitter>
```

| Attribut | Bedeutung |
|---|---|
| `art` | `karo` (Standard), `punkte`, `geobrett` |
| `spalten`, `zeilen` | Größe, höchstens Satzspiegelbreite |
| `kaestchen` | `1` oder `0.5` cm; ohne Angabe 1 cm in Kl. 1/2, 0,5 cm ab Kl. 3 |
| `figur` | gefüllte Kästchen zeilenweise, `0` leer, `1` voll |
| `linien` | stattdessen Vielecke über Gitterpunkte, `0,0 3,0 3,2`, mehrere mit `;` (im Editor nur über Claude änderbar) |
| `aufgabe` | `spiegeln`, `fortsetzen`, `vergroessern`, `weg`, ohne Angabe keine |
| `achse`, `achse-bei` | `senkrecht` oder `waagerecht`, nach so vielen Kästchen; liegt immer auf einer Gitterlinie |
| `rapport`, `rapporte`, `rapportart` | Breite eines Musters, wie viele vorgegeben sind (2), `schieben`, `spiegeln` oder `drehen` im Wechsel. Die Lösung zeigt zwei weitere |
| `faktor` | `2` oder `0.5`; das Zielgitter steht rechts daneben |
| `weg`, `start`, `wegart` | Schritte wie `3→ 2↑`, Startkästchen `Spalte,Zeile` ab `0,0`, `gehen` oder `beschreiben` (Weg steht da, die Pfeile sind die Antwort) |
| `zaehlen` | `flaeche`, `umfang`: Antwortfelder unter dem Gitter |

Die Lösung wird berechnet, nie angegeben. Fehler: Figur kreuzt die Achse, Spiegelbild oder vergrößerte Figur passt nicht, Weg verlässt das Gitter, Umfang bei schrägen Linien, Halbieren ohne volle 2×2-Felder.

### `x-figur`: Ebene Figur

```html
<x-figur form="dreieck" typ="rechtwinklig" loesung="rechter-winkel" beschriftung="ja"></x-figur>
<x-figur form="rechteck" masse="4 2" markierung="gleich-lang"></x-figur>
```

`form` `quadrat`, `rechteck`, `dreieck` (`typ` `rechtwinklig`, `gleichseitig`, `gleichschenklig`), `kreis`, `trapez`, `parallelogramm`, `raute`, `fuenfeck`, `sechseck`; `masse` in cm (dann echte Größe, sonst `groesse`); `drehung` in Grad; `markierung` `rechter-winkel`, `parallel`, `gleich-lang`; `loesung` dieselben Marken nur auf dem Lösungsblatt; `beschriftung` Ecken A, B, C.

### `x-tangram`: Tangram

```html
<x-tangram umriss="katze" teile="quadrat"></x-tangram>
<x-tangram bogen="ja"></x-tangram>
```

`umriss` `haus`, `katze`, `schiff`, `fisch`, `kerze`; `teile` schon eingezeichnet: `gross1`, `gross2`, `mittel`, `klein1`, `klein2`, `quadrat`, `raute`; `groesse` px je Einheit; `bogen="ja"` Quadrat von 12 cm zum Ausschneiden. Die Lösung zeigt alle sieben Teile in einer gültigen Lage.

## Räumliche Geometrie

Muster: `assets/muster/raeumliche-geometrie.html`. Schrägbild, Bauplan und Ansichten entstehen aus einem Bauplan und passen darum immer zusammen.

### `x-wuerfelbau`: Würfelgebäude

```html
<x-wuerfelbau bauplan="2 1 / 3 1" zeige="schraegbild bauplan vorne rechts links oben"></x-wuerfelbau>
<x-wuerfelbau bauplan="1 2 / 1 3" zeige="schraegbild" fragen="bauplan anzahl"></x-wuerfelbau>
```

| Attribut | Bedeutung |
|---|---|
| `bauplan` | Turmhöhen 0 bis 5, Zeilen mit `/`, höchstens 4 × 4; die letzte Zeile ist vorne |
| `zeige` | Vorgaben: `schraegbild` (Standard), `bauplan`, `vorne`, `rechts`, `links`, `oben` |
| `fragen` | Antworten: `anzahl`, `bauplan`, `vorne`, `rechts`, `links`, `oben`; leer auf dem Blatt, gefüllt in der Lösung |
| `projektion` | `schraeg` (Standard) oder `iso` |
| `verdeckt` | `zeigen`: verdeckte Würfel gestrichelt |
| `einheit` | Würfelkante in px |

Fehler: Frage ist zugleich Vorgabe; Fragen ohne Schrägbild oder Bauplan; nach Bauplan oder Anzahl gefragt, während das Schrägbild einen Würfel verdeckt.

### `x-wuerfelnetz`: Würfel- und Quadernetz

```html
<x-wuerfelnetz netz="3" aufgabe="gegenueber" markiere="2"></x-wuerfelnetz>
<x-wuerfelnetz netz="n4" aufgabe="netz-oder-nicht"></x-wuerfelnetz>
<x-wuerfelnetz netz="10" aufgabe="augen-ergaenzen" seed="a"></x-wuerfelnetz>
<x-wuerfelnetz netz="1" augen="ja" bastel="ja" kante="4"></x-wuerfelnetz>
<x-wuerfelnetz netz="6" flaechen="1 #12 Haus rot 5 Stern" bastel="ja" kante="5"></x-wuerfelnetz>
```

| Attribut | Bedeutung |
|---|---|
| `netz` | `1` bis `11` (alle Würfelnetze), `n1` bis `n8` (geprüft keine Netze) |
| `aufgabe` | `netz-oder-nicht`, `gegenueber` (`markiere` = Fläche 1 bis 6 in Leserichtung), `augen-ergaenzen` (drei Flächen leer, je Paar eine, nach `seed`) |
| `augen` | `ja`: Standardwürfel, gegenüber immer 7, gedreht wie ein echter Würfel |
| `flaechen` | sechs Einträge in Leserichtung: `1`–`6` Augen, `0` leer, `#12` Zahl, Farbname (s/w: Muster), sonst Wort ohne Leerzeichen |
| `laschen` | `ja`: 7 Laschen, an jeder Klebekante eine; bei `bastel` Standard |
| `bastel`, `kante` | Bastelvorlage in echten cm (Standard 4), dreht sich selbst aufs Blatt; passt sie nicht, nennt der Fehler die größte Kante. Beim Anlegen `--druckhinweis "In Originalgröße drucken (100 %), festes Papier"` |
| `art`, `masse` | `quader` mit drei Maßen, nur Netze 1 bis 6 |
| `drehung`, `groesse` | 0, 90, 180, 270 Grad; px je Kästchen |

### `x-koerper`: Körper

```html
<x-koerper form="pyramide" markiere="ecken kanten"></x-koerper>
<x-koerper form="quader" ansicht="kantenmodell"></x-koerper>
```

`form` `wuerfel`, `quader`, `kugel`, `zylinder`, `kegel`, `pyramide`, `prisma`; `ansicht` `schraegbild` (Kavalierperspektive) oder `kantenmodell` (nur mit geraden Kanten); `verdeckt` `gestrichelt` oder `aus`; `markiere` `ecken`, `kanten`, `flaechen`: Antwortfeld auf dem Blatt, Markierung und Anzahl in der Lösung (beim Kegel heißt es „Spitzen“); `masse` in Einheiten; `drehung` um die senkrechte Achse; `groesse` px je Einheit.

## Zahldarstellungen

Muster: `assets/muster/zahldarstellungen.html`. Stellenfarben der Klasse: einmal am `<body>`, zum Beispiel `data-stellenfarben="E:blau Z:rot H:gruen"`. Sie gelten nur im Farbprofil, als schmale Kopfleiste in der Stellentafel und an deren Plättchen.

Erweiterungen der Grundelemente: `x-zwanzigerfeld` `art` (`fuenfer`, `zehner`, `zwanziger`), `n2` zweite Sorte, `loesung="5 2"`. `x-dienes` `t`, `h`, `loesung="1 2 3 4"` (T H Z E). `x-stellentafel` bis `M HT ZT T H Z E`, `art="plaettchen"` mit `plaettchen="3 0 12"` (bis 15 je Stelle), auch in `loesung`. `x-zahlenstrahl` `marken` mittlere Striche alle so viele Schritte; Ausschnitte wie 3400 bis 3500 ohne Null.

### `x-hunderterfeld`: Hunderterfeld

```html
<x-hunderterfeld n="30" n2="6"></x-hunderterfeld>
<x-hunderterfeld malwinkel="3x7"></x-hunderterfeld>
<x-hunderterfeld loesung="4x8"></x-hunderterfeld>
```

`n` volle Plättchen zeilenweise, `n2` Ringe; `zeilen`, `spalten` Ausschnitt; `malwinkel` Zeilen x Spalten, liegt immer oben links; `loesung` Plättchen (`30 6`) oder Malwinkel (`3x7`) erst in der Lösung; `groesse` px je Feld. Die Lücke in der Mitte ist das Fünferkreuz.

### `x-hundertertafel`: Hundertertafel

```html
<x-hundertertafel luecken="7 23 58" markiert="5 10 15"></x-hundertertafel>
<x-hundertertafel ausschnitt="kreuz" mitte="45" luecken="35 44 46 55"></x-hundertertafel>
<x-hundertertafel von="301" bis="400" ausschnitt="block" mitte="345" zufall="4" seed="a"></x-hundertertafel>
```

`von`, `bis`; `ausschnitt` `ganz`, `zeile`, `spalte`, `kreuz`, `block`, `treppe` mit `mitte`; `luecken` leer auf dem Blatt, in der Lösung ausgefüllt; `zufall` so viele zufällige Lücken dazu (`seed`); `markiert` mit Muster oder Farbe; `groesse` px je Feld. Eine Zahl muss stehen bleiben; Kreuz und Block gehen nicht am Rand der Tafel.

### `x-rechenrahmen`: Rechenrahmen

```html
<x-rechenrahmen stellung="7 3"></x-rechenrahmen>
<x-rechenrahmen art="100" loesung="10 10 4"></x-rechenrahmen>
```

`art` `20` oder `100`; `stellung` Kugeln links je Reihe; `loesung` erst in der Lösung; `groesse` px je Kugel.

### `x-rechenstrich`: Rechenstrich

```html
<x-rechenstrich start="47" spruenge="+30 +4"></x-rechenstrich>
<x-rechenstrich start="83" spruenge="−20 −3" zeige="start spruenge zwischen"></x-rechenstrich>
```

`start`; `spruenge` mit Vorzeichen; `zeige` aus `start`, `spruenge`, `zwischen`, `ziel` (Standard: Start und Sprünge), alles andere ist ein Kästchen mit der berechneten Lösung; `massstab="ja"` Bögen maßstäblich, mindestens 28 px; `gemischt="ja"` erlaubt Vor- und Rückwärtssprünge, dann immer im Maßstab; `breite` in px.

## Rechenformate

Muster: `assets/muster/rechenformate.html`. Die Lösung wird immer berechnet. Das Element prüft den Zahlenraum der Klasse (kl1 20, kl2 100, kl3 1 000, kl4 1 000 000) und ob sich jedes offene Feld eindeutig ergibt; sonst FEHLER. `offen` listet leere Felder; ohne Angabe gilt der Standard des Elements.

### `x-zahlenmauer`: Zahlenmauer

```html
<x-zahlenmauer basis="3 5 2"></x-zahlenmauer>
<x-zahlenmauer basis="4 2 6 1" offen="0-1 0-2 1-0 2-1 3-0"></x-zahlenmauer>
```

`basis` unterste Reihe, 2 bis 5 Steine; `offen` Steine als `Reihe-Stein`, Reihe 0 ist unten; Standard: alles über der Basis. `art` `plus` oder `minus` (links minus rechts); `groesse` Steinbreite in px.

### `x-rechendreieck`: Rechendreieck

```html
<x-rechendreieck innen="3 5 2"></x-rechendreieck>
<x-rechendreieck innen="4 7 6" offen="i0 i1 a2" darstellung="plaettchen"></x-rechendreieck>
```

`innen` drei Zahlen; `offen` aus `i0`, `i1`, `i2` (innen: oben, links, rechts) und `a0`, `a1`, `a2` (außen: links, unten, rechts), Standard: außen; `darstellung` `zahlen` oder `plaettchen` (bis 20); `groesse` in px.

### `x-zahlenhaus`: Zahlenhaus

```html
<x-zahlenhaus dach="7" zerlegungen="3 4; 5 2"></x-zahlenhaus>
<x-zahlenhaus dach="5" alle="ja" offen="0-r 1-l 2-r 3-l 4-r 5-l"></x-zahlenhaus>
```

`dach`; `zerlegungen` Stockwerke; `alle="ja"` alle Zerlegungen der Reihe nach; `offen` aus `dach`, `0-l`, `0-r` … (Stockwerk, links oder rechts), Standard: rechts; `groesse` in px.

### `x-zahlenkette`: Rechenkette

```html
<x-zahlenkette start="8" operatoren="+5 −3 ·2"></x-zahlenkette>
<x-zahlenkette start="4" operatoren="·5 −2" rueckwaerts="ja" art="pfeilbild"></x-zahlenkette>
```

`start` ist immer die erste Zahl, auch rückwärts; `operatoren` mit `+`, `−`, `·`, `:` (nur ohne Rest); `zeige` aus `start`, `operatoren`, `zwischen`, `ziel`, Standard Start und Schritte, bei `rueckwaerts="ja"` Ziel und Schritte; `art` `kette` oder `pfeilbild`.

### `x-zauberdreieck`: Zauberdreieck und magisches Quadrat

```html
<x-zauberdreieck summe="9" vorgegeben="e0 e1"></x-zauberdreieck>
<x-zauberdreieck></x-zauberdreieck>
<x-zauberdreieck art="quadrat" vorgegeben="z0 z4 z5"></x-zauberdreieck>
```

`art` `dreieck` (Felder `e0` oben, `s0`, `e1` links, `s1`, `e2` rechts, `s2`) oder `quadrat` (`z0` bis `z8`); `zahlen` Standard 1 bis 6 bzw. 1 bis 9; `summe`: mit ihr muss es genau eine Lösung geben, ohne sie zeigt die Lösung „eine von n Lösungen“ (Forscheraufgabe); `vorgegeben` Felder, deren Zahl aus der Lösung schon dasteht; `seed` wählt die Lösung; `groesse` in px.

### `x-rechenrad`: Rechenrad

```html
<x-rechenrad mitte="·7" zahlen="1 2 3 4 5 6 7 8"></x-rechenrad>
```

`mitte` Rechenschritt; `zahlen` innerer Ring, 6 bis 10; `offen` `aussen` oder `innen`; `groesse` in px.
