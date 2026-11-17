# Abbildungen: Zahlen und Rechnen

Inhalt: Grundelemente · Zahldarstellungen · Rechenformate · Einmaleins und schriftliches Rechnen

Für die `x-…`-Elemente hier gilt der Kopf des Katalogs `references/abbildungen.md` („Für alle gilt“: Lösung, Farbe, unzulässige Angaben, Attributformate, `seed`, `masstab`).

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

### Uhr: weitere Angaben

```html
<x-uhr zeit="4:30" digital="ja"></x-uhr>
<x-uhr zeit="4:50" sektor="4:30-4:50" minuten="ja"></x-uhr>
<x-uhr loesung="16:30" digital="nur" format="24"></x-uhr>
```

`digital` `nein`, `ja`, `nur`; `format` `24` oder `12`. `sektor` Zeitspanne als Fläche, bis 60 Minuten; `sektor-loesung` erst im Lösungsblatt. `minuten="ja"` äußerer Ring 5, 10, …; `ziffern24="ja"` innerer Ring 13 bis 24. `ziffern="nein"` ohne die Ziffern 1 bis 12.

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

Muster: `assets/muster/rechenformate.html`. Die Lösung wird immer berechnet. Ob sich jedes offene Feld eindeutig ergibt, prüft das Element; sonst FEHLER. Der Zahlenraum der Klasse (kl1 20, kl2 100, kl3 1 000, kl4 1 000 000) ist der Normalfall; darüber wird gezeichnet, die Prüfung meldet eine WARNUNG. Nur für starke Kinder bewusst überschreiten. Unter 0, über 1 000 000 oder keine ganze Zahl: FEHLER. `offen` listet leere Felder; ohne Angabe gilt der Standard des Elements.

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

### `x-rechenreihe`: Rechenpäckchen

```html
<x-rechenreihe rechenart="+" zahlenraum="20" anzahl="8" uebergang="mit"></x-rechenreihe>
<x-rechenreihe aufgaben="7 + _ = 12; 3 + 4 = _; _ · 7 = 28; 17 : 5 = _"></x-rechenreihe>
```

`aufgaben` hält die Rechnungen, je mit genau einem `_`; die Lösung wird immer berechnet, `17 : 5 = _` ergibt „3 R 2“. Ohne `aufgaben` entstehen sie aus den Einstellungen und dem `seed`. `rechenart` `+`, `−`, `·`, `:`. `zahlenraum` 10, 20, 100, 1000, 1000000; welcher zur Klasse passt, steht in `fach-mathematik`. `anzahl` 1 bis 60, `spalten` 1 bis 4. `uebergang` `egal`, `mit`, `ohne` (nur Plus und Minus; `3 + 7` zählt als ohne). `platzhalter` `ergebnis`, `erste`, `zweite`, `gemischt`. `beziehung` `keine`, `tausch`, `umkehr`. `reihe` 1 bis 10 für Einmaleins-Reihen. `rest="1"` beim Teilen. Findet der Generator zu wenige verschiedene Aufgaben, meldet das Element es.

## Einmaleins und schriftliches Rechnen

Muster: `assets/muster/einmaleins-und-schriftlich.html`. Lösung und Teilergebnisse werden immer berechnet. Über dem Zahlenraum der Klasse meldet die Prüfung eine WARNUNG (siehe Rechenformate).

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
- `verfahren` bei Minus Pflicht: `abziehen-entbuendeln`, `abziehen-erweitern`, `ergaenzen-entbuendeln`, `ergaenzen-erweitern`. Entbündeln zeigt die neuen Ziffern über den durchgestrichenen, Erweitern die Überträge unter dem Subtrahenden. Abziehen und Ergänzen sehen im Blatt gleich aus und unterscheiden sich in der Sprechweise.
- `uebertrag` `zeile` (Standard) oder `keine`. Beim Malnehmen hat jedes Teilprodukt eine eigene Übertragszeile über sich; die Teilprodukte beginnen beim höchsten Stellenwert des zweiten Faktors und tragen ihre Nullen.
- `zeige` mehrfach: `aufgabe`, `uebertraege`, `ergebnis`; Standard `aufgabe`. Das Lösungsblatt zeigt alles, bei Geteilt mit allen Zwischenschritten und Rest.
- `fehlerhaft="ja"` zeigt die Rechnung mit genau einem typischen Fehler (Übertrag vergessen, Stelle verrutscht, falsch herum gerechnet; bei Geteilt Rest oder Null vergessen), `seed` wählt ihn. Die Lösung kreist die falsche Ziffer ein, schreibt die richtige darunter und nennt den Fehler. Lässt sich keiner einbauen (ohne Übertrag und kürzere Zahl), meldet das Element das.

Der Bildungsplan BW nennt für Klasse 3/4 alle vier Verfahren im Zahlenraum bis 1 000 000, Subtraktion als „Abziehen oder Ergänzen“, Division auch mit Rest, und begrenzt weder Stellenzahl noch Divisor. Die Grenzen hier sind Vorgaben der Schoolbox.
