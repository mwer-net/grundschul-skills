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

## Einmaleins und schriftliches Rechnen

Muster: `assets/muster/einmaleins-und-schriftlich.html`. Lösung und Teilergebnisse werden immer berechnet. Der Zahlenraum der Klasse wird geprüft.

### `x-punktfeld`: Punktfeld

```html
<x-punktfeld zeilen="6" spalten="7" trenner="5"></x-punktfeld>
<x-punktfeld zeilen="4" spalten="9" trenner="5" richtung="spalten" loesung="ja"></x-punktfeld>
<x-punktfeld zeilen="10" spalten="10" abdecken="3 4"></x-punktfeld>
```

`zeilen`, `spalten` höchstens 10, Fünferlücke nach der 5. Zeile und Spalte. `trenner` Zerlegungslinie nach Zeile oder Spalte k (`richtung` `zeilen`, `spalten`); empfohlen sind die Kernaufgaben: nach 1, 2 oder 5 (10 ist das volle Zehnerfeld). `loesung="ja"`: Linie erst in der Lösung. Die Teilaufgaben („5 · 7 + 1 · 7“) stehen immer erst in der Lösung. `abdecken` lässt Zeilen und Spalten frei, der Rest liegt grau darunter wie beim Malwinkel. `groesse` Punktabstand in px, 14 bis 40.

### `x-malkreuz`: Malkreuz

```html
<x-malkreuz a="34" b="6"></x-malkreuz>
<x-malkreuz a="23" b="45" zeige="zerlegung teilprodukte"></x-malkreuz>
```

`a`, `b` 1 bis 99, zerlegt nach Stellenwerten (34 = 30 + 4). `zeige` mehrfach: `zerlegung`, `teilprodukte`, `summe`; Standard `zerlegung`. Was nicht in `zeige` steht, füllt das Lösungsblatt.

### `x-schriftlich`: Schriftliche Rechnung

```html
<x-schriftlich art="plus" zahlen="345 278 96"></x-schriftlich>
<x-schriftlich art="minus" zahlen="903 478" verfahren="ergaenzen-erweitern"></x-schriftlich>
<x-schriftlich art="mal" zahlen="345 23"></x-schriftlich>
<x-schriftlich art="geteilt" zahlen="957 4"></x-schriftlich>
<x-schriftlich art="plus" zahlen="478 356" fehlerhaft="ja" seed="3"></x-schriftlich>
```

Eine Ziffer je Kästchen im echten Heftmaß, also in Originalgröße drucken (`kaestchen` 0,4 bis 1 cm, Standard 0,5).

- `art`: `plus` (2 bis 4 Zahlen), `minus` (erste Zahl mindestens so groß wie die zweite), `mal` (zweiter Faktor höchstens 3 Stellen), `geteilt` (durch 2 bis 9, mit oder ohne Rest). Jede Zahl höchstens 7 Stellen.
- `verfahren` bei Minus Pflicht: `abziehen-entbuendeln`, `abziehen-erweitern`, `ergaenzen-entbuendeln`, `ergaenzen-erweitern`. Entbündeln zeigt die neuen Ziffern über den durchgestrichenen, Erweitern die Überträge unter dem Subtrahenden. Abziehen und Ergänzen sehen im Blatt gleich aus und unterscheiden sich in der Sprechweise; das Panel nennt sie.
- `uebertrag` `zeile` (Standard) oder `keine`. Beim Malnehmen hat jedes Teilprodukt eine eigene Übertragszeile über sich; die Teilprodukte beginnen beim höchsten Stellenwert des zweiten Faktors und tragen ihre Nullen.
- `zeige` mehrfach: `aufgabe`, `uebertraege`, `ergebnis`; Standard `aufgabe`. Das Lösungsblatt zeigt alles, bei Geteilt mit allen Zwischenschritten und Rest.
- `fehlerhaft="ja"` zeigt die Rechnung mit genau einem typischen Fehler (Übertrag vergessen, Stelle verrutscht, falsch herum gerechnet; bei Geteilt Rest oder Null vergessen), `seed` wählt ihn. Die Lösung kreist die falsche Ziffer ein, schreibt die richtige darunter und nennt den Fehler. Lässt sich keiner einbauen (ohne Übertrag und kürzere Zahl), meldet das Element das.

