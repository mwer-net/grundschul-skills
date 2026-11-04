# Katalog der Abbildungen

Alle `x-…`-Elemente aus `assets/abbildungen.js`. Sie sind berechnet, nie von Hand gezeichnet und nie KI-Bilder. Vollständige Beispiele im Blatt: `assets/muster/`.

**Für alle gilt:**

- Lösung erscheint nur auf dem Lösungsblatt und im Beispiel (`class="beispiel"` am Container).
- Farbe aus der Palette, Text bleibt schwarz. In der s/w-Ansicht zeichnen die Elemente selbst mit Schwarz, Grau, Form und Muster.
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

`von` und `bis`, `schritt` Abstand der Striche, `zahlen` beschriftete Zahlen, `pfeile` Pfeile mit Antwortkästchen (Zahl nur in der Lösung), `breite` in px, `schrift` Größe der Zahlen. Fehler: `bis` nicht größer als `von`, Schritt nicht passend.

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

s/w: Muster und Legende (das Kästchen zeigt das Muster zur Farbe); ohne Legende nicht zu lesen. Jedes Feld mindestens 20°, sonst Fehler. Eine Beschriftung erscheint nur, wenn sie in das Feld passt.

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

Muster: `assets/muster/zahldarstellungen.html`. Stellenfarben der Klasse: einmal am `<body>`, zum Beispiel `data-stellenfarben="E:blau Z:rot H:gruen"`. Sie gelten nur in Farbe, als schmale Kopfleiste in der Stellentafel und an deren Plättchen.

Erweiterungen der Grundelemente: `x-zwanzigerfeld` `art` (`fuenfer`, `zehner`, `zwanziger`), `n2` zweite Sorte, `loesung="5 2"`. `x-dienes` `t`, `h`, `loesung="1 2 3 4"` (T H Z E). `x-stellentafel` bis `M HT ZT T H Z E`, `art="plaettchen"` mit `plaettchen="3 0 12"` (bis 15 je Stelle), auch in `loesung`. `x-zahlenstrahl` `marken` mittlere Striche alle so viele Schritte; Ausschnitte wie 3400 bis 3500 ohne Null. `x-stellentafel` `zeilen` Anzahl der Zeilen. `x-dienes`, `x-strichpunkt` und `x-zwanzigerfeld` `groesse` Maß in px.

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

### `x-rechenreihe`

```html
<x-rechenreihe rechenart="+" zahlenraum="20" anzahl="8" uebergang="mit"></x-rechenreihe>
<x-rechenreihe aufgaben="7 + _ = 12; 3 + 4 = _; _ · 7 = 28; 17 : 5 = _"></x-rechenreihe>
```

`aufgaben` hält die Rechnungen, je mit genau einem `_`; die Lösung wird immer berechnet, `17 : 5 = _` ergibt „3 R 2“. Ohne `aufgaben` entstehen sie aus den Einstellungen und dem `seed`. `rechenart` `+`, `−`, `·`, `:`. `zahlenraum` 10, 20, 100, 1000, 1000000; welcher zur Klasse passt, steht in `fach-mathematik`. `anzahl` 1 bis 60, `spalten` 1 bis 4. `uebergang` `egal`, `mit`, `ohne` (nur Plus und Minus; `3 + 7` zählt als ohne). `platzhalter` `ergebnis`, `erste`, `zweite`, `gemischt`. `beziehung` `keine`, `tausch`, `umkehr`. `reihe` 1 bis 10 für Einmaleins-Reihen. `rest="1"` beim Teilen. Findet der Generator zu wenige verschiedene Aufgaben, meldet das Element es.

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

`digital` `nein`, `ja`, `nur`; `format` `24` oder `12`. `sektor` Zeitspanne als Fläche, bis 60 Minuten; `sektor-loesung` erst im Lösungsblatt. `minuten="ja"` äußerer Ring 5, 10, …; `ziffern24="ja"` innerer Ring 13 bis 24. `ziffern="nein"` ohne die Ziffern 1 bis 12.

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

