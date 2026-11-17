# Abbildungen: Sachunterricht

Für die `x-…`-Elemente hier gilt der Kopf des Katalogs `references/abbildungen.md` („Für alle gilt“: Lösung, Farbe, unzulässige Angaben, Attributformate, `seed`, `masstab`).

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