Der Bildungsplan BW nennt für Klasse 3/4 alle vier Verfahren im Zahlenraum bis 1 000 000, Subtraktion als „Abziehen oder Ergänzen“, Division auch mit Rest, und begrenzt weder Stellenzahl noch Divisor. Die Grenzen hier sind Vorgaben der Schoolbox.

## Größen

Muster: `assets/muster/groessen.html`. Beträge, Längen und Zeiten werden immer berechnet.

### `x-geld`: Münzen und Spielgeld-Scheine

```html
<x-geld stuecke="2€ 1€ 50ct 20ct 20ct" aufgabe="betrag"></x-geld>
<x-geld aufgabe="legen" betrag="3,45"></x-geld>
<x-geld stuecke="1ct 2ct 5ct 10ct 20ct 50ct 1€ 2€" massstab="original" anordnung="gruppiert"></x-geld>
```

`stuecke`: 1ct, 2ct, 5ct, 10ct, 20ct, 50ct, 1€, 2€, 5€, 10€, 20€, 50€, 100€, 200€, jedes Stück einzeln. `aufgabe`: `keine`, `betrag` (Antwortkästchen), `legen` (mit `betrag`; die Lösung legt mit möglichst wenigen Stücken, `stuecke` begrenzt dann den Vorrat). `anordnung` `reihe` oder `gruppiert`. `seite` `wert` oder `rueck` (nur Münzen). `massstab`: `original` (Münzen in echten mm, in Originalgröße drucken) oder Faktor 0,3 bis 1, Standard 0,5. Münzen haben echte Größenverhältnisse. Scheine sind schematisch, tragen „Spielgeld“ und bleiben höchstens 75 % groß (EZB/2013/10). Beträge bis Klasse 2 als „3 € 45 ct“, ab Klasse 3 als „3,45 €“. Nie Fotos oder KI-Bilder von echtem Geld.

### `x-skala`: Messgerät

```html
<x-skala art="lineal" von="0" bis="12" wert="7.5" aufgabe="ablesen"></x-skala>
<x-skala art="messbecher" einheit="ml" wert="300" aufgabe="ablesen"></x-skala>
<x-skala art="thermometer" wert="-5" aufgabe="einzeichnen"></x-skala>
<x-skala art="waage" einheit="g" bis="1000" loesung="350"></x-skala>
```

`art`: `lineal` (cm, mm), `massband` (cm, m), `messbecher` (ml, l), `thermometer` (°C, Standard −20 bis 40), `waage` (g, kg). `von`, `bis`, `einheit`, `teilung` (Hauptstrich und Zwischenstrich, z. B. `10 1`). `wert` zeigt den Wert, `loesung` erst im Lösungsblatt. `aufgabe`: `ablesen` (Antwortkästchen), `einzeichnen` (Marke erst in der Lösung). Das Lineal ist in Originalgröße, also in Originalgröße drucken; `massstab="nein"` verkleinert es auf `groesse` und schreibt „nicht zum Messen“ dazu. `groesse` ist sonst die Länge oder der Durchmesser in px.

### `x-strecke`: Strecke zum Messen

```html
<x-strecke laenge="7" beschriftung="A B"></x-strecke>
<x-strecke laenge="45 mm" richtung="schraeg"></x-strecke>
```

`laenge` in cm oder mm, immer in Originalgröße; was nicht auf die Seite passt, meldet das Element. `beschriftung` Buchstaben an den Enden, `richtung` `waagerecht` oder `schraeg`. Die Länge steht im Antwortkästchen der Lösung.

### `x-kalender`: Monat oder Jahr

```html
<x-kalender monat="2" jahr="2028" markiert="14" luecken="8 22" kw="ja"></x-kalender>
<x-kalender art="jahr" jahr="2028"></x-kalender>
```