`punkte` ist `x,y: Wort` in Prozent des Bilds. `darstellung`: `linien` (Standard, Wörter außerhalb des Bilds, Linien kreuzen sich nicht), `nummer`. Höchstens 6 Punkte je Bildhälfte. `wortspeicher="1"` zeigt die Wörter sortiert. In der Schoolbox setzt die Lehrkraft die Punkte mit Maus oder Finger aufs Bild. Lösung: Wörter eingetragen.

### `x-schreibrahmen`

```html
<x-schreibrahmen satzanfaenge="Zuerst; Dann; Am Ende" wortspeicher="Samen; Blume"></x-schreibrahmen>
<x-schreibrahmen planung="1" linien="1" lineatur="3" satzanfaenge="Ich sehe" beispiel="Ich sehe einen Hund."></x-schreibrahmen>
```

`satzanfaenge` mit `;` getrennt, bis 10. `linien` je Satz 1 bis 6 (Standard 2). `lineatur` `1` bis `4`; ohne Angabe folgt sie der Klasse. `planung="1"` setzt Einleitung, Hauptteil und Schluss davor. `beispiel` steht nur auf dem Lösungsblatt.

## Deutsch

Muster: `assets/muster/deutsch.html`.

### `x-lineatur`

```html
<x-lineatur art="2" zeilen="3" vorlage="Rosine" vorlage-zeilen="1" anfang="Ha" loesung="Der Hund bellt."></x-lineatur>
```

`art` `1`, `2`, `3`, `4`, `karo`, `karo-klein`; Maße in `grundschul-didaktik/references/gestaltung.md`. `zeilen` 1 bis 30. `vorlage` grau zum Nachspuren (Schriftgröße folgt dem Mittelband), `vorlage-zeilen` wie viele Zeilen, `anfang` schwarzes Vorbild am Zeilenanfang. `loesung` nur im Lösungsblatt, wird umbrochen und muss in die freien Zeilen passen. `mittelband` `linie` oder `getoent` (nur in Farbe, nur auf Wunsch). `band` 2 bis 10 mm überschreibt das Mittelband, falls das Heft der Klasse anders misst. `breite` in px, Standard ganze Spalte. Fest in Originalgröße; der Druckhinweis erscheint von selbst. Zu langer Text meldet einen Fehler, gekürzt wird nichts.

### `x-silben`

```html
<x-silben>Die Ro|si|ne ist süß.</x-silben>
<x-silben darstellung="beides" farben="blau rot">Zu|cker</x-silben>
<x-silben aufgabe="boegen">Ta|fel</x-silben>
```

Inhalt: Text mit `|` an den Silbengrenzen; ein Wort ohne `|` ist eine Silbe. Nicht erlaubt: `||`, `|` am Wortanfang oder -ende, andere Zeichen als Buchstaben, Satzzeichen, Leerzeichen. `darstellung` `boegen`, `farbe`, `beides`; in s/w immer Bögen. `farben` zwei aus `blau`, `rot`, `gruen`, `lila`, `braun`, `schwarz`; je Wort beginnt die erste Farbe neu. `aufgabe` `keine`, `boegen` (Bögen nur im Lösungsblatt), `trennen` (Striche nur im Lösungsblatt). Silbenregeln: `fach-deutsch`.

Im Fließtext: `<x-silben im-text>Ro|si|ne</x-silben>` bleibt in der Zeile.

### Zeilennummern im Lesetext

```html
<p class="text" data-zeilennummern="5">Text des Lesetexts …</p>
```

`data-zeilennummern`: `1` jede Zeile, `5` alle 5 Zeilen. Der Browser zählt beim Zeichnen die echten Zeilen, über alle Absätze und Seiten des Dokuments. Keine Nummern von Hand setzen.

### `x-gesamtpunkte`

```html
<x-gesamtpunkte></x-gesamtpunkte>
```

Zählt die `.punkte` aller Aufgaben ohne Sternchenaufgaben, also auch nach Umstellen und Löschen richtig. Am `<body>` blendet die Klasse `ohne-punkte` Punkte und Gesamtpunkte aus.

