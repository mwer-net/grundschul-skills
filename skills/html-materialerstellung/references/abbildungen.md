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

### `x-dienes`: Zehnerstangen und Einerwürfel

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