`art` `monat` oder `jahr` (12 Monate auf einer Seite). Wochen beginnen am Montag, Schaltjahre stimmen. `markiert` Tage mit Ring, `luecken` Tage ohne Zahl; im Jahreskalender als `Monat-Tag`, z. B. `2-14` (dort nur in der Quelle, das Panel zeigt die Tage nur beim Monat). `kw="ja"` Kalenderwochen. Feiertage und Ferien kommen nicht automatisch, sie sind je Land verschieden: über `markiert`.

### `x-zeitspanne`: Zeitspanne am Zeitstrahl

```html
<x-zeitspanne von="8:20" bis="9:45"></x-zeitspanne>
<x-zeitspanne von="8:20" bis="10:00" spruenge="bis 9:00, +1 h" zeige="von spruenge"></x-zeitspanne>
```

Ohne `spruenge` geht es zur vollen Stunde, über die ganzen Stunden und dann zum Ende. Sprünge: `bis 9:00`, `+40 min`, `+1 h`. `zeige` mehrfach: `von`, `bis`, `spruenge`, `dauer`; Standard `von bis`. Bis 24 Stunden; in Klasse 1 und 2 nicht über Mitternacht.

### Uhr: weitere Angaben

```html
<x-uhr zeit="4:30" digital="ja"></x-uhr>
<x-uhr zeit="4:50" sektor="4:30-4:50" minuten="ja"></x-uhr>
<x-uhr loesung="16:30" digital="nur" format="24"></x-uhr>
```

`digital` `nein`, `ja`, `nur`; `format` `24` oder `12`. `sektor` Zeitspanne als Fläche, bis 60 Minuten; `sektor-loesung` erst im Lösungsblatt. `minuten="ja"` äußerer Ring 5, 10, …; `ziffern24="ja"` innerer Ring 13 bis 24.

## Deutsch

Muster: `assets/muster/deutsch.html`.

### `x-lineatur`

```html
<x-lineatur art="2" zeilen="3" vorlage="Rosine" vorlage-zeilen="1" anfang="Ha" loesung="Der Hund bellt."></x-lineatur>
```

`art` `1`, `2`, `3`, `4`, `karo`, `karo-klein`; Maße in `grundschul-didaktik/references/gestaltung.md`. `zeilen` 1 bis 30. `vorlage` grau zum Nachspuren (Schriftgröße folgt dem Mittelband), `vorlage-zeilen` wie viele Zeilen, `anfang` schwarzes Vorbild am Zeilenanfang. `loesung` nur im Lösungsblatt, wird umbrochen und muss in die freien Zeilen passen. `mittelband` `linie` oder `getoent` (nur Farbprofil, nur auf Wunsch). `band` 2 bis 10 mm überschreibt das Mittelband, falls das Heft der Klasse anders misst. `breite` in px, Standard ganze Spalte. Fest in Originalgröße; der Druckhinweis erscheint von selbst. Zu langer Text meldet einen Fehler, gekürzt wird nichts.

### `x-silben`

```html
<x-silben>Die Ro|si|ne ist süß.</x-silben>
<x-silben darstellung="beides" farben="blau rot">Zu|cker</x-silben>
<x-silben aufgabe="boegen">Ta|fel</x-silben>
```

Inhalt: Text mit `|` an den Silbengrenzen; ein Wort ohne `|` ist eine Silbe. Nicht erlaubt: `||`, `|` am Wortanfang oder -ende, andere Zeichen als Buchstaben, Satzzeichen, Leerzeichen. `darstellung` `boegen`, `farbe`, `beides`; im s/w-Profil immer Bögen. `farben` zwei aus `blau`, `rot`, `gruen`, `lila`, `braun`, `schwarz`; je Wort beginnt die erste Farbe neu. `aufgabe` `keine`, `boegen` (Bögen nur im Lösungsblatt), `trennen` (Striche nur im Lösungsblatt). Silbenregeln: `fach-deutsch`.