### `x-notenschluessel`

```html
<x-notenschluessel></x-notenschluessel>
<x-notenschluessel grenzen="1:90; 2:75; 3:60; 4:45; 5:20" gesamt="20"></x-notenschluessel>
```

`grenzen`: Prozent für Note 1 bis 5, von oben nach unten kleiner. Ohne `grenzen` gilt der Vorschlag, und das Blatt sagt das. `gesamt`: feste Summe; ohne sie zählt das Blatt wie `x-gesamtpunkte`.

### `x-notenspiegel`

```html
<x-notenspiegel></x-notenspiegel>
```

Leere Verteilung und Durchschnitt zum Eintragen. Nie mit Namen von Kindern.

### `x-unterschrift`

```html
<x-unterschrift felder="beides" text="Unterschrift"></x-unterschrift>
```

`felder`: `beides`, `datum`, `unterschrift`. `text`: Beschriftung der Unterschrift.

### `x-erwartungshorizont`

```html
<x-erwartungshorizont></x-erwartungshorizont>
```

Erscheint nur in der Lösung. Sammelt je Aufgabe `data-l`, `loesung`, `nur-loesung` und Lücken, dazu die Punkte; `data-afb="I"` an der `.aufgabe` ergibt die Spalte Bereich. Rechnet das Blatt anderes (etwa `x-zuordnen`), steht dort „siehe Lösungsblatt“.

### `x-wortarten`

```html
<x-wortarten aufgabe="bestimmen" nur="N V">Der/Art Hund/N bellt/V laut/A.</x-wortarten>
```

Inhalt: Kürzel mit `/` am Wort; Wörter ohne Kürzel bleiben ohne Zeichen. Kürzel: `N` Nomen, `Art` Artikel, `V` Verb, `A` Adjektiv, `P` Pronomen, `Pr` Präposition, `K` Konjunktion, `Adv` Adverb. `darstellung` `symbole` (Montessori-Formen unter dem Wort) oder `unterstreichen` (Linienart je Wortart). `nur` Kürzel, die gezeigt werden. `farben` Klassenfarben, z. B. `N: blau; V: rot` (blau, rot, gruen, lila, braun, schwarz, hellblau, rosa, orange); wirkt nur in Farbe. `aufgabe` `keine` oder `bestimmen` (leere Symbolplätze, Symbole und Linien nur im Lösungsblatt).

### `x-satzglieder`

```html
<x-satzglieder aufgabe="umstellen">[Der Hund]S [bellt]P [den Briefträger]AkO [an]P.</x-satzglieder>
```

Inhalt: Satzglieder in eckigen Klammern mit Rolle `S`, `P`, `AkO`, `DaO`, `Ort`, `Zeit`; das Prädikat darf zweiteilig sein. `aufgabe` `keine` (Rollen über den Kästchen), `bestimmen`, `umstellen` (leere Kästchen, Umstellung nur im Lösungsblatt), `fragen` („Wen oder was?“). `vorn` Rolle, die beim Umstellen nach vorn kommt; Standard das nächste Satzglied. `ausschneiden="ja"` Satzstreifen mit gestricheltem Rand.

Die Umstellung setzt das finite Verb an die zweite Stelle, die Verbpartikel ans Ende und passt die Großschreibung an. Nur Sätze mit dem Prädikat an zweiter Stelle, keine Fragen. Am Satzanfang schreibt sie Artikel, Pronomen, Präpositionen und Zeitwörter klein, ebenso ein Wort mit Adjektivendung vor einem Nomen; Nomen und Namen bleiben groß. **Prüfe die Lösung bei Doppelnamen auf -e, -er oder -en (`Peter Müller`)**: Sie würden klein; stelle solche Sätze um oder wähle einen anderen Satz.

### `x-wortbausteine`

```html
<x-wortbausteine stamm="fahr" aufgabe="zerlegen">ver|fahr|en</x-wortbausteine>
<x-wortbausteine art="familie" aufgabe="familie" woerter="Fahrer; Abfahrt; fahren">fahr</x-wortbausteine>
```

