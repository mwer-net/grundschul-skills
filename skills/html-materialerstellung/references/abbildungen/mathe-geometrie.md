# Abbildungen: Geometrie

Inhalt: Ebene Geometrie · Räumliche Geometrie

Für die `x-…`-Elemente hier gilt der Kopf des Katalogs `references/abbildungen.md` („Für alle gilt“: Lösung, Farbe, unzulässige Angaben, Attributformate, `seed`, `masstab`).

## Ebene Geometrie

Muster: `assets/muster/ebene-geometrie.html`. Gitter und Figuren mit `masse` sind maßstäblich: beim Anlegen `--druckhinweis "In Originalgröße drucken (100 %)"`.

### `x-gitter`: Karo-, Punkt- und Geobrett-Gitter

```html
<x-gitter spalten="12" zeilen="6" aufgabe="spiegeln" achse="senkrecht" achse-bei="6" figur="0 0 1 / 0 1 1 / 0 0 1"></x-gitter>
<x-gitter spalten="24" zeilen="4" aufgabe="fortsetzen" rapport="4" figur="1 1 0 0 / 1 0 0 0"></x-gitter>
<x-gitter spalten="10" zeilen="8" aufgabe="vergroessern" faktor="2" figur="1 1 / 1 0"></x-gitter>
<x-gitter spalten="10" zeilen="6" aufgabe="weg" start="1,4" weg="3→ 2↑ 1←"></x-gitter>
<x-gitter spalten="10" zeilen="4" zaehlen="flaeche umfang" figur="1 1 / 1 0"></x-gitter>
<x-gitter art="geobrett" spalten="4" zeilen="4" aufgabe="pruefen" linien="0,0 4,2 0,4"></x-gitter>
<x-gitter spalten="6" zeilen="6" aufgabe="pruefen" frage="achsen" achsen-hinweis="2" figur="0 0 0 0 / 0 1 1 0 / 1 1 1 1 / 0 1 1 0"></x-gitter>
```

| Attribut | Bedeutung |
|---|---|
| `art` | `karo` (Standard), `punkte`, `geobrett` |
| `spalten`, `zeilen` | Größe, höchstens Satzspiegelbreite |
| `kaestchen` | Kantenlänge in cm; ohne Angabe wie im Rechenheft: 0,7 cm in Kl. 1, 0,5 cm ab Kl. 2 |
| `figur` | gefüllte Kästchen zeilenweise, `0` leer, `1` voll |
| `linien` | stattdessen Vielecke über Gitterpunkte, `0,0 3,0 3,2`, mehrere mit `;` |
| `aufgabe` | `spiegeln`, `fortsetzen`, `vergroessern`, `weg`, `pruefen`, ohne Angabe keine |
| `achse`, `achse-bei` | `senkrecht` oder `waagerecht`, nach so vielen Kästchen; liegt immer auf einer Gitterlinie |
| `rapport`, `rapporte`, `rapportart` | Breite eines Musters, wie viele vorgegeben sind (2), `schieben`, `spiegeln` oder `drehen` im Wechsel. Die Lösung zeigt zwei weitere |
| `faktor` | `2` oder `0.5`; das Zielgitter steht rechts daneben |
| `weg`, `start`, `wegart` | Schritte wie `3→ 2↑`, Startkästchen `Spalte,Zeile` ab `0,0`, `gehen` oder `beschreiben` (Weg steht da, die Pfeile sind die Antwort) |
| `zaehlen` | `flaeche`, `umfang`: Antwortfelder unter dem Gitter |
| `frage` | nur bei `pruefen`: `ja-nein` (Standard, „Symmetrisch? ja / nein“ zum Ankreuzen) oder `achsen` (die Kinder zeichnen jede Achse ein) |
| `nur` | nur bei `pruefen`: `senkrecht` oder `waagerecht`; es zählt nur diese Achse, und sie steht unter dem Gitter in der Frage. Ohne `nur` zählen alle Achsen, auch die schrägen |
| `achsen-hinweis` | nur bei `frage="achsen"` ohne `nur`: die Zahl der Achsen, dann steht „Zeichne beide Achsen ein.“ unter dem Gitter; sie muss zur Figur passen |