Inhalt: Bausteine mit `|`, ein Wort ohne Leerzeichen; bei `art="familie"` nur der Stamm. `stamm` muss einer der Bausteine sein. `woerter` 1 bis 8 Wörter der Familie um den Stamm. `aufgabe` bei `wort`: `keine`, `zerlegen` (Kästchen nur im Lösungsblatt), `zusammensetzen` (Wort nur im Lösungsblatt); bei `familie`: `keine`, `familie` (Wörter nur im Lösungsblatt).

## Sachunterricht

Muster: `assets/muster/sachunterricht.html`, Wetterbogen: `assets/muster/wetterbogen.html` und `wetterbogen-klein.html` (Kl. 1/2, nur Symbole).

### `x-zeitleiste`

```html
<x-zeitleiste von="1900" bis="2020" schritt="10" ereignisse="1914: Krieg beginnt; 1900-1914: Kaiserzeit; 1969: Mondlandung: offen"></x-zeitleiste>
<x-zeitleiste art="leben" von="0" bis="10" schritt="1" ereignisse="0: Geburt; 6: Schule: offen"></x-zeitleiste>
```

Maßstäblich: eine feste Länge je Jahr. `art` `jahre` oder `leben` (Alter statt Jahreszahlen). `von`, `bis`; Jahre vor Christus mit Minus (`-500`), ein Jahr 0 gibt es nicht. `schritt` Abstand der Markierungen; die Jahreszahlen dünnen sich aus, wenn sie nicht passen. `ereignisse` `Jahr: Text` oder `Von-Bis: Text` (Zeitraum als Balken); `: offen` am Ende lässt die Kinder eintragen: leeres Kästchen, Lösung nur im Lösungsblatt, die Texte stehen darunter als Liste zum Zuordnen (`ereignisliste="nein"` lässt sie weg). `breite` in px, auch über den Satzspiegel hinaus für Plakate. Liegen Ereignisse zu dicht, kommt ein Fehler.

### `x-jahreskreis`

```html
<x-jahreskreis jahreszeiten="ja" markiert="Juli"></x-jahreskreis>
<x-jahreskreis art="tag" beschriftung="leer" groesse="240"></x-jahreskreis>
```

Beginnt oben, im Uhrzeigersinn. `art` `jahr` (Januar oben), `woche`, `tag` (vier Tageszeiten), `stunden` (24 Stunden). `beschriftung` `voll` oder `leer` (Namen nur im Lösungsblatt). `jahreszeiten="ja"` nur bei `jahr`: äußerer Ring, meteorologisch (Frühling = März bis Mai), mit Legende. `markiert` Namen der Segmente, in s/w schraffiert. `groesse` in px, 200 bis 1200; für 12 Monate mindestens etwa 240.

### `x-windrose`

```html
<x-windrose richtungen="8" beschriftung="norden"></x-windrose>
```

`richtungen` `4` oder `8`, deutsche Kürzel N, O, S, W und NO, SO, SW, NW. `beschriftung` `voll`, `norden` (nur N, Rest leere Kästchen) oder `leer`; die leeren Kästchen füllt nur das Lösungsblatt. `groesse` in px.

### `x-plan`

```html
<x-plan spalten="6" zeilen="4" boden="wasser wald leer strasse leer leer / wasser leer leer strasse leer leer" objekte="schule: E2; baum: B1 C1" massstab="1 Kästchen = 100 m" nordpfeil="ja" aufgabe="finden"></x-plan>
<x-plan art="raum" spalten="7" zeilen="4" objekte="tafel: D1; tuer: A1; tisch: B3 C3"></x-plan>
```

Draufsicht im Gitter, Planquadrate A, B, C … waagerecht und 1, 2, 3 … senkrecht (`planquadrate="nein"` lässt sie weg). `art` `ort` oder `raum`. `boden` Raster mit `leer`, `strasse`, `wasser`, `wald`, `wiese`, `platz`. `objekte` `Symbol: Planquadrate`, je Planquadrat ein Symbol. Symbole `ort`: `schule`, `kirche`, `rathaus`, `bahnhof`, `bushaltestelle`, `spielplatz`, `haus`, `baum`, `bruecke`, `post`, `krankenhaus`, `parkplatz`; `raum`: `tisch`, `stuhl`, `tafel`, `tuer`, `fenster`, `schrank`, `teppich`. Die Legende entsteht von selbst (`legende="nein"` lässt sie weg). `kaestchen` in cm, mindestens 0,8. `massstab` genau `1 Kästchen = 100 m`: Leiste von einem Kästchen, Druckhinweis „Originalgröße“. `nordpfeil="ja"`. `aufgabe` `keine`, `finden` (Planquadrate nur im Lösungsblatt), `einzeichnen` (Symbole nur im Lösungsblatt), `weg` mit `weg="A1 A2 B2"` (benachbarte Planquadrate; Start S und Ziel Z stehen da, die Linie nur im Lösungsblatt).

### `x-schaltplan`

```html
<x-schaltplan teile="batterie schalter:offen lampe" aufgabe="leuchtet"></x-schaltplan>
<x-schaltplan teile="batterie lampe" zweig="kabel" aufgabe="leuchtet"></x-schaltplan>
<x-schaltplan art="bild" teile="batterie schalter:zu lampe" aufgabe="vervollstaendigen"></x-schaltplan>
```

Schaltzeichen nach DIN EN 60617 in Schulbuchform. `teile`: `batterie` (mindestens eine), `schalter:offen`, `schalter:zu`, `lampe`, `motor`, `summer`, `kabel`, Leiter `eisen`, `kupfer`, `alufolie`, Nichtleiter `holz`, `gummi`, `plastik`, `glas`, `papier`. `zweig`: zweiter Zweig, parallel zu allen Teilen außer der Batterie; mehr als zwei Zweige gibt es nicht. `art` `symbole` oder `bild`. `aufgabe`: `keine` (leuchtende Lampe sichtbar), `leuchtet` (Ja und Nein zum Ankreuzen, Lösung kreuzt an), `vervollstaendigen` (Lücke, Lösung zeigt das Kabel), `benennen` (Felder, Lösung nennt die Teile). Das Element rechnet: Ein Zweig leitet, wenn kein Schalter offen ist und kein Nichtleiter drinsteckt; ein leitender Zweig ohne Verbraucher ist ein Kurzschluss, dann bleibt alles dunkel und die Lösung sagt „Kurzschluss: Batterie wird heiß“. Nie selbst festlegen, ob etwas leuchtet.

### `x-kreislauf`

```html
<x-kreislauf stationen="Meer; Wolken; Regen; Fluss" pfeile="verdunsten; ziehen; versickern; münden" offen="3 p1"></x-kreislauf>
<x-kreislauf art="ablauf" stationen="Bohne: bilder/bohne.png; Keimling; Blüte" pfeile="keimt; blüht"></x-kreislauf>
```

`art` `kreis` oder `ablauf`. `stationen`: 3 bis 8, mit Semikolon getrennt, nach dem Doppelpunkt optional ein Bild aus `bilder/`. `pfeile`: Beschriftung je Übergang, mit Semikolon getrennt. `offen`: Nummern leerer Stationen, `p` und Nummer für leere Pfeiltexte; beides füllt nur das Lösungsblatt. Bilder wie jedes Bild (in s/w Strich oder Graustufen).

### `x-verkehrszeichen`

```html
<x-verkehrszeichen nummer="205"></x-verkehrszeichen>
<x-verkehrszeichen nummer="306" ausmalen="ja" groesse="110"></x-verkehrszeichen>
```

Amtliche Zeichen, nie selbst zeichnen oder als KI-Bild. `nummer` (StVO): 101, 102, 136, 138, 205, 206, 220, 237, 239, 240, 250, 254, 267, 274 (zeigt 50), 301, 306, 350, 357. Andere Nummern melden einen Fehler. `groesse` Höhe in px, Standard 90. `ausmalen="ja"`: nur Umriss, das Lösungsblatt zeigt das Zeichen in Farbe bzw. Grau. Das s/w-Blatt zeigt Graustufen, die Form bleibt erkennbar. Herkunft: `assets/bilder/verkehrszeichen/QUELLEN.md`.