Bei `pruefen` sucht das Element alle Achsen der Figur selbst. Bei Kästchen (`figur`) sind das senkrecht und waagerecht durch die Mitte ihres Rands und beide Diagonalen; bei Linien (`linien`) jede Richtung, auch die schrägen Achsen eines gekippten Quadrats auf dem Geobrett. Die Lösung kreuzt ja oder nein an und zeichnet die Achsen. Fehler: `frage="achsen"` bei einer Figur ohne Achse, `achsen-hinweis` passt nicht zur Figur, `achse` beim Prüfen; im Prüfbericht ein FEHLER, wenn das Gitter `nur` hat und die Anweisung von Symmetrie spricht, die Achse aber nicht nennt.

Die Lösung wird berechnet, nie angegeben. Fehler: Figur kreuzt die Achse, Spiegelbild oder vergrößerte Figur passt nicht, Weg verlässt das Gitter, Umfang bei schrägen Linien, Halbieren ohne volle 2×2-Felder.

### `x-symmetrie-sortieren`: Nach Achsen sortieren

```html
<x-symmetrie-sortieren zeichen="A B E H M O 3 8"></x-symmetrie-sortieren>
<x-symmetrie-sortieren zeichen="A T C F" gruppen="senkrecht waagerecht keine"></x-symmetrie-sortieren>
<x-symmetrie-sortieren gruppen="senkrecht keine" figuren="0 1 0 / 1 1 1; 1 1 / 1 0"></x-symmetrie-sortieren>
```

| Attribut | Bedeutung |
|---|---|
| `zeichen` | Großbuchstaben und Ziffern, mit Leerzeichen getrennt; gesetzt in der Leseschrift |
| `figuren` | Gitterfiguren wie `figur` bei `x-gitter`, mehrere mit `;`; sie stehen nummeriert da, die Kinder schreiben die Nummer in die Spalte |
| `gruppen` | die Spalten, zwei bis vier aus `senkrecht` (nur senkrecht), `waagerecht` (nur waagerecht), `beide`, `keine`; Standard `senkrecht waagerecht beide` |

Die Lösung kommt aus der Tabelle unten, bei Figuren aus der Berechnung wie bei `x-gitter aufgabe="pruefen"`, nie von Hand. Fehler: ein Zeichen, das nicht in der Tabelle steht; ein Eintrag, für den die Spalte fehlt (H braucht `beide`); eine Figur mit nur schrägen Achsen.

<!-- erzeugt: symmetrie-zeichen -->
| Spalte | Buchstaben | Ziffern |
|---|---|---|
| nur senkrecht (`senkrecht`) | A M T U V W Y | – |
| nur waagerecht (`waagerecht`) | B C D E K | 3 |
| beide Achsen (`beide`) | H I O X | 0 8 |
| keine Achse (`keine`) | F G J L N P Q R S Z | 1 2 4 5 6 7 9 |
<!-- /erzeugt: symmetrie-zeichen -->

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

`umriss` `haus`, `katze`, `schiff`, `fisch`, `kerze`; `teile` schon eingezeichnet: `gross1`, `gross2`, `mittel`, `klein1`, `klein2`, `quadrat`, `raute`; `groesse` px je Einheit; `bogen="ja"` Quadrat von 12 cm zum Ausschneiden. Die Lösung zeigt alle sieben Teile in einer gültigen Lage. Andere Umrisse: als [freies Element](#freies-element), siehe das Tangram dort; `umriss` bleibt bei dieser Liste.

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

Fehler: Frage ist zugleich Vorgabe; Fragen ohne Schrägbild oder Bauplan; nach Bauplan oder Anzahl gefragt, während das Schrägbild einen Würfel verdeckt und `verdeckt` nicht `zeigen` ist.

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