### `x-wetter`

```html
<x-wetter symbol="regen" wind="2"></x-wetter>
<x-wetter loesung="heiter"></x-wetter>
```

`symbol` oder `loesung` (erst im Lösungsblatt, davor ein leeres Feld): `sonne`, `heiter`, `wolke`, `regen`, `schnee`, `gewitter`, `nebel`. `wind` 0 bis 3 Striche. `groesse` Standard 60.

### Temperaturverlauf mit `x-diagramm`

```html
<x-diagramm art="linie" werte="Mo: -5; Di: -2; Mi: 0; Do: 3" offen="3 4" von="-10" bis="10" skala="5" einheit="°C"></x-diagramm>
<x-diagramm art="linie" werte="Mo; Di; Mi; Do; Fr" von="-10" bis="30" skala="5" einheit="°C"></x-diagramm>
```

Nur `art="linie"` nimmt Werte unter null; `von` setzt den Skalenbeginn, die Null-Linie ist dann kräftig. `offen`: Punkte erst im Lösungsblatt. Einträge ohne Wert bleiben auch dort leer, z. B. für einen Beobachtungsbogen ohne feste Lösung.

## Rätsel

Muster: `assets/muster/raetsel.html`, `assets/muster/raetsel-kl1.html`. Suchsel, Kreuzworträtsel und Lösungswörter nie von Hand bauen: Die Elemente legen die Wörter und prüfen, dass alles aufgeht. Nur mit Anschlussaufgabe einsetzen (Wörter aufschreiben, Sätze bilden), nicht als bloße Beschäftigung.

### `x-suchsel`

```html
<x-suchsel spalten="10" zeilen="10" woerter="Hund; Katze; Maus"></x-suchsel>
<x-suchsel wortliste="bilder" woerter="dog: bild:bilder/hund.png; cat: bild:bilder/katze.png"></x-suchsel>
```

`woerter` nur Buchstaben; optional hinter `: ` ein Mini-Inhalt für `wortliste="bilder"`. `wortliste` `text`, `bilder`, `keine`. `spalten`, `zeilen` 5 bis 20, Standard 10; Zelle 1 cm (Kl. 1/2), 0,8 cm (Kl. 3/4), also höchstens 16 bzw. 20 Spalten. `richtungen` aus `rechts runter diagonal rueckwaerts`, Standard nach Klasse: Kl. 1 nach rechts, Kl. 2 auch nach unten, ab Kl. 3 auch schräg; rückwärts nur auf Wunsch in Kl. 4. `buchstaben` `gross` oder `wie-geschrieben`, Kl. 1/2 groß. Ä, Ö, Ü sind eine Zelle, ß wird in Großschreibung zu SS. Jedes Wort steht genau einmal im Gitter, deshalb darf kein Wort in einem anderen stecken (`Oma` und `Omas`). `seed` für ein anderes Gitter. Lösung: Rahmen um jedes Wort.

### `x-kreuzwort`

```html
<x-kreuzwort loesungswort="HEFT" eintraege="Damit schreibst du.: STIFT; bild:bilder/stuhl.png: STUHL"></x-kreuzwort>
<x-kreuzwort art="senkrecht" loesungswort="BAUM" eintraege="Du isst sie.: BIRNE; Darin wohnst du.: HAUS; Das Tier bellt.: HUND; Er scheint nachts.: MOND"></x-kreuzwort>
```

`eintraege` Hinweis (Text oder Mini-Inhalt) und Wort, 2 bis 12. `art="kreuz"` legt die Wörter frei und zusammenhängend, sie berühren sich nur an Kreuzungen; `loesungswort` markiert dann passende Felder mit Nummern. `art="senkrecht"` legt die Wörter untereinander, das Lösungswort steht in einer Spalte; es braucht so viele Buchstaben, wie es Wörter sind, und jedes Wort muss seinen Buchstaben enthalten. Findet sich kein Gitter: ein Wort tauschen oder `seed` ändern.

### `x-loesungswort`

```html
<x-loesungswort wort="SONNE" bezug="3" zuordnung="42: S; 64: O; 27: N; 28: N; 45: E" ablenker="24: U; 72: K"></x-loesungswort>
```

Selbstkontrolle zu einer Aufgabe: `bezug` ist die Nummer der Aufgabe auf demselben Blatt, ihre `.antwort` liefern in Reihenfolge die Buchstaben. `zuordnung` hält fest, welches Ergebnis zu welchem Buchstaben gehört, auch mit `bezug`: Nur so fällt auf, wenn sich später eine Lösung ändert („Aufgabe 3, Item 2 hat jetzt die Lösung 48; das Lösungswort stimmt nicht mehr.“). Fehlt sie, nennt die Meldung, was einzutragen ist. Ohne `bezug` nur `wort` und `zuordnung`. `ablenker` sind typische falsche Ergebnisse (±1, Zahlendreher; `fach-mathematik`) mit eigenem Buchstaben. Ein Ergebnis gehört immer zu genau einem Buchstaben.

## Spiele

Muster: `assets/muster/spiele.html`. Bingo, Domino und Spielpläne nie von Hand bauen: Die Elemente mischen, prüfen und legen Folgeseiten selbst an. Ein Element, das mehr als eine Seite füllt, steht allein auf seiner `.seite`; die Folgeseiten (`data-erzeugt`) gehören nicht in die Quelle. FEHLER aus `blatt.py` ernst nehmen: Sie heißen, dass das Spiel so nicht funktioniert.

**Mini-Inhalte** statt Text, in jedem Feld: `uhr:7:30`, `wuerfel:5`, `menge:7`, `geld:2€ 50ct`, `rhythmus:4 8 8 4`, `bild:bilder/katze.png`. Listen trennt `;`, zwei Seiten eines Eintrags trennt `: ` mit Leerzeichen.

### `x-bingo`

```html
<x-bingo felder="3" karten="28" je-seite="2" eintraege="7·8: 56; 6·9: 54; 3·4: 12; 5·6: 30; 8·8: 64; 4·7: 28; 9·3: 27; 6·6: 36; 7·7: 49; 2·9: 18; 8·3: 24; 9·9: 81; 5·7: 35"></x-bingo>
```

`eintraege` Ruf und Feld, ohne `: ` beides gleich. `felder` 3 (Kl. 1), 4 oder 5; `karten` 1 bis 40; `je-seite` 1, 2 oder 4; `frei="ja"` Joker in der Mitte bei ungerader Größe; `rufliste="nein"` ohne Rufliste; `seed` für andere Karten. Nötig sind Felder × Felder + 4 Einträge, alle verschieden. Zwei Karten unterscheiden sich in mindestens zwei Feldern. Feld mindestens 2,5 cm (Kl. 1/2), 2 cm (Kl. 3/4). Die Rufliste enthält alle Einträge in gemischter Reihenfolge und steht auf einer eigenen Seite des Lösungsblatts.

### `x-domino`

```html
<x-domino kette="geschlossen" paare="7·8: 56; 6·9: 54; 3·4: 12; 5·6: 30; 8·8: 64; 4·7: 28; 9·3: 27; 6·6: 36; 7·7: 49; 2·9: 18; 8·3: 24; uhr:7:30: halb 8"></x-domino>
```

`paare` Aufgabe und Lösung, 12 bis 24. `kette` `geschlossen` (der erste Stein trägt die Lösung des letzten) oder `offen` (mit „Start“ und „Ende“, ein Stein mehr). `je-seite` gerade Zahl bis 16, Standard 12; `rueckseite="nummer"` zeigt die Nummer auf jedem Stein, zur Selbstkontrolle; `seed` für eine andere Lage. Keine Lösung doppelt, keine Lösung gleich einer Aufgabe. Auf dem Blatt gemischt, auf dem Lösungsblatt in Kettenfolge mit Nummern.

### `x-spielplan`

```html
<x-spielplan felder="30" form="schlange" inhalt="; 7+8; ?; +3; ★" leitern="3-14; 17-5" loesungen="2: 15"></x-spielplan>
<x-spielplan art="lernlandkarte" inhalt="Ich kann bis 100 zählen.; Ich kann zum Zehner ergänzen."></x-spielplan>
```

`felder` 20 bis 40; `form` `schlange`, `spirale`, `rundweg`, `leiter`. `inhalt` je Feld ab Feld 1, leere Einträge zählen mit; Feld 1 und das letzte tragen `start` und `ziel`. Sonderfelder `?`, `★`, `+3`, `−2`. `leitern` von-bis; rückwärts ist es eine Rutsche (gestrichelt); auf einem Feld endet höchstens eine, eine Leiter kreuzt höchstens eine andere. `loesungen` `Feld: Lösung` als Kontrollkarte auf dem Lösungsblatt. Passt der Weg nicht, meldet das Element einen Fehler: weniger Felder oder `a4-quer`, `a3-hoch`. `art="lernlandkarte"`: `inhalt` sind 2 bis 12 Ich-kann-Ziele, je Station drei Kreise zum Anmalen.

## Musik

Muster: `assets/muster/musik.html`. Noten nie als Text oder KI-Bild setzen: Das Element balkt, setzt die Hälse und prüft die Takte.

### `x-rhythmus`

```html
<x-rhythmus art="karte" takt="2/4" noten="4 8 8" silben="ta"></x-rhythmus>
<x-rhythmus takt="4/4" noten="4 8 8 4 r4 | 8 8 8 8 2" aufgabe="silben"></x-rhythmus>
<x-rhythmus art="grafisch" takt="4/4" noten="4 8 8 2"></x-rhythmus>
```

`takt` `2/4`, `3/4`, `4/4`. `noten` wie in LilyPond: `1`, `2`, `4`, `8`, Punkt (`2.`, `4.`), Pause mit `r` (`r4`), Takte mit `|`. Jeder Takt muss aufgehen, sonst FEHLER mit Taktnummer; `auftakt="ja"` erlaubt einen kürzeren ersten und letzten Takt. Keine Sechzehntel und Triolen. `art` `zeile`, `karte` (genau ein Takt, Notenkopf 8 mm) oder `grafisch` (Strich und Punkt, Pausen als Lücke, Kl. 1/2). `silben` `keine`, `ta` (ta, ti, ta-a) oder die Silben der Klasse mit Leerzeichen, eine je klingende Note. `aufgabe` `keine`, `silben` (Felder, Lösung nennt sie), `noten` (Silben gegeben, Noten im Lösungsblatt), `ergaenzen` (`offen`: Nummern der fehlenden Noten, ohne Angabe die letzte). `linie="ja"` zieht die Rhythmuslinie. Im Kartenbogen breite Takte auf `--spalten:1` setzen: Eine Karte mit acht Achteln braucht rund 12 cm.

### `x-noten`

```html
<x-noten takt="4/4" noten="c'4 d'4 e'4 f'4 | g'2 g'2" namen="ja"></x-noten>
<x-noten takt="3/4" noten="g'4 a'4 h'4 | c''2." aufgabe="zeichnen"></x-noten>
<x-noten systeme="4"></x-noten>
```

`noten` mit Tonhöhe, Oktaven mit Strichen: `c'` bis `h'`, `c''` bis `a''`; mehr geht nicht. Deutsche Namen: `h` ist die weiße Taste über `a` (`b` meint dasselbe, ein erniedrigtes h kommt über die Vorzeichnung). `namen="ja"` Notennamen darunter. `text` Liedsilben mit Leerzeichen, eine je Note. `aufgabe` `keine`, `benennen` (Felder, Lösung nennt die Namen), `zeichnen` (Namen gegeben, Noten im Lösungsblatt). `systeme` leere Notenzeilen. `vorzeichen` `keine`, `b` (F-Dur), `kreuz` (G-Dur), ab Kl. 4. `auftakt`, `takt` und `breite` wie oben; zu lange Stücke brechen nach einem Takt um.
